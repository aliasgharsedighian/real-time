import { api } from "@/shared/lib/api";
import { useSessionStore } from "@/features/auth/session-store";
import { ensureServiceWorker } from "@/shared/lib/register-service-worker";
import { firebaseConfig, pushConfigured, vapidKey } from "./config";
import type { ChatNotification } from "./types";

export function bounded<T>(promise: Promise<T>, ms = 10_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Notification service unavailable")), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

export function installationId() {
  let id = localStorage.getItem("batgram-push-installation");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("batgram-push-installation", id);
  }
  return id;
}
export function preference(userId: number) {
  try { return localStorage.getItem(`batgram-push-enabled-${userId}`) === "true"; }
  catch { return false; }
}
export function setPreference(userId: number, enabled: boolean) {
  localStorage.setItem(`batgram-push-enabled-${userId}`, String(enabled));
}
export function browserSupportsPush() {
  return window.isSecureContext && "Notification" in window &&
    "serviceWorker" in navigator && "PushManager" in window;
}

export async function workerMessage(message: unknown) {
  const registration = await ensureServiceWorker();
  const worker = registration.active;
  if (!worker) throw new Error("Notification worker unavailable");
  const channel = new MessageChannel();
  try {
    await bounded(new Promise<void>((resolve, reject) => {
      channel.port1.onmessage = (event) => event.data?.ok ? resolve() : reject(new Error("Notification worker failed"));
      worker.postMessage(message, [channel.port2]);
    }), 2000);
  } finally { channel.port1.close(); }
}

// Firebase is loaded only for opted-in browsers; no Analytics or external script tags.
export async function connectBrowserPush(onMessage: (data: unknown) => void, current: () => boolean) {
  if (!pushConfigured || !browserSupportsPush() || Notification.permission !== "granted")
    throw new Error("Browser notifications are not configured or allowed");
  const [appSdk, messagingSdk, registration] = await bounded(Promise.all([
    import("firebase/app"), import("firebase/messaging"), ensureServiceWorker(),
  ]));
  if (!(await bounded(messagingSdk.isSupported())) || !current()) throw new Error("Notifications unavailable");
  const app = appSdk.getApps().find((entry) => entry.name === "batgram-notifications") ||
    appSdk.initializeApp(firebaseConfig, "batgram-notifications");
  const messaging = messagingSdk.getMessaging(app);
  const stop = messagingSdk.onMessage(messaging, (payload) => onMessage(payload.data));
  try {
    const token = await bounded(messagingSdk.getToken(messaging, { vapidKey, serviceWorkerRegistration: registration }));
    if (!current()) { stop(); return () => {}; }
    const identity = useSessionStore.getState().tokens?.refreshToken;
    await api.put("notifications/subscription", { token, installationId: installationId() }, {
      _sessionIdentity: identity, timeout: 8000,
    });
    if (!current()) { stop(); return () => {}; }
    return stop;
  } catch (error) { stop(); throw error; }
}

export async function disableBrowserPush(userId: number) {
  setPreference(userId, false);
  // This local binding is cleared even if either Google or our API is unreachable.
  await workerMessage({ type: "notification:bind", userId: String(userId), enabled: false }).catch(() => {});
  await api.delete(`notifications/subscription/${installationId()}`, { timeout: 5000 }).catch(() => {});
}

export async function clearNotificationSession() {
  await workerMessage({ type: "notification:bind", userId: null, enabled: false }).catch(() => {});
  await api.delete(`notifications/subscription/${installationId()}`, { timeout: 3000 }).catch(() => {});
}

export async function deliverThroughWorker(data: ChatNotification) {
  await workerMessage({ type: "notification:deliver", data });
}

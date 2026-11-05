import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useSession } from "@/features/auth/session-context";
import { useSessionStore } from "@/features/auth/session-store";
import { getSocket } from "@/features/chat/socket";
import { api } from "@/shared/lib/api";
import { NotificationContext, type PushStatus } from "./context";
import { NotificationCard } from "./NotificationCard";
import { pushConfigured } from "./config";
import {
  browserSupportsPush, connectBrowserPush, deliverThroughWorker, disableBrowserPush,
  preference, setPreference, workerMessage,
} from "./browser-push";
import { isChatNotification, type ChatNotification } from "./types";

interface Notice { data: ChatNotification; count: number; expiresAt: number }
function currentChatId() {
  return /^\/dashboard\/websocket\/(\d+)\/?$/.exec(window.location.pathname)?.[1] || null;
}
function isActive() {
  return document.visibilityState === "visible" && document.hasFocus();
}

export default function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const userId = user!.id;
  const identity = useSessionStore((s) => s.tokens?.refreshToken);
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState<PushStatus>("off");
  const [notices, setNotices] = useState<Notice[]>([]);
  const seen = useRef(new Set<string>());
  const generation = useRef(0);
  const stopPush = useRef<(() => void) | undefined>(undefined);
  const connecting = useRef(false);
  const configured = useRef(false);

  const show = useCallback((value: unknown) => {
    if (!isChatNotification(value) || value.recipientId !== String(userId) ||
      value.senderId === String(userId) || !isActive() || currentChatId() === value.chatId ||
      !useSessionStore.getState().tokens) return;
    if (seen.current.has(value.messageId)) return;
    seen.current.add(value.messageId);
    if (seen.current.size > 500) seen.current.delete(seen.current.values().next().value!);
    setNotices((old) => {
      const existing = old.find((notice) => notice.data.chatId === value.chatId);
      return [{ data: value, count: (existing?.count ?? 0) + 1, expiresAt: Date.now() + 8000 },
        ...old.filter((notice) => notice.data.chatId !== value.chatId)].slice(0, 3);
    });
  }, [userId]);

  const receive = useCallback((value: unknown) => {
    if (!isChatNotification(value) || value.recipientId !== String(userId)) return;
    // The worker arbitrates tabs, suppresses an open chat, and deduplicates socket/FCM.
    void deliverThroughWorker(value).catch(() => show(value));
  }, [show, userId]);

  const start = useCallback(async () => {
    if (connecting.current || !preference(userId)) return;
    if (!configured.current) { setStatus("unconfigured"); return; }
    const epoch = ++generation.current;
    connecting.current = true;
    stopPush.current?.();
    stopPush.current = undefined;
    setStatus("pending");
    const current = () => generation.current === epoch &&
      useSessionStore.getState().tokens?.refreshToken === identity && preference(userId);
    try {
      await workerMessage({ type: "notification:bind", userId: String(userId), enabled: true });
      if (!current()) return;
      const stop = await connectBrowserPush(receive, current);
      if (!current()) { stop(); return; }
      stopPush.current = stop;
      setStatus("enabled");
    } catch {
      if (current()) setStatus("unavailable");
    } finally { connecting.current = false; }
  }, [identity, userId, receive]);

  useEffect(() => {
    let disposed = false;
    const invalidate = () => { generation.current++; };
    void workerMessage({ type: "notification:bind", userId: String(userId), enabled: preference(userId) }).catch(() => {});
    if (!browserSupportsPush()) setStatus("unsupported");
    else if (!pushConfigured) setStatus("unconfigured");
    else {
      void api.get<{ pushConfigured: boolean }>("notifications/config", { timeout: 8000 }).then(({ data }) => {
        if (disposed) return;
        configured.current = data.pushConfigured;
        if (!data.pushConfigured) setStatus("unconfigured");
        else if (Notification.permission === "denied") setStatus("denied");
        else if (preference(userId) && Notification.permission === "granted") void start();
        else setStatus("off");
      }).catch(() => { if (!disposed) setStatus("unavailable"); });
    }
    return () => {
      disposed = true;
      invalidate();
      stopPush.current?.();
      stopPush.current = undefined;
    };
  }, [userId, start]);

  useEffect(() => {
    const socket = getSocket();
    if (socket.connected) socket.emit("notification:presence", { active: isActive(), chatId: Number(currentChatId()) || null });
    setNotices((old) => old.filter((notice) => notice.data.chatId !== currentChatId()));
  }, [location.pathname]);

  useEffect(() => {
    const socket = getSocket();
    const presence = () => {
      if (socket.connected) socket.emit("notification:presence", { active: isActive(), chatId: Number(currentChatId()) || null });
      if (isActive()) setNotices((old) => old.filter((notice) => notice.data.chatId !== currentChatId()));
    };
    const suspended = () => { if (socket.connected) socket.emit("notification:presence", { active: false, chatId: null }); };
    const workerEvent = (event: MessageEvent) => {
      if (event.data?.type === "notification:state") {
        event.ports[0]?.postMessage({
          userId: useSessionStore.getState().tokens?.refreshToken === identity ? String(userId) : null,
          active: isActive(), chatId: currentChatId(),
        });
      }
      if (event.data?.type === "notification:in-app") show(event.data.data);
      if (event.data?.type === "notification:navigate" &&
        event.data.recipientId === String(userId) && /^[1-9]\d*$/.test(event.data.chatId))
        navigate(`/dashboard/websocket/${event.data.chatId}`);
    };
    const removed = ({ chatId }: { chatId: number }) => setNotices(old => old.filter(notice => notice.data.chatId !== String(chatId)));
    const deleted = ({ chatId, messageIds }: { chatId: number; messageIds: number[] }) => setNotices(old => old.filter(notice => notice.data.chatId !== String(chatId) || !messageIds.includes(Number(notice.data.messageId))));
    socket.on("chat:removed", removed);
    socket.on("message:deleted", deleted);
    socket.on("connect", presence);
    socket.on("chat:joined", presence);
    socket.on("notification:new", receive);
    document.addEventListener("visibilitychange", presence);
    window.addEventListener("focus", presence);
    window.addEventListener("blur", presence);
    window.addEventListener("pagehide", suspended);
    navigator.serviceWorker?.addEventListener("message", workerEvent);
    const heartbeat = setInterval(presence, 20_000);
    const expiry = setInterval(() => setNotices((old) => old.filter((notice) => notice.expiresAt > Date.now() && notice.data.chatId !== currentChatId())), 1000);
    presence();
    return () => {
      suspended();
      clearInterval(heartbeat); clearInterval(expiry);
      socket.off("chat:removed", removed);
      socket.off("message:deleted", deleted);
      socket.off("connect", presence); socket.off("chat:joined", presence); socket.off("notification:new", receive);
      document.removeEventListener("visibilitychange", presence);
      window.removeEventListener("focus", presence); window.removeEventListener("blur", presence); window.removeEventListener("pagehide", suspended);
      navigator.serviceWorker?.removeEventListener("message", workerEvent);
    };
  }, [identity, userId, navigate, receive, show]);

  useEffect(() => {
    const retry = () => {
      if (preference(userId) && browserSupportsPush() && Notification.permission === "granted") void start();
    };
    const refresh = setInterval(retry, 60 * 60_000);
    window.addEventListener("online", retry);
    return () => { clearInterval(refresh); window.removeEventListener("online", retry); };
  }, [start, userId]);

  async function enable() {
    if (!browserSupportsPush()) { setStatus("unsupported"); return; }
    try {
      // Called before awaiting network work, preserving the browser's user gesture.
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setStatus(permission === "denied" ? "denied" : "off"); return; }
      setPreference(userId, true);
      if (!configured.current && pushConfigured) {
        const { data } = await api.get<{ pushConfigured: boolean }>("notifications/config", { timeout: 8000 });
        configured.current = data.pushConfigured;
      }
      await start();
    } catch { setStatus("unavailable"); }
  }
  async function disable() {
    generation.current++;
    stopPush.current?.(); stopPush.current = undefined;
    setStatus("off");
    await disableBrowserPush(userId);
  }

  return (
    <NotificationContext value={{ status, enable, disable }}>
      {children}
      <div role="status" aria-live="polite" aria-label="New messages" className="pointer-events-none fixed inset-x-3 top-[max(1rem,env(safe-area-inset-top))] z-[70] ml-auto flex max-w-sm flex-col gap-3 sm:right-5">
        {notices.map(({ data, count }) => <div key={data.chatId} className="pointer-events-auto">
          <NotificationCard notification={data} count={count}
            dismiss={() => setNotices((old) => old.filter((notice) => notice.data.chatId !== data.chatId))}
            open={() => { setNotices((old) => old.filter((notice) => notice.data.chatId !== data.chatId)); navigate(`/dashboard/websocket/${data.chatId}`); }} />
        </div>)}
      </div>
    </NotificationContext>
  );
}

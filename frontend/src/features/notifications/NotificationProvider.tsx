import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast, Toaster } from "sonner";
import { useSession } from "@/features/auth/session-context";
import { useSessionStore } from "@/features/auth/session-store";
import { getSocket } from "@/features/chat/socket";
import { api } from "@/shared/lib/api";
import { listenForSoundActivation, playAppSound } from "@/shared/lib/app-sounds";
import { NotificationContext, type PushStatus } from "./context";
import { NotificationCard } from "./NotificationCard";
import { pushConfigured } from "./config";
import {
  browserSupportsPush, connectBrowserPush, deliverThroughWorker, disableBrowserPush,
  preference, setPreference, workerMessage,
} from "./browser-push";
import { isChatNotification } from "./types";

const messageToaster = "chat-notifications";
interface Notice { id: string; messageId: string; count: number }
function currentChatId() {
  return /^\/dashboard\/websocket\/(\d+)\/?$/.exec(window.location.pathname)?.[1] || null;
}
function isActive() {
  // A visible desktop window can still receive messages while another window has focus.
  return document.visibilityState === "visible";
}

export default function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const userId = user!.id;
  const identity = useSessionStore((s) => s.tokens?.refreshToken);
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState<PushStatus>("off");
  const notices = useRef(new Map<string, Notice>());
  const seen = useRef(new Set<string>());
  const generation = useRef(0);
  const stopPush = useRef<(() => void) | undefined>(undefined);
  const connecting = useRef(false);
  const configured = useRef(false);

  useEffect(listenForSoundActivation, [identity]);

  const dismissChat = useCallback((chatId: string) => {
    const notice = notices.current.get(chatId);
    if (!notice) return;
    notices.current.delete(chatId);
    toast.dismiss(notice.id);
  }, []);

  useEffect(() => {
    const current = notices.current;
    const received = seen.current;
    return () => {
      for (const { id } of current.values()) toast.dismiss(id);
      current.clear();
      received.clear();
    };
  }, [identity]);

  const show = useCallback((value: unknown) => {
    if (!isChatNotification(value) || value.recipientId !== String(userId) ||
      value.senderId === String(userId) || !isActive() || currentChatId() === value.chatId ||
      !identity || useSessionStore.getState().tokens?.refreshToken !== identity) return;
    if (seen.current.has(value.messageId)) return;
    seen.current.add(value.messageId);
    if (seen.current.size > 500) seen.current.delete(seen.current.values().next().value!);
    playAppSound("messageReceived");
    const previous = notices.current.get(value.chatId);
    const id = previous?.id ?? `chat-message-${value.messageId}`;
    const count = (previous?.count ?? 0) + 1;
    const forget = () => {
      if (notices.current.get(value.chatId)?.id === id) notices.current.delete(value.chatId);
    };
    notices.current.delete(value.chatId);
    notices.current.set(value.chatId, { id, messageId: value.messageId, count });
    if (notices.current.size > 3) dismissChat(notices.current.keys().next().value!);

    toast.custom(() => (
      <NotificationCard notification={value} count={count}
        dismiss={() => dismissChat(value.chatId)}
        open={() => {
          dismissChat(value.chatId);
          navigate(`/dashboard/websocket/${value.chatId}`);
        }} />
    ), {
      id,
      toasterId: messageToaster,
      className: "w-[var(--width)]",
      duration: 8000,
      onDismiss: forget,
      onAutoClose: forget,
    });
  }, [dismissChat, identity, navigate, userId]);

  const receive = useCallback((value: unknown) => {
    if (!isChatNotification(value) || value.recipientId !== String(userId)) return;
    // Firebase delivery can race a visibility change, so recheck through the worker.
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
    dismissChat(currentChatId() ?? "");
  }, [dismissChat, location.pathname]);

  useEffect(() => {
    const socket = getSocket();
    const presence = () => {
      if (socket.connected) socket.emit("notification:presence", { active: isActive(), chatId: Number(currentChatId()) || null });
      if (isActive()) dismissChat(currentChatId() ?? "");
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
    const removed = ({ chatId }: { chatId: number }) => dismissChat(String(chatId));
    const deleted = ({ chatId, messageIds }: { chatId: number; messageIds: number[] }) => {
      const notice = notices.current.get(String(chatId));
      if (notice && messageIds.includes(Number(notice.messageId))) dismissChat(String(chatId));
    };
    socket.on("chat:removed", removed);
    socket.on("message:deleted", deleted);
    socket.on("connect", presence);
    socket.on("chat:joined", presence);
    socket.on("notification:new", show);
    document.addEventListener("visibilitychange", presence);
    window.addEventListener("focus", presence);
    window.addEventListener("pageshow", presence);
    window.addEventListener("pagehide", suspended);
    navigator.serviceWorker?.addEventListener("message", workerEvent);
    const heartbeat = setInterval(presence, 20_000);
    presence();
    return () => {
      suspended();
      clearInterval(heartbeat);
      socket.off("chat:removed", removed);
      socket.off("message:deleted", deleted);
      socket.off("connect", presence); socket.off("chat:joined", presence); socket.off("notification:new", show);
      document.removeEventListener("visibilitychange", presence);
      window.removeEventListener("focus", presence); window.removeEventListener("pageshow", presence); window.removeEventListener("pagehide", suspended);
      navigator.serviceWorker?.removeEventListener("message", workerEvent);
    };
  }, [dismissChat, identity, userId, navigate, show]);

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
      <Toaster id={messageToaster} position="top-right" swipeDirections={["top"]}
        visibleToasts={3} expand gap={12} containerAriaLabel="New messages"
        offset={{ top: "max(1rem, env(safe-area-inset-top))", right: 20 }}
        mobileOffset={{ top: "max(1rem, env(safe-area-inset-top))", left: 12, right: 12 }} />
    </NotificationContext>
  );
}

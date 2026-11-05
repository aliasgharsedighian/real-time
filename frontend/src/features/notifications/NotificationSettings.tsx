import { Bell, BellOff } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { useNotifications } from "./context";

export function NotificationSettings() {
  const notifications = useNotifications();
  if (!notifications) return null;
  const { status, enable, disable } = notifications;
  const description = {
    off: "Get browser notifications when you are away from BatGram.",
    enabled: "Browser notifications are enabled on this device.",
    pending: "Connecting to the notification service…",
    denied: "Notifications are blocked. Allow them in your browser's site settings, then retry.",
    unsupported: "This browser cannot receive push notifications. On iPhone, install BatGram on the Home Screen first.",
    unconfigured: "Browser notifications are not available yet. In-app notifications are active.",
    unavailable: "The notification service could not be reached. Your chats still work; you can retry anytime.",
  }[status];
  return (
    <section className="brand-panel mx-auto mt-5 max-w-xl rounded-3xl p-6" aria-labelledby="notification-settings-title">
      <div className="mb-3 flex items-center gap-2 text-brand"><Bell className="size-5" /><h2 id="notification-settings-title" className="font-semibold text-foreground">Notifications</h2></div>
      <p className="mb-4 text-sm leading-relaxed text-muted-foreground" role="status">{description}</p>
      <p className="mb-4 text-xs text-muted-foreground">While you use BatGram, new messages from other chats appear in the app. Your open conversation stays quiet.</p>
      <div className="flex flex-wrap gap-2">
        {status !== "enabled" && <Button onClick={() => void enable()} disabled={["pending", "unsupported", "unconfigured"].includes(status)}><Bell className="size-4" />{status === "unavailable" || status === "denied" ? "Retry notifications" : "Enable browser notifications"}</Button>}
        {["enabled", "unavailable", "pending"].includes(status) && <Button variant="outline" onClick={() => void disable()}><BellOff className="size-4" />Turn off</Button>}
      </div>
    </section>
  );
}

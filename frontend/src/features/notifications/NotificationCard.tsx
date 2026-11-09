import { Image, MessageCircle, Music2, Mic, Users, Video, X } from "lucide-react";
import type { ChatNotification } from "./types";

export function NotificationCard({ notification, count, open, dismiss }: {
  notification: ChatNotification; count: number; open: () => void; dismiss: () => void;
}) {
  const Icon = notification.mediaKind === "IMAGE" ? Image : notification.mediaKind === "VIDEO"
    ? Video : notification.mediaKind === "AUDIO" ? Mic : notification.mediaKind === "MUSIC" ? Music2 : MessageCircle;
  return (
    <article className="brand-panel relative flex w-full items-start gap-3 rounded-2xl border-primary/40 p-4 shadow-[0_12px_50px_#0005,0_0_24px_var(--brand-halo)]">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-brand">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <button type="button" onClick={open} className="min-w-0 flex-1 text-start outline-offset-4" aria-label={`Open conversation: ${notification.title}`}>
        <span className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-brand">
          BatGram <span className="text-muted-foreground">· New message{count > 1 ? `s (${count})` : ""}</span>
        </span>
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          {notification.title !== notification.senderName && <Users className="size-3.5 shrink-0 text-brand" aria-hidden="true" />}
          <span dir="auto" className="truncate">{notification.title}</span>
        </span>
        <span dir="auto" className="mt-1 line-clamp-2 block break-words text-xs leading-relaxed text-muted-foreground">{notification.body}</span>
        <span className="mt-2 block text-xs font-medium text-brand">Open conversation →</span>
      </button>
      <button type="button" onClick={dismiss} aria-label="Dismiss notification" className="-mr-1 -mt-1 flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-brand">
        <X className="size-4" />
      </button>
    </article>
  );
}

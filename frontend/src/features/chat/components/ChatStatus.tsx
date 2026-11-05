import { useSession } from "@/features/auth/session-context";
import { useChatStatus } from "../hooks/use-chat-status";
import { formatPresence } from "../presence";

export function ChatStatus({
  chatId,
  peerId,
  groupLabel,
}: {
  chatId: number;
  peerId?: number;
  groupLabel?: string;
}) {
  const { user } = useSession();
  const status = useChatStatus(chatId, user?.id);
  const typing = groupLabel
    ? status.typing
    : status.typing.filter((entry) => entry.userId === peerId);
  const text =
    typing.length > 0
      ? groupLabel
        ? `${typing.map((entry) => entry.username || "Someone").join(", ")} is typing`
        : "is typing"
      : (groupLabel ??
        formatPresence(peerId ? status.users[peerId] : undefined, status.now));
  return (
    <p
      className="mt-0.5 min-h-4 truncate text-xs text-brand"
      aria-live="polite"
      aria-atomic="true"
      title={text}
    >
      {text}
    </p>
  );
}

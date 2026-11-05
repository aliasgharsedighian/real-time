export interface UserPresence {
  userId: number;
  online: boolean;
  lastSeenAt: string | null;
  lastSeen: "recently" | "week" | "month" | null;
}
export interface ChatPresence {
  chatId: number;
  users: UserPresence[];
}

export function formatPresence(
  value: UserPresence | undefined,
  now = Date.now(),
) {
  if (!value) return "";
  if (value.online) return "online";
  if (value.lastSeen)
    return value.lastSeen === "recently"
      ? "last seen recently"
      : `last seen within a ${value.lastSeen}`;
  if (!value.lastSeenAt) return "last seen recently";
  const then = new Date(value.lastSeenAt);
  const elapsed = Math.max(0, now - then.getTime());
  if (!Number.isFinite(elapsed) || elapsed < 60_000)
    return "last seen recently";
  if (elapsed < 3_600_000)
    return `last seen ${Math.floor(elapsed / 60_000)} min ago`;
  const today = new Date(now);
  // Calendar days, including across DST and local midnight.
  const days = Math.round(
    (Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) -
      Date.UTC(then.getFullYear(), then.getMonth(), then.getDate())) /
      86_400_000,
  );
  if (days === 1) return "last seen yesterday";
  if (days > 1) return `last seen ${days} days ago`;
  return `last seen ${Math.floor(elapsed / 3_600_000)} h ago`;
}

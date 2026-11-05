// Kept independent of Firebase to test tab arbitration and logout behavior.
export function notificationDestination(binding, data, windows, now = Date.now()) {
  if (!binding || binding.userId !== data.recipientId || data.senderId === data.recipientId ||
    data.type !== "chat.message" || !/^[1-9]\d*$/.test(data.chatId) || !/^[1-9]\d*$/.test(data.messageId) ||
    !Number.isFinite(Date.parse(data.createdAt)) || now - Date.parse(data.createdAt) > 300_000 || Date.parse(data.createdAt) > now + 60_000)
    return { mode: "silent" };
  const active = windows.filter((entry) => entry.userId === data.recipientId && entry.active);
  if (active.some((entry) => entry.chatId === data.chatId)) return { mode: "silent" };
  return active.length ? { mode: "in-app", clientId: active[0].clientId }
    : binding.enabled ? { mode: "push" } : { mode: "silent" };
}

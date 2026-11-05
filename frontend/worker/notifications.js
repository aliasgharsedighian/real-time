import { notificationDestination } from "./notification-routing.js";

const DB_NAME = "batgram-notifications";
let queue = Promise.resolve();
function enqueue(work) {
  const result = queue.then(work);
  queue = result.catch(() => {});
  return result;
}
function database() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("state");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function state(key, value, write = false) {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("state", write ? "readwrite" : "readonly");
      const store = tx.objectStore("state");
      const request = write ? store.put(value, key) : store.get(key);
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}
async function windows() {
  const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  // Only dashboard windows host the notification provider. Public pages neither
  // suppress Push nor delay every notification waiting for a reply they cannot send.
  const clients = allClients.filter((client) => /^\/dashboard(?:\/|$)/.test(new URL(client.url).pathname));
  const states = await Promise.all(clients.map((client) => new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => { channel.port1.close(); resolve(null); }, 400);
    channel.port1.onmessage = (event) => {
      clearTimeout(timer); channel.port1.close();
      resolve({ ...event.data, clientId: client.id });
    };
    client.postMessage({ type: "notification:state" }, [channel.port2]);
  })));
  return { clients, states: states.filter(Boolean) };
}
async function deliver(data) {
  if (!data || typeof data.title !== "string" || typeof data.body !== "string") return;
  const binding = await state("binding");
  const { clients, states } = await windows();
  const destination = notificationDestination(binding, data, states);
  if (destination.mode === "silent") return;
  const key = `${data.recipientId}:${data.messageId}`;
  const recent = (await state("recent") || []).filter((entry) => entry.time > Date.now() - 300_000);
  if (recent.some((entry) => entry.key === key)) return;
  if (destination.mode === "in-app") {
    clients.find((client) => client.id === destination.clientId)?.postMessage({ type: "notification:in-app", data });
  } else {
    await self.registration.showNotification(data.title.slice(0, 120), {
      body: data.body.slice(0, 240), icon: "/icons/icon-192.png", badge: "/icons/notification-badge.png",
      tag: `batgram-chat-${data.recipientId}-${data.chatId}`,
      data: { chatId: data.chatId, recipientId: data.recipientId },
    });
  }
  await state("recent", [...recent.slice(-499), { key, time: Date.now() }], true);
}

// Register our click handler before Firebase, and accept only internal chat links.
self.addEventListener("notificationclick", (event) => {
  event.stopImmediatePropagation();
  event.notification.close();
  event.waitUntil(enqueue(async () => {
    const data = event.notification.data;
    const binding = await state("binding");
    if (!data || binding?.userId !== data.recipientId || !/^[1-9]\d*$/.test(data.chatId)) return;
    const { clients, states } = await windows();
    const matching = states.find((entry) => entry.userId === data.recipientId);
    const client = clients.find((entry) => entry.id === matching?.clientId);
    if (client) {
      client.postMessage({ type: "notification:navigate", chatId: data.chatId, recipientId: data.recipientId });
      await client.focus();
    } else await self.clients.openWindow(`/dashboard/websocket/${data.chatId}`);
  }).catch(() => {}));
});
self.addEventListener("message", (event) => {
  const type = event.data?.type;
  if (type !== "notification:bind" && type !== "notification:deliver") return;
  // Messages must originate from an actual same-origin app window.
  if (!event.source?.url || new URL(event.source.url).origin !== self.location.origin) return;
  event.waitUntil(enqueue(async () => {
    if (type === "notification:bind") {
      const userId = event.data.userId;
      if (userId !== null && !/^[1-9]\d*$/.test(userId)) throw new Error("Invalid account");
      const previous = await state("binding");
      await state("binding", { userId, enabled: event.data.enabled === true }, true);
      if (!userId || previous?.userId !== userId || !event.data.enabled) {
        const notifications = await self.registration.getNotifications();
        notifications.forEach((notification) => notification.close());
      }
    } else await deliver(event.data.data);
    event.ports[0]?.postMessage({ ok: true });
  }).catch(() => event.ports[0]?.postMessage({ ok: false })));
});

// FCM data-only payloads arrive through the browser Push API. Own this handler so
// a visible public page cannot swallow delivery and no Firebase auto-display can
// bypass chat suppression. Registration/token management still uses Firebase SDK.
self.addEventListener("push", (event) => {
  let payload;
  try { payload = event.data?.json(); } catch { return; }
  if (payload?.data?.type !== "chat.message") return;
  event.waitUntil(enqueue(() => deliver(payload.data)).catch(() => {}));
});

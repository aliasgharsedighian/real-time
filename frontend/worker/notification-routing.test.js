import { describe, expect, it } from "vitest";
import { notificationDestination } from "./notification-routing.js";
const data = { type: "chat.message", messageId: "9", chatId: "7", recipientId: "2", senderId: "1", createdAt: new Date().toISOString() };
const binding = { userId: "2", enabled: true };
const tab = { userId: "2", active: true, chatId: "3", clientId: "first" };
describe("notification display at actual delivery time", () => {
  it("shows system push with all app windows closed or hidden", () => {
    expect(notificationDestination(binding, data, []).mode).toBe("push");
    expect(notificationDestination(binding, data, [{ ...tab, active: false, chatId: "7" }]).mode).toBe("push");
  });
  it("shows one in-app banner when a different chat is open", () => {
    expect(notificationDestination(binding, data, [tab, { ...tab, clientId: "second" }])).toEqual({ mode: "in-app", clientId: "first" });
  });
  it("suppresses late push if the chat was opened in any active tab", () => {
    expect(notificationDestination(binding, data, [tab, { ...tab, chatId: "7" }]).mode).toBe("silent");
  });
  it("drops old-account, logged-out, own-message, invalid and expired payloads", () => {
    for (const account of [null, { userId: null }, { userId: "3", enabled: true }])
      expect(notificationDestination(account, data, []).mode).toBe("silent");
    for (const patch of [{ senderId: "2" }, { chatId: "https://evil.test" }, { createdAt: "invalid" }, { createdAt: new Date(Date.now() - 301000).toISOString() }])
      expect(notificationDestination(binding, { ...data, ...patch }, []).mode).toBe("silent");
  });
  it("disabling browser push preserves in-app notifications", () => {
    expect(notificationDestination({ ...binding, enabled: false }, data, []).mode).toBe("silent");
    expect(notificationDestination({ ...binding, enabled: false }, data, [tab]).mode).toBe("in-app");
  });
});

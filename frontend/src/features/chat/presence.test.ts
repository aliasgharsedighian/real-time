import { describe, expect, it } from "vitest";
import { formatPresence, type UserPresence } from "./presence";

describe("last seen", () => {
  const now = new Date(2026, 10, 5, 12).getTime();
  const status = (age: number): UserPresence => ({
    userId: 2,
    online: false,
    lastSeenAt: new Date(now - age).toISOString(),
    lastSeen: null,
  });
  it("formats recent, minutes, hours, yesterday and older days", () => {
    expect(formatPresence(status(59_999), now)).toBe("last seen recently");
    expect(formatPresence(status(60_000), now)).toBe("last seen 1 min ago");
    expect(formatPresence(status(23 * 60_000), now)).toBe(
      "last seen 23 min ago",
    );
    expect(formatPresence(status(2 * 3_600_000), now)).toBe(
      "last seen 2 h ago",
    );
    expect(formatPresence(status(86_400_000), now)).toBe("last seen yesterday");
    expect(formatPresence(status(2 * 86_400_000), now)).toBe(
      "last seen 2 days ago",
    );
  });
  it("gives online precedence and uses only coarse labels for private timestamps", () => {
    expect(formatPresence({ ...status(1000), online: true }, now)).toBe(
      "online",
    );
    for (const lastSeen of ["recently", "week", "month"] as const) {
      expect(formatPresence({ ...status(1000), lastSeen }, now)).toBe(
        lastSeen === "recently"
          ? "last seen recently"
          : `last seen within a ${lastSeen}`,
      );
    }
    expect(formatPresence(undefined)).toBe("");
    expect(formatPresence({ ...status(0), lastSeenAt: null })).toBe(
      "last seen recently",
    );
  });
});

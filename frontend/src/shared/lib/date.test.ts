import { describe, expect, it } from "vitest";
import {
  formatMessageDay,
  formatMessageTime,
  localDateKey,
  localMonthRange,
} from "./date";
describe("chat dates", () => {
  it("groups messages using local calendar boundaries instead of UTC dates", () => {
    expect(localDateKey(new Date(2026, 10, 3, 23, 59))).toBe("2026-11-03");
    expect(localDateKey(new Date(2026, 10, 4, 0, 0))).toBe("2026-11-04");
  });
  it("formats older message timestamps as time only", () => {
    const value = new Date(2025, 0, 5, 17, 42).toISOString();
    expect(formatMessageTime(value)).toBe(
      new Date(value).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }),
    );
    expect(formatMessageTime(value)).not.toContain("2025");
    expect(formatMessageDay("2025-01-05")).toContain("January 5");
    expect(formatMessageDay("2025-01-05")).toContain("2025");
  });
  it("uses local month starts for the API's half-open calendar range", () => {
    const range = localMonthRange("2026-11");
    expect(range.from).toBe(new Date(2026, 10, 1).toISOString());
    expect(range.to).toBe(new Date(2026, 11, 1).toISOString());
    expect(range.timeZone).toBeTruthy();
  });
});

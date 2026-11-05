import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useInboxTyping } from "./use-inbox-typing";

const fake = vi.hoisted(() => ({
  handlers: new Map<string, (value?: unknown) => void>(),
  emit: vi.fn(),
}));
vi.mock("@/features/auth/session-context", () => ({
  useSession: () => ({ user: { id: 1 } }),
}));
vi.mock("../socket", () => ({
  getSocket: () => ({
    connected: true,
    emit: fake.emit,
    on: (name: string, handler: (value?: unknown) => void) =>
      fake.handlers.set(name, handler),
    off: (name: string) => fake.handlers.delete(name),
  }),
}));
const event = (name: string, value?: unknown) =>
  act(() => fake.handlers.get(name)?.(value));
describe("inbox typing", () => {
  beforeEach(() => {
    fake.handlers.clear();
    fake.emit.mockClear();
  });
  it("tracks multiple conversations, excludes self, restores snapshots and removes stopped typists", () => {
    const { result } = renderHook(useInboxTyping);
    expect(fake.emit).toHaveBeenCalledWith("typing:list");
    const alice = { chatId: 3, userId: 2, username: "Alice" };
    const bob = { chatId: 4, userId: 3, username: "Bob" };
    event("typing:list", [alice, { chatId: 3, userId: 1, username: "Me" }]);
    event("typing:start", bob);
    expect(result.current).toEqual([alice, bob]);
    event("typing:stop", alice);
    expect(result.current).toEqual([bob]);
    event("disconnect");
    expect(result.current).toEqual([]);
    fake.emit.mockClear();
    event("connect");
    expect(fake.emit).toHaveBeenCalledWith("typing:list");
  });
});

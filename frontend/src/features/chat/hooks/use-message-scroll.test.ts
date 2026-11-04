import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { Message } from "../types";
import { useMessageScroll } from "./use-message-scroll";

afterEach(() => vi.unstubAllGlobals());

it("shows the date only for scrolling and hides it after scrolling stops", () => {
  vi.useFakeTimers();
  try {
    const items = messages(1, 2);
    const { result, rerender, unmount } = renderHook(
      ({ items }) =>
        useMessageScroll({
          messages: items,
          loadingOlder: false,
          canLoadOlder: false,
          loadOlder: async () => {},
        }),
      { initialProps: { items } },
    );
    const element = document.createElement("div");
    Object.defineProperties(element, {
      clientHeight: { get: () => 300 },
      scrollHeight: { get: () => 1000 },
    });
    result.current.container.current = element;
    rerender({ items: [...items] });
    act(() => result.current.handleScroll());
    expect(result.current.scrolling).toBe(false);
    element.scrollTop = 400;
    act(() => result.current.handleScroll());
    expect(result.current.scrolling).toBe(true);
    act(() => vi.advanceTimersByTime(1000));
    element.scrollTop = 300;
    act(() => result.current.handleScroll());
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.scrolling).toBe(true);
    act(() => vi.advanceTimersByTime(400));
    expect(result.current.scrolling).toBe(false);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    vi.useRealTimers();
  }
});

it("updates the pinned day when scrolling in either direction across midnight", () => {
  const items = messages(1, 2);
  const { result, rerender } = renderHook(
    ({ items }) =>
      useMessageScroll({
        messages: items,
        loadingOlder: false,
        canLoadOlder: false,
        loadOlder: async () => {},
      }),
    { initialProps: { items } },
  );
  const element = document.createElement("div");
  let top = 0;
  Object.defineProperties(element, {
    clientHeight: { get: () => 300 },
    scrollHeight: { get: () => 1000 },
    scrollTop: {
      get: () => top,
      set: (value: number) => {
        top = Math.max(0, Math.min(value, 700));
      },
    },
  });
  element.querySelectorAll = (() =>
    [0, 1].map((index) => ({
      dataset: {
        messageId: String(index + 1),
        messageDay: index ? "2026-11-04" : "2026-11-03",
      },
      getBoundingClientRect: () => ({
        top: index * 500 - top,
        bottom: (index + 1) * 500 - top,
      }),
    }))) as unknown as typeof element.querySelectorAll;
  result.current.container.current = element;
  rerender({ items: [...items] });
  expect(result.current.visibleDay).toBe("2026-11-04");
  element.scrollTop = 100;
  act(() => result.current.rememberPosition());
  expect(result.current.visibleDay).toBe("2026-11-03");
  element.scrollTop = 600;
  act(() => result.current.rememberPosition());
  expect(result.current.visibleDay).toBe("2026-11-04");
});

it("centers a selected search message and keeps it in view across list updates", () => {
  type Focus =
    | { id: number; requestId: number; align?: "start" | "center" }
    | undefined;
  const { result, rerender } = renderHook(
    ({ focus, items }: { focus: Focus; items: Message[] }) =>
      useMessageScroll({
        messages: items,
        loadingOlder: false,
        canLoadOlder: false,
        loadOlder: async () => {},
        focusMessage: focus,
      }),
    { initialProps: { focus: undefined as Focus, items: messages(1, 50) } },
  );
  const element = document.createElement("div");
  let top = 0;
  Object.defineProperties(element, {
    clientHeight: { get: () => 300 },
    scrollHeight: { get: () => 5000 },
    scrollTop: {
      get: () => top,
      set: (value: number) => {
        top = Math.max(0, Math.min(value, 4700));
      },
    },
  });
  const row = {
    dataset: { messageId: "10" },
    getBoundingClientRect: () => ({
      top: 900 - top,
      bottom: 1000 - top,
      height: 100,
    }),
  };
  element.querySelector = (() =>
    row) as unknown as typeof element.querySelector;
  element.querySelectorAll = (() => [
    row,
  ]) as unknown as typeof element.querySelectorAll;
  result.current.container.current = element;
  rerender({ focus: undefined, items: messages(1, 50) });
  expect(top).toBe(4700);
  const focus = { id: 10, requestId: 1 };
  rerender({ focus, items: messages(1, 50) });
  expect(top).toBe(800);
  rerender({ focus, items: messages(1, 51) });
  expect(top).toBe(800);
  rerender({
    focus: { id: 10, requestId: 2, align: "start" },
    items: messages(1, 51),
  });
  expect(top).toBe(888);
});

const messages = (start: number, end: number): Message[] =>
  Array.from({ length: end - start + 1 }, (_, index) => ({
    id: start + index,
    chatId: 7,
    senderId: 2,
    content: "Message",
    createdAt: "2026-11-04",
  }));
it("anchors the visible row across prepends, loader changes and scrolling during a request", () => {
  let current = messages(51, 100);
  let loading = false;
  const { result, rerender } = renderHook(
    ({ items, loadingOlder }) =>
      useMessageScroll({
        messages: items,
        loadingOlder,
        canLoadOlder: false,
        loadOlder: async () => {},
      }),
    { initialProps: { items: current, loadingOlder: loading } },
  );
  const element = document.createElement("div");
  let scrollTop = 0;
  Object.defineProperties(element, {
    clientHeight: { get: () => 300 },
    scrollHeight: { get: () => current.length * 100 + (loading ? 40 : 0) },
    scrollTop: {
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = Math.max(0, Math.min(value, element.scrollHeight - 300));
      },
    },
  });
  const rows = () =>
    current.map((message, index) => ({
      dataset: { messageId: String(message.id) },
      getBoundingClientRect: () => ({
        top: index * 100 + (loading ? 40 : 0) - scrollTop,
        bottom: (index + 1) * 100 + (loading ? 40 : 0) - scrollTop,
      }),
    }));
  element.querySelectorAll = (() =>
    rows()) as unknown as typeof element.querySelectorAll;
  element.querySelector = ((selector: string) =>
    rows().find((row) =>
      selector.includes(`"${row.dataset.messageId}"`),
    )) as unknown as typeof element.querySelector;
  result.current.container.current = element;
  rerender({ items: [...current], loadingOlder: loading });
  expect(scrollTop).toBe(4700);
  element.scrollTop = 150;
  act(() => result.current.rememberPosition());
  loading = true;
  rerender({ items: current, loadingOlder: loading });
  expect(scrollTop).toBe(190);
  element.scrollTop = 290;
  act(() => result.current.rememberPosition());
  current = messages(1, 100);
  loading = false;
  rerender({ items: current, loadingOlder: loading });
  expect(scrollTop).toBe(5250);
  current = messages(1, 101);
  rerender({ items: current, loadingOlder: loading });
  expect(scrollTop).toBe(5250);
});

it("stays at the bottom as attachments and the viewport resize, until the user scrolls up", () => {
  let resize!: () => void;
  const observe = vi.fn();
  const disconnect = vi.fn();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        resize = callback;
      }
      observe = observe;
      disconnect = disconnect;
    },
  );
  const { result, rerender, unmount } = renderHook(
    ({ items }) =>
      useMessageScroll({
        messages: items,
        loadingOlder: false,
        canLoadOlder: false,
        loadOlder: async () => {},
      }),
    { initialProps: { items: messages(1, 50) } },
  );
  const element = document.createElement("div");
  const list = document.createElement("div");
  let height = 1000;
  let viewport = 300;
  Object.defineProperties(element, {
    scrollHeight: { get: () => height },
    clientHeight: { get: () => viewport },
  });
  let top = 0;
  Object.defineProperty(element, "scrollTop", {
    get: () => top,
    set: (value: number) => {
      top = Math.max(0, Math.min(value, height - viewport));
    },
  });
  result.current.container.current = element;
  result.current.content.current = list;
  rerender({ items: messages(1, 50) });
  expect(top).toBe(700);
  expect(observe).toHaveBeenCalledWith(element);
  expect(observe).toHaveBeenCalledWith(list);
  // An image/video replaces the small loading placeholder after the first paint.
  height = 1800;
  // Browsers may deliver a scroll event before the resize notification.
  act(() => result.current.rememberPosition());
  act(() => resize());
  expect(top).toBe(1500);
  viewport = 200;
  act(() => resize());
  expect(top).toBe(1600);
  element.scrollTop = 300;
  act(() => result.current.rememberPosition());
  height = 2100;
  act(() => resize());
  expect(top).toBe(300);
  unmount();
  expect(disconnect).toHaveBeenCalled();
});

it("waits for a visible viewport before completing the initial scroll", () => {
  let resize!: () => void;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        resize = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
  const { result, rerender } = renderHook(
    ({ items }) =>
      useMessageScroll({
        messages: items,
        loadingOlder: false,
        canLoadOlder: false,
        loadOlder: async () => {},
      }),
    { initialProps: { items: messages(1, 50) } },
  );
  const element = document.createElement("div");
  let visible = false;
  let top = 0;
  Object.defineProperties(element, {
    scrollHeight: { get: () => (visible ? 1500 : 0) },
    clientHeight: { get: () => (visible ? 300 : 0) },
    scrollTop: {
      get: () => top,
      set: (value: number) => {
        top = visible ? Math.min(value, 1200) : 0;
      },
    },
  });
  result.current.container.current = element;
  result.current.content.current = document.createElement("div");
  rerender({ items: messages(1, 50) });
  visible = true;
  act(() => result.current.rememberPosition());
  act(() => resize());
  expect(top).toBe(1200);
});

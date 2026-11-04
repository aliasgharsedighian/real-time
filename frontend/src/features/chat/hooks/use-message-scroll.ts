import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import type { Message } from "../types";

export function useMessageScroll({
  messages,
  loadingOlder,
  canLoadOlder,
  loadOlder,
}: {
  messages?: Message[];
  loadingOlder: boolean;
  canLoadOlder: boolean;
  loadOlder: () => Promise<void>;
}) {
  const container = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const initialized = useRef(false);
  const previousScrollTop = useRef(0);
  const anchor = useRef<{ id: string; offset: number } | null>(null);
  const prefetch = useRef<HTMLDivElement>(null);

  const rememberPosition = useCallback(() => {
    const element = container.current;
    if (!element || element.clientHeight <= 0) return;
    // A resize can emit scroll before ResizeObserver runs. Distance from the
    // new end alone does not mean the user scrolled away from the old end.
    if (
      initialized.current &&
      (!nearBottom.current || element.scrollTop < previousScrollTop.current - 1)
    ) {
      nearBottom.current =
        element.scrollHeight - element.scrollTop - element.clientHeight < 100;
    }
    previousScrollTop.current = element.scrollTop;
    const top = element.getBoundingClientRect().top;
    const visible = Array.from(
      element.querySelectorAll<HTMLElement>("[data-message-id]"),
    ).find((row) => row.getBoundingClientRect().bottom > top);
    anchor.current = visible
      ? {
          id: visible.dataset.messageId!,
          offset: visible.getBoundingClientRect().top - top,
        }
      : null;
  }, []);

  const syncPosition = useCallback(() => {
    const element = container.current;
    // Suspense/hidden layouts can attach refs before the viewport has a size.
    if (!element || element.clientHeight <= 0) return;
    if (!initialized.current || nearBottom.current) {
      element.scrollTop = element.scrollHeight;
      initialized.current = true;
    } else if (anchor.current) {
      // Anchor the actual visible row, so prepends and the loading row cannot jump the viewport.
      const row = element.querySelector<HTMLElement>(
        `[data-message-id="${anchor.current.id}"]`,
      );
      if (row)
        element.scrollTop +=
          row.getBoundingClientRect().top -
          element.getBoundingClientRect().top -
          anchor.current.offset;
    }
    rememberPosition();
  }, [rememberPosition]);

  useLayoutEffect(() => {
    if (messages?.length) syncPosition();
  }, [messages, loadingOlder, syncPosition]);

  useEffect(() => {
    const element = container.current;
    const list = content.current;
    if (!element || !list || typeof ResizeObserver === "undefined") return;
    // Attachments load after history. Keep the end visible as their dimensions
    // settle, and preserve the visible message once the user scrolls upwards.
    const observer = new ResizeObserver(syncPosition);
    observer.observe(element);
    observer.observe(list);
    return () => observer.disconnect();
  }, [messages, syncPosition]);

  useEffect(() => {
    const element = container.current;
    const target = prefetch.current;
    if (
      !element ||
      !target ||
      !canLoadOlder ||
      loadingOlder ||
      typeof IntersectionObserver === "undefined"
    )
      return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          initialized.current &&
          !nearBottom.current &&
          entries.some((entry) => entry.isIntersecting)
        )
          void loadOlder();
      },
      { root: element },
    );
    observer.observe(target);
    // Also handle jumping directly to the top (Home key or a fast scroll).
    const first = element.querySelector<HTMLElement>("[data-message-id]");
    if (first && first !== target) observer.observe(first);
    return () => observer.disconnect();
  }, [messages, canLoadOlder, loadingOlder, loadOlder]);

  return { container, content, bottom, nearBottom, prefetch, rememberPosition };
}

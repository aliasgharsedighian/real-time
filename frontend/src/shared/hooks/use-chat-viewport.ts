import { useLayoutEffect, useRef } from "react";

/** Follow the visible viewport: iOS does not resize the layout for its keyboard. */
export function useChatViewport() {
  const viewport = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const visual = window.visualViewport;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        element.style.setProperty(
          "--chat-height",
          `${visual?.height ?? window.innerHeight}px`,
        );
        // Safari can retain the home-indicator inset above an open keyboard.
        element.style.setProperty(
          "--chat-safe-bottom",
          visual && window.innerHeight - visual.height > 100
            ? "0px"
            : "env(safe-area-inset-bottom)",
        );
        element.style.setProperty("--chat-top", `${visual?.offsetTop ?? 0}px`);
      });
    };
    const preventGesture = (event: Event) => event.preventDefault();
    const preventPinch = (event: TouchEvent) => {
      if (event.touches.length > 1) event.preventDefault();
    };
    document.documentElement.classList.add("chat-viewport-active");
    update();
    visual?.addEventListener("resize", update);
    visual?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    document.addEventListener("gesturestart", preventGesture, {
      passive: false,
    });
    document.addEventListener("gesturechange", preventGesture, {
      passive: false,
    });
    document.addEventListener("touchmove", preventPinch, { passive: false });
    return () => {
      cancelAnimationFrame(frame);
      document.documentElement.classList.remove("chat-viewport-active");
      visual?.removeEventListener("resize", update);
      visual?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      document.removeEventListener("gesturestart", preventGesture);
      document.removeEventListener("gesturechange", preventGesture);
      document.removeEventListener("touchmove", preventPinch);
    };
  }, []);
  return viewport;
}

import { useRef, type RefObject, type TouchEvent } from "react";

/** Dismiss only on a deliberate gesture toward older messages, never on resize. */
export function useComposerGestures(
  textarea: RefObject<HTMLTextAreaElement | null>,
  beforeDismiss: () => void,
) {
  const start = useRef<{ x: number; y: number } | null>(null);
  return {
    onTouchStart(event: TouchEvent) {
      const touch = event.touches[0];
      start.current =
        event.touches.length === 1 && touch
          ? { x: touch.clientX, y: touch.clientY }
          : null;
    },
    onTouchMove(event: TouchEvent) {
      const touch = event.touches[0];
      if (!start.current || !touch || event.touches.length !== 1) return;
      const dy = touch.clientY - start.current.y;
      const dx = Math.abs(touch.clientX - start.current.x);
      // Dragging down reveals older messages in a chronological message list.
      if (dy > 16 && dy > dx && document.activeElement === textarea.current) {
        beforeDismiss();
        textarea.current?.blur();
        start.current = null;
      }
    },
    onTouchEnd() {
      start.current = null;
    },
    onTouchCancel() {
      start.current = null;
    },
  };
}

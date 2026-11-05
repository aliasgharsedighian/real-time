import { useRef, useState, type PointerEvent } from "react";

// Lock direction after a small dead zone so scrolling, taps and media controls keep working.
export function useHorizontalSwipe({
  restingOffset = 0,
  minOffset,
  maxOffset,
  threshold,
  enabled = true,
  onCommit,
}: {
  restingOffset?: number;
  minOffset: number;
  maxOffset: number;
  threshold: number;
  enabled?: boolean;
  onCommit: (direction: "left" | "right") => void;
}) {
  const gesture = useRef<{
    x: number;
    y: number;
    pointerId: number;
    base: number;
    axis: "pending" | "horizontal" | "vertical";
  } | null>(null);
  const suppressClick = useRef(false);
  const [offset, setOffset] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  function move(event: PointerEvent<HTMLElement>) {
    const start = gesture.current;
    if (!start || start.pointerId !== event.pointerId || !enabled) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (start.axis === "pending" && Math.max(Math.abs(dx), Math.abs(dy)) > 8) {
      start.axis =
        Math.abs(dx) > Math.abs(dy) * 1.2 ? "horizontal" : "vertical";
      if (start.axis === "horizontal") {
        suppressClick.current = true;
        if (event.type === "pointermove")
          event.currentTarget.setPointerCapture?.(event.pointerId);
      }
    }
    if (start.axis !== "horizontal") return;
    setDragging(true);
    setOffset(Math.max(minOffset, Math.min(maxOffset, start.base + dx)));
  }

  function finish(event: PointerEvent<HTMLElement>, cancelled = false) {
    if (!cancelled) move(event);
    const start = gesture.current;
    if (!start || start.pointerId !== event.pointerId) return;
    gesture.current = null;
    setDragging(false);
    setOffset(null);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (cancelled || !enabled || start.axis !== "horizontal") return;
    const dx = event.clientX - start.x;
    if (dx >= threshold && maxOffset > start.base) onCommit("right");
    else if (dx <= -threshold && minOffset < start.base) onCommit("left");
  }

  return {
    offset: offset ?? restingOffset,
    dragging,
    suppressClick,
    handlers: {
      onPointerDown(event: PointerEvent<HTMLElement>) {
        suppressClick.current = false;
        if (
          !enabled ||
          event.pointerType !== "touch" ||
          event.isPrimary === false ||
          (event.target as HTMLElement).closest(
            "button,input,textarea,video,audio,[data-message-menu]",
          )
        )
          return;
        gesture.current = {
          x: event.clientX,
          y: event.clientY,
          pointerId: event.pointerId,
          base: restingOffset,
          axis: "pending",
        };
      },
      onPointerMove: move,
      onPointerUp: (event: PointerEvent<HTMLElement>) => finish(event),
      onPointerCancel: (event: PointerEvent<HTMLElement>) =>
        finish(event, true),
      onLostPointerCapture: (event: PointerEvent<HTMLElement>) => {
        // Moving implicit capture from a child to this surface is not a cancellation.
        if (event.target === event.currentTarget) finish(event, true);
      },
    },
  };
}

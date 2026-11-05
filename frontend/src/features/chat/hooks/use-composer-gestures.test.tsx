import { fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { expect, it, vi } from "vitest";
import { useComposerGestures } from "./use-composer-gestures";

it("dismisses on a deliberate drag toward history and ignores taps, sideways and newer-message gestures", () => {
  const beforeDismiss = vi.fn();
  function Chat() {
    const textarea = useRef<HTMLTextAreaElement>(null);
    const gestures = useComposerGestures(textarea, beforeDismiss);
    return (
      <>
        <textarea ref={textarea} aria-label="Message" />
        <div role="log" {...gestures} />
      </>
    );
  }
  render(<Chat />);
  const input = screen.getByLabelText("Message");
  const log = screen.getByRole("log");
  input.focus();
  const touch = (x: number, y: number) => ({
    touches: [{ clientX: x, clientY: y }],
  });
  fireEvent.touchStart(log, touch(100, 100));
  fireEvent.touchMove(log, touch(100, 104));
  fireEvent.touchMove(log, touch(100, 60));
  fireEvent.touchMove(log, touch(150, 110));
  expect(document.activeElement).toBe(input);
  expect(beforeDismiss).not.toHaveBeenCalled();
  fireEvent.touchMove(log, touch(100, 130));
  expect(document.activeElement).not.toBe(input);
  expect(beforeDismiss).toHaveBeenCalledTimes(1);
  input.focus();
  fireEvent.touchStart(log, touch(100, 100));
  fireEvent.touchCancel(log);
  fireEvent.touchMove(log, touch(100, 140));
  expect(document.activeElement).toBe(input);
});

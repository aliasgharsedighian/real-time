import { useEffect, useRef, useState } from "react";

export function useVoiceRecorder({
  maxSeconds,
  maxBytes,
  onReady,
  onError,
}: {
  maxSeconds: number;
  maxBytes: number;
  onReady: (file: File) => void;
  onError: (message: string) => void;
}) {
  const [status, setStatus] = useState<
    "idle" | "requesting" | "recording" | "stopping"
  >("idle");
  const [seconds, setSeconds] = useState(0);
  type RecordingSession = {
    recorder?: MediaRecorder;
    stream?: MediaStream;
    timer?: ReturnType<typeof setInterval>;
    released: boolean;
    cancelled: boolean;
  };
  const session = useRef<RecordingSession | null>(null);
  const callbacks = useRef({ onReady, onError });
  useEffect(() => {
    callbacks.current = { onReady, onError };
  }, [onReady, onError]);

  function finish(cancelled = false) {
    const current = session.current;
    if (!current) return;
    current.released = true;
    current.cancelled ||= cancelled;
    clearInterval(current.timer);
    if (current.recorder?.state === "recording") {
      setStatus("stopping");
      current.recorder.stop();
    }
    current.stream?.getTracks().forEach((track) => track.stop());
    if (!current.recorder) {
      session.current = null;
      setStatus("idle");
    }
  }

  useEffect(() => {
    const cancel = () => finish(true);
    const hide = () => {
      if (document.hidden) cancel();
    };
    window.addEventListener("blur", cancel);
    document.addEventListener("visibilitychange", hide);
    return () => {
      window.removeEventListener("blur", cancel);
      document.removeEventListener("visibilitychange", hide);
      const current = session.current;
      if (current) {
        current.cancelled = true;
        current.released = true;
        clearInterval(current.timer);
        if (current.recorder?.state === "recording") current.recorder.stop();
        current.stream?.getTracks().forEach((track) => track.stop());
        session.current = null;
      }
    };
  }, []);

  async function start() {
    if (session.current) return;
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      callbacks.current.onError(
        "Voice recording requires a supported browser and HTTPS or localhost.",
      );
      return;
    }
    const current: RecordingSession = {
      released: false,
      cancelled: false,
    };
    session.current = current;
    setStatus("requesting");
    setSeconds(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      current.stream = stream;
      if (current.released || session.current !== current) {
        stream.getTracks().forEach((track) => track.stop());
        if (session.current === current) {
          session.current = null;
          setStatus("idle");
        }
        return;
      }
      const mimeType = [
        "audio/webm;codecs=opus",
        "audio/mp4",
        "audio/ogg;codecs=opus",
        "audio/webm",
      ].find((mime) => MediaRecorder.isTypeSupported(mime));
      if (!mimeType)
        throw new Error("This browser cannot record a supported audio format.");
      const recorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 96000,
      });
      current.recorder = recorder;
      const chunks: Blob[] = [];
      let bytes = 0;
      recorder.ondataavailable = (event) => {
        if (!event.data.size) return;
        bytes += event.data.size;
        chunks.push(event.data);
        if (bytes > maxBytes) {
          callbacks.current.onError(
            "The recording exceeds the audio size limit. Please record a shorter message.",
          );
          finish(true);
        }
      };
      recorder.onerror = () => {
        callbacks.current.onError("Recording failed. Please try again.");
        finish(true);
      };
      recorder.onstop = () => {
        clearInterval(current.timer);
        stream.getTracks().forEach((track) => track.stop());
        if (session.current !== current) return;
        session.current = null;
        setStatus("idle");
        if (!current.cancelled && bytes && bytes <= maxBytes) {
          const type = (recorder.mimeType || mimeType).split(";")[0];
          const extension =
            type === "audio/mp4"
              ? "m4a"
              : type === "audio/ogg"
                ? "ogg"
                : "webm";
          callbacks.current.onReady(
            new File(chunks, `voice-${Date.now()}.${extension}`, { type }),
          );
        }
      };
      recorder.start(250);
      setStatus("recording");
      const started = Date.now();
      current.timer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - started) / 1000);
        setSeconds(elapsed);
        if (elapsed >= maxSeconds) finish();
      }, 200);
    } catch (error) {
      current.stream?.getTracks().forEach((track) => track.stop());
      if (session.current !== current) return;
      session.current = null;
      setStatus("idle");
      if (!current.released)
        callbacks.current.onError(
          error instanceof DOMException && error.name === "NotAllowedError"
            ? "Microphone access was denied. Allow microphone access in your browser and try again."
            : error instanceof Error
              ? error.message
              : "Unable to access the microphone.",
        );
    }
  }
  return {
    status,
    seconds,
    active: status !== "idle",
    start,
    stop: () => finish(),
    cancel: () => finish(true),
  };
}

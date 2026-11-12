export const appSounds = {
  messageReceived: "/sounds/message-received.wav",
  messageSent: "/sounds/message-sent.mp3",
  incomingCall: "/sounds/incoming-call.wav",
  outgoingCall: "/sounds/outgoing-call.wav",
};

type AppSound = keyof typeof appSounds;

let context: AudioContext | undefined;
const buffers = new Map<AppSound, Promise<AudioBuffer>>();
const playing = new Map<AppSound, AudioBufferSourceNode>();

export function soundOutput() {
  const { userAgent, platform, maxTouchPoints, userAgentData } = navigator as Navigator & {
    userAgentData?: { platform?: string; mobile?: boolean };
  };
  if (/Android/i.test(userAgent) || userAgentData?.platform === "Android") return "silent";
  if (/iPhone|iPad|iPod/i.test(userAgent) || (platform === "MacIntel" && maxTouchPoints > 1)) {
    // WebKit routes Web Audio as ambient audio on iOS.
    return window.AudioContext ? "ambient" : "silent";
  }
  if (/Mobile/i.test(userAgent) || userAgentData?.mobile) return "silent";
  if (/^Win/i.test(platform) || userAgentData?.platform === "Windows") return "native";
  return maxTouchPoints > 1 ? "silent" : "native";
}

const nativeEffects = new Map<AppSound, HTMLAudioElement>();

function playNativeEffect(sound: AppSound) {
  if (nativeEffects.has(sound)) return;
  const audio = new Audio(appSounds[sound]);
  const clear = () => {
    if (nativeEffects.get(sound) === audio) nativeEffects.delete(sound);
  };
  audio.addEventListener("ended", clear, { once: true });
  audio.addEventListener("error", clear, { once: true });
  nativeEffects.set(sound, audio);
  void audio.play().catch(clear);
}

function load(sound: AppSound, audio: AudioContext) {
  const cached = buffers.get(sound);
  if (cached) return cached;
  const pending = fetch(appSounds[sound]).then((response) => {
    if (!response.ok) throw new Error("Sound unavailable");
    return response.arrayBuffer();
  }).then((bytes) => audio.decodeAudioData(bytes)).catch((error: unknown) => {
    buffers.delete(sound);
    throw error;
  });
  buffers.set(sound, pending);
  return pending;
}

export function listenForSoundActivation() {
  const output = soundOutput();
  if (output === "silent") return;
  if (output === "native") {
    return () => {
      for (const audio of nativeEffects.values()) audio.pause();
      nativeEffects.clear();
    };
  }
  const activate = () => {
    try {
      context ??= new AudioContext();
      if (context.state !== "running") void context.resume().catch(() => {});
    } catch {
      // Browser audio is optional.
    }
  };
  document.addEventListener("pointerup", activate, true);
  document.addEventListener("keydown", activate, true);
  return () => {
    document.removeEventListener("pointerup", activate, true);
    document.removeEventListener("keydown", activate, true);
    for (const source of playing.values()) source.stop();
    playing.clear();
    if (context) void context.close().catch(() => {});
    context = undefined;
    buffers.clear();
  };
}

export function playAppSound(sound: AppSound) {
  if (document.visibilityState !== "visible") return;
  const output = soundOutput();
  if (output === "native") playNativeEffect(sound);
  if (output === "ambient") playAmbientSound(sound);
}

export function playAmbientSound(sound: AppSound, loop = false) {
  const audio = context;
  let cancelled = false;
  let source: AudioBufferSourceNode | undefined;
  if (audio?.state === "running" && document.visibilityState === "visible" && !playing.has(sound)) {
    void load(sound, audio).then((buffer) => {
      if (cancelled || audio !== context || audio.state !== "running" ||
        document.visibilityState !== "visible" || playing.has(sound)) return;
      const node = audio.createBufferSource();
      node.buffer = buffer;
      node.loop = loop;
      node.connect(audio.destination);
      node.onended = () => {
        if (playing.get(sound) === node) playing.delete(sound);
        node.disconnect();
      };
      node.start();
      source = node;
      playing.set(sound, node);
    }).catch(() => {});
  }
  return () => {
    cancelled = true;
    if (source && playing.get(sound) === source) {
      playing.delete(sound);
      source.stop();
    }
  };
}

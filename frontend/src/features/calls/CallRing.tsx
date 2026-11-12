import { useEffect } from "react";
import { appSounds, playAmbientSound, soundOutput } from "@/shared/lib/app-sounds";

export function CallRing({ sound }: { sound: "incomingCall" | "outgoingCall" }) {
  const output = soundOutput();
  useEffect(() => {
    if (output === "ambient") return playAmbientSound(sound, true);
  }, [output, sound]);

  if (output === "native") return <audio autoPlay loop src={appSounds[sound]} />;
  return null;
}

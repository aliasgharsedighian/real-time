import { createContext, useContext } from "react";
import type { CallController } from "./controller";
import type { CallView } from "./types";
export const CallContext = createContext<{
  controller: CallController;
  view: CallView;
} | null>(null);
export function useCalls() {
  const context = useContext(CallContext);
  if (!context) throw new Error("Calls must be used within CallProvider.");
  return context;
}

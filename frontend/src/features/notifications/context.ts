import { createContext, useContext } from "react";
export type PushStatus = "off" | "enabled" | "pending" | "denied" | "unsupported" | "unconfigured" | "unavailable";
export const NotificationContext = createContext<{
  status: PushStatus;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
} | null>(null);
export function useNotifications() {
  return useContext(NotificationContext);
}

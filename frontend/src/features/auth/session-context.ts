import { createContext, useContext } from "react";
import type { User } from "@/shared/lib/types";

export interface SessionContextValue {
  user: User | null;
  checking: boolean;
  error: unknown;
  retry: () => void;
}
export const SessionContext = createContext<SessionContextValue>({
  user: null,
  checking: false,
  error: null,
  retry: () => {},
});
export const useSession = () => useContext(SessionContext);

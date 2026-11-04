import { createContext, useContext, useState, type ReactNode } from "react";

const MessageSearchContext = createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
}>({ open: false, setOpen: () => {} });

export function MessageSearchProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <MessageSearchContext.Provider value={{ open, setOpen }}>
      {children}
    </MessageSearchContext.Provider>
  );
}

export const useMessageSearch = () => useContext(MessageSearchContext);

import { createContext, useContext, useState, type ReactNode } from "react";

const MessageSearchContext = createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
}>({ open: false, setOpen: () => {} });

export function MessageSearchProvider({
  children,
  scope,
}: {
  children: ReactNode;
  scope?: string;
}) {
  const [previousScope, setPreviousScope] = useState(scope);
  const [open, setOpen] = useState(false);
  if (scope !== previousScope) {
    setPreviousScope(scope);
    setOpen(false);
  }
  return (
    <MessageSearchContext.Provider value={{ open, setOpen }}>
      {children}
    </MessageSearchContext.Provider>
  );
}

export const useMessageSearch = () => useContext(MessageSearchContext);

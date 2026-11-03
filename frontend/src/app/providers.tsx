import { useState } from "react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { SessionProvider } from "@/features/auth/SessionProvider";

export function Providers({ children }: { children: ReactNode }) {
  const [cache] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1, staleTime: 10_000 } },
      }),
  );
  return (
    <QueryClientProvider client={cache}>
      <SessionProvider>{children}</SessionProvider>
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  );
}

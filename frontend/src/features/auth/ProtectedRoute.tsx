import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useSession } from "./session-context";
import { useSessionStore } from "./session-store";
import { Button } from "@/shared/ui/button";
import { errorMessage } from "@/shared/lib/api";

export function ProtectedRoute() {
  const { user, checking, error, retry } = useSession();
  const token = useSessionStore((state) => state.tokens?.accessToken);
  const location = useLocation();
  if (!token)
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  if (checking)
    return (
      <div role="status" className="grid min-h-dvh place-items-center">
        Checking your session…
      </div>
    );
  if (error || !user)
    return (
      <div className="grid min-h-dvh place-items-center p-6">
        <div className="space-y-4 text-center">
          <p role="alert">{errorMessage(error)}</p>
          <Button onClick={retry}>Try again</Button>
          <Button
            variant="outline"
            onClick={() => useSessionStore.getState().clear()}
          >
            Sign in again
          </Button>
        </div>
      </div>
    );
  return <Outlet />;
}

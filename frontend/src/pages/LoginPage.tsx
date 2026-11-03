import { Navigate } from "react-router-dom";
import { useSession } from "@/features/auth/session-context";
import AuthButton from "@/features/auth/components/AuthButton";
import { Button } from "@/shared/ui/button";
import { errorMessage } from "@/shared/lib/api";
import { useSessionStore } from "@/features/auth/session-store";
import { ThemeToggle } from "@/shared/components/ThemeToggle";

export default function LoginPage() {
  const { user, checking, error, retry } = useSession();
  if (checking)
    return (
      <div role="status" className="grid min-h-dvh place-items-center">
        Checking your session…
      </div>
    );
  if (user) return <Navigate to="/dashboard" replace />;
  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <div className="max-w-md space-y-6 text-center">
        <ThemeToggle />
        <h1 className="text-3xl font-bold">Welcome to BatGram</h1>
        <p className="text-muted-foreground">
          Sign in or create an account to continue to your chats.
        </p>
        {error ? (
          <>
            <p role="alert">{errorMessage(error)}</p>
            <Button onClick={retry}>Try again</Button>
            <Button
              variant="outline"
              onClick={() => useSessionStore.getState().clear()}
            >
              Use another account
            </Button>
          </>
        ) : (
          <AuthButton type="button" />
        )}
      </div>
    </main>
  );
}

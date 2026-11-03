import { Navigate } from "react-router-dom";
import { useSession } from "@/features/auth/session-context";
import AuthButton from "@/features/auth/components/AuthButton";
import { Button } from "@/shared/ui/button";
import { errorMessage } from "@/shared/lib/api";
import { useSessionStore } from "@/features/auth/session-store";
import { ThemeToggle } from "@/shared/components/ThemeToggle";
import { Brand } from "@/shared/components/Brand";
import { BrandLoading } from "@/shared/components/BrandLoading";
import { Link } from "react-router-dom";

export default function LoginPage() {
  const { user, checking, error, retry } = useSession();
  if (checking) return <BrandLoading message="Checking your session…" />;
  if (user) return <Navigate to="/dashboard" replace />;
  return (
    <main className="brand-scene grid min-h-dvh place-items-center p-5">
      <div className="brand-panel flex w-full max-w-md flex-col items-center gap-6 rounded-[2rem] p-6 py-10 text-center sm:p-10">
        <ThemeToggle />
        <Link to="/" aria-label="BatGram home">
          <Brand variant="vertical" className="w-56" />
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">
          Your signal starts here.
        </h1>
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

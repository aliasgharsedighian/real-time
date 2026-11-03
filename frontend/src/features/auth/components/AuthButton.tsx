import { lazy, Suspense, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/shared/ui/button";
import { useSession } from "../session-context";
import UserButton from "./UserButton";

const AuthDialog = lazy(() => import("./AuthDialog"));

export default function AuthButton({ type }: { type: "header" | "button" }) {
  const { user } = useSession();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  if (user)
    return type === "header" ? (
      <UserButton />
    ) : (
      <Button onClick={() => navigate("/dashboard")}>Open chats</Button>
    );
  return (
    <>
      <Button className="brand-cta min-h-11 rounded-full px-5" variant={type === "header" ? "outline" : "default"} onClick={() => setOpen(true)}>
        {type === "header" ? "Sign In/Sign Up" : "Start Chatting Free"}
      </Button>
      {open && (
        <Suspense
          fallback={
            <span role="status" className="text-sm">
              Loading sign in…
            </span>
          }
        >
          <AuthDialog open={open} onOpenChange={setOpen} />
        </Suspense>
      )}
    </>
  );
}

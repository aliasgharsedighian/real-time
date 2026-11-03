import { Link } from "react-router-dom";
import AuthButton from "@/features/auth/components/AuthButton";
import { ThemeToggle } from "./ThemeToggle";
import { Brand } from "./Brand";

export default function Header() {
  return (
    <header className="mx-auto flex min-h-20 max-w-6xl items-center justify-between gap-3 border-b border-border/60 px-5 sm:px-8">
      <Link to="/" aria-label="BatGram home">
        <Brand className="w-36 sm:w-48" />
      </Link>
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <Link
          className="hidden text-sm hover:text-brand sm:block"
          to="/dashboard"
        >
          Chats
        </Link>
        <AuthButton type="header" />
      </div>
    </header>
  );
}

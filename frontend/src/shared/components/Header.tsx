import { Link } from "react-router-dom";
import AuthButton from "@/features/auth/components/AuthButton";
import { ThemeToggle } from "./ThemeToggle";

export default function Header() {
  return (
    <header className="flex h-15 items-center justify-between px-4 shadow-sm sm:px-6">
      <Link className="text-xl font-bold tracking-tight" to="/">
        Bat<span className="text-brand">Gram</span>
      </Link>
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <Link className="text-sm hover:text-brand" to="/dashboard">Dashboard</Link>
        <AuthButton type="header" />
      </div>
    </header>
  );
}

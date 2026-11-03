import { Link } from "react-router-dom";
import AuthButton from "@/features/auth/components/AuthButton";

export default function Header() {
  return (
    <header className="flex h-15 items-center justify-between px-4 shadow-sm sm:px-6">
      <Link className="font-medium uppercase tracking-widest" to="/dashboard">
        Dashboard
      </Link>
      <AuthButton type="header" />
    </header>
  );
}

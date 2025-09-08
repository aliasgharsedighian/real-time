"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AuthButton from "./AuthButton";

function Header() {
  const pathname = usePathname();

  const isDashboard = pathname.startsWith("/dashboard");
  return (
    <header className="flex items-center justify-between px-4 h-15 sm:px-6 shadow-sm">
      <Link className="font-medium uppercase tracking-widest" href="/dashboard">
        Dashboard
      </Link>
      <div>
        <AuthButton type="header" />
      </div>
    </header>
  );
}

export default Header;

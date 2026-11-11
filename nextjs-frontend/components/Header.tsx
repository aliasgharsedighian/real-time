"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import AuthButton from "./AuthButton";

function Header() {
  const pathname = usePathname();
  const setToken = useAuthStore((state) => state.setToken);
  const setUser = useAuthStore((state) => state.setUser);
  const token = useAuthStore((s) => s.token); // stored token in Zustand

  useEffect(() => {
    // Also check localStorage + cookies if needed
    const cookieToken = document.cookie.includes("token=");
    const localToken = localStorage.getItem("token");

    if (!token || !cookieToken || !localToken) {
      setToken(null);
      setUser(null);
    }
  }, [pathname]); // recheck when route changes

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

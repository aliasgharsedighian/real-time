import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Toaster } from "sonner";

type Theme = "dark" | "light";
const ThemeContext = createContext({ theme: "dark" as Theme, toggleTheme: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return localStorage.getItem("batgram-theme") === "light" ? "light" : "dark";
    } catch {
      return "dark";
    }
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      "content", theme === "dark" ? "#050A12" : "#ffffff",
    );
    try {
      localStorage.setItem("batgram-theme", theme);
    } catch { /* Theme switching still works when storage is unavailable. */ }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme: () => setTheme((current) => current === "dark" ? "light" : "dark") }}>
      {children}
      <Toaster theme={theme} position="top-center" richColors />
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

import { Moon, Sun } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { useTheme } from "./ThemeProvider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const label = `Switch to ${theme === "dark" ? "light" : "dark"} theme`;
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-11 shrink-0 rounded-full"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
    >
      {theme === "dark" ? <Sun /> : <Moon />}
    </Button>
  );
}

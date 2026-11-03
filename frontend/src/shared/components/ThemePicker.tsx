import { Check, Moon, Sun } from "lucide-react";
import { useTheme } from "./ThemeProvider";

export function ThemePicker() {
  const { theme, toggleTheme } = useTheme();
  return (
    <fieldset>
      <legend className="mb-3 text-sm font-semibold">Make it your own</legend>
      <div className="grid grid-cols-2 gap-3">
        {(["dark", "light"] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={theme === value}
            onClick={() => {
              if (theme !== value) toggleTheme();
            }}
            className={`rounded-2xl border p-3 text-left transition-colors ${theme === value ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border hover:border-primary/40"}`}
          >
            <span
              aria-hidden="true"
              className={`mb-3 flex h-16 flex-col items-end justify-center gap-2 rounded-lg border p-3 ${value === "dark" ? "border-[#1A2A3A] bg-[#050A12]" : "border-[#D9E6F2] bg-white"}`}
            >
              <span className="h-2 w-3/4 rounded-full bg-[#0077FF]/50" />
              <span
                className={`h-2 w-1/2 self-start rounded-full ${value === "dark" ? "bg-[#00D4FF]/30" : "bg-[#D9E6F2]"}`}
              />
            </span>
            <span className="flex items-center gap-2 text-sm font-medium">
              {value === "dark" ? (
                <Moon className="size-4" />
              ) : (
                <Sun className="size-4" />
              )}
              {value === "dark" ? "Dark" : "Light"}
              {theme === value && (
                <Check className="ml-auto size-4 text-brand" />
              )}
            </span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

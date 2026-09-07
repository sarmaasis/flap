import { Moon, Sun } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, getClerkToken } from "../lib/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

type Theme = "system" | "light" | "dark";
type Ctx = { theme: Theme; setTheme: (t: Theme) => void };

const ThemeContext = createContext<Ctx>({ theme: "system", setTheme: () => undefined });

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = theme === "dark" || (theme === "system" && prefersDark);
  root.classList.toggle("dark", dark);
  root.dataset.theme = dark ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem("flap-theme") as Theme | null;
    return saved || "system";
  });

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem("flap-theme", theme);
  }, [theme]);

  // This provider sits above ClerkProvider so the theme paints before auth
  // bootstraps, which means no session token exists while it mounts. Mirror the
  // choice to the account only when the user actually picks one and a token is
  // available; localStorage is what drives rendering either way.
  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    void (async () => {
      if (!(await getClerkToken())) return;
      await api.setTheme(next).catch(() => undefined);
    })();
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (theme === "system") applyTheme("system");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  return (
    <div className={`flex items-center gap-2 text-sm ${className}`}>
      <span className="inline-flex items-center gap-1.5 text-[var(--muted)]">
        {theme === "dark" ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
        Theme
      </span>
      <Select value={theme} onValueChange={(v) => setTheme(v as Theme)}>
        <SelectTrigger className="h-8 w-[120px]" aria-label="Color theme">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="system">System</SelectItem>
          <SelectItem value="light">Light</SelectItem>
          <SelectItem value="dark">Dark</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

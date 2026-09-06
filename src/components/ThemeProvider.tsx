import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "../lib/api";

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
    void api.setTheme(theme).catch(() => undefined);
  }, [theme]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (theme === "system") applyTheme("system");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme: setThemeState }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  return (
    <label className={`inline-flex items-center gap-2 text-sm ${className}`}>
      <span className="text-[var(--muted)]">Theme</span>
      <select
        className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 py-1"
        value={theme}
        onChange={(e) => setTheme(e.target.value as Theme)}
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  );
}

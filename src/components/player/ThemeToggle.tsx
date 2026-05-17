"use client";
import { Moon, Sun } from "lucide-react";
import * as React from "react";

type Theme = "dark" | "light";
const STORAGE_KEY = "reso-theme";

function readTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.getAttribute("data-theme") === "light"
    ? "light"
    : "dark";
}

export function ThemeToggle() {
  const [theme, setTheme] = React.useState<Theme>("dark");
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setTheme(readTheme());
    setMounted(true);
  }, []);

  const toggle = React.useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      const root = document.documentElement;
      if (next === "light") root.setAttribute("data-theme", "light");
      else root.removeAttribute("data-theme");
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {}
      return next;
    });
  }, []);

  const isLight = theme === "light";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isLight ? "Switch to dark theme" : "Switch to light theme"}
      title={isLight ? "Switch to dark theme" : "Switch to light theme"}
      className="grid size-9 cursor-pointer place-items-center rounded-full border border-line-subtle bg-paper/40 text-ink-soft backdrop-blur-md transition-colors hover:bg-paper-warm/60 hover:text-ink"
      suppressHydrationWarning
    >
      {mounted && isLight ? (
        <Moon className="size-4" strokeWidth={1.6} />
      ) : (
        <Sun className="size-4" strokeWidth={1.6} />
      )}
    </button>
  );
}

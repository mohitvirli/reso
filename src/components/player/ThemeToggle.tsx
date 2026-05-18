"use client";
import { gsap } from "@/lib/anim/gsap";
import { Moon, Sun } from "lucide-react";
import * as React from "react";

type Theme = "dark" | "light";
const STORAGE_KEY = "reso-theme";
const TRANSITION_MS = 400;

function readTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.getAttribute("data-theme") === "light"
    ? "light"
    : "dark";
}

export function ThemeToggle() {
  const [theme, setTheme] = React.useState<Theme>("dark");
  const [mounted, setMounted] = React.useState(false);
  const iconWrapRef = React.useRef<HTMLSpanElement>(null);
  const btnRef = React.useRef<HTMLButtonElement>(null);
  const transitionTimer = React.useRef<number | null>(null);

  React.useEffect(() => {
    setTheme(readTheme());
    setMounted(true);
  }, []);

  const toggle = React.useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      const root = document.documentElement;

      // Smooth color crossfade across the whole app.
      root.classList.add("theme-transitioning");
      if (transitionTimer.current != null) {
        clearTimeout(transitionTimer.current);
      }
      transitionTimer.current = window.setTimeout(() => {
        root.classList.remove("theme-transitioning");
        transitionTimer.current = null;
      }, TRANSITION_MS);

      if (next === "light") root.setAttribute("data-theme", "light");
      else root.removeAttribute("data-theme");
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {}

      // Icon swap — rotate + scale the wrapper. The icon itself swaps via
      // React on the next render; GSAP just hides the old one before the
      // swap and reveals the new one after.
      const wrap = iconWrapRef.current;
      if (wrap) {
        gsap.killTweensOf(wrap);
        gsap
          .timeline()
          .to(wrap, {
            rotate: -90,
            scale: 0.4,
            autoAlpha: 0,
            duration: 0.18,
            ease: "power2.in",
          })
          .set(wrap, { rotate: 90 })
          .to(wrap, {
            rotate: 0,
            scale: 1,
            autoAlpha: 1,
            duration: 0.28,
            ease: "back.out(2)",
          });
      }

      // Subtle press feedback on the button itself.
      const btn = btnRef.current;
      if (btn) {
        gsap.killTweensOf(btn);
        gsap.fromTo(
          btn,
          { scale: 0.92 },
          { scale: 1, duration: 0.35, ease: "elastic.out(1, 0.6)" }
        );
      }

      return next;
    });
  }, []);

  React.useEffect(() => {
    return () => {
      if (transitionTimer.current != null) {
        clearTimeout(transitionTimer.current);
      }
    };
  }, []);

  const isLight = theme === "light";

  return (
    <button
      ref={btnRef}
      type="button"
      onClick={toggle}
      aria-label={isLight ? "Switch to dark theme" : "Switch to light theme"}
      title={isLight ? "Switch to dark theme" : "Switch to light theme"}
      className="grid size-9 cursor-pointer place-items-center rounded-full border border-line-subtle bg-paper/40 text-ink-soft backdrop-blur-md hover:bg-paper-warm/60 hover:text-ink"
      suppressHydrationWarning
    >
      <span
        ref={iconWrapRef}
        className="grid place-items-center"
        style={{ willChange: "transform, opacity" }}
      >
        {mounted && isLight ? (
          <Moon className="size-4" strokeWidth={1.6} />
        ) : (
          <Sun className="size-4" strokeWidth={1.6} />
        )}
      </span>
    </button>
  );
}

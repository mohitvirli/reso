import * as React from "react";
import { cn } from "@/lib/util/cn";

type PillVariant = "outline" | "outline-accent" | "filled-accent" | "muted";

interface PillProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: PillVariant;
  asButton?: boolean;
  children: React.ReactNode;
}

/**
 * Mono-caps rounded pill. Used for genre tags, BPM/KEY badges, and the
 * "notch" pseudo-label at the top of the Stage card. Default is outline ink.
 */
export function Pill({
  variant = "outline",
  asButton = false,
  className,
  children,
  ...rest
}: PillProps) {
  const base =
    "inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] leading-none whitespace-nowrap select-none";
  const variants: Record<PillVariant, string> = {
    outline: "border border-line text-ink",
    "outline-accent": "border border-accent text-accent",
    "filled-accent":
      "bg-accent border border-accent text-paper",
    muted: "border border-line-subtle text-ink-soft",
  };
  const interactive = asButton
    ? "cursor-pointer transition-colors hover:bg-paper-warm"
    : "";

  return (
    <span
      className={cn(base, variants[variant], interactive, className)}
      {...rest}
    >
      {children}
    </span>
  );
}

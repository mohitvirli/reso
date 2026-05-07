"use client";
import { cn } from "@/lib/util/cn";
import * as React from "react";

type Variant = "outline" | "filled" | "ghost";
type Size = "md" | "lg";

interface ControlButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  active?: boolean;
  /** Optional 4-letter mono caps label rendered inside (e.g. SHFL, RPT). */
  label?: string;
}

/**
 * The signature transport button — square-ish, rounded corners, ink border.
 * `active` flips to the filled-accent variant; that's how RPT in the
 * wireframe announces it's on.
 */
export const ControlButton = React.forwardRef<
  HTMLButtonElement,
  ControlButtonProps
>(function ControlButton(
  {
    variant = "outline",
    size = "md",
    active = false,
    label,
    className,
    children,
    type = "button",
    ...rest
  },
  ref
) {
  const sizes: Record<Size, string> = {
    md: "h-14 w-14 rounded-xl",
    lg: "h-16 w-16 rounded-2xl",
  };
  const isFilled = variant === "filled" || active;
  const visual = isFilled
    ? "bg-accent border-accent text-paper hover:bg-accent-bright shadow-soft"
    : variant === "ghost"
      ? "border-transparent text-ink hover:bg-paper-warm"
      : "border-line-subtle text-ink hover:bg-paper-warm shadow-soft";

  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "relative grid place-items-center border bg-card",
        "transition-[background-color,transform,box-shadow] duration-150",
        "active:translate-y-px active:shadow-none",
        "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-card disabled:shadow-none",
        sizes[size],
        visual,
        className
      )}
      {...rest}
    >
      {label ? (
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] font-bold">
          {label}
        </span>
      ) : (
        children
      )}
    </button>
  );
});

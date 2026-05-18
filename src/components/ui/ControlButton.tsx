"use client";
import { cn } from "@/lib/util/cn";
import * as React from "react";

type Variant = "outline" | "filled" | "ghost";
type Size = "md" | "lg" | "xl";

interface ControlButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  active?: boolean;
  /** Optional 4-letter mono caps label rendered inside (e.g. SHFL, RPT). */
  label?: string;
  /** Render an outer ring fixed to the surface (doesn't scale with the knob).
   *  When enabled, LED (if `led`) is placed on the rail at 12 o'clock. */
  outerRail?: boolean;
  /** Show the green LED indicator on the outer rail (play/pause only). */
  led?: boolean;
  /** When `led` is true, drives bright (playing) vs dim (paused) state. */
  ledOn?: boolean;
}

const SIZE_CLASS: Record<Size, string> = {
  md: "h-14 w-14",
  lg: "h-16 w-16",
  xl: "h-20 w-20",
};

/**
 * Round vintage-radio knob — cream gradient body, concentric ring detail,
 * soft drop shadow that lifts on hover. With `outerRail`, an additional
 * dark ring is rendered as a sibling that stays put while the knob scales,
 * so the button doesn't read as "floating" on hover. The LED chip sits on
 * that rail at 12 o'clock when both `outerRail` and `led` are set.
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
    outerRail = false,
    led = false,
    ledOn = false,
    className,
    children,
    type = "button",
    ...rest
  },
  ref
) {
  const isFilled = variant === "filled" || active;
  const surface = isFilled
    ? "bg-accent border-accent text-paper hover:bg-accent-bright shadow-soft"
    : variant === "ghost"
      ? "border-transparent text-ink hover:bg-paper-warm"
      : "knob border-line-subtle text-ink shadow-soft";

  const button = (
    <button
      ref={ref}
      type={type}
      className={cn(
        "relative grid place-items-center cursor-pointer rounded-full",
        "transition-[background-color,transform,box-shadow,scale] duration-300",
        "active:translate-y-px active:shadow-none",
        "hover:shadow-soft-raised hover:scale-105",
        "disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed disabled:shadow-none disabled:hover:scale-100 disabled:hover:shadow-none disabled:active:translate-y-0 disabled:text-ink-soft",
        SIZE_CLASS[size],
        surface,
        // When wrapped in a rail, button has no extra outside margin
        outerRail ? "" : "",
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

  if (!outerRail) return button;

  // Wrap button + rail in a sized relative container so the rail stays
  // fixed on the surface while the knob scales on hover.
  return (
    <span
      className={cn(
        "relative inline-grid place-items-center",
        SIZE_CLASS[size]
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute rounded-full border z-0"
        style={{
          inset: -8,
          borderColor: "var(--color-line)",
        }}
      >
        {led ? <Led on={ledOn} /> : null}
      </span>
      <span className="relative z-10">{button}</span>
    </span>
  );
});

/**
 * LED chip on the outer rail at 12 o'clock — flat against the surface,
 * not extruding. Bright + glowing when "on" (playing), dim when "off".
 */
const LED_GREEN = "oklch(0.80 0.210 142)";
const LED_GREEN_DIM = "oklch(0.55 0.090 142)";

function Led({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className="absolute left-1/2 -translate-x-1/2 rounded-[1.5px]"
      style={{
        top: -4,
        width: 7,
        height: 9,
        background: on ? LED_GREEN : LED_GREEN_DIM,
        boxShadow: on ? `0 0 6px ${LED_GREEN}, 0 0 1px ${LED_GREEN}` : "none",
        opacity: on ? 1 : 0.5,
      }}
    />
  );
}

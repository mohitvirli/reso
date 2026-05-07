"use client";
import { usePlayerStore } from "@/lib/player/store";
import { Pill } from "@/components/ui/Pill";

/**
 * Tags + primary/secondary CTAs. Track title, artist/album, plays count,
 * and KEY/BPM live in the Stage header — that block sits visually with
 * the inset display where it belongs (matching the reference mock).
 */
export function TrackInfo() {
  const track = usePlayerStore((s) => s.track);

  const tags = track?.tags ?? [];
  const primary = tags[0];
  const rest = tags.slice(1, 5);
  const overflow = Math.max(0, tags.length - 5);

  return (
    <section className="space-y-5">
      {/* Tags */}
      <div className="flex flex-wrap items-center gap-1.5">
        {primary ? (
          <Pill variant="outline-accent">{primary}</Pill>
        ) : (
          <Pill variant="muted">untagged</Pill>
        )}
        {rest.map((t) => (
          <Pill key={t} variant="outline">
            {t}
          </Pill>
        ))}
        {track?.year ? <Pill variant="outline">{track.year}</Pill> : null}
        {overflow > 0 ? <Pill variant="outline">+{overflow}</Pill> : null}
      </div>

      {/* CTAs */}
      <div className="grid grid-cols-2 gap-3">
        <CtaButton variant="primary" disabled>
          Queue
        </CtaButton>
        <CtaButton variant="outline" disabled>
          Suggest
        </CtaButton>
      </div>
    </section>
  );
}

function CtaButton({
  variant,
  disabled,
  children,
}: {
  variant: "primary" | "outline";
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const base =
    "relative inline-flex h-12 w-full items-center justify-center gap-2 rounded-full font-mono text-[11px] uppercase tracking-[0.22em] transition-all";
  const styles =
    variant === "primary"
      ? "bg-accent text-paper hover:bg-accent-bright shadow-soft"
      : "border border-line text-ink hover:bg-paper-warm";

  return (
    <button
      type="button"
      disabled={disabled}
      className={`${base} ${styles} disabled:opacity-55 disabled:cursor-not-allowed`}
    >
      <span
        aria-hidden
        className={`size-1.5 rounded-full ${
          variant === "primary" ? "bg-paper" : "bg-accent"
        }`}
      />
      {children}
    </button>
  );
}

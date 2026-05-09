"use client";
import { seek } from "@/lib/player/controller";
import { usePlayerStore } from "@/lib/player/store";
import { formatTime } from "@/lib/util/time";
import { Replace } from "lucide-react";
import Image from "next/image";
import * as React from "react";
import { LiveWave } from "./LiveWave";
import { UploadGate } from "./UploadGate";

/**
 * Hero stack: album art + title/artist header → recessed display window
 * → KEY/BPM split below it.
 */
export function Stage() {
  const track = usePlayerStore((s) => s.track);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const swapMode = usePlayerStore((s) => s.swapMode);
  const setSwapMode = usePlayerStore((s) => s.setSwapMode);

  const title = track?.title ?? "Awaiting upload";
  const artist = track?.artist ?? "Drop a song to begin";
  const keyValue = track?.key ?? "—";
  const bpmValue = track?.bpm ? String(Math.round(track.bpm)) : "—";

  return (
    <section aria-label="Now playing" className="flex flex-col flex-grow gap-5">
      <div className="flex flex-col flex-grow align-items-center justify-center">
        {/* Album / upload region */}
        <div className="relative aspect-square w-full overflow-hidden rounded-2xl shadow-sleeve">
          {!track || swapMode ? (
            <UploadGate
              onCancel={track ? () => setSwapMode(false) : undefined}
            />
          ) : (
            <>
              {track.artworkUrl ? (
                <Image
                  src={track.artworkUrl}
                  alt={`${track.album} — cover`}
                  fill
                  sizes="(max-width: 480px) 100vw, 440px"
                  className="object-cover"
                  unoptimized
                  priority
                />
              ) : (
                <div className="grid h-full w-full place-items-center bg-paper-warm">
                  <span className="font-mono text-[11px] uppercase tracking-[0.28em] text-ink-soft">
                    No artwork
                  </span>
                </div>
              )}
              <button
                type="button"
                onClick={() => setSwapMode(true)}
                aria-label="Swap track"
                title="Swap track"
                className="absolute top-3 right-3 z-10 grid size-9 cursor-pointer place-items-center rounded-full border border-line bg-paper/80 text-ink shadow-soft backdrop-blur transition-colors hover:bg-paper"
              >
                <Replace className="size-4" strokeWidth={1.6} />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col justify-self-end gap-5">
        {/* Title + artist */}
        <header className="flex flex-col gap-1.5">
          <h1 className="truncate font-display h-10 text-[1.75rem] font-bold leading-[1.1] tracking-[-0.02em] text-ink">
            {title}
          </h1>
          <p className="truncate font-mono text-[12px] font-bold uppercase tracking-[0.22em] text-ink-soft">
            {artist}
          </p>
        </header>

        {/* The inset display window — recessed glass holding ticks, wave, knob */}
        <div className="display-inset display-sheen rounded-md px-4 pt-3 pb-2">
          <TickScale duration={duration} />
          <SeekArea
            duration={duration}
            currentTime={currentTime}
            isPlaying={isPlaying}
            disabled={!track}
            onSeek={seek}
          />
        </div>

        {/* KEY (left) + BPM (right), sitting below the display */}
        <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.20em] text-ink-soft">
          <span>
            Key <span className="font-bold text-ink">{keyValue}</span>
          </span>
          <span>
            BPM <span className="font-bold text-ink">{bpmValue}</span>
          </span>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── internals ─────────────────────────── */

/**
 * Tick scale at the top of the display — major ticks at 0/25/50/75/100% with
 * time labels, minor ticks every 5% in between.
 */
function TickScale({ duration }: { duration: number }) {
  const majors = React.useMemo(
    () =>
      [0, 0.25, 0.5, 0.75, 1].map((f) => ({
        fraction: f,
        label: duration > 0 ? formatTime(f * duration) : "—:—",
      })),
    [duration]
  );

  const minors = React.useMemo(
    () =>
      Array.from({ length: 21 }, (_, i) => i / 20).filter(
        (f) => !majors.some((m) => Math.abs(m.fraction - f) < 1e-3)
      ),
    [majors]
  );

  return (
    <div className="relative w-full">
      {/* Time labels */}
      <div className="relative h-3.5">
        {majors.map((m, i) => (
          <span
            key={m.fraction}
            className="absolute top-0 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-soft"
            style={{
              left: `${m.fraction * 100}%`,
              transform:
                i === 0
                  ? "translateX(0)"
                  : i === majors.length - 1
                    ? "translateX(-100%)"
                    : "translateX(-50%)",
            }}
          >
            {m.label}
          </span>
        ))}
      </div>

      {/* Tick marks */}
      <svg
        viewBox="0 0 200 12"
        preserveAspectRatio="none"
        className="block h-3 w-full"
        aria-hidden
      >
        <line
          x1="0"
          y1="11"
          x2="200"
          y2="11"
          stroke="var(--color-window-tick)"
          strokeWidth="0.5"
        />
        {minors.map((f) => (
          <line
            key={f}
            x1={f * 200}
            y1="7"
            x2={f * 200}
            y2="11"
            stroke="var(--color-window-tick)"
            strokeWidth="0.5"
          />
        ))}
        {majors.map((m) => (
          <line
            key={m.fraction}
            x1={m.fraction * 200}
            y1="2"
            x2={m.fraction * 200}
            y2="11"
            stroke="var(--color-ink)"
            strokeOpacity="0.6"
            strokeWidth="0.8"
          />
        ))}
      </svg>
    </div>
  );
}

interface SeekAreaProps {
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  disabled: boolean;
  onSeek: (s: number) => void;
}

function SeekArea({
  duration,
  currentTime,
  isPlaying,
  disabled,
  onSeek,
}: SeekAreaProps) {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const dragRef = React.useRef(false);

  const fraction =
    duration > 0 ? Math.max(0, Math.min(1, currentTime / duration)) : 0;

  const handleSeekFromClientX = (clientX: number) => {
    const wrap = wrapRef.current;
    if (!wrap || disabled || duration <= 0) return;
    const r = wrap.getBoundingClientRect();
    const f = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    onSeek(f * duration);
  };

  return (
    <div
      ref={wrapRef}
      role="slider"
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={Math.floor(duration)}
      aria-valuenow={Math.floor(currentTime)}
      tabIndex={disabled ? -1 : 0}
      className={[
        "relative mt-2 h-14 w-full select-none touch-none",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
      ].join(" ")}
      onPointerDown={(e) => {
        if (disabled) return;
        dragRef.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        handleSeekFromClientX(e.clientX);
      }}
      onPointerMove={(e) => {
        if (!dragRef.current) return;
        handleSeekFromClientX(e.clientX);
      }}
      onPointerUp={(e) => {
        dragRef.current = false;
        e.currentTarget.releasePointerCapture(e.pointerId);
      }}
      onPointerCancel={(e) => {
        dragRef.current = false;
        e.currentTarget.releasePointerCapture(e.pointerId);
      }}
    >
      {/* Real-time audio-reactive ribbon — bass on the left, highs near the
          playhead, calm on the right. Anchors to baseline at the playhead so
          the line flows cleanly through the centre of the glass knob. */}
      <LiveWave
        duration={duration}
        isPlaying={isPlaying}
        className="absolute inset-0 h-full w-full"
      />

      {/* Glass knob — apple liquid-glass slider with red playhead line */}
      <div
        aria-hidden
        className="glass-knob absolute rounded-[10px]"
        style={{
          left: `${fraction * 100}%`,
          top: -6,
          bottom: -6,
          width: 30,
          transform: "translateX(-50%)",
        }}
      >
        <span
          className="absolute left-1/2 top-2 bottom-2 w-px -translate-x-1/2"
          style={{ background: "var(--color-playhead)" }}
        />
      </div>
    </div>
  );
}


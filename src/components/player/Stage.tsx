"use client";
import { seek } from "@/lib/player/controller";
import { usePlayerStore } from "@/lib/player/store";
import { formatPlays } from "@/lib/util/format";
import { formatTime } from "@/lib/util/time";
import Image from "next/image";
import * as React from "react";
import { UploadGate } from "./UploadGate";

/**
 * Hero stack:
 *   1. Album art — large square, sleeve-elevated
 *   2. Waveform display — an INSET window in the cream surface, with a
 *      tick scale at the top (time labels), the wave traced in dark ink,
 *      and an apple-liquid-glass knob as the seek handle
 */
export function Stage() {
  const track = usePlayerStore((s) => s.track);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);

  const title = track?.title ?? "Awaiting upload";
  const artist = track?.artist ?? "—";
  const albumLine = track
    ? [track.album, track.year && `LP-${track.year}`].filter(Boolean).join(" · ")
    : "Drop a song to begin";
  const keyValue = track?.key ?? "—";
  const bpmValue = track?.bpm ? String(Math.round(track.bpm)) : "—";
  const playsValue = track?.plays ? formatPlays(track.plays) : "—";

  return (
    <section aria-label="Now playing" className="flex flex-col gap-5">
      {/* Album / upload region */}
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl shadow-sleeve">
        {track?.artworkUrl ? (
          <Image
            src={track.artworkUrl}
            alt={`${track.album} — cover`}
            fill
            sizes="(max-width: 480px) 100vw, 440px"
            className="object-cover"
            unoptimized
            priority
          />
        ) : track ? (
          <div className="grid h-full w-full place-items-center bg-paper-warm">
            <span className="font-mono text-[11px] uppercase tracking-[0.28em] text-ink-soft">
              No artwork
            </span>
          </div>
        ) : (
          <UploadGate />
        )}
      </div>

      {/* Track info header — title + artist/album on the left, plays + KEY/BPM
          on the right. Mirrors the layout above the display in the reference mock. */}
      <header className="flex flex-col gap-2.5">
        <div className="flex items-start justify-between gap-4">
          <h1 className="min-w-0 flex-1 truncate font-display text-[2.25rem] leading-[1.05] text-ink">
            {title}
          </h1>
          <div className="shrink-0 text-right">
            <p className="font-mono text-[9px] uppercase tracking-[0.20em] text-ink-soft">
              Number of plays
            </p>
            <p className="mt-0.5 font-mono text-[1.4rem] font-bold leading-none text-accent">
              {playsValue}
            </p>
          </div>
        </div>
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="truncate font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-ink">
              {artist}
            </p>
            <p className="truncate font-mono text-[10px] uppercase tracking-[0.22em] italic text-ink-soft">
              {albumLine}
            </p>
          </div>
          <p className="shrink-0 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">
            <span>Key</span>{" "}
            <span className="font-bold text-ink">{keyValue}</span>
            <span aria-hidden className="mx-1.5 text-ink-soft/40">
              |
            </span>
            <span>BPM</span>{" "}
            <span className="font-bold text-ink">{bpmValue}</span>
          </p>
        </div>
      </header>

      {/* The inset display window — recessed glass holding ticks, wave, knob */}
      <div className="display-inset display-sheen rounded-md px-4 pt-3 pb-2">
        <TickScale duration={duration} />
        <SeekArea
          duration={duration}
          currentTime={currentTime}
          disabled={!track}
          onSeek={seek}
        />
      </div>
    </section>
  );
}

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
        {/* Baseline */}
        <line
          x1="0"
          y1="11"
          x2="200"
          y2="11"
          stroke="var(--color-window-tick)"
          strokeWidth="0.5"
        />
        {/* Minor ticks */}
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
        {/* Major ticks — taller, stronger */}
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
  disabled: boolean;
  onSeek: (s: number) => void;
}

/**
 * The wave + glass knob layer. The whole strip is the seek surface; the
 * knob is purely decorative (positioned via fraction).
 */
function SeekArea({ duration, currentTime, disabled, onSeek }: SeekAreaProps) {
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
      {/* Center baseline */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-1/2 h-px"
        style={{ background: "var(--color-window-tick)" }}
      />

      {/* Wave path — kept as-is, drawn in dark ink */}
      <svg
        aria-hidden
        viewBox="0 0 200 56"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
      >
        <path
          d={STATIC_WAVE}
          fill="none"
          stroke="var(--color-ink)"
          strokeOpacity="0.78"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {/* Glass knob — apple liquid-glass slider with red playhead line.
          Sized to match the reference mock: roughly square, with the knob
          slightly taller than the wave region so it lifts off the surface. */}
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

/**
 * Hand-tuned static waveform path — gentle peaks over a baseline.
 * 200×56 viewBox to match the compressed wave area height.
 */
const STATIC_WAVE =
  "M0,32 C6,30 10,22 16,22 C22,22 24,28 30,25 C36,22 38,14 44,12 C50,10 54,20 60,18 C66,16 70,8 76,5 C82,2 86,14 92,14 C98,14 102,20 108,17 C114,14 118,5 124,4 C130,3 134,12 140,14 C146,16 150,8 156,10 C162,12 166,20 172,20 C178,20 182,14 188,17 C194,20 198,28 200,30";

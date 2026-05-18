"use client";
import type { AnalysisSegment } from "@/lib/analysis/client";
import { seek } from "@/lib/player/controller";
import { usePlayerStore } from "@/lib/player/store";
import { formatTime } from "@/lib/util/time";
import Image from "next/image";
import * as React from "react";
import { LiveWave } from "./LiveWave";

/**
 * Hero stack: album art + title/artist header → recessed display window
 * → KEY/BPM split below it.
 */
export function Stage() {
  const track = usePlayerStore((s) => s.track);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const analysisStatus = usePlayerStore((s) => s.analysisStatus);
  const analysisError = usePlayerStore((s) => s.analysisError);
  const segments = usePlayerStore((s) => s.analysis?.segments);

  const currentSegment = React.useMemo(() => {
    if (!segments) return null;
    return (
      segments.find((s) => currentTime >= s.start && currentTime < s.end) ??
      null
    );
  }, [segments, currentTime]);

  const title = track?.title ?? "Reso";
  const artist = track?.artist ?? "Pick a track from the queue";
  const keyValue = track?.key ?? "—";
  const bpmValue = track?.bpm ? String(Math.round(track.bpm)) : "—";

  // Short label for the inline chip. Tooltip carries the full error.
  const statusLabel =
    analysisStatus === "pending"
      ? "analyzing"
      : analysisStatus === "error"
        ? (analysisError ?? "Analysis failed")
        : analysisStatus === "unsupported"
          ? "mp3/wav only"
          : null;
  const statusTitle =
    analysisStatus === "error" && analysisError
      ? `Analysis failed: ${analysisError}`
      : statusLabel;

  return (
    <section aria-label="Now playing" className="flex flex-col flex-grow gap-5">
      <div className="flex flex-col flex-grow align-items-center justify-center">
        {/* Album / upload region */}
        <div
          data-anim="album"
          className="relative aspect-square w-full overflow-hidden rounded-2xl shadow-sleeve"
        >
          {track && track.artworkUrl ? (
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
            <div className="grid h-full w-full place-items-center bg-paper-warm/40">
              <div className="flex flex-col items-center gap-3 px-6 text-center">
                <span className="font-display text-[2rem] font-bold tracking-[-0.02em] text-ink">
                  Reso
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
                  {track ? "No artwork" : "Listen closer"}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col justify-self-end gap-5">
        {/* Title + artist */}
        <header data-anim="header" className="flex flex-col gap-1.5">
          <h1 className="truncate font-display h-10 text-[1.75rem] font-bold leading-[1.1] tracking-[-0.02em] text-ink">
            {title}
          </h1>
          <p className="truncate font-mono text-[14px] font-bold uppercase tracking-[0.22em] text-ink-soft">
            {artist}
          </p>
        </header>

        {/* The inset display window — recessed glass holding ticks, wave, knob */}
        <div
          data-anim="display"
          className="display-inset display-sheen rounded-md px-4 pt-3 pb-2"
        >
          <TickScale duration={duration} segments={segments ?? null} />
          <SeekArea
            duration={duration}
            currentTime={currentTime}
            isPlaying={isPlaying}
            disabled={!track}
            onSeek={seek}
          />
        </div>

        {/* KEY (left) + BPM (right), sitting below the display */}
        <div
          data-anim="meta"
          className="flex min-w-0 items-baseline justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.20em] text-ink-soft"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="shrink-0">
              Key <span className="font-bold text-ink">{keyValue}</span>
            </span>
            {statusLabel && (
              <span
                title={statusTitle ?? undefined}
                aria-label={statusTitle ?? undefined}
                className={[
                  "ml-1 inline-flex min-w-0 max-w-[140px] items-center gap-1.5 normal-case tracking-normal",
                  analysisStatus === "error"
                    ? "text-danger"
                    : "text-ink-soft",
                ].join(" ")}
              >
                <span
                  aria-hidden
                  className={[
                    "size-1.5 shrink-0 rounded-full",
                    analysisStatus === "pending"
                      ? "bg-accent animate-pulse"
                      : analysisStatus === "error"
                        ? "bg-danger"
                        : "bg-ink-soft/40",
                  ].join(" ")}
                />
                <span className="truncate text-[9px]">{statusLabel}</span>
              </span>
            )}
          </span>
          <span className="flex items-center gap-3">
            {currentSegment && (
              <span className="flex items-center gap-1.5">
                <span className="text-ink-soft">Section</span>
                <span className="font-bold text-ink">
                  {currentSegment.label}
                </span>
              </span>
            )}
            <span>
              BPM <span className="font-bold text-ink">{bpmValue}</span>
            </span>
          </span>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── internals ─────────────────────────── */

interface MajorTick {
  fraction: number;
  /** Seconds the tick maps to. Used by click-to-seek. */
  time: number;
  /** Display label below the tick. */
  label: string;
  /** Original segment label, used to size the tick. */
  segmentLabel?: string;
}

/**
 * Relative tick height by segment importance. Range 0–1, multiplied into the
 * SVG y1 coordinate so taller ticks come down further from the top edge.
 */
function tickWeight(label?: string): number {
  if (!label) return 0.5;
  const key = label.toLowerCase().trim();
  switch (key) {
    case "chorus":
      return 1;
    case "verse":
    case "bridge":
    case "intro":
    case "outro":
      return 0.7;
    case "pre-chorus":
    case "prechorus":
    case "inst":
    case "instrumental":
    case "solo":
    case "break":
    case "breakdown":
      return 0.45;
    case "start":
    case "end":
      return 0.35;
    default:
      return 0.6;
  }
}

/**
 * Monochrome ink opacity per segment label. Higher opacity = stronger
 * presence, used to distinguish chorus from supporting sections without
 * introducing color.
 */
function segmentFillOpacity(label?: string): number {
  if (!label) return 0.05;
  const key = label.toLowerCase().trim();
  switch (key) {
    case "chorus":
      return 0.3;
    case "verse":
      return 0.2;
    case "bridge":
      return 0.18;
    case "pre-chorus":
    case "prechorus":
      return 0.15;
    case "inst":
    case "instrumental":
    case "solo":
      return 0.12;
    case "break":
    case "breakdown":
      return 0.1;
    case "intro":
    case "outro":
      return 0.06;
    case "start":
    case "end":
      return 0.04;
    default:
      return 0.05;
  }
}

/**
 * Build major ticks from segment boundaries. Each segment.start becomes a
 * tick, plus the final segment.end so the scale terminates cleanly. Labels
 * that would overlap their predecessor are dropped (their ticks stay).
 */
function buildSegmentTicks(
  segments: AnalysisSegment[],
  duration: number
): MajorTick[] {
  const ticks: MajorTick[] = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg.start < 0 || seg.start > duration) continue;
    const prev = ticks[ticks.length - 1];
    // Skip near-duplicate boundaries (allin1 sometimes emits a 0–0.04 "start").
    if (prev && Math.abs(prev.fraction - seg.start / duration) < 0.005) {
      // Promote to the higher-weight label so chorus etc. dominates.
      if (tickWeight(seg.label) > tickWeight(prev.segmentLabel)) {
        prev.segmentLabel = seg.label;
      }
      continue;
    }
    ticks.push({
      fraction: seg.start / duration,
      time: seg.start,
      label: formatTime(seg.start),
      segmentLabel: seg.label,
    });
  }
  const last = segments[segments.length - 1];
  if (last && last.end <= duration) {
    const f = last.end / duration;
    const prev = ticks[ticks.length - 1];
    if (!prev || Math.abs(prev.fraction - f) > 0.005) {
      ticks.push({
        fraction: f,
        time: last.end,
        label: formatTime(last.end),
      });
    }
  }
  return ticks;
}

/** Build the default quarter-point ticks when no segments are available. */
function buildDefaultTicks(duration: number): MajorTick[] {
  return [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    fraction: f,
    time: duration > 0 ? f * duration : 0,
    label: duration > 0 ? formatTime(f * duration) : "—:—",
  }));
}

function TickScale({
  duration,
  segments,
}: {
  duration: number;
  segments: AnalysisSegment[] | null;
}) {
  const majors = React.useMemo<MajorTick[]>(() => {
    if (duration > 0 && segments && segments.length > 0) {
      return buildSegmentTicks(segments, duration);
    }
    return buildDefaultTicks(duration);
  }, [duration, segments]);

  /**
   * Show time labels for the first tick (0:00) and chorus boundaries — and
   * drop any that would collide with the song-length label permanently
   * pinned to the right edge. The end label is rendered outside this map.
   */
  const visibleLabels = React.useMemo(() => {
    const LABEL_WIDTH_PCT = 6;
    const MIN_GAP_PCT = 0.5;

    interface Slot {
      left: number;
      right: number;
    }

    // Anchored slots — these are always rendered, so chorus labels must
    // dodge them.
    const placed: Slot[] = [];
    if (duration > 0) {
      placed.push({ left: 100 - LABEL_WIDTH_PCT, right: 100 });
    }

    interface Candidate extends Slot {
      index: number;
      priority: number;
    }

    const candidates: Candidate[] = [];
    majors.forEach((m, i) => {
      const isFirst = i === 0;
      const isChorus = m.segmentLabel?.toLowerCase() === "chorus";
      if (!isFirst && !isChorus) return;

      const center = m.fraction * 100;
      const left = isFirst ? center : center - LABEL_WIDTH_PCT / 2;
      const right = left + LABEL_WIDTH_PCT;
      const priority = isFirst ? 2 : 1;
      candidates.push({ index: i, left, right, priority });
    });

    candidates.sort((a, b) =>
      b.priority - a.priority || a.left - b.left
    );

    const kept = new Set<number>();
    for (const c of candidates) {
      const collides = placed.some(
        (p) => !(c.right + MIN_GAP_PCT <= p.left || c.left >= p.right + MIN_GAP_PCT)
      );
      if (!collides) {
        kept.add(c.index);
        placed.push({ left: c.left, right: c.right });
      }
    }

    return kept;
  }, [majors, duration]);

  const hasSegments = duration > 0 && !!segments && segments.length > 0;

  return (
    <div className="relative w-full">
      {/* Time labels — start (0:00), chorus boundaries, total length on right. */}
      <div className="relative h-3.5">
        {majors.map((m, i) => {
          if (!visibleLabels.has(i)) return null;
          const transform =
            i === 0 ? "translateX(0)" : "translateX(-50%)";
          const emphasis =
            m.segmentLabel?.toLowerCase() === "chorus"
              ? "text-ink"
              : "text-ink-soft";
          return (
            <span
              key={`${m.fraction}-${i}`}
              className={`absolute top-0 font-mono text-[9px] uppercase tracking-[0.12em] ${emphasis}`}
              style={{ left: `${m.fraction * 100}%`, transform }}
            >
              {m.label}
            </span>
          );
        })}
        {duration > 0 && (
          <span
            className="absolute top-0 right-0 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-soft"
            title="Total length"
          >
            {formatTime(duration)}
          </span>
        )}
      </div>

      {/* Tick row with segment-tinted backgrounds. Click any segment span
          to jump to its start. */}
      <div className="relative h-3 w-full">
        <svg
          viewBox="0 0 200 12"
          preserveAspectRatio="none"
          className="block h-full w-full"
          aria-hidden
        >
          {hasSegments && (
            <g shapeRendering="crispEdges">
              {segments!.map((seg, i) => {
                const x = (Math.max(0, seg.start) / duration) * 200;
                // Extend each rect to the next segment's start (or duration)
                // so adjacent fills overlap by zero and leave no hairline gap.
                const next = segments![i + 1];
                const endTime =
                  next != null ? next.start : Math.min(duration, seg.end);
                const x2 = (endTime / duration) * 200;
                const w = Math.max(0.2, x2 - x);
                return (
                  <rect
                    key={`bg-${i}-${seg.start}`}
                    x={x}
                    y="0"
                    width={w}
                    height="12"
                    fill="var(--color-ink)"
                    fillOpacity={segmentFillOpacity(seg.label)}
                  />
                );
              })}
            </g>
          )}

          <line
            x1="0"
            y1="11"
            x2="200"
            y2="11"
            stroke="var(--color-window-tick)"
            strokeWidth="0.5"
          />

          {majors.map((m, i) => {
            const weight = tickWeight(m.segmentLabel);
            const y1 = 11 - weight * 10;
            const isChorus = m.segmentLabel?.toLowerCase() === "chorus";
            return (
              <line
                key={`${m.fraction}-${i}`}
                x1={m.fraction * 200}
                y1={y1}
                x2={m.fraction * 200}
                y2="11"
                stroke="var(--color-ink)"
                strokeOpacity={isChorus ? 0.85 : 0.55}
                strokeWidth={isChorus ? 1.1 : 0.7}
              />
            );
          })}
        </svg>

        {/* Click targets span the full width of each segment. */}
        {hasSegments &&
          segments!.map((seg, i) => {
            const leftPct = (Math.max(0, seg.start) / duration) * 100;
            const widthPct =
              ((Math.min(duration, seg.end) - Math.max(0, seg.start)) /
                duration) *
              100;
            if (widthPct <= 0) return null;
            return (
              <button
                key={`hit-${i}-${seg.start}`}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  seek(seg.start);
                }}
                title={`${seg.label} · ${formatTime(seg.start)}`}
                aria-label={`Jump to ${seg.label} at ${formatTime(seg.start)}`}
                className="absolute top-0 bottom-0 cursor-pointer bg-transparent transition-colors hover:bg-ink/5"
                style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
              />
            );
          })}
      </div>
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


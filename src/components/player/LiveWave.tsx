"use client";
import * as React from "react";
import { getEngine } from "@/lib/audio/engine";

/**
 * Real-time audio-reactive ribbon — Trap-Nation-style. A single canvas
 * stroke morphs vertically with the live FFT and flows horizontally as a
 * traveling wave. Spatially:
 *
 *   active region (0 → playhead)
 *     bass   → big slow rounded swells on the left
 *     mids   → smoother flowing motion in the centre
 *     highs  → finer fast ripples right up to the playhead
 *
 *   calm region (playhead → right edge)
 *     subtle breathing only — never goes silent, never spikes
 *
 * The line is anchored at u=0, at the playhead, and at u=1, so it always
 * passes cleanly through the centre of the glass knob.
 *
 * Smoothing: asymmetric attack/release on band levels, soft tanh-style
 * compression on summed amplitude, and quadratic-Bézier midpoint curves
 * across ~96 control points keep the ribbon feeling analog and luxurious.
 */

interface Band {
  lo: number;
  hi: number;
  /** Spatial centre within the active region (0 = playhead-far, 1 = playhead) */
  cx: number;
  spread: number;
  gain: number;
  /** dB at which this band's normalized level is 0 (silence floor) */
  minDb: number;
  /** dB at which this band's normalized level is 1 (loud ceiling) */
  maxDb: number;
}

// Per-band dB ranges compensate for music's natural energy distribution:
// bass sits -50→-8, highs sit -68→-25. Equal NORM across bands → all read.
const BANDS: Band[] = [
  // Bass — far left, big slow swells
  { lo: 20, hi: 150, cx: 0.15, spread: 0.22, gain: 1.0, minDb: -55, maxDb: -10 },
  // Low-mid — left-of-centre, broad
  { lo: 150, hi: 600, cx: 0.4, spread: 0.22, gain: 1.2, minDb: -60, maxDb: -15 },
  // Upper-mid — centre to right, smoother
  { lo: 600, hi: 2500, cx: 0.65, spread: 0.2, gain: 1.5, minDb: -65, maxDb: -20 },
  // Highs — right edge near the playhead, fine ripples
  { lo: 2500, hi: 9000, cx: 0.88, spread: 0.16, gain: 1.9, minDb: -68, maxDb: -25 },
];

const POINT_COUNT = 192;
const ATTACK = 0.45;
const RELEASE = 0.1;
const FLOW_SPEED = 0.045;

// Chirp endpoints — log-interp spatial frequency across the active region.
// Low (slow) on the left for bass, high (fast) near the playhead for highs.
const SPATIAL_FREQ_LEFT = 1.2;
const SPATIAL_FREQ_RIGHT = 18;

export interface LiveWaveProps {
  duration: number;
  isPlaying: boolean;
  className?: string;
}

export function LiveWave({ duration, isPlaying, className }: LiveWaveProps) {
  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const bandLevelsRef = React.useRef<Float32Array>(
    new Float32Array(BANDS.length)
  );
  const flowRef = React.useRef(0);

  React.useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const engine = getEngine();
    let raf = 0;
    let freqBin: Float32Array<ArrayBuffer> | null = null;
    let bandRanges: { start: number; end: number }[] | null = null;

    // Resolve --color-ink at mount; OKLCH literal is the fallback.
    const inkColor =
      getComputedStyle(document.documentElement)
        .getPropertyValue("--color-ink")
        .trim() || "oklch(0.22 0.015 50)";

    const ensureBands = () => {
      const a = engine.analyser;
      if (!a || bandRanges) return;
      const sr = a.context.sampleRate;
      const binHz = sr / a.fftSize;
      bandRanges = BANDS.map((b) => ({
        start: Math.max(0, Math.floor(b.lo / binHz)),
        end: Math.min(a.frequencyBinCount - 1, Math.ceil(b.hi / binHz)),
      }));
      freqBin = new Float32Array(a.frequencyBinCount);
    };

    const draw = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = rect.width;
      const h = rect.height;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const baseline = h / 2;
      const ampScale = h * 0.42;
      const playFrac =
        duration > 0
          ? Math.max(0, Math.min(1, engine.audio.currentTime / duration))
          : 0;
      const playX = playFrac * w;
      const levels = bandLevelsRef.current;

      // Update band levels from FFT (asymmetric attack/release).
      const a = engine.analyser;
      if (isPlaying && a) {
        ensureBands();
        if (freqBin && bandRanges) {
          a.getFloatFrequencyData(freqBin);
          for (let b = 0; b < BANDS.length; b++) {
            const { start, end } = bandRanges[b];
            const band = BANDS[b];
            let sum = 0;
            let n = 0;
            for (let i = start; i <= end; i++) {
              sum += freqBin[i];
              n++;
            }
            const avgDb = n > 0 ? sum / n : band.minDb;
            // Per-band dB → 0..1 normalization gives mids/highs equal footing
            // with bass despite their lower absolute energy.
            const range = Math.max(1, band.maxDb - band.minDb);
            const norm = Math.max(
              0,
              Math.min(1, (avgDb - band.minDb) / range)
            );
            const ease = norm > levels[b] ? ATTACK : RELEASE;
            levels[b] = levels[b] + (norm - levels[b]) * ease;
          }
        }
      } else {
        // Bleed off levels so the active region collapses to flat smoothly.
        for (let b = 0; b < BANDS.length; b++) levels[b] *= 1 - RELEASE;
      }

      // Flow advance proportional to total band energy → motion only when music plays
      let totalEnergy = 0;
      for (let b = 0; b < BANDS.length; b++) totalEnergy += levels[b];
      flowRef.current += totalEnergy * FLOW_SPEED;

      // Pre-compute chirp phase across the active region using trapezoidal
      // integration of an exponentially-interpolated spatial frequency.
      // Closed form for log-linear chirp:
      //   φ(lu) = 2π · (e^(logL + k·lu) − e^logL) / k,  k = logR − logL
      const logL = Math.log(SPATIAL_FREQ_LEFT);
      const logR = Math.log(SPATIAL_FREQ_RIGHT);
      const k = logR - logL;
      const expL = Math.exp(logL);
      const phaseAt = (lu: number): number => {
        if (Math.abs(k) < 1e-6) return expL * lu * Math.PI * 2;
        return ((Math.exp(logL + k * lu) - expL) / k) * Math.PI * 2;
      };

      // Build control points
      const xs = new Float32Array(POINT_COUNT);
      const ys = new Float32Array(POINT_COUNT);

      for (let p = 0; p < POINT_COUNT; p++) {
        const u = p / (POINT_COUNT - 1);
        const x = u * w;
        xs[p] = x;

        let yNorm = 0;

        if (playX > 1 && x <= playX) {
          // ── ACTIVE REGION ────────────────────────────────────────────
          const lu = x / playX; // 0..1 within active region

          // Amplitude — sum of band Gaussians at their preferred lu position
          let A = 0;
          for (let b = 0; b < BANDS.length; b++) {
            const d = (lu - BANDS[b].cx) / BANDS[b].spread;
            A += levels[b] * BANDS[b].gain * Math.exp(-d * d);
          }

          const phase = phaseAt(lu) + flowRef.current;
          const wave = Math.sin(phase);
          // Endpoint envelope — anchors lu=0 and lu=1 to baseline
          const env = Math.sin(Math.PI * lu);
          const raw = A * env * wave;
          // Soft tanh-style clip — keeps the ribbon graceful even at peaks
          yNorm = raw / (1 + Math.abs(raw) * 0.3);
        }
        // Right of the playhead: dead flat. No idle, no residual.

        ys[p] = baseline - yNorm * ampScale;
      }

      // Force exact baseline at the playhead so the ribbon flows cleanly
      // through the centre of the glass knob.
      let nearestIdx = 0;
      let nearestD = Infinity;
      for (let p = 0; p < POINT_COUNT; p++) {
        const d = Math.abs(xs[p] - playX);
        if (d < nearestD) {
          nearestD = d;
          nearestIdx = p;
        }
      }
      if (nearestD < w / POINT_COUNT) ys[nearestIdx] = baseline;

      // Stroke
      ctx.strokeStyle = inkColor;
      ctx.lineWidth = 1.6;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(xs[0], ys[0]);
      // Quadratic Bézier through midpoints — no straight segments, no kinks
      for (let p = 0; p < POINT_COUNT - 1; p++) {
        const xc = (xs[p] + xs[p + 1]) / 2;
        const yc = (ys[p] + ys[p + 1]) / 2;
        ctx.quadraticCurveTo(xs[p], ys[p], xc, yc);
      }
      ctx.lineTo(xs[POINT_COUNT - 1], ys[POINT_COUNT - 1]);
      ctx.stroke();
    };

    const tick = () => {
      draw();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const ro = new ResizeObserver(() => draw());
    ro.observe(wrap);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [duration, isPlaying]);

  return (
    <div ref={wrapRef} className={className}>
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}

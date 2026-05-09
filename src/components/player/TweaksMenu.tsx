"use client";
import * as React from "react";
import { RotateCcw, Settings2, X } from "lucide-react";
import {
  BAND_HZ,
  BAND_LABELS,
  useTuning,
  type TuningState,
} from "@/lib/player/tuning";

/**
 * Floating tweaks panel for the LiveWave visualizer. The toggle button sits
 * fixed bottom-right; opening expands a bottom-sheet (mobile) / corner card
 * (desktop) of sliders. LiveWave reads tuning live every frame, so edits
 * land instantly.
 */
export function TweaksMenu() {
  const isOpen = useTuning((s) => s.isOpen);
  const setOpen = useTuning((s) => s.setOpen);
  const buttonVisible = useTuning((s) => s.buttonVisible);
  const toggleButton = useTuning((s) => s.toggleButton);
  const reset = useTuning((s) => s.reset);

  // Press `T` to reveal/hide the floating tweaks toggle. Skip when typing.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "t" && e.key !== "T") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tgt = e.target as HTMLElement | null;
      if (
        tgt &&
        (tgt.tagName === "INPUT" ||
          tgt.tagName === "TEXTAREA" ||
          tgt.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      toggleButton();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleButton]);

  return (
    <>
      {buttonVisible && !isOpen && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open wave tweaks"
          title="Wave tweaks (T to hide)"
          className="fixed bottom-6 right-6 z-40 grid size-11 cursor-pointer place-items-center rounded-full border border-line bg-paper-warm text-ink shadow-soft transition-colors hover:bg-paper-edge"
        >
          <Settings2 className="size-4" strokeWidth={1.6} />
        </button>
      )}
      {isOpen && (
        <aside
          role="dialog"
          aria-label="Wave tweaks"
          className="fixed inset-x-0 bottom-0 z-40 max-h-[80vh] overflow-y-auto rounded-t-2xl border border-line bg-paper shadow-sleeve sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[340px] sm:rounded-2xl"
        >
          <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line-subtle bg-paper px-4 py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
              Wave Tweaks
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={reset}
                aria-label="Reset to defaults"
                title="Reset"
                className="grid size-7 cursor-pointer place-items-center rounded-sm text-ink-soft hover:bg-paper-warm"
              >
                <RotateCcw className="size-3.5" strokeWidth={1.6} />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="grid size-7 cursor-pointer place-items-center rounded-sm text-ink-soft hover:bg-paper-warm"
              >
                <X className="size-3.5" strokeWidth={1.6} />
              </button>
            </div>
          </header>

          <div className="space-y-5 p-4">
            <Section title="Energy easing">
              <ParamSlider
                paramKey="attack"
                label="Attack (snap up)"
                min={0.05}
                max={1}
                step={0.01}
              />
              <ParamSlider
                paramKey="release"
                label="Release (decay)"
                min={0.01}
                max={0.5}
                step={0.01}
              />
            </Section>

            <Section title="Flow & chirp">
              <ParamSlider
                paramKey="flowSpeed"
                label="Flow speed"
                min={0}
                max={0.2}
                step={0.005}
              />
              <ParamSlider
                paramKey="freqLeft"
                label="Spatial freq · left"
                min={0.2}
                max={4}
                step={0.1}
              />
              <ParamSlider
                paramKey="freqRight"
                label="Spatial freq · right"
                min={4}
                max={40}
                step={0.5}
              />
            </Section>

            <Section title="Bands">
              {BAND_LABELS.map((label, i) => (
                <BandBlock key={label} label={label} index={i} />
              ))}
            </Section>
          </div>
        </aside>
      )}
    </>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
        {title}
      </p>
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

type ScalarKey = "attack" | "release" | "flowSpeed" | "freqLeft" | "freqRight";

function ParamSlider({
  paramKey,
  label,
  min,
  max,
  step,
}: {
  paramKey: ScalarKey;
  label: string;
  min: number;
  max: number;
  step: number;
}) {
  const value = useTuning((s) => s[paramKey] as number);
  const setParam = useTuning((s) => s.setParam);
  const decimals = decimalsFor(step);
  return (
    <label className="block">
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-ink-soft">{label}</span>
        <span className="font-mono text-[11px] text-ink">
          {value.toFixed(decimals)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => setParam(paramKey, Number(e.target.value))}
        className={SLIDER_CLASS}
        style={sliderStyle(value, min, max)}
      />
    </label>
  );
}

function BandBlock({ label, index }: { label: string; index: number }) {
  const band = useTuning((s: TuningState) => s.bands[index]);
  const setBand = useTuning((s) => s.setBand);
  const hz = BAND_HZ[index];
  return (
    <div className="rounded-md border border-line-subtle bg-paper-warm/50 p-2.5">
      <div className="flex items-baseline justify-between">
        <p className="text-[11px] text-ink">{label}</p>
        <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-soft">
          {hz.lo}–{hz.hi} Hz
        </p>
      </div>
      <div className="mt-2 space-y-1.5">
        <BandSlider
          label="Position"
          value={band.cx}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => setBand(index, { cx: v })}
        />
        <BandSlider
          label="Spread"
          value={band.spread}
          min={0.04}
          max={0.5}
          step={0.01}
          onChange={(v) => setBand(index, { spread: v })}
        />
        <BandSlider
          label="Gain"
          value={band.gain}
          min={0}
          max={5}
          step={0.05}
          onChange={(v) => setBand(index, { gain: v })}
        />
        <BandSlider
          label="Min dB"
          value={band.minDb}
          min={-90}
          max={-20}
          step={1}
          onChange={(v) => setBand(index, { minDb: v })}
        />
        <BandSlider
          label="Max dB"
          value={band.maxDb}
          min={-40}
          max={0}
          step={1}
          onChange={(v) => setBand(index, { maxDb: v })}
        />
      </div>
    </div>
  );
}

function BandSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const decimals = decimalsFor(step);
  return (
    <label className="block">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] text-ink-soft">{label}</span>
        <span className="font-mono text-[10px] text-ink">
          {value.toFixed(decimals)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={SLIDER_CLASS}
        style={sliderStyle(value, min, max)}
      />
    </label>
  );
}

function decimalsFor(step: number): number {
  if (step >= 1) return 0;
  if (step >= 0.1) return 1;
  if (step >= 0.01) return 2;
  return 3;
}

function sliderStyle(
  value: number,
  min: number,
  max: number
): React.CSSProperties {
  const pct = ((value - min) / (max - min)) * 100;
  return {
    background: `linear-gradient(to right, var(--color-accent) 0%, var(--color-accent) ${pct}%, var(--color-line-subtle) ${pct}%, var(--color-line-subtle) 100%)`,
  };
}

const SLIDER_CLASS =
  "h-1 w-full cursor-pointer appearance-none rounded-full bg-line-subtle [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-accent [&::-moz-range-thumb]:border-0";

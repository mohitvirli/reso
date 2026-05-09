"use client";
import { create } from "zustand";

/**
 * Live-tunable parameters for the LiveWave visualizer. LiveWave reads from
 * `useTuning.getState()` inside its rAF loop on every frame, so slider
 * edits land instantly with no effect re-runs.
 */

export interface BandTuning {
  /** Spatial centre within the active region (0 = left, 1 = playhead) */
  cx: number;
  /** Gaussian half-width — wider = bleeds into neighbours */
  spread: number;
  /** Visual gain — counters music's natural energy distribution */
  gain: number;
  /** dB at which this band's normalized level is 0 (silence floor) */
  minDb: number;
  /** dB at which this band's normalized level is 1 (loud ceiling) */
  maxDb: number;
}

export const BAND_LABELS = ["Bass", "Low-mid", "Upper-mid", "Highs"];

export const BAND_HZ: Array<{ lo: number; hi: number }> = [
  { lo: 20, hi: 150 },
  { lo: 150, hi: 600 },
  { lo: 600, hi: 2500 },
  { lo: 2500, hi: 9000 },
];

const DEFAULT_BANDS: BandTuning[] = [
  { cx: 0.05, spread: 0.17, gain: 3.45, minDb: -70, maxDb: -5 },
  { cx: 0.4, spread: 0.14, gain: 2.7, minDb: -66, maxDb: -15 },
  { cx: 0.72, spread: 0.13, gain: 3.45, minDb: -65, maxDb: -20 },
  { cx: 1.0, spread: 0.19, gain: 4.25, minDb: -89, maxDb: -19 },
];

const DEFAULTS = {
  bands: DEFAULT_BANDS.map((b) => ({ ...b })),
  attack: 0.86,
  release: 0.16,
  flowSpeed: 0.135,
  freqLeft: 2.9,
  freqRight: 32.5,
};

export interface TuningState {
  bands: BandTuning[];
  attack: number;
  release: number;
  flowSpeed: number;
  freqLeft: number;
  freqRight: number;
  isOpen: boolean;
  /** Whether the floating tweaks-toggle button is visible. Hidden by
   *  default; press `T` to reveal. Once revealed, persists for the session. */
  buttonVisible: boolean;
  setBand: (i: number, patch: Partial<BandTuning>) => void;
  setParam: <
    K extends "attack" | "release" | "flowSpeed" | "freqLeft" | "freqRight",
  >(
    key: K,
    value: number
  ) => void;
  setOpen: (v: boolean) => void;
  toggleOpen: () => void;
  toggleButton: () => void;
  reset: () => void;
}

export const useTuning = create<TuningState>((set) => ({
  ...DEFAULTS,
  isOpen: false,
  buttonVisible: false,
  setBand: (i, patch) =>
    set((s) => {
      const bands = s.bands.slice();
      bands[i] = { ...bands[i], ...patch };
      return { bands };
    }),
  setParam: (key, value) => set({ [key]: value } as Partial<TuningState>),
  setOpen: (isOpen) => set({ isOpen }),
  toggleOpen: () => set((s) => ({ isOpen: !s.isOpen })),
  toggleButton: () => set((s) => ({ buttonVisible: !s.buttonVisible })),
  reset: () =>
    set({ ...DEFAULTS, bands: DEFAULT_BANDS.map((b) => ({ ...b })) }),
}));

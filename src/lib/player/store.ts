import { create } from "zustand";
import type { AnalysisSegment } from "@/lib/analysis/client";

export type RepeatMode = "off" | "all" | "one";

export interface LibraryTrack {
  /** Display name (without extension). */
  name: string;
  /** Public URL to fetch. */
  url: string;
}

export type AnalysisStatus = "idle" | "pending" | "ready" | "error" | "unsupported";

export interface AnalysisData {
  beats: number[];
  downbeats: number[];
  beatPositions: number[];
  segments: AnalysisSegment[];
  /** Duration as reported by the analyzer (independent of HTMLMediaElement). */
  duration: number;
}

export interface TrackMeta {
  title: string;
  artist: string;
  album: string;
  year: number | null;
  durationSec: number;
  artworkUrl: string | null;
  fileName: string;
  bytes: number;
  /** Cosmetic fields — analyzer/scrobbler will populate later. */
  bpm: number | null;
  key: string | null;
  plays: number | null;
  tags: string[];
}

interface PlayerState {
  track: TrackMeta | null;
  isPlaying: boolean;
  isLoading: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  /** When true, the album region shows the UploadGate again so the user can
   *  swap to a different file or demo while a track is already loaded. */
  swapMode: boolean;

  analysisStatus: AnalysisStatus;
  analysisError: string | null;
  analysis: AnalysisData | null;

  library: LibraryTrack[];
  libraryIndex: number | null;
  libraryLoaded: boolean;
  libraryError: string | null;
  /** Probed durations (seconds) keyed by library track URL. */
  libraryDurations: Record<string, number>;
  /** Side panel open/closed. */
  libraryOpen: boolean;

  setLibrary: (tracks: LibraryTrack[]) => void;
  setLibraryError: (err: string | null) => void;
  setLibraryIndex: (i: number | null) => void;
  setLibraryDuration: (url: string, sec: number) => void;
  setLibraryOpen: (v: boolean) => void;

  setTrack: (track: TrackMeta | null) => void;
  setSwapMode: (v: boolean) => void;
  setAnalysisStatus: (s: AnalysisStatus, error?: string | null) => void;
  setAnalysis: (a: AnalysisData | null) => void;
  patchTrack: (patch: Partial<TrackMeta>) => void;
  setIsPlaying: (v: boolean) => void;
  setIsLoading: (v: boolean) => void;
  setCurrentTime: (t: number) => void;
  setDuration: (d: number) => void;
  setVolume: (v: number) => void;
  setMuted: (v: boolean) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  track: null,
  isPlaying: false,
  isLoading: false,
  currentTime: 0,
  duration: 0,
  volume: 0.85,
  muted: false,
  shuffle: false,
  repeat: "off",
  swapMode: false,

  analysisStatus: "idle",
  analysisError: null,
  analysis: null,

  library: [],
  libraryIndex: null,
  libraryLoaded: false,
  libraryError: null,
  libraryDurations: {},
  libraryOpen: false,

  setLibrary: (library) => set({ library, libraryLoaded: true }),
  setLibraryError: (libraryError) => set({ libraryError, libraryLoaded: true }),
  setLibraryIndex: (libraryIndex) => set({ libraryIndex }),
  setLibraryDuration: (url, sec) =>
    set((s) => ({ libraryDurations: { ...s.libraryDurations, [url]: sec } })),
  setLibraryOpen: (libraryOpen) => set({ libraryOpen }),

  setSwapMode: (swapMode) => set({ swapMode }),
  setTrack: (track) =>
    set((s) => {
      // Clean up any stale artwork object URL
      if (s.track?.artworkUrl && s.track.artworkUrl !== track?.artworkUrl) {
        URL.revokeObjectURL(s.track.artworkUrl);
      }
      return {
        track,
        currentTime: 0,
        duration: track?.durationSec ?? 0,
        isPlaying: false,
        // New track invalidates previous analysis.
        analysisStatus: "idle",
        analysisError: null,
        analysis: null,
      };
    }),
  setAnalysisStatus: (analysisStatus, analysisError = null) =>
    set({ analysisStatus, analysisError }),
  setAnalysis: (analysis) => set({ analysis }),
  patchTrack: (patch) =>
    set((s) => (s.track ? { track: { ...s.track, ...patch } } : s)),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  setDuration: (duration) => set({ duration }),
  setVolume: (volume) => set({ volume, muted: volume === 0 }),
  setMuted: (muted) => set({ muted }),
  toggleShuffle: () => set((s) => ({ shuffle: !s.shuffle })),
  cycleRepeat: () =>
    set((s) => ({
      repeat: s.repeat === "off" ? "all" : s.repeat === "all" ? "one" : "off",
    })),
}));

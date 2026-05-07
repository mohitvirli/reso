import { create } from "zustand";

export type RepeatMode = "off" | "all" | "one";

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

  setTrack: (track: TrackMeta | null) => void;
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
      };
    }),
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

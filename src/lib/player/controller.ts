/**
 * Glue between the Zustand player store and the imperative AudioEngine.
 * Single-track Phase 1 — no library, no persistence.
 */
import { parseBlob } from "music-metadata";
import { getEngine } from "@/lib/audio/engine";
import { usePlayerStore, type TrackMeta } from "./store";

let listenersWired = false;

/** Wire HTMLMediaElement events into the store. Call once on mount. */
export function wireEngineListeners(): () => void {
  const engine = getEngine();
  if (listenersWired) return () => undefined;
  listenersWired = true;

  const set = usePlayerStore.setState;

  const onTimeUpdate = () => set({ currentTime: engine.audio.currentTime });
  const onLoadedMetadata = () =>
    set({
      duration: Number.isFinite(engine.audio.duration)
        ? engine.audio.duration
        : 0,
      isLoading: false,
    });
  const onPlay = () => set({ isPlaying: true });
  const onPause = () => set({ isPlaying: false });
  const onWaiting = () => set({ isLoading: true });
  const onCanPlay = () => set({ isLoading: false });
  const onEnded = () => {
    const { repeat } = usePlayerStore.getState();
    if (repeat === "one") {
      engine.seek(0);
      void engine.play();
    } else {
      set({
        isPlaying: false,
        currentTime: engine.audio.duration || 0,
      });
    }
  };
  const onVolumeChange = () =>
    set({ volume: engine.audio.volume, muted: engine.audio.muted });

  engine.on("timeupdate", onTimeUpdate);
  engine.on("loadedmetadata", onLoadedMetadata);
  engine.on("play", onPlay);
  engine.on("pause", onPause);
  engine.on("waiting", onWaiting);
  engine.on("canplay", onCanPlay);
  engine.on("ended", onEnded);
  engine.on("volumechange", onVolumeChange);

  const { volume, muted } = usePlayerStore.getState();
  engine.setVolume(volume);
  engine.setMuted(muted);

  return () => {
    engine.off("timeupdate", onTimeUpdate);
    engine.off("loadedmetadata", onLoadedMetadata);
    engine.off("play", onPlay);
    engine.off("pause", onPause);
    engine.off("waiting", onWaiting);
    engine.off("canplay", onCanPlay);
    engine.off("ended", onEnded);
    engine.off("volumechange", onVolumeChange);
    listenersWired = false;
  };
}

/** Load + auto-play a single audio file. */
export async function loadFile(file: File): Promise<void> {
  usePlayerStore.setState({ isLoading: true });
  try {
    const meta = await parseBlob(file).catch(() => null);

    const pic = meta?.common.picture?.[0];
    const artworkBlob = pic
      ? new Blob([new Uint8Array(pic.data)], { type: pic.format })
      : null;
    const artworkUrl = artworkBlob ? URL.createObjectURL(artworkBlob) : null;

    const track: TrackMeta = {
      title:
        meta?.common.title?.trim() ||
        file.name.replace(/\.[^.]+$/, ""),
      artist:
        meta?.common.artist?.trim() ||
        meta?.common.albumartist?.trim() ||
        "Unknown artist",
      album: meta?.common.album?.trim() || "—",
      year: meta?.common.year ?? null,
      durationSec: meta?.format.duration ?? 0,
      artworkUrl,
      fileName: file.name,
      bytes: file.size,
      bpm: meta?.common.bpm ?? null,
      key: meta?.common.key ?? null,
      plays: null,
      tags: (meta?.common.genre ?? []).slice(0, 5),
    };

    usePlayerStore.getState().setTrack(track);

    const engine = getEngine();
    await engine.load(file);
    await engine.play();
  } catch (err) {
    console.error("Failed to load file", err);
    usePlayerStore.setState({ isLoading: false, isPlaying: false });
  }
}

export async function togglePlayPause(): Promise<void> {
  const { track } = usePlayerStore.getState();
  if (!track) return;
  await getEngine().toggle();
}

export function seek(seconds: number): void {
  getEngine().seek(seconds);
  usePlayerStore.setState({ currentTime: seconds });
}

export function seekRelative(deltaSec: number): void {
  const { currentTime, duration } = usePlayerStore.getState();
  seek(Math.max(0, Math.min(duration, currentTime + deltaSec)));
}

export function setVolume(v: number): void {
  const clamped = Math.max(0, Math.min(1, v));
  getEngine().setVolume(clamped);
  usePlayerStore.setState({ volume: clamped, muted: clamped === 0 });
}

export function toggleMute(): void {
  const { muted } = usePlayerStore.getState();
  getEngine().setMuted(!muted);
  usePlayerStore.setState({ muted: !muted });
}

export function toggleShuffle(): void {
  usePlayerStore.getState().toggleShuffle();
}

export function cycleRepeat(): void {
  usePlayerStore.getState().cycleRepeat();
}

/** Phase 1: prev/next replay the same track. Wire to a queue when added. */
export async function next(): Promise<void> {
  const engine = getEngine();
  engine.seek(0);
  await engine.play();
}

export async function previous(): Promise<void> {
  const engine = getEngine();
  if (engine.audio.currentTime > 3) {
    engine.seek(0);
  } else {
    engine.seek(0);
  }
  if (engine.audio.paused) await engine.play();
}

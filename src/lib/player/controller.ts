/**
 * Glue between the Zustand player store and the imperative AudioEngine.
 * Single-track Phase 1 — no library, no persistence.
 */
import { parseBlob } from "music-metadata";
import { getEngine } from "@/lib/audio/engine";
import {
  analyzeFile,
  isAnalyzable,
  type AnalysisResult,
} from "@/lib/analysis/client";
import {
  getCachedAnalysis,
  putCachedAnalysis,
} from "@/lib/analysis/store";
import { usePlayerStore, type TrackMeta } from "./store";

let analysisAbort: AbortController | null = null;

/**
 * Session-scoped cache of analysis results keyed by SHA-256 of file bytes.
 * Robust to renames, demo re-fetches (which reset lastModified), and the same
 * audio uploaded via different paths. In-flight requests dedupe by hash too.
 */
const analysisCache = new Map<string, AnalysisResult>();
const analysisInflight = new Map<string, Promise<AnalysisResult>>();

async function hashFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

function applyAnalysisToStore(result: AnalysisResult): void {
  const store = usePlayerStore.getState();
  store.setAnalysis({
    beats: result.beats,
    downbeats: result.downbeats,
    beatPositions: result.beat_positions,
    segments: result.segments,
    duration: result.duration,
  });
  store.patchTrack({
    bpm: Number.isFinite(result.bpm) ? Math.round(result.bpm) : null,
    key: result.key,
  });
  store.setAnalysisStatus("ready");
}

/**
 * Map raw fetch/API errors to short, user-friendly labels for the UI.
 * The full error still lands in console for debugging.
 */
function friendlyAnalysisError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (/502|unreachable|Failed to fetch|NetworkError/i.test(raw)) {
    return "Analyzer offline";
  }
  if (/400/.test(raw)) return "Unsupported file";
  if (/timeout/i.test(raw)) return "Analyzer timed out";
  if (/aborted/i.test(raw)) return "Cancelled";
  return "Analysis failed";
}

/** Run analysis in the background; never throws. */
async function runAnalysis(file: File): Promise<void> {
  const store = usePlayerStore;
  if (!isAnalyzable(file)) {
    store.getState().setAnalysisStatus("unsupported");
    return;
  }

  analysisAbort?.abort();
  const ctrl = new AbortController();
  analysisAbort = ctrl;
  store.getState().setAnalysisStatus("pending");

  let key: string;
  try {
    key = await hashFile(file);
  } catch (err) {
    if (ctrl.signal.aborted) return;
    console.error("[analysis] hashing failed", err);
    store.getState().setAnalysisStatus("error", "Could not read file");
    return;
  }
  if (ctrl.signal.aborted) return;

  const cached = analysisCache.get(key);
  if (cached) {
    applyAnalysisToStore(cached);
    return;
  }

  try {
    const persisted = await getCachedAnalysis(key);
    if (ctrl.signal.aborted) return;
    if (persisted) {
      // AnalysisRecord extends AnalysisResult; the extra hash/createdAt fields
      // are harmless here since applyAnalysisToStore only reads known keys.
      analysisCache.set(key, persisted);
      applyAnalysisToStore(persisted);
      return;
    }
  } catch (err) {
    console.warn("[analysis] idb read failed; continuing to network", err);
  }

  // Coalesce concurrent requests for the same content.
  // Do NOT bind the fetch to ctrl.signal: UI swaps must not cancel an inflight
  // analysis. Otherwise re-clicking the same demo before the first run
  // finishes would re-fire the API call and never populate the cache.
  let pending = analysisInflight.get(key);
  if (!pending) {
    pending = analyzeFile(file).then(async (r) => {
      analysisCache.set(key, r);
      try {
        await putCachedAnalysis(key, r);
      } catch (err) {
        console.warn("[analysis] idb write failed", err);
      }
      return r;
    });
    analysisInflight.set(key, pending);
    pending.finally(() => analysisInflight.delete(key));
  }

  try {
    const result = await pending;
    if (ctrl.signal.aborted) return;
    applyAnalysisToStore(result);
  } catch (err) {
    if (ctrl.signal.aborted) return;
    console.error("[analysis] failed", err);
    store.getState().setAnalysisStatus("error", friendlyAnalysisError(err));
  }
}

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
    const { repeat, library, libraryIndex } = usePlayerStore.getState();
    if (repeat === "one") {
      engine.seek(0);
      void engine.play();
      return;
    }
    if (library.length > 0) {
      const isLast =
        libraryIndex != null && libraryIndex >= library.length - 1;
      if (!isLast || repeat === "all") {
        void next();
        return;
      }
    }
    set({
      isPlaying: false,
      currentTime: engine.audio.duration || 0,
    });
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
    usePlayerStore.setState({ swapMode: false });

    const engine = getEngine();
    await engine.load(file);
    await engine.play();

    // Fire-and-forget. Player works immediately; analysis fills in later.
    void runAnalysis(file);
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

/** Fetch a library track by URL and load it as the current track. */
export async function playLibraryIndex(index: number): Promise<void> {
  const { library } = usePlayerStore.getState();
  if (index < 0 || index >= library.length) return;
  const item = library[index];
  usePlayerStore.getState().setLibraryIndex(index);
  try {
    const res = await fetch(item.url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const file = new File([blob], item.name, {
      type: blob.type || "audio/mpeg",
    });
    await loadFile(file);
  } catch (err) {
    console.error("Library load failed", err);
    usePlayerStore.setState({ isLoading: false });
  }
}

export async function next(): Promise<void> {
  const { library, libraryIndex, shuffle } = usePlayerStore.getState();
  if (library.length === 0) {
    const engine = getEngine();
    engine.seek(0);
    await engine.play();
    return;
  }
  let nextIdx: number;
  if (shuffle && library.length > 1) {
    do {
      nextIdx = Math.floor(Math.random() * library.length);
    } while (nextIdx === libraryIndex);
  } else {
    nextIdx =
      libraryIndex == null ? 0 : (libraryIndex + 1) % library.length;
  }
  await playLibraryIndex(nextIdx);
}

export async function previous(): Promise<void> {
  const engine = getEngine();
  // If past 3s into the current track, prev rewinds rather than skipping back.
  if (engine.audio.currentTime > 3) {
    engine.seek(0);
    if (engine.audio.paused) await engine.play();
    return;
  }
  const { library, libraryIndex } = usePlayerStore.getState();
  if (library.length === 0) {
    engine.seek(0);
    if (engine.audio.paused) await engine.play();
    return;
  }
  const prevIdx =
    libraryIndex == null
      ? 0
      : (libraryIndex - 1 + library.length) % library.length;
  await playLibraryIndex(prevIdx);
}

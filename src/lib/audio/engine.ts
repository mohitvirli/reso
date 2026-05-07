/**
 * Audio engine — singleton orchestrating the live playback graph.
 *
 *   HTMLAudioElement → MediaElementSource → AnalyserNode (tap)
 *                                        → GainNode → AudioContext.destination
 *
 * The analyser is placed pre-gain so volume changes don't affect what we
 * visualize. The realtime AnalyserNode isn't used by the progress bar in
 * Phase 1 (we use baked peaks instead) but it's wired for Phase 2 visualizers.
 *
 * Browser quirk: AudioContext often starts suspended until a user gesture
 * resumes it. `play()` calls `ctx.resume()` first.
 */

type Listener<T = Event> = (event: T) => void;

export class AudioEngine {
  readonly audio: HTMLAudioElement;
  private ctx: AudioContext | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  analyser: AnalyserNode | null = null;
  private gain: GainNode | null = null;
  private currentObjectURL: string | null = null;

  constructor() {
    this.audio = new Audio();
    this.audio.preload = "metadata";
    this.audio.crossOrigin = "anonymous";
  }

  /** Lazy-create the audio graph on first user gesture. */
  ensureGraph(): void {
    if (this.ctx) return;
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    this.ctx = new Ctor();
    this.source = this.ctx.createMediaElementSource(this.audio);
    this.analyser = this.ctx.createAnalyser();
    // 4096 → ~10.7 Hz per bin at 44.1kHz, enough to resolve sub-bass cleanly.
    this.analyser.fftSize = 4096;
    // Lighter native smoothing — the FrequencyProgress view applies its own
    // temporal lerp, layering on top of this would feel sluggish.
    this.analyser.smoothingTimeConstant = 0.7;
    this.gain = this.ctx.createGain();
    this.source.connect(this.analyser);
    this.analyser.connect(this.gain);
    this.gain.connect(this.ctx.destination);
  }

  /** Swap the audio source. Revokes the previous object URL. */
  async load(blob: Blob): Promise<void> {
    if (this.currentObjectURL) {
      URL.revokeObjectURL(this.currentObjectURL);
      this.currentObjectURL = null;
    }
    this.currentObjectURL = URL.createObjectURL(blob);
    this.audio.src = this.currentObjectURL;
    // Force the element to load; awaits the loadedmetadata event implicitly.
    this.audio.load();
  }

  async play(): Promise<void> {
    this.ensureGraph();
    if (this.ctx?.state === "suspended") await this.ctx.resume();
    await this.audio.play();
  }

  pause(): void {
    this.audio.pause();
  }

  toggle(): Promise<void> | void {
    return this.audio.paused ? this.play() : this.pause();
  }

  seek(seconds: number): void {
    if (Number.isFinite(seconds)) {
      this.audio.currentTime = Math.max(0, seconds);
    }
  }

  setVolume(volume: number): void {
    const v = Math.max(0, Math.min(1, volume));
    this.audio.volume = v;
    if (this.gain) this.gain.gain.value = 1; // gain stays at unity; element handles vol
  }

  setMuted(muted: boolean): void {
    this.audio.muted = muted;
  }

  on<K extends keyof HTMLMediaElementEventMap>(
    type: K,
    listener: Listener<HTMLMediaElementEventMap[K]>
  ): void {
    this.audio.addEventListener(type, listener as EventListener);
  }

  off<K extends keyof HTMLMediaElementEventMap>(
    type: K,
    listener: Listener<HTMLMediaElementEventMap[K]>
  ): void {
    this.audio.removeEventListener(type, listener as EventListener);
  }

  destroy(): void {
    if (this.currentObjectURL) URL.revokeObjectURL(this.currentObjectURL);
    this.audio.pause();
    this.audio.removeAttribute("src");
    this.audio.load();
    this.ctx?.close();
  }
}

let _engine: AudioEngine | null = null;

/** Get the singleton engine. Must only be called in the browser. */
export function getEngine(): AudioEngine {
  if (typeof window === "undefined") {
    throw new Error("AudioEngine is browser-only");
  }
  if (!_engine) _engine = new AudioEngine();
  return _engine;
}

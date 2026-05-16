# reso

A web-based music player that analyzes uploaded tracks and visualizes their structure — BPM, key, beats, downbeats, and song sections (intro / verse / chorus / bridge / outro). Built with Next.js 16 (App Router), React 19, Zustand, Tailwind 4.

Reso is a frontend. It depends on a sibling Python service, [`reso-analysis`](#reso-analysis-companion-service), for the actual audio analysis.

## Quick start

Requirements:
- Bun (or npm/pnpm/yarn) for the Next app
- The `reso-analysis` service running locally on `:8000` (see below)

```bash
cp .env.local.example .env.local   # ANALYSIS_API_URL=http://localhost:8000
bun install
bun dev                              # → http://localhost:3000
```

Drop an `.mp3` or `.wav` onto the album region (or pick a demo). Playback starts immediately. Analysis runs in the background and populates BPM, key, and the segment-aware time scale 15–35s later (M4 Air, 4-min track).

## Architecture

```
┌─────────────┐    multipart    ┌──────────────────┐    multipart    ┌────────────────────┐
│  Browser    │ ──────────────► │  Next.js proxy   │ ──────────────► │  reso-analysis API │
│  (reso)     │                 │  /api/analyze    │                 │  FastAPI :8000     │
└─────────────┘                 └──────────────────┘                 └────────────────────┘
       │                                                                       │
       │ 1. hash file (SHA-256)                                                 │
       │ 2. check in-memory Map      ◄─── 3-tier cache ───┐                    │
       │ 3. check IndexedDB                                │                    │
       │ 4. POST /api/analyze       ─────────────────────► │ ──────────────────►│
       │ 5. write both caches       ◄─────────────────────┘ ◄──────────────────│
       │ 6. apply to Zustand store                                              │
       │ 7. UI re-renders TickScale + KEY/BPM                                   │
       ▼
```

### Frontend pieces

| Module | Role |
|---|---|
| [`src/lib/player/store.ts`](src/lib/player/store.ts) | Zustand store: `track`, transport state, `analysis` slice |
| [`src/lib/player/controller.ts`](src/lib/player/controller.ts) | `loadFile`, transport actions, three-tier analysis cache, `runAnalysis` |
| [`src/lib/analysis/client.ts`](src/lib/analysis/client.ts) | `analyzeFile()`, `isAnalyzable()`, response types |
| [`src/lib/analysis/store.ts`](src/lib/analysis/store.ts) | IndexedDB persistence (`reso-analysis-cache` DB) |
| [`src/app/api/analyze/route.ts`](src/app/api/analyze/route.ts) | Next.js proxy → FastAPI, streams multipart body, exposes `GET` health |
| [`src/components/player/Stage.tsx`](src/components/player/Stage.tsx) | Hero stack, segment-aware `TickScale`, click-to-seek, glass knob |
| [`src/components/player/LiveWave.tsx`](src/components/player/LiveWave.tsx) | Real-time audio-reactive waveform across the seek area |

### Analysis result shape

```ts
interface AnalysisResult {
  bpm: number;
  key: string;            // e.g. "A minor"
  beats: number[];        // seconds
  downbeats: number[];    // seconds
  beat_positions: number[]; // 1..4 per beat
  segments: { start: number; end: number; label: string }[];
  duration: number;       // seconds
}
```

`bpm` and `key` are patched into `track`. The rest lands in `analysis` for the UI to render.

## Caching strategy

Analyzing a 4-min track on M4 Air takes 15–35s. Re-analysis on every demo click would be unacceptable, so the controller runs a three-tier cache keyed by file content:

1. **Module-scope `Map<hash, AnalysisResult>`** — instant, lost on reload
2. **IndexedDB (`reso-analysis-cache.analyses`)** — survives reload, ~few-ms async lookup
3. **Network** — `/api/analyze` → FastAPI service, terminal fallback

Hash is `SHA-256` of the full file bytes via `crypto.subtle.digest`. Robust against:
- Renames (file picker assigns new names)
- Demo re-fetches (`new File()` resets `lastModified`)
- The same audio uploaded via different paths

### Inflight de-duplication

Critical detail: the network fetch is **not bound to the UI's `AbortController`**. UI swaps (clicking a new demo) only cancel _which result is applied_; the inflight request runs to completion and writes both caches. Without this, rapid clicks on the same track would cancel the first analysis before it could cache, causing it to refire on every click.

```ts
analysisAbort?.abort();       // cancel UI application of prior result
const ctrl = new AbortController();
// hashFile … cache lookups …
let pending = analysisInflight.get(key);
if (!pending) {
  pending = analyzeFile(file).then(r => { memoryCache.set(key,r); persist(key,r); return r; });
  inflight.set(key, pending);
}
const result = await pending;
if (!ctrl.signal.aborted) applyAnalysisToStore(result);
```

### Legacy DB cleanup

Prior dev iterations created a `reso` IndexedDB that was missing the object store. `store.ts` deletes it once on first access and opens a fresh `reso-analysis-cache` DB.

## UI: segment-aware time scale

The tick scale under the seek area mirrors the song's structure rather than uniform quarter-points:

- **Ticks** at every segment boundary, height scaled by importance — chorus full-height, verse/bridge 70%, inst/break 45%, intro/outro stub 35%
- **Background tints** monochrome black-opacity per segment label — chorus 14%, verse 9%, bridge 8%, etc. Paper texture reads through.
- **Time labels** only for `0:00`, chorus boundaries, and total duration (pinned right). A collision algorithm drops chorus labels that would overlap the anchored end label.
- **Click targets** span the full width of each segment — click a section to jump to its start. No tick-centered hit targets; the colored region is the button.
- **Section pill** beside BPM shows the current segment as playback advances.

The fallback for tracks without analysis is the classic 5-tick `0/25/50/75/100%` scale.

## Error handling

Status chip next to KEY shows:
- `analyzing` (pulsing accent dot) while pending
- `mp3/wav only` for unsupported formats — playback still works, analysis skipped
- A friendly error label on failure: `Analyzer offline` (502/network), `Unsupported file` (400), `Analyzer timed out`, `Cancelled`, or generic `Analysis failed`
- Tooltip carries the full upstream message

idb read/write failures degrade gracefully — the network call still completes and the in-memory cache still serves the session.

## Environment

`.env.local`:

```
ANALYSIS_API_URL=http://localhost:8000
```

The variable is server-only — the browser hits `/api/analyze` and Next.js proxies upstream. This keeps the analyzer URL off the client and lets you swap to a remote service later without code changes.

## reso-analysis companion service

A standalone Python FastAPI service at [`../reso-analysis`](../reso-analysis), wrapping [`all-in-one-mlx`](https://pypi.org/project/all-in-one-mlx/) (MLX port of harmonix beat/segment models, Apple Silicon) and `librosa` (chroma-based key detection).

### Endpoints

| Method | Path | Description |
|---|---|---|
| `GET`  | `/`        | API info |
| `GET`  | `/health`  | `{ "status": "ok" }` |
| `POST` | `/analyze` | Multipart upload (`file` field, mp3/wav) → `AnalysisResult` JSON |

### Pipeline per request

1. **Decode** — if mp3, transcode to wav via `ffmpeg` (avoids the 20–40 ms beat offset `allin1-mlx` exhibits on compressed audio)
2. **Structure** — `allin1-mlx` CLI on the wav with bundled MLX weights, emits beats/downbeats/segments/BPM JSON
3. **Key** — `librosa.feature.chroma_cqt` + Krumhansl–Schmuckler major/minor profile correlation
4. **Duration** — `librosa.get_duration` (independent of `allin1` output)
5. **Cleanup** — temp dir removed after response

`allin1-mlx` analysis runs inside `asyncio.to_thread` so the FastAPI event loop stays responsive. Single request at a time — no queue. Adequate for local Reso dev.

### Run locally

```bash
cd ../reso-analysis
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Requires `ffmpeg` on PATH (`brew install ffmpeg`) and a populated `mlx-weights/` directory with harmonix fold weights.

### Why a separate service?

- **Heavy native deps** (mlx, librosa, ffmpeg) don't belong in a Next.js app
- **Performance** — Python/MLX is the right environment for the model, not Node
- **Reusability** — same API can later back a hosted version (Replicate alt) without changes to Reso
- **Latency budget** — the proxy in `/api/analyze` streams multipart, so the only overhead is one localhost hop

## Project structure (relevant slices)

```
src/
├── app/
│   └── api/
│       ├── analyze/route.ts     # streaming proxy to reso-analysis
│       └── demo/route.ts        # lists files under public/demo/
├── components/
│   └── player/
│       ├── Stage.tsx            # hero + TickScale + SeekArea
│       ├── LiveWave.tsx
│       ├── Transport.tsx
│       ├── UploadGate.tsx
│       └── TrackInfo.tsx
└── lib/
    ├── analysis/
    │   ├── client.ts            # POST /api/analyze
    │   └── store.ts             # IndexedDB
    ├── audio/engine.ts          # HTMLMediaElement wrapper
    └── player/
        ├── controller.ts        # loadFile, runAnalysis, transport actions
        ├── store.ts             # Zustand state
        └── tuning.ts
```

## Known limits / not implemented

- Single-track playback only — no queue, no library, no persistence beyond analysis cache
- Analysis service must be running locally; remote-only deployment needs auth + a job queue
- Hashing reads the full file into memory once (~50–100 ms for typical track) — fine up to ~50 MB
- No format conversion in the browser — non-mp3/wav files play but skip analysis silently

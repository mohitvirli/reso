# reso

A web-based music player that analyzes uploaded tracks and visualizes their structure — BPM, key, beats, downbeats, and song sections (intro / verse / chorus / bridge / outro). Built with Next.js 16 (App Router), React 19, Zustand, Tailwind 4.

A distinct aesthetic: warm cream paper meets vintage hi-fi gear. Circular knobs, recessed glass display, liquid-glass playhead. The full-bleed album cover sits behind a translucent player so colour bleeds through every surface — knobs, waveform window, queue panel — without overpowering the chrome. Light / dark themes. Manrope display, Space Mono everywhere else.

Reso is a frontend. Audio analysis is offloaded to a sibling Python service: **[reso-analysis](https://github.com/mohitvirli/reso-analysis)** (MLX + librosa, Apple Silicon-friendly local server).

## Quick start

```bash
cp .env.local.example .env.local       # ANALYSIS_API_URL=http://localhost:8000
bun install
bun dev                                # → http://localhost:3000
```

For analysis to populate BPM/key/segments, run the companion service locally:

```bash
# In a sibling checkout
git clone https://github.com/mohitvirli/reso-analysis
cd reso-analysis && # follow its README
```

Without it, playback still works — demos with a pre-baked analysis manifest get full UI; everything else degrades gracefully.

## Features

- **Drop or pick a file** — `.mp3` / `.wav` (or browse `public/demo/` from the splash button)
- **Queue** — uploaded files append to the end, auto-advance on track end, click any row to jump
- **Live audio-reactive waveform** — a single ribbon that morphs with the live FFT. Frequency bands map spatially across the playhead (bass on the left, vocals in the centre, highs trailing into the playhead). Asymmetric attack/release smooths transients without flattening them, a log-chirp spatial frequency keeps the line flowing, and audio-energy-coupled phase drift makes it breathe with the track instead of marching on a timer. Quadratic-Bézier midpoints keep every stroke continuous. Hard-flat right of the knob — no decoration where there's nothing heard yet.
- **Glass playhead knob** — translucent, pillowy, refracts the wave behind it with a thin red playhead line
- **Segment-aware time scale** — ticks at structural boundaries, label intensity per section, click a section to seek. Section labels come from the `all-in-one` model and can mis-classify, especially on niche genres, very short songs, or remixes. Treat them as a hint, not ground truth.
- **Background album-art blur** behind translucent transport + waveform display
- **Light / dark theme** toggle (top-right)
- **Tweaks menu** — press **T** to reveal a panel of live waveform tuning (bands, gains, smoothing, chirp endpoints)

## Architecture

```
┌─────────────┐  multipart   ┌──────────────────┐                ┌────────────────────┐
│  Browser    │ ───────────► │  Next.js proxy   │ ─── manifest ─►│  public/demo/      │
│  (reso)     │              │  /api/analyze    │                │  manifest.json     │
└─────────────┘              │                  │                └────────────────────┘
       ▲                     │                  │  miss          ┌────────────────────┐
       │                     │                  │ ──────────────►│  reso-analysis API │
       └─── JSON ────────────┴──────────────────┘                │  FastAPI :8000     │
                                                                 └────────────────────┘
```

The route inspects an `x-content-hash` header (client SHA-256 of the file bytes). If the hash is in the baked manifest, it short-circuits and returns the cached analysis without ever calling the upstream analyzer. Otherwise it streams the multipart body to the FastAPI service.

## Analysis caching

Analysis on a 4-min track is 15–35s on M4 Air. Re-analyzing the same audio would be unacceptable, so results are cached across **four tiers** keyed by SHA-256 of the file bytes:

1. **Module-scope `Map`** — instant, per session
2. **IndexedDB** (`reso-analysis-cache.analyses`) — survives reload
3. **Baked manifest** (`public/demo/manifest.json`, looked up server-side via `x-content-hash`) — covers known demo tracks with zero server cost
4. **Upstream FastAPI** — terminal fallback when nothing else has it

Hashing the bytes (vs filename / `lastModified`) survives renames, re-fetches, and the same audio uploaded via different paths.

Inflight requests dedupe by hash so rapid clicks on the same demo can't multiply analyzer calls.

## Project structure

```
src/
├── app/
│   ├── api/
│   │   ├── analyze/route.ts      # baked-manifest lookup + upstream proxy
│   │   └── demo/route.ts         # lists files under public/demo/
│   ├── globals.css
│   └── layout.tsx
├── components/player/
│   ├── PlayerRoot.tsx            # composition + entrance choreography
│   ├── Stage.tsx                 # album region + tick scale + glass knob
│   ├── LiveWave.tsx              # real-time audio-reactive ribbon
│   ├── Transport.tsx             # prev / play / next knobs
│   ├── Library.tsx               # queue panel, glass selector
│   ├── TweaksMenu.tsx            # live waveform parameter sliders
│   └── ThemeToggle.tsx
└── lib/
    ├── analysis/
    │   ├── client.ts             # POST /api/analyze (sends x-content-hash)
    │   └── store.ts              # IndexedDB cache
    ├── audio/engine.ts           # HTMLMediaElement + Web Audio graph
    └── player/
        ├── controller.ts         # loadFile, runAnalysis, queue actions
        ├── store.ts              # Zustand state
        └── tuning.ts             # waveform params (for TweaksMenu)
```

## Environment

`.env.local`:

```
ANALYSIS_API_URL=http://localhost:8000
```

Server-only — the browser talks to `/api/analyze`. Swap the upstream URL freely; no client code changes needed.

## Known limits

- Hashing reads the full file into memory once (~50–100 ms per typical track; fine up to ~50 MB)
- Non-mp3/wav files play, but analysis is skipped silently
- Remote deploys of the analyzer need auth + a job queue (not built in)
- No volume / shuffle / repeat UI yet (store fields exist)

"use client";
import { loadFile } from "@/lib/player/controller";
import { usePlayerStore } from "@/lib/player/store";
import { cn } from "@/lib/util/cn";
import { ListMusic, Upload, X } from "lucide-react";
import * as React from "react";

const ACCEPT =
  "audio/mpeg,audio/flac,audio/wav,audio/ogg,audio/x-m4a,audio/aac,audio/mp4,audio/opus,audio/webm,.mp3,.flac,.wav,.ogg,.m4a,.aac,.opus,.webm";

interface DemoTrack {
  name: string;
  url: string;
}

/**
 * Drop zone that occupies the album-art region when no track is loaded.
 * Two paths in:
 *   - File picker / drag-drop (default view)
 *   - Demo browser — fetches `/api/demo`, plays a chosen file from public/demo/
 */
export interface UploadGateProps {
  /** Optional cancel handler — when supplied, renders an X button to dismiss
   *  the gate (used when swapping tracks while one is already loaded). */
  onCancel?: () => void;
}

export function UploadGate({ onCancel }: UploadGateProps = {}) {
  const isLoading = usePlayerStore((s) => s.isLoading);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const [view, setView] = React.useState<"default" | "demos">("default");
  const [demos, setDemos] = React.useState<DemoTrack[] | null>(null);
  const [demoErr, setDemoErr] = React.useState<string | null>(null);
  const [demoLoading, setDemoLoading] = React.useState(false);

  const onPick = (file: File | null | undefined) => {
    if (!file) return;
    void loadFile(file);
  };

  const openDemos: React.MouseEventHandler = async (e) => {
    e.stopPropagation();
    setView("demos");
    if (demos !== null) return;
    setDemoLoading(true);
    setDemoErr(null);
    try {
      const res = await fetch("/api/demo", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { tracks: DemoTrack[] };
      setDemos(data.tracks ?? []);
    } catch {
      setDemoErr("Could not load demos");
      setDemos([]);
    } finally {
      setDemoLoading(false);
    }
  };

  const playDemo = async (track: DemoTrack) => {
    try {
      const res = await fetch(track.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const file = new File([blob], track.name, {
        type: blob.type || "audio/mpeg",
      });
      void loadFile(file);
    } catch (err) {
      console.error("Demo load failed", err);
    }
  };

  if (view === "demos") {
    return (
      <div className="grid h-full w-full grid-rows-[auto_1fr] bg-paper-warm/60">
        <header className="flex items-center justify-between gap-2 border-b border-line-subtle px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
            Demo tracks
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setView("default");
              }}
              className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.22em] text-ink hover:underline"
            >
              Back
            </button>
            {onCancel && (
              <button
                type="button"
                aria-label="Close"
                onClick={(e) => {
                  e.stopPropagation();
                  onCancel();
                }}
                className="grid size-6 cursor-pointer place-items-center rounded-sm text-ink-soft hover:bg-paper"
              >
                <X className="size-3.5" strokeWidth={1.6} />
              </button>
            )}
          </div>
        </header>
        <div className="overflow-y-auto p-2">
          {demoLoading && (
            <p className="px-2 py-3 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft">
              Loading…
            </p>
          )}
          {demoErr && (
            <p className="px-2 py-3 font-mono text-[11px] uppercase tracking-[0.18em] text-danger">
              {demoErr}
            </p>
          )}
          {!demoLoading &&
            !demoErr &&
            demos !== null &&
            demos.length === 0 && (
              <p className="px-2 py-3 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft">
                No demos. Add audio files to public/demo/
              </p>
            )}
          {demos && demos.length > 0 && (
            <ul className="divide-y divide-line-subtle">
              {demos.map((d) => (
                <li key={d.url}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void playDemo(d);
                    }}
                    className="block w-full cursor-pointer truncate px-3 py-2.5 text-left text-[12px] text-ink transition-colors hover:bg-paper"
                  >
                    {trimExt(d.name)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        onPick(e.dataTransfer.files?.[0]);
      }}
      className={cn(
        "relative grid h-full w-full place-items-center cursor-pointer transition-colors",
        dragOver ? "bg-accent/10" : "bg-paper-warm/30 hover:bg-paper-warm/60"
      )}
    >
      {onCancel && (
        <button
          type="button"
          aria-label="Close"
          onClick={(e) => {
            e.stopPropagation();
            onCancel();
          }}
          className="absolute top-3 right-3 z-10 grid size-7 cursor-pointer place-items-center rounded-full border border-line bg-paper text-ink-soft hover:bg-paper-warm"
        >
          <X className="size-3.5" strokeWidth={1.6} />
        </button>
      )}
      <div className="flex flex-col items-center gap-3 px-6 text-center">
        <div className="grid size-12 place-items-center rounded-full border border-dashed border-accent text-accent">
          <Upload className="size-5" strokeWidth={1.6} />
        </div>
        <div className="space-y-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-ink">
            {isLoading ? "Reading file…" : "Drop a song"}
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">
            {isLoading ? "Hold tight" : "or"}
          </p>
        </div>
        <button
          type="button"
          onClick={openDemos}
          className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-ink transition-colors hover:bg-paper-warm"
        >
          <ListMusic className="size-3" strokeWidth={1.8} />
          Try a demo
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={(e) => {
          onPick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function trimExt(name: string): string {
  return name.replace(/\.[^.]+$/, "");
}

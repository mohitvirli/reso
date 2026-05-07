"use client";
import * as React from "react";
import { Upload } from "lucide-react";
import { loadFile } from "@/lib/player/controller";
import { usePlayerStore } from "@/lib/player/store";
import { cn } from "@/lib/util/cn";

const ACCEPT =
  "audio/mpeg,audio/flac,audio/wav,audio/ogg,audio/x-m4a,audio/aac,audio/mp4,audio/opus,audio/webm,.mp3,.flac,.wav,.ogg,.m4a,.aac,.opus,.webm";

/**
 * Drop zone that occupies the album-art region when no track is loaded.
 * On select / drop, hands the file to controller.loadFile.
 */
export function UploadGate() {
  const isLoading = usePlayerStore((s) => s.isLoading);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = React.useState(false);

  const onPick = (file: File | null | undefined) => {
    if (!file) return;
    void loadFile(file);
  };

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
        "grid h-full w-full place-items-center cursor-pointer transition-colors",
        dragOver ? "bg-accent/10" : "bg-paper-warm/30 hover:bg-paper-warm/60"
      )}
    >
      <div className="flex flex-col items-center gap-3 px-6 text-center">
        <div className="grid size-12 place-items-center rounded-full border border-dashed border-accent text-accent">
          <Upload className="size-5" strokeWidth={1.6} />
        </div>
        <div className="space-y-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-ink">
            {isLoading ? "Reading file…" : "Drop a song"}
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">
            {isLoading ? "Hold tight" : "or tap to browse"}
          </p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={(e) => {
          onPick(e.target.files?.[0]);
          // Reset so picking the same file twice still fires onChange
          e.target.value = "";
        }}
      />
    </div>
  );
}

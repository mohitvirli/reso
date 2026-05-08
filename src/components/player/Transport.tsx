"use client";
import { ControlButton } from "@/components/ui/ControlButton";
import {
  next,
  previous,
  togglePlayPause,
} from "@/lib/player/controller";
import { usePlayerStore } from "@/lib/player/store";
import { Pause, Play, SkipBack, SkipForward } from "lucide-react";

export function Transport() {
  const track = usePlayerStore((s) => s.track);
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  const disabled = !track;

  return (
    <div
      role="group"
      aria-label="Playback controls"
      className="grid grid-cols-3 items-center justify-items-center gap-4"
    >
      <ControlButton
        disabled={disabled}
        onClick={() => void previous()}
        aria-label="Previous track"
      >
        <SkipBack className="size-4" strokeWidth={1.6} fill="currentColor" />
      </ControlButton>

      <ControlButton
        size="xl"
        outerRail
        led
        ledOn={isPlaying}
        disabled={disabled}
        onClick={() => void togglePlayPause()}
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {/* Combined ▶|| icon — universal play/pause symbol; LED conveys state. */}
        <span className="flex items-center gap-[3px] text-ink">
          <Play className="size-4" strokeWidth={0} fill="currentColor" />
          <Pause className="size-4" strokeWidth={0} fill="currentColor" />
        </span>
      </ControlButton>

      <ControlButton
        disabled={disabled}
        onClick={() => void next()}
        aria-label="Next track"
      >
        <SkipForward className="size-4" strokeWidth={1.6} fill="currentColor" />
      </ControlButton>
    </div>
  );
}

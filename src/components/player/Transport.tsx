"use client";
import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { ControlButton } from "@/components/ui/ControlButton";
import {
  cycleRepeat,
  next,
  previous,
  togglePlayPause,
  toggleShuffle,
} from "@/lib/player/controller";
import { usePlayerStore } from "@/lib/player/store";

export function Transport() {
  const track = usePlayerStore((s) => s.track);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const shuffle = usePlayerStore((s) => s.shuffle);
  const repeat = usePlayerStore((s) => s.repeat);

  const disabled = !track;

  return (
    <div
      role="group"
      aria-label="Playback controls"
      className="grid grid-cols-5 gap-2.5"
    >
      <ControlButton
        label="SHFL"
        active={shuffle}
        disabled={disabled}
        onClick={toggleShuffle}
        aria-label="Toggle shuffle"
        aria-pressed={shuffle}
      />
      <ControlButton
        disabled={disabled}
        onClick={() => void previous()}
        aria-label="Previous track"
      >
        <SkipBack className="size-5" strokeWidth={1.6} fill="currentColor" />
      </ControlButton>
      <ControlButton
        size="lg"
        disabled={disabled}
        onClick={() => void togglePlayPause()}
        aria-label={isPlaying ? "Pause" : "Play"}
        className="-mt-1"
      >
        {isPlaying ? (
          <Pause className="size-6" strokeWidth={1.6} fill="currentColor" />
        ) : (
          <Play
            className="size-6 translate-x-px"
            strokeWidth={1.6}
            fill="currentColor"
          />
        )}
      </ControlButton>
      <ControlButton
        disabled={disabled}
        onClick={() => void next()}
        aria-label="Next track"
      >
        <SkipForward className="size-5" strokeWidth={1.6} fill="currentColor" />
      </ControlButton>
      <ControlButton
        label="RPT"
        active={repeat !== "off"}
        disabled={disabled}
        onClick={cycleRepeat}
        aria-label={`Repeat: ${repeat}`}
        aria-pressed={repeat !== "off"}
        title={
          repeat === "off"
            ? "Repeat off"
            : repeat === "all"
              ? "Repeat all"
              : "Repeat one"
        }
      />
    </div>
  );
}

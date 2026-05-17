"use client";
import { wireEngineListeners } from "@/lib/player/controller";
import { usePlayerStore } from "@/lib/player/store";
import Image from "next/image";
import * as React from "react";
import { cn } from "@/lib/util/cn";
import { ListMusic } from "lucide-react";
import { Library } from "./Library";
import { Stage } from "./Stage";
import { ThemeToggle } from "./ThemeToggle";
import { Transport } from "./Transport";
import { TweaksMenu } from "./TweaksMenu";

/**
 * Single client root. Wires audio engine listeners and composes:
 *   - BackgroundArtwork (full-viewport blurred album art behind everything)
 *   - Stage / Transport (foreground UI)
 *   - TweaksMenu (overlay)
 */
export function PlayerRoot() {
  React.useEffect(() => {
    return wireEngineListeners();
  }, []);
  const libraryOpen = usePlayerStore((s) => s.libraryOpen);
  const setLibraryOpen = usePlayerStore((s) => s.setLibraryOpen);

  return (
    <div className="relative min-h-svh w-full">
      <BackgroundArtwork />
      <div
        className={cn(
          "fixed top-4 z-40 flex items-center gap-2 transition-[right]",
          libraryOpen ? "right-4 min-[700px]:right-[calc(40vw+1rem)]" : "right-4"
        )}
      >
        {!libraryOpen && (
          <button
            type="button"
            aria-label="Open queue"
            title="Open queue"
            onClick={() => setLibraryOpen(true)}
            className="grid size-9 cursor-pointer place-items-center rounded-full border border-line-subtle bg-paper/40 text-ink-soft backdrop-blur-md transition-colors hover:bg-paper-warm/60 hover:text-ink"
          >
            <ListMusic className="size-4" strokeWidth={1.6} />
          </button>
        )}
        <ThemeToggle />
      </div>
      <div
        className={cn(
          "relative z-10 mx-auto flex w-full max-w-[1280px] justify-center px-5 py-10 sm:py-16",
          libraryOpen && "min-[700px]:pr-[40vw]"
        )}
      >
        <main className="flex w-full max-w-[440px] flex-col gap-8">
          <Stage />
          <Transport />
        </main>
      </div>
      {libraryOpen && <Library />}
      <TweaksMenu />
    </div>
  );
}

/**
 * Heavy-blurred album art covering the viewport. A paper-tinted overlay
 * sits on top to keep cream/ink chrome legible regardless of cover colour.
 */
function BackgroundArtwork() {
  const url = usePlayerStore((s) => s.track?.artworkUrl ?? null);
  if (!url) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      <Image
        src={url}
        alt=""
        fill
        sizes="100vw"
        unoptimized
        priority
        className="scale-125 object-cover blur-3xl saturate-150"
        style={{ opacity: "var(--art-bg-opacity, 1)" }}
      />
      {/* Themed tint — keeps chrome readable over coloured artwork. */}
      <div
        className="absolute inset-0"
        style={{ background: "var(--backdrop-tint)" }}
      />
      {/* Vignette — pulls focus to the centre column. */}
      <div
        className="absolute inset-0"
        style={{ background: "var(--backdrop-vignette)" }}
      />
    </div>
  );
}

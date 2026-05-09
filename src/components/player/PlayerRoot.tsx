"use client";
import { wireEngineListeners } from "@/lib/player/controller";
import { usePlayerStore } from "@/lib/player/store";
import Image from "next/image";
import * as React from "react";
import { Stage } from "./Stage";
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

  return (
    <div className="relative min-h-svh w-full">
      <BackgroundArtwork />
      <div className="relative z-10 flex w-full px-5 py-10 sm:py-16">
        <main className="mx-auto flex w-full max-w-[440px] flex-col gap-8">
          <Stage />
          <Transport />
          {/* <TrackInfo /> */}
        </main>
      </div>
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
      />
      {/* Paper-tinted overlay — high alpha keeps ink text readable. */}
      <div className="absolute inset-0 bg-paper/70" />
      {/* Subtle vignette to anchor reading attention to the centre column. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,oklch(0.94_0.018_85_/_0.35)_70%,oklch(0.92_0.022_80_/_0.6)_100%)]" />
    </div>
  );
}

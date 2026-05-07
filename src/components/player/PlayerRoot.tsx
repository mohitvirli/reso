"use client";
import * as React from "react";
import { wireEngineListeners } from "@/lib/player/controller";
import { Stage } from "./Stage";
import { Transport } from "./Transport";
import { TrackInfo } from "./TrackInfo";

/**
 * Single client root for the player. Wires the audio engine listeners on
 * mount, then composes the three stacked sections: Stage, Transport, TrackInfo.
 *
 * No top chrome — the player is the page. Mobile-first column capped at
 * 440px on desktop so the warm gradient breathes around it.
 */
export function PlayerRoot() {
  React.useEffect(() => {
    return wireEngineListeners();
  }, []);

  return (
    <div className="min-h-svh w-full px-5 py-10 sm:py-16">
      <main className="mx-auto flex w-full max-w-[440px] flex-col gap-8">
        <Stage />
        <Transport />
        <TrackInfo />
      </main>
    </div>
  );
}

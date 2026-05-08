"use client";
import { wireEngineListeners } from "@/lib/player/controller";
import * as React from "react";
import { Stage } from "./Stage";
import { Transport } from "./Transport";

/**
 * Single client root for the player. Wires the audio engine listeners on
 * mount, then composes the three stacked sections: Stage, Transport, TrackInfo.
 *
 * Mobile-first column capped at 440px on desktop.
 */
export function PlayerRoot() {
  React.useEffect(() => {
    return wireEngineListeners();
  }, []);

  return (
    <div className="min-h-svh w-full px-5 py-10 sm:py-16 flex">
      <main className="mx-auto flex w-full max-w-[440px] flex-col gap-8">
        <Stage />
        <Transport />
        {/* <TrackInfo /> */}
      </main>
    </div>
  );
}

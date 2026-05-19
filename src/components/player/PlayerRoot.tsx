"use client";
import { gsap, useGSAP } from "@/lib/anim/gsap";
import { wireEngineListeners } from "@/lib/player/controller";
import { usePlayerStore } from "@/lib/player/store";
import { cn } from "@/lib/util/cn";
import { ListMusic } from "lucide-react";
import Image from "next/image";
import * as React from "react";
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
  const rootRef = React.useRef<HTMLDivElement>(null);

  // Open queue by default on desktop (≥700px). Mobile stays closed.
  // useLayoutEffect → flip before paint so master timeline picks it up.
  React.useLayoutEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 700px)").matches
    ) {
      setLibraryOpen(true);
    }
  }, [setLibraryOpen]);

  // Mirrors libraryOpen but lags by the panel close anim duration so the
  // mobile chrome (theme/queue buttons) doesn't pop in over the panel while
  // it's still sliding off-screen.
  const [chromeHiddenMobile, setChromeHiddenMobile] = React.useState(libraryOpen);
  React.useEffect(() => {
    if (libraryOpen) {
      setChromeHiddenMobile(true);
      return;
    }
    const id = window.setTimeout(() => setChromeHiddenMobile(false), 500);
    return () => clearTimeout(id);
  }, [libraryOpen]);

  // First-load choreography. Tag the major regions so the timeline can pick
  // them up; Library + Background run their own mount anims in parallel.
  useGSAP(
    () => {
      const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
      tl.fromTo(
        "[data-anim='rail']",
        { y: -20, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.6 }
      )
        .fromTo(
          "[data-anim='album']",
          { y: 200, scale: 0.5, autoAlpha: 0 },
          { y: 0, scale: 1, autoAlpha: 1, duration: 0.7 },
          0.05
        )
        .fromTo(
          "[data-anim='header']",
          { y: 48, autoAlpha: 0 },
          { y: 0, autoAlpha: 1, duration: 0.6 },
          0.18
        )
        .fromTo(
          "[data-anim='display']",
          { y: 14, autoAlpha: 0, filter: "blur(6px)" },
          { y: 0, autoAlpha: 1, filter: "blur(0px)", duration: 1 },
          0.24
        )
        .fromTo(
          "[data-anim='meta']",
          { y: 88, autoAlpha: 0 },
          { y: 0, autoAlpha: 1, duration: 1.5 },
          0.32
        )
        .set("[data-anim='transport']", { autoAlpha: 1 }, 0.34)
        .fromTo(
          "[data-anim='transport'] > *",
          { y: 100 },
          { y: 0, duration: 0.55, stagger: 0.1 },
          0.34
        );

      if (libraryOpen) {
        tl.fromTo(
          "[data-queue-panel]",
          { xPercent: 100, autoAlpha: 0 },
          {
            xPercent: 0,
            autoAlpha: 1,
            pointerEvents: "auto",
            duration: 0.7,
            ease: "expo.out",
          },
          0.1
        ).fromTo(
          "[data-queue-panel] [data-anim='content']",
          { y: 14, autoAlpha: 0, filter: "blur(6px)" },
          {
            y: 0,
            autoAlpha: 1,
            filter: "blur(0px)",
            duration: 0.55,
            ease: "power3.out",
            stagger: 0.04,
          },
          0.25
        );
      }
    },
    { scope: rootRef }
  );

  return (
    <div ref={rootRef} className="relative min-h-svh w-full">
      <BackgroundArtwork />
      <div
        data-anim="rail"
        className={cn(
          "fixed top-4 z-40 flex items-center gap-2 transition-[right]",
          libraryOpen
            ? "right-4 min-[700px]:right-[calc(40vw+1rem)]"
            : "right-4",
          chromeHiddenMobile && "max-[699px]:hidden"
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
          "relative z-10 mx-auto flex w-full max-w-[1280px] justify-center px-5 pt-16 pb-10 sm:py-16 transition-[padding] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
          libraryOpen && "min-[700px]:pr-[40vw]"
        )}
      >
        <main className="flex w-full max-w-[440px] flex-col gap-8">
          <Stage />
          <Transport />
        </main>
      </div>
      <Library open={libraryOpen} />
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

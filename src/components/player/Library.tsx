"use client";
import { gsap, useGSAP } from "@/lib/anim/gsap";
import { playLibraryIndex } from "@/lib/player/controller";
import { usePlayerStore } from "@/lib/player/store";
import { cn } from "@/lib/util/cn";
import { formatTime } from "@/lib/util/time";
import { Loader2, X } from "lucide-react";
import * as React from "react";

interface LibraryProps {
  open: boolean;
}

/**
 * Right-side queue panel. Lists library tracks with track number, parsed
 * title/artist, and probed duration. Highlights the currently playing row.
 */
export function Library({ open }: LibraryProps) {
  const library = usePlayerStore((s) => s.library);
  const libraryLoaded = usePlayerStore((s) => s.libraryLoaded);
  const libraryError = usePlayerStore((s) => s.libraryError);
  const libraryIndex = usePlayerStore((s) => s.libraryIndex);
  const libraryDurations = usePlayerStore((s) => s.libraryDurations);
  const isLoading = usePlayerStore((s) => s.isLoading);
  const setLibrary = usePlayerStore((s) => s.setLibrary);
  const setLibraryError = usePlayerStore((s) => s.setLibraryError);
  const setLibraryOpen = usePlayerStore((s) => s.setLibraryOpen);
  const setLibraryDuration = usePlayerStore((s) => s.setLibraryDuration);

  React.useEffect(() => {
    if (libraryLoaded) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/demo", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as {
          tracks: { name: string; url: string }[];
        };
        if (cancelled) return;
        setLibrary(data.tracks ?? []);
      } catch {
        if (cancelled) return;
        setLibraryError("Could not load library");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [libraryLoaded, setLibrary, setLibraryError]);

  // Probe durations via lightweight Audio metadata load — never fetches full file.
  React.useEffect(() => {
    if (!libraryLoaded || library.length === 0) return;
    const audios: HTMLAudioElement[] = [];
    library.forEach((t) => {
      if (libraryDurations[t.url] != null) return;
      const a = new Audio();
      a.preload = "metadata";
      a.src = t.url;
      const onMeta = () => {
        if (Number.isFinite(a.duration)) {
          setLibraryDuration(t.url, a.duration);
        }
      };
      a.addEventListener("loadedmetadata", onMeta, { once: true });
      audios.push(a);
    });
    return () => {
      audios.forEach((a) => {
        a.src = "";
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libraryLoaded, library, setLibraryDuration]);

  const count = library.length;
  const rootRef = React.useRef<HTMLElement>(null);

  // Track first mount so PlayerRoot's master timeline can drive the initial
  // slide-in (keeps it perfectly synced with the rest of the entrance).
  const firstOpenRun = React.useRef(true);

  // Panel slide + content reveal on subsequent open / close toggles.
  useGSAP(
    () => {
      if (firstOpenRun.current) {
        firstOpenRun.current = false;
        return;
      }
      const root = rootRef.current;
      if (!root) return;
      const content = root.querySelectorAll<HTMLElement>("[data-anim='content']");
      if (open) {
        gsap.to(root, {
          xPercent: 0,
          autoAlpha: 1,
          pointerEvents: "auto",
          duration: 0.55,
          ease: "expo.out",
        });
        gsap.fromTo(
          content,
          { y: 14, autoAlpha: 0, filter: "blur(6px)" },
          {
            y: 0,
            autoAlpha: 1,
            filter: "blur(0px)",
            duration: 0.55,
            ease: "power3.out",
            stagger: 0.04,
            delay: 0.08,
          }
        );
      } else {
        gsap.to(root, {
          xPercent: 100,
          autoAlpha: 0,
          duration: 0.5,
          ease: "expo.out",
          onComplete: () => gsap.set(root, { pointerEvents: "none" }),
        });
      }
    },
    { dependencies: [open], scope: rootRef }
  );

  return (
    <aside
      ref={rootRef}
      aria-label="Queue"
      aria-hidden={!open}
      data-queue-panel
      className="fixed top-0 right-0 z-30 flex h-svh w-full flex-col border-l border-line-subtle bg-paper p-4 backdrop-blur-xl shadow-soft will-change-transform min-[700px]:w-[40vw] min-[700px]:min-w-[320px] min-[700px]:bg-paper/30"
    >
      <header
        data-anim="content"
        className="flex items-start justify-between px-2 pb-3"
      >
        <div className="flex flex-col gap-2">
          <p className="font-mono text-[13px] font-bold uppercase tracking-[0.32em] text-ink">
            Queue
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
            {libraryLoaded && !libraryError ? `${count} tracks` : ""}
          </p>
        </div>
        <button
          type="button"
          aria-label="Close queue"
          onClick={() => setLibraryOpen(false)}
          className="grid size-7 cursor-pointer place-items-center rounded-md text-ink-soft transition-colors hover:bg-ink/10 hover:text-ink"
        >
          <X className="size-4" strokeWidth={1.6} />
        </button>
      </header>

      <div data-anim="content" className="flex-1">
        {!libraryLoaded && !libraryError && <ShimmerList />}
        {libraryError && (
          <p className="px-3 py-4 font-mono text-[11px] uppercase tracking-[0.18em] text-danger">
            {libraryError}
          </p>
        )}
        {libraryLoaded && !libraryError && count === 0 && (
          <p className="px-3 py-4 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft">
            No tracks
          </p>
        )}
        {libraryLoaded && !libraryError && count > 0 && (
          <RowList
            library={library}
            libraryIndex={libraryIndex}
            libraryDurations={libraryDurations}
            isLoading={isLoading}
            open={open}
          />
        )}
      </div>
    </aside>
  );
}

interface RowListProps {
  library: { name: string; url: string }[];
  libraryIndex: number | null;
  libraryDurations: Record<string, number>;
  isLoading: boolean;
  open: boolean;
}

function RowList({
  library,
  libraryIndex,
  libraryDurations,
  isLoading,
  open,
}: RowListProps) {
  const ulRef = React.useRef<HTMLUListElement>(null);
  const selectorRef = React.useRef<HTMLDivElement>(null);
  const firstSelectorRender = React.useRef(true);

  // Active-row glass selector — animated via GSAP on libraryIndex change.
  useGSAP(
    () => {
      const ul = ulRef.current;
      const sel = selectorRef.current;
      if (!ul || !sel) return;
      if (libraryIndex == null) {
        gsap.to(sel, { opacity: 0, duration: 0.2, ease: "power2.out" });
        return;
      }
      const li = ul.children[libraryIndex] as HTMLElement | undefined;
      if (!li) return;
      const top = li.offsetTop - 4;
      const height = li.offsetHeight + 8;

      if (firstSelectorRender.current) {
        gsap.set(sel, { y: top, height, x: 400, opacity: 0 });
        gsap.to(sel, { opacity: 1, scale: 1, x: 0, duration: 0.5, ease: "power2.out" });
        firstSelectorRender.current = false;
        return;
      }
      gsap.to(sel, {
        y: top,
        height,
        opacity: 1,
        duration: 0.8,
        ease: "power2.out",
      });
    },
    { dependencies: [libraryIndex, library.length], scope: ulRef }
  );

  // Stagger rows in on panel open / library populate.
  useGSAP(
    () => {
      if (!open) return;
      const ul = ulRef.current;
      if (!ul) return;
      gsap.fromTo(
        ul.children,
        { y: 12, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.5,
          ease: "power3.out",
          stagger: 0.035,
          delay: 0.12,
        }
      );
    },
    { dependencies: [open, library.length], scope: ulRef }
  );

  return (
    <div className="relative">
      <div
        ref={selectorRef}
        aria-hidden
        className="pointer-events-none absolute rounded-md will-change-transform"
        style={{
          opacity: 0,
          left: -30,
          right: -20,
          top: 0,
          background: "var(--glass-active-bg)",
          border: "1px solid var(--glass-active-border)",
          boxShadow: "var(--glass-active-shadow)",
          backdropFilter: "blur(24px) saturate(200%)",
          WebkitBackdropFilter: "blur(24px) saturate(200%)",
        }}
      />
      <ul ref={ulRef} className="relative flex flex-col gap-1 overflow-y-scroll">
        {library.map((t, i) => {
          const active = i === libraryIndex;
          const parsed = parseName(t.name);
          const dur = libraryDurations[t.url];
          return (
            <li key={t.url}>
              <Row
                index={i}
                title={parsed.title}
                artist={parsed.artist}
                duration={dur != null ? formatTime(dur) : null}
                active={active}
                loading={active && isLoading}
                onClick={() => void playLibraryIndex(i)}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

interface RowProps {
  index: number;
  title: string;
  artist: string | null;
  duration: string | null;
  active: boolean;
  loading: boolean;
  onClick: () => void;
}

function Row({
  index,
  title,
  artist,
  duration,
  active,
  loading,
  onClick,
}: RowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={cn(
        "group relative z-10 flex w-full cursor-pointer items-center gap-4 rounded-md px-3 py-2.5 text-left transition-colors",
        active ? "text-ink" : "text-ink-soft hover:bg-ink/5 hover:text-ink"
      )}
    >
      <span
        className={cn(
          "grid w-6 shrink-0 place-items-center font-mono text-[11px] tabular-nums",
          active ? "text-ink" : "text-ink-soft"
        )}
      >
        {loading ? (
          <Loader2 className="size-3.5 animate-spin" strokeWidth={1.8} />
        ) : (
          String(index + 1).padStart(2, "0")
        )}
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="truncate font-display text-[13px] font-semibold leading-tight text-ink">
          {title}
        </span>
        {artist && (
          <span className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-ink-soft">
            {artist}
          </span>
        )}
      </span>

      <span
        className={cn(
          "shrink-0 font-mono text-[11px] tabular-nums",
          active ? "text-ink" : "text-ink-soft"
        )}
      >
        {duration ?? "—"}
      </span>
    </button>
  );
}

function ShimmerList() {
  return (
    <ul className="flex flex-col gap-1 px-3 py-1">
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i} className="flex items-center gap-4 rounded-md px-3 py-2.5">
          <div className="h-3 w-6 shrink-0 animate-pulse rounded bg-ink/10" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div
              className="h-3.5 animate-pulse rounded bg-ink/10"
              style={{ width: `${60 + ((i * 13) % 30)}%` }}
            />
            <div
              className="h-2.5 animate-pulse rounded bg-ink/5"
              style={{ width: `${30 + ((i * 7) % 20)}%` }}
            />
          </div>
          <div className="h-3 w-8 shrink-0 animate-pulse rounded bg-ink/10" />
        </li>
      ))}
    </ul>
  );
}

function parseName(raw: string): { title: string; artist: string | null } {
  const noExt = raw.replace(/\.[^.]+$/, "");
  const sepIdx = noExt.indexOf(" - ");
  if (sepIdx === -1) return { title: noExt, artist: null };
  const artist = noExt.slice(0, sepIdx).trim();
  const title = noExt.slice(sepIdx + 3).trim();
  if (!artist || !title) return { title: noExt, artist: null };
  return { title, artist };
}

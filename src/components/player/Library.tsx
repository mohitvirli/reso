"use client";
import { playLibraryIndex } from "@/lib/player/controller";
import { usePlayerStore } from "@/lib/player/store";
import { cn } from "@/lib/util/cn";
import { formatTime } from "@/lib/util/time";
import { X } from "lucide-react";
import * as React from "react";

/**
 * Right-side queue panel. Lists library tracks with track number, parsed
 * title/artist, and probed duration. Highlights the currently playing row.
 */
export function Library() {
  const library = usePlayerStore((s) => s.library);
  const libraryLoaded = usePlayerStore((s) => s.libraryLoaded);
  const libraryError = usePlayerStore((s) => s.libraryError);
  const libraryIndex = usePlayerStore((s) => s.libraryIndex);
  const libraryDurations = usePlayerStore((s) => s.libraryDurations);
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
    // libraryDurations intentionally excluded — we only probe missing entries on library load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libraryLoaded, library, setLibraryDuration]);

  const count = library.length;

  return (
    <aside
      aria-label="Queue"
      className="fixed top-0 right-0 z-30 flex h-svh w-[40vw] min-w-[320px] flex-col border-l border-line-subtle bg-paper/30 p-4 backdrop-blur-xl shadow-soft"
    >
      <header className="flex items-start justify-between px-2 pb-3">
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

      <div className="flex-1">
        {!libraryLoaded && (
          <p className="px-3 py-4 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft">
            Loading…
          </p>
        )}
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
        <RowList
          library={library}
          libraryIndex={libraryIndex}
          libraryDurations={libraryDurations}
        />
      </div>
    </aside>
  );
}

interface RowListProps {
  library: { name: string; url: string }[];
  libraryIndex: number | null;
  libraryDurations: Record<string, number>;
}

function RowList({ library, libraryIndex, libraryDurations }: RowListProps) {
  const ulRef = React.useRef<HTMLUListElement>(null);
  const [rect, setRect] = React.useState<{ top: number; height: number } | null>(null);
  const [animate, setAnimate] = React.useState(false);

  React.useLayoutEffect(() => {
    const ul = ulRef.current;
    if (!ul || libraryIndex == null) {
      setRect(null);
      return;
    }
    const li = ul.children[libraryIndex] as HTMLElement | undefined;
    if (!li) return;
    setRect({ top: li.offsetTop, height: li.offsetHeight });
  }, [libraryIndex, library.length]);

  // Enable transition only after first paint, so initial position doesn't animate from 0.
  React.useEffect(() => {
    if (rect && !animate) {
      const id = requestAnimationFrame(() => setAnimate(true));
      return () => cancelAnimationFrame(id);
    }
  }, [rect, animate]);

  return (
    <div className="relative">
      {rect && (
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute rounded-md",
            animate && "transition-[transform,height] duration-300 ease-out"
          )}
          style={{
            // Bleed past the row both vertically and horizontally for 3D overflow feel.
            transform: `translateY(${rect.top - 4}px)`,
            height: rect.height + 8,
            left: -30,
            right: -20,
            background: "var(--glass-active-bg)",
            border: "1px solid var(--glass-active-border)",
            boxShadow: "var(--glass-active-shadow)",
            backdropFilter: "blur(24px) saturate(200%)",
            WebkitBackdropFilter: "blur(24px) saturate(200%)",
          }}
        />
      )}
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
  onClick: () => void;
}

function Row({ index, title, artist, duration, active, onClick }: RowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={cn(
        "group relative z-10 flex w-full cursor-pointer items-center gap-4 rounded-md px-3 py-2.5 text-left transition-colors",
        active
          ? "text-ink"
          : "text-ink-soft hover:bg-ink/5 hover:text-ink"
      )}
    >
      {/* Track number */}
      <span
        className={cn(
          "w-6 shrink-0 font-mono text-[11px] tabular-nums",
          active ? "text-ink" : "text-ink-soft"
        )}
      >
        {String(index + 1).padStart(2, "0")}
      </span>

      {/* Title + artist */}
      <span className="flex min-w-0 flex-1 flex-col gap-2">
        <span
          className={cn(
            "truncate text-[13px] leading-tight font-display font-semibold text-ink",
          )}
        >
          {title}
        </span>
        {artist && (
          <span className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-ink-soft">
            {artist}
          </span>
        )}
      </span>

      {/* Duration */}
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

/** Split "Artist - Title" filename into structured parts. Falls back to using
 *  the whole string as the title when no separator is present. */
function parseName(raw: string): { title: string; artist: string | null } {
  const noExt = raw.replace(/\.[^.]+$/, "");
  const sepIdx = noExt.indexOf(" - ");
  if (sepIdx === -1) return { title: noExt, artist: null };
  const artist = noExt.slice(0, sepIdx).trim();
  const title = noExt.slice(sepIdx + 3).trim();
  if (!artist || !title) return { title: noExt, artist: null };
  return { title, artist };
}

import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";

/**
 * GET /api/demo
 * Lists audio files in `public/demo/` so the upload gate can offer them.
 * Always read fresh from disk (force-dynamic) — users add files between requests.
 */
export const dynamic = "force-dynamic";

const AUDIO_EXTS = new Set([
  ".mp3",
  ".flac",
  ".wav",
  ".ogg",
  ".oga",
  ".m4a",
  ".aac",
  ".opus",
  ".webm",
]);

interface DemoTrack {
  name: string;
  url: string;
}

export async function GET() {
  const dir = join(process.cwd(), "public", "demo");
  try {
    const files = await readdir(dir);
    const tracks: DemoTrack[] = files
      .filter((name) => {
        if (name.startsWith(".")) return false;
        const ext = name.slice(name.lastIndexOf(".")).toLowerCase();
        return AUDIO_EXTS.has(ext);
      })
      .sort()
      .map((name) => ({
        name,
        url: `/demo/${encodeURIComponent(name)}`,
      }));
    return NextResponse.json({ tracks });
  } catch {
    return NextResponse.json({ tracks: [] });
  }
}

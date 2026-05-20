/**
 * Client for the /api/analyze proxy → reso-analysis FastAPI service.
 */

export interface AnalysisSegment {
  start: number;
  end: number;
  label: string;
}

export interface AnalysisResult {
  bpm: number;
  key: string;
  beats: number[];
  downbeats: number[];
  beat_positions: number[];
  segments: AnalysisSegment[];
  duration: number;
}

/** Formats reso-analysis accepts. Other types skip analysis silently. */
const SUPPORTED_EXTENSIONS = new Set(["mp3", "wav"]);

export function isAnalyzable(file: File): boolean {
  const ext = file.name.split(".").pop()?.toLowerCase();
  return ext ? SUPPORTED_EXTENSIONS.has(ext) : false;
}

/**
 * POST the file to `/api/analyze`. Pass `hash` (SHA-256 hex) so the server
 * can short-circuit via its baked-manifest lookup before touching the
 * upstream analyzer.
 */
export async function analyzeFile(
  file: File,
  hash?: string
): Promise<AnalysisResult> {
  // Bodyless manifest lookup first. Demo tracks are pre-baked, so this
  // returns immediately without sending the file. Critical on Vercel, whose
  // 4.5MB request-body cap would otherwise 413 large tracks at the edge
  // before the server-side short-circuit ever runs.
  if (hash) {
    const hit = await fetch("/api/analyze", {
      method: "POST",
      headers: { "x-content-hash": hash },
    });
    if (hit.ok) return (await hit.json()) as AnalysisResult;
    if (hit.status !== 404) {
      const text = await hit.text().catch(() => "");
      throw new Error(
        `Analysis failed (${hit.status}): ${text || hit.statusText}`
      );
    }
    // 404 = manifest miss; fall through to full upload.
  }

  const fd = new FormData();
  fd.append("file", file, file.name);

  const res = await fetch("/api/analyze", {
    method: "POST",
    body: fd,
    headers: hash ? { "x-content-hash": hash } : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Analysis failed (${res.status}): ${text || res.statusText}`);
  }

  return (await res.json()) as AnalysisResult;
}

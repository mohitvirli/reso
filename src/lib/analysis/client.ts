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
  const fd = new FormData();
  fd.append("file", file, file.name);

  const headers: Record<string, string> = {};
  if (hash) headers["x-content-hash"] = hash;

  const res = await fetch("/api/analyze", {
    method: "POST",
    body: fd,
    headers,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Analysis failed (${res.status}): ${text || res.statusText}`);
  }

  return (await res.json()) as AnalysisResult;
}

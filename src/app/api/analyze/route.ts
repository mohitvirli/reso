/**
 * /api/analyze
 *
 * Two-tier handler:
 *   1. Manifest lookup — if the client supplies `x-content-hash` and that
 *      hash is in `public/demo/manifest.json`, return the pre-baked result
 *      immediately. Skips the analyzer entirely for known demo tracks.
 *   2. Upstream proxy — otherwise stream the multipart body to the
 *      reso-analysis FastAPI service.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import type { AnalysisResult } from "@/lib/analysis/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const UPSTREAM = process.env.ANALYSIS_API_URL ?? "http://localhost:8000";
const MANIFEST_PATH = join(process.cwd(), "public", "demo", "manifest.json");

interface BakedEntry {
  hash: string;
  analysis: AnalysisResult;
}

// Cache the parsed manifest in module scope; force-dynamic ensures the
// route still re-runs per request, but we avoid re-parsing JSON every call.
let manifestCache: Map<string, AnalysisResult> | null = null;
let manifestLoadedAt = 0;
const MANIFEST_TTL_MS = 30_000;

async function getManifest(): Promise<Map<string, AnalysisResult>> {
  const now = Date.now();
  if (manifestCache && now - manifestLoadedAt < MANIFEST_TTL_MS) {
    return manifestCache;
  }
  try {
    const raw = await readFile(MANIFEST_PATH, "utf8");
    const entries = JSON.parse(raw) as BakedEntry[];
    const map = new Map<string, AnalysisResult>();
    for (const e of entries) {
      if (e?.hash && e.analysis) map.set(e.hash.toLowerCase(), e.analysis);
    }
    manifestCache = map;
    manifestLoadedAt = now;
    return map;
  } catch {
    manifestCache = new Map();
    manifestLoadedAt = now;
    return manifestCache;
  }
}

export async function POST(request: Request): Promise<Response> {
  const contentType = request.headers.get("content-type");
  if (!contentType?.startsWith("multipart/form-data")) {
    return NextResponse.json(
      { error: "Expected multipart/form-data" },
      { status: 400 }
    );
  }

  // Manifest hit — short-circuit, no upstream call.
  const hash = request.headers.get("x-content-hash")?.toLowerCase();
  if (hash) {
    const manifest = await getManifest();
    const baked = manifest.get(hash);
    if (baked) {
      return NextResponse.json(baked, {
        headers: { "x-analysis-source": "baked" },
      });
    }
  }

  if (!request.body) {
    return NextResponse.json({ error: "Empty body" }, { status: 400 });
  }

  try {
    const upstream = await fetch(`${UPSTREAM}/analyze`, {
      method: "POST",
      headers: { "content-type": contentType },
      body: request.body,
      // Required when streaming a request body in Node/undici.
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    const payload = await upstream.text();
    return new Response(payload, {
      status: upstream.status,
      headers: {
        "content-type":
          upstream.headers.get("content-type") ?? "application/json",
        "x-analysis-source": "upstream",
      },
    });
  } catch (err) {
    console.error("[analyze] upstream failed", err);
    return NextResponse.json(
      { error: "Analysis service unreachable", upstream: UPSTREAM },
      { status: 502 }
    );
  }
}

export async function GET(): Promise<Response> {
  try {
    const res = await fetch(`${UPSTREAM}/health`, { cache: "no-store" });
    return NextResponse.json(
      { proxy: "ok", upstream: await res.json() },
      { status: res.ok ? 200 : 502 }
    );
  } catch {
    return NextResponse.json(
      { proxy: "ok", upstream: "unreachable", url: UPSTREAM },
      { status: 502 }
    );
  }
}

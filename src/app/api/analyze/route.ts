/**
 * Proxy → reso-analysis FastAPI service.
 * Streams multipart body through to avoid buffering large audio uploads.
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const UPSTREAM = process.env.ANALYSIS_API_URL ?? "http://localhost:8000";

export async function POST(request: Request): Promise<Response> {
  const contentType = request.headers.get("content-type");
  if (!contentType?.startsWith("multipart/form-data")) {
    return NextResponse.json(
      { error: "Expected multipart/form-data" },
      { status: 400 }
    );
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

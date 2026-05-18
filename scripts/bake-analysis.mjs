#!/usr/bin/env node
/**
 * Bake analysis JSON for every audio file in public/demo/.
 *
 * For each file:
 *   1. Compute SHA-256 of bytes (matches client-side hashFile in controller.ts).
 *   2. POST to the local reso-analysis FastAPI at ANALYSIS_API_URL.
 *   3. Write result to public/demo/analysis/<hash>.json.
 *   4. Append entry to public/demo/manifest.json.
 *
 * Run once locally with the FastAPI service up. Commit the resulting JSON so
 * production deployments do not need the analyzer.
 */
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile, stat } from "node:fs/promises";
import { join, extname } from "node:path";

const ROOT = process.cwd();
const DEMO_DIR = join(ROOT, "public", "demo");
const MANIFEST = join(DEMO_DIR, "manifest.json");
const UPSTREAM = process.env.ANALYSIS_API_URL ?? "http://localhost:8000";

const AUDIO_EXTS = new Set([
  ".mp3", ".flac", ".wav", ".ogg", ".oga", ".m4a", ".aac", ".opus", ".webm",
]);

function sha256Hex(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

async function analyze(name, bytes) {
  const fd = new FormData();
  fd.append("file", new Blob([bytes]), name);
  const res = await fetch(`${UPSTREAM}/analyze`, { method: "POST", body: fd });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

async function main() {
  let existing = {};
  try {
    const prev = JSON.parse(await readFile(MANIFEST, "utf8"));
    if (Array.isArray(prev)) {
      for (const e of prev) if (e?.hash && e.analysis) existing[e.hash] = e.analysis;
    }
  } catch {
    /* no prior manifest */
  }

  const entries = await readdir(DEMO_DIR);
  const files = [];
  for (const name of entries) {
    if (name.startsWith(".")) continue;
    const full = join(DEMO_DIR, name);
    const s = await stat(full);
    if (!s.isFile()) continue;
    if (!AUDIO_EXTS.has(extname(name).toLowerCase())) continue;
    files.push(name);
  }
  files.sort();

  const manifest = [];
  for (const name of files) {
    const full = join(DEMO_DIR, name);
    const bytes = await readFile(full);
    const hash = sha256Hex(bytes);

    let analysis = existing[hash];
    if (analysis) {
      console.log(`✓ cached  ${name}  (${hash.slice(0, 12)})`);
    } else {
      process.stdout.write(`… analyze ${name} … `);
      analysis = await analyze(name, bytes);
      console.log(`done (${hash.slice(0, 12)})`);
    }

    manifest.push({
      name,
      url: `/demo/${encodeURIComponent(name)}`,
      hash,
      bytes: bytes.length,
      analysis,
    });
  }

  await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`\nWrote ${manifest.length} entries → ${MANIFEST}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

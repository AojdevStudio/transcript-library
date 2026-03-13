import { NextResponse } from "next/server";
import fs from "node:fs";
import { requirePrivateApi } from "@/lib/private-api-guard";
import { resolveTranscriptPath } from "@/lib/catalog";

export const runtime = "nodejs";

/**
 * GET /api/raw
 * Serves a raw file from `PLAYLIST_TRANSCRIPTS_REPO` as plain text.
 * Path traversal is blocked by resolving and prefix-checking against the repo root.
 *
 * @param req - Incoming request. Expects `?path=` query param with a repo-relative
 *   file path.
 * @returns Plain-text file contents, or a 400 / 403 / 503 / 500 error response.
 */
export async function GET(req: Request) {
  const guard = requirePrivateApi(req);
  if (!guard.allowed) return guard.response;

  const url = new URL(req.url);
  const p = url.searchParams.get("path");
  if (!p) return NextResponse.json({ ok: false, error: "missing path" }, { status: 400 });

  if (!process.env.PLAYLIST_TRANSCRIPTS_REPO) {
    return NextResponse.json(
      { ok: false, error: "PLAYLIST_TRANSCRIPTS_REPO not configured" },
      { status: 503 },
    );
  }

  let resolved: string;
  try {
    resolved = resolveTranscriptPath(p);
  } catch (error) {
    if (error instanceof Error && error.message === "forbidden") {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }
    throw error;
  }

  try {
    const content = fs.readFileSync(resolved, "utf8");
    return new NextResponse(content, {
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  } catch (e) {
    console.error("raw route read failed:", e);
    return NextResponse.json({ ok: false, error: "read failed" }, { status: 500 });
  }
}

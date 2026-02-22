import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const p = url.searchParams.get("path");
  if (!p) return NextResponse.json({ ok: false, error: "missing path" }, { status: 400 });

  // Safety: resolve to canonical paths to prevent path traversal attacks.
  const root = process.env.PLAYLIST_TRANSCRIPTS_REPO || "/Users/aojdevstudio/projects/clawd/playlist-transcripts";
  const resolved = path.resolve(root, p);
  if (!resolved.startsWith(path.resolve(root) + path.sep)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
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

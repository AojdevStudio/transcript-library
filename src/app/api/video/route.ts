import { NextResponse } from "next/server";
import fs from "node:fs";
import { absTranscriptPath, getVideo } from "@/modules/catalog";
import { requirePrivateApi, sanitizePayload } from "@/lib/private-api-guard";

export const runtime = "nodejs";

/**
 * Reads a file from disk, returning its UTF-8 contents or null if the file is
 * missing or unreadable.
 *
 * @param p - Absolute path to the file.
 * @returns The file contents as a string, or null on any error.
 */
function safeRead(p: string) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return null;
  }
}

/**
 * GET /api/video
 * Returns video metadata and transcript part contents for the requested video.
 * Catalog metadata comes from the shared SQLite-backed snapshot helper.
 * Protected by the private API boundary in hosted mode.
 *
 * @param req - Incoming request. Expects `?videoId=` query param.
 * @returns JSON with `video` and `parts` (each part includes file content), or a
 *   400 if `videoId` is missing, or a 404 if no matching video is found.
 */
export async function GET(req: Request) {
  const guard = requirePrivateApi(req);
  if (!guard.allowed) return guard.response;

  const url = new URL(req.url);
  const videoId = url.searchParams.get("videoId");
  if (!videoId) return NextResponse.json({ error: "missing videoId" }, { status: 400 });

  const video = getVideo(videoId);
  if (!video) return NextResponse.json({ error: "not found" }, { status: 404 });

  const parts = video.parts.map((p) => ({
    ...p,
    content: safeRead(absTranscriptPath(p.filePath)),
  }));

  return NextResponse.json(sanitizePayload({ video, parts }));
}

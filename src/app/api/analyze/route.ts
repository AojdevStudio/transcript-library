import { NextResponse } from "next/server";
import fs from "node:fs";
import { absTranscriptPath, getVideo } from "@/modules/catalog";
import { getAnalyzeStartEligibility, isValidVideoId, spawnAnalysis } from "@/modules/analysis";

export const runtime = "nodejs";

/**
 * POST /api/analyze
 * Validates the video, assembles its full transcript, and spawns a background
 * analysis worker. Returns immediately; the worker writes artifacts to disk as it
 * runs while metadata continues to come from the shared catalog snapshot.
 *
 * @param req - Incoming request. Expects `?videoId=` query param.
 * @returns JSON `{ ok: true, status: "running", outcome: "started" }` on
 *   success, or a 400 / 404 / 409 / 429 error response with an explicit
 *   start outcome when a rerun is blocked.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const videoId = url.searchParams.get("videoId") || "";

  if (!isValidVideoId(videoId)) {
    return NextResponse.json({ ok: false, error: "invalid videoId" }, { status: 400 });
  }

  const video = getVideo(videoId);
  if (!video) {
    return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  }

  const eligibility = getAnalyzeStartEligibility(videoId);
  if (!eligibility.canStart) {
    return NextResponse.json(
      {
        ok: false,
        error: eligibility.message,
        outcome: eligibility.outcome,
        retryable: eligibility.retryable,
        lifecycle: eligibility.snapshot.lifecycle,
      },
      { status: 409 },
    );
  }

  // Build transcript content
  const transcriptParts = video.parts.map((p) => {
    const abs = absTranscriptPath(p.filePath);
    try {
      return fs.readFileSync(abs, "utf8");
    } catch {
      return `[Part ${p.chunk}: file not found]`;
    }
  });
  const transcript = transcriptParts.join("\n\n---\n\n");

  const spawned = spawnAnalysis(
    videoId,
    {
      videoId,
      title: video.title,
      channel: video.channel,
      topic: video.topic,
      publishedDate: video.publishedDate,
      transcriptPartPath: absTranscriptPath(video.parts[0]?.filePath ?? ""),
    },
    transcript,
    "[analyze]",
  );

  if (!spawned) {
    return NextResponse.json(
      {
        ok: false,
        error: "too many analyses running",
        outcome: "capacity-reached",
        retryable: true,
      },
      { status: 429 },
    );
  }

  return NextResponse.json({ ok: true, status: "running", outcome: "started" });
}

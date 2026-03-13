import { NextResponse } from "next/server";
import fs from "node:fs";
import { absTranscriptPath, getVideo } from "@/modules/catalog";
import { getAnalyzeStartEligibility, isValidVideoId, spawnAnalysis } from "@/modules/analysis";
import { describeCatalogPreconditionFailure } from "@/lib/catalog-db";
import { reconcileRuntimeArtifacts } from "@/lib/runtime-reconciliation";
import { requirePrivateApi, sanitizePayload } from "@/lib/private-api-guard";

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
  const guard = requirePrivateApi(req);
  if (!guard.allowed) return guard.response;

  const url = new URL(req.url);
  const videoId = url.searchParams.get("videoId") || "";

  if (!isValidVideoId(videoId)) {
    return NextResponse.json({ ok: false, error: "invalid videoId" }, { status: 400 });
  }

  let video;
  try {
    video = getVideo(videoId);
  } catch (error) {
    const catalogFailure = describeCatalogPreconditionFailure(error);
    if (catalogFailure) {
      return NextResponse.json(
        sanitizePayload({
          ok: false,
          error: "catalog unavailable",
          outcome: "catalog-rebuild-needed",
          retryable: true,
          stage: "catalog-precondition",
          message: `${catalogFailure.message} Rebuild the catalog with \`${catalogFailure.repairCommand}\`.`,
          repairCommand: catalogFailure.repairCommand,
        }),
        { status: 503 },
      );
    }

    throw error;
  }

  if (!video) {
    return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  }

  const eligibility = getAnalyzeStartEligibility(videoId);
  const reconciliation = reconcileRuntimeArtifacts(videoId);
  if (!eligibility.canStart) {
    if (reconciliation.status === "mismatch" && eligibility.retryable) {
      // Allow clean reruns when durable reconciliation marks the latest artifacts as inconsistent.
    } else {
      return NextResponse.json(
        sanitizePayload({
          ok: false,
          error:
            reconciliation.status === "mismatch"
              ? (reconciliation.reasons[0]?.message ?? eligibility.message)
              : eligibility.message,
          outcome: reconciliation.status === "mismatch" ? "retry-needed" : eligibility.outcome,
          retryable: reconciliation.status === "mismatch" || eligibility.retryable,
          lifecycle: eligibility.snapshot.lifecycle,
        }),
        { status: 409 },
      );
    }
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

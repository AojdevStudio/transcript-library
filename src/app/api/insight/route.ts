import { NextResponse } from "next/server";
import { isValidVideoId, readRuntimeSnapshot, type RunLifecycle } from "@/modules/analysis";
import {
  getInsightArtifacts,
  hasBlockedLegacyInsight,
  readCuratedInsight,
  readInsightMarkdown,
} from "@/modules/insights";

export const runtime = "nodejs";

/**
 * GET /api/insight
 * Returns the full insight state for a video: derived status, markdown content,
 * curated structured data, artifact file list, and durable latest-run metadata.
 * Restart reconciliation is delegated to the shared runtime layer.
 *
 * @param req - Incoming request. Expects `?videoId=` query param.
 * @returns JSON with `{ status, error?, insight, curated, artifacts, run }`, or a
 *   400 if the videoId is invalid. Always served with `Cache-Control: no-store`.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const videoId = url.searchParams.get("videoId") || "";

  if (!isValidVideoId(videoId)) {
    return NextResponse.json({ ok: false, error: "invalid videoId" }, { status: 400 });
  }

  const insight = readInsightMarkdown(videoId).markdown;
  const curated = readCuratedInsight(videoId);
  const snapshot = readRuntimeSnapshot(videoId);
  const blockedLegacyInsight = hasBlockedLegacyInsight(videoId);

  let state: "idle" | "running" | "complete" | "failed" =
    snapshot.status === "idle" && insight ? "complete" : snapshot.status;
  let error: string | undefined = snapshot.error ?? curated.error ?? undefined;
  let lifecycle: RunLifecycle | null = snapshot.lifecycle;

  if (blockedLegacyInsight) {
    state = "failed";
    lifecycle = lifecycle ?? "failed";
    error =
      "Legacy insight requires one-time migration. Run node scripts/migrate-legacy-insights-to-json.ts --check, then rerun without --check to upgrade remaining artifacts.";
  } else if (curated.error) {
    state = "failed";
    lifecycle = lifecycle ?? "failed";
  }

  return NextResponse.json(
    {
      status: state,
      lifecycle,
      error,
      insight,
      curated: curated.curated,
      artifacts: getInsightArtifacts(videoId),
      run: snapshot.run,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

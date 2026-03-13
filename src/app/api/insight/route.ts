import { NextResponse } from "next/server";
import {
  getAnalyzeStartEligibility,
  isValidVideoId,
  readRuntimeSnapshot,
  type RunLifecycle,
} from "@/modules/analysis";
import { reconcileRuntimeArtifacts } from "@/lib/runtime-reconciliation";
import { readRuntimeStreamEvent } from "@/lib/runtime-stream";
import {
  getInsightArtifacts,
  hasBlockedLegacyInsight,
  readCuratedInsight,
  readInsightMarkdown,
} from "@/modules/insights";
import { requirePrivateApi, sanitizePayload } from "@/lib/private-api-guard";

export const runtime = "nodejs";

/**
 * GET /api/insight
 * Returns the operator-facing insight state for a video: derived status,
 * markdown content, curated structured data, artifact file list, durable
 * latest-run metadata, reconciliation state, retry guidance, and recent live
 * evidence. Restart reconciliation is delegated to the shared runtime layer so
 * the workspace reads the same durable truth as the filesystem artifacts.
 *
 * @param req - Incoming request. Expects `?videoId=` query param.
 * @returns JSON with status-first runtime fields plus insight content and
 *   artifact metadata, or a 400 if the videoId is invalid. Always served with
 *   `Cache-Control: no-store`.
 */
export async function GET(req: Request) {
  const guard = requirePrivateApi(req);
  if (!guard.allowed) return guard.response;

  const url = new URL(req.url);
  const videoId = url.searchParams.get("videoId") || "";

  if (!isValidVideoId(videoId)) {
    return NextResponse.json({ ok: false, error: "invalid videoId" }, { status: 400 });
  }

  const insight = readInsightMarkdown(videoId).markdown;
  const curated = readCuratedInsight(videoId);
  const snapshot = readRuntimeSnapshot(videoId);
  const eligibility = getAnalyzeStartEligibility(videoId);
  const reconciliation = reconcileRuntimeArtifacts(videoId);
  const runtimeEvidence = readRuntimeStreamEvent(videoId).payload;
  const blockedLegacyInsight = hasBlockedLegacyInsight(videoId);

  let state: "idle" | "running" | "complete" | "failed" =
    snapshot.status === "idle" && insight ? "complete" : snapshot.status;
  let error: string | undefined = snapshot.error ?? curated.error ?? undefined;
  let lifecycle: RunLifecycle | null = snapshot.lifecycle;
  let retryable = eligibility.retryable;
  let analyzeOutcome = eligibility.outcome;

  if (blockedLegacyInsight) {
    state = "failed";
    lifecycle = lifecycle ?? "failed";
    error =
      "Legacy insight requires one-time migration. Run node scripts/migrate-legacy-insights-to-json.ts --check, then rerun without --check to upgrade remaining artifacts.";
  } else if (curated.error) {
    state = "failed";
    lifecycle = lifecycle ?? "failed";
  }

  if (reconciliation.status === "mismatch") {
    state = "failed";
    lifecycle = lifecycle ?? "reconciled";
    retryable = true;
    analyzeOutcome = "retry-needed";
    error = reconciliation.reasons[0]?.message ?? error;
  }

  return NextResponse.json(
    sanitizePayload({
      status: state,
      lifecycle,
      retryable,
      analyzeOutcome,
      error,
      stage: runtimeEvidence.stage,
      insight,
      curated: curated.curated,
      logs: runtimeEvidence.logs,
      recentLogs: runtimeEvidence.recentLogs,
      retryGuidance: runtimeEvidence.retryGuidance,
      artifacts: getInsightArtifacts(videoId),
      reconciliation,
      run: snapshot.run,
    }),
    { headers: { "Cache-Control": "no-store" } },
  );
}

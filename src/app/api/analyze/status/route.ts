import { NextResponse } from "next/server";
import { isValidVideoId, readRuntimeSnapshot, type RunLifecycle } from "@/modules/analysis";

export const runtime = "nodejs";

type StatusResponse = {
  status: "idle" | "running" | "complete" | "failed";
  startedAt?: string;
  completedAt?: string;
  error?: string;
  lifecycle?: RunLifecycle | null;
  runId?: string | null;
};

/**
 * GET /api/analyze/status
 * Returns the current analysis lifecycle status for a video from the shared
 * durable runtime snapshot. Restart reconciliation happens inside the shared
 * runtime layer rather than route-local PID patching.
 *
 * @param req - Incoming request. Expects `?videoId=` query param.
 * @returns JSON `StatusResponse` (`{ status, startedAt?, error? }`), or a 400
 *   error if the videoId is invalid. Always served with `Cache-Control: no-store`.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const videoId = url.searchParams.get("videoId") || "";

  if (!isValidVideoId(videoId)) {
    return NextResponse.json({ ok: false, error: "invalid videoId" }, { status: 400 });
  }

  const snapshot = readRuntimeSnapshot(videoId);
  const response: StatusResponse = {
    status: snapshot.status,
    startedAt: snapshot.startedAt ?? undefined,
    completedAt: snapshot.completedAt ?? undefined,
    error: snapshot.error ?? undefined,
    lifecycle: snapshot.lifecycle,
    runId: snapshot.run?.runId ?? null,
  };

  return NextResponse.json(response, {
    headers: { "Cache-Control": "no-store" },
  });
}

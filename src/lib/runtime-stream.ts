import crypto from "node:crypto";
import { readRuntimeSnapshot } from "@/lib/analysis";
import { getInsightArtifacts, readInsightLogTail, readInsightRecentLines } from "@/lib/insights";
import {
  reconcileRuntimeArtifacts,
  type RuntimeReconciliationRecord,
} from "@/lib/runtime-reconciliation";

type RuntimeStreamStageKey =
  | "idle"
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "interrupted"
  | "reconciled";

export type RuntimeStreamPayload = {
  videoId: string;
  status: "idle" | "running" | "complete" | "failed";
  lifecycle: string | null;
  stage: {
    key: RuntimeStreamStageKey;
    label: string;
  };
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
  logs: {
    stdout: string;
    stderr: string;
  };
  recentLogs: string[];
  retryGuidance: {
    canRetry: boolean;
    nextAction: "wait" | "rerun-analysis" | "review-mismatch";
    message: string;
  };
  reconciliation: Pick<
    RuntimeReconciliationRecord,
    "status" | "resolution" | "retryable" | "reasons"
  >;
  artifacts: ReturnType<typeof getInsightArtifacts>;
  run: ReturnType<typeof readRuntimeSnapshot>["run"];
};

export type RuntimeStreamEvent = {
  event: "snapshot" | "heartbeat";
  version: string;
  payload: RuntimeStreamPayload;
};

type CacheEntry = {
  cachedAt: number;
  version: string;
  payload: RuntimeStreamPayload;
};

const CACHE_TTL_MS = 2_000;
const streamCache = new Map<string, CacheEntry>();

function resolveStage(
  lifecycle: string | null,
  status: RuntimeStreamPayload["status"],
): RuntimeStreamPayload["stage"] {
  switch (lifecycle) {
    case "queued":
      return { key: "queued", label: "Queued" };
    case "running":
      return { key: "running", label: "Running" };
    case "completed":
      return { key: "completed", label: "Completed" };
    case "failed":
      return { key: "failed", label: "Failed" };
    case "interrupted":
      return { key: "interrupted", label: "Interrupted" };
    case "reconciled":
      return { key: "reconciled", label: "Needs Reconciliation" };
    default:
      return status === "running"
        ? { key: "running", label: "Running" }
        : status === "complete"
          ? { key: "completed", label: "Completed" }
          : status === "failed"
            ? { key: "failed", label: "Failed" }
            : { key: "idle", label: "Idle" };
  }
}

function buildPayload(videoId: string): RuntimeStreamPayload {
  const snapshot = readRuntimeSnapshot(videoId);
  const reconciliation = reconcileRuntimeArtifacts(videoId);
  const logs = readInsightLogTail(videoId, 12_000);
  const recentLogs = readInsightRecentLines(videoId, 12_000, 12);
  const retryGuidance =
    snapshot.status === "running"
      ? {
          canRetry: false,
          nextAction: "wait" as const,
          message: "Analysis is still running.",
        }
      : reconciliation.status === "mismatch"
        ? {
            canRetry: true,
            nextAction: "rerun-analysis" as const,
            message: "The latest run is inconsistent. Start a clean rerun instead of trusting it.",
          }
        : snapshot.status === "failed"
          ? {
              canRetry: true,
              nextAction: "rerun-analysis" as const,
              message: "The latest run failed. Start a clean rerun when ready.",
            }
          : {
              canRetry: false,
              nextAction: "review-mismatch" as const,
              message: "No retry is needed.",
            };

  return {
    videoId,
    status: snapshot.status,
    lifecycle: snapshot.lifecycle,
    stage: resolveStage(snapshot.lifecycle, snapshot.status),
    startedAt: snapshot.startedAt,
    completedAt: snapshot.completedAt,
    error:
      reconciliation.status === "mismatch"
        ? (reconciliation.reasons[0]?.message ?? snapshot.error)
        : snapshot.error,
    logs,
    recentLogs,
    retryGuidance,
    reconciliation: {
      status: reconciliation.status,
      resolution: reconciliation.resolution,
      retryable: reconciliation.retryable,
      reasons: reconciliation.reasons,
    },
    artifacts: getInsightArtifacts(videoId),
    run: snapshot.run,
  };
}

function versionForPayload(payload: RuntimeStreamPayload): string {
  return crypto.createHash("sha1").update(JSON.stringify(payload)).digest("hex");
}

function readSharedSnapshot(videoId: string): CacheEntry {
  const cached = streamCache.get(videoId);
  const now = Date.now();

  if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
    return cached;
  }

  const payload = buildPayload(videoId);
  const entry: CacheEntry = {
    cachedAt: now,
    version: versionForPayload(payload),
    payload,
  };
  streamCache.set(videoId, entry);
  return entry;
}

export function readRuntimeStreamEvent(videoId: string, lastVersion?: string): RuntimeStreamEvent {
  const snapshot = readSharedSnapshot(videoId);

  return {
    event: lastVersion && lastVersion === snapshot.version ? "heartbeat" : "snapshot",
    version: snapshot.version,
    payload: snapshot.payload,
  };
}

export function __resetRuntimeStreamForTests(): void {
  streamCache.clear();
}

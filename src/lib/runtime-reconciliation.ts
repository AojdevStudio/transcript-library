import fs from "node:fs";
import path from "node:path";
import { parseStructuredAnalysis } from "@/lib/analysis-contract";
import { analysisPath, readRunMetadata, readStatus, type RunFile } from "@/lib/analysis";
import { insightDir, structuredAnalysisPath } from "@/lib/insight-paths";
import { readInsightLogTail } from "@/lib/insights";

export type ReconciliationReasonCode =
  | "missing-run-record"
  | "missing-status-record"
  | "status-run-id-mismatch"
  | "status-lifecycle-mismatch"
  | "missing-canonical-analysis"
  | "missing-structured-analysis"
  | "invalid-structured-analysis"
  | "artifacts-without-run";

export type ReconciliationReason = {
  code: ReconciliationReasonCode;
  severity: "warning" | "failure";
  message: string;
};

export type RuntimeReconciliationRecord = {
  schemaVersion: 1;
  videoId: string;
  runId: string | null;
  status: "ok" | "mismatch" | "resolved";
  resolution: "none" | "rerun-ready" | "resolved";
  retryable: boolean;
  checkedAt: string;
  detectedAt: string | null;
  resolvedAt: string | null;
  reasons: ReconciliationReason[];
  artifactState: {
    canonicalAnalysis: boolean;
    structuredAnalysis: "valid" | "invalid" | "missing";
    statusFile: boolean;
    runFile: boolean;
  };
  evidence: {
    stdoutTail: string;
    stderrTail: string;
  };
};

const RECONCILIATION_SCHEMA_VERSION = 1;
const RECONCILIATION_FILE = "reconciliation.json";

function nowIso(): string {
  return new Date().toISOString();
}

export function runtimeReconciliationPath(videoId: string): string {
  return path.join(insightDir(videoId), RECONCILIATION_FILE);
}

export function readRuntimeReconciliation(videoId: string): RuntimeReconciliationRecord | null {
  try {
    const raw = fs.readFileSync(runtimeReconciliationPath(videoId), "utf8");
    return JSON.parse(raw) as RuntimeReconciliationRecord;
  } catch {
    return null;
  }
}

function atomicWriteJson(filePath: string, data: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
  fs.renameSync(tempPath, filePath);
}

function readStructuredState(videoId: string): "valid" | "invalid" | "missing" {
  try {
    const raw = fs.readFileSync(structuredAnalysisPath(videoId), "utf8");
    parseStructuredAnalysis(raw);
    return "valid";
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return "missing";
    }
    return "invalid";
  }
}

function buildReasons(
  videoId: string,
  run: RunFile | null,
  hasCanonicalAnalysis: boolean,
  structuredState: "valid" | "invalid" | "missing",
): ReconciliationReason[] {
  const status = readStatus(videoId);
  const reasons: ReconciliationReason[] = [];

  if (!run && (hasCanonicalAnalysis || structuredState !== "missing")) {
    reasons.push({
      code: "artifacts-without-run",
      severity: "failure",
      message: "Canonical artifacts exist without a matching durable run record.",
    });
  }

  if (run && !status) {
    reasons.push({
      code: "missing-status-record",
      severity: "warning",
      message: "run.json exists but status.json is missing.",
    });
  }

  if (run && status && status.runId !== run.runId) {
    reasons.push({
      code: "status-run-id-mismatch",
      severity: "failure",
      message: "status.json points at a different runId than run.json.",
    });
  }

  if (run && status && status.lifecycle !== run.lifecycle) {
    reasons.push({
      code: "status-lifecycle-mismatch",
      severity: "failure",
      message: "status.json lifecycle disagrees with run.json lifecycle.",
    });
  }

  if (run?.lifecycle === "completed") {
    if (!hasCanonicalAnalysis) {
      reasons.push({
        code: "missing-canonical-analysis",
        severity: "failure",
        message: "The latest run completed but analysis.md is missing.",
      });
    }

    if (structuredState === "missing") {
      reasons.push({
        code: "missing-structured-analysis",
        severity: "failure",
        message: "The latest run completed but analysis.json is missing.",
      });
    }

    if (structuredState === "invalid") {
      reasons.push({
        code: "invalid-structured-analysis",
        severity: "failure",
        message: "analysis.json exists but does not match the structured contract.",
      });
    }
  }

  return reasons;
}

export function reconcileRuntimeArtifacts(videoId: string): RuntimeReconciliationRecord {
  const previous = readRuntimeReconciliation(videoId);
  const run = readRunMetadata(videoId);
  const hasCanonicalAnalysis = fs.existsSync(analysisPath(videoId));
  const structuredState = readStructuredState(videoId);
  const reasons = buildReasons(videoId, run, hasCanonicalAnalysis, structuredState);
  const checkedAt = nowIso();
  const evidence = readInsightLogTail(videoId, 4_000);

  let status: RuntimeReconciliationRecord["status"] = "ok";
  let resolution: RuntimeReconciliationRecord["resolution"] = "none";
  let detectedAt: string | null = previous?.detectedAt ?? null;
  let resolvedAt: string | null = null;

  if (reasons.length > 0) {
    status = "mismatch";
    resolution = "rerun-ready";
    detectedAt = detectedAt ?? checkedAt;
  } else if (previous?.status === "mismatch" || previous?.status === "resolved") {
    status = "resolved";
    resolution = "resolved";
    detectedAt = previous.detectedAt ?? checkedAt;
    resolvedAt = checkedAt;
  }

  const record: RuntimeReconciliationRecord = {
    schemaVersion: RECONCILIATION_SCHEMA_VERSION,
    videoId,
    runId: run?.runId ?? null,
    status,
    resolution,
    retryable: resolution === "rerun-ready",
    checkedAt,
    detectedAt,
    resolvedAt,
    reasons,
    artifactState: {
      canonicalAnalysis: hasCanonicalAnalysis,
      structuredAnalysis: structuredState,
      statusFile: readStatus(videoId) !== null,
      runFile: run !== null,
    },
    evidence: {
      stdoutTail: evidence.stdout,
      stderrTail: evidence.stderr,
    },
  };

  if (
    !previous ||
    previous.status !== record.status ||
    previous.runId !== record.runId ||
    previous.resolution !== record.resolution ||
    JSON.stringify(previous.reasons) !== JSON.stringify(record.reasons) ||
    previous.artifactState.structuredAnalysis !== record.artifactState.structuredAnalysis ||
    previous.artifactState.canonicalAnalysis !== record.artifactState.canonicalAnalysis
  ) {
    atomicWriteJson(runtimeReconciliationPath(videoId), record);
    return record;
  }

  const refreshed = { ...record, detectedAt: previous.detectedAt, resolvedAt: previous.resolvedAt };
  atomicWriteJson(runtimeReconciliationPath(videoId), refreshed);
  return refreshed;
}

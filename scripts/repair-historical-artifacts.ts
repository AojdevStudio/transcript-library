import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  atomicWriteJson,
  analysisPath,
  insightsBaseDir,
  readRunMetadata,
  structuredAnalysisPath,
} from "../src/lib/analysis";
import {
  reconcileRuntimeArtifacts,
  type ReconciliationReasonCode,
  type RuntimeReconciliationRecord,
} from "../src/lib/runtime-reconciliation";
import { isValidVideoId } from "../src/lib/insight-paths";
import { ensureDisplayArtifact } from "./backfill-insight-artifacts";
import { deriveStructuredAnalysisFromMarkdown } from "./migrate-legacy-insights-to-json";

export type HistoricalArtifactRepairAction = "repaired" | "rerun-needed" | "skipped" | "error";

export type HistoricalArtifactRepairResult = {
  videoId: string;
  runId: string | null;
  action: HistoricalArtifactRepairAction;
  reasonCodes: ReconciliationReasonCode[];
  reconciliationBefore: RuntimeReconciliationRecord["status"];
  reconciliationAfter: RuntimeReconciliationRecord["status"] | null;
  displayArtifact: string | null;
  operatorEvidence: {
    retryable: boolean;
    analyzeOutcome: "retry-needed" | "resolved" | "none";
    resolution: RuntimeReconciliationRecord["resolution"];
    primaryReasonCode: ReconciliationReasonCode | null;
  };
  error?: string;
};

export type HistoricalArtifactRepairReport = {
  schemaVersion: 1;
  checkedAt: string;
  repairedCount: number;
  rerunNeededCount: number;
  skippedCount: number;
  errorCount: number;
  mismatchClassCounts: Record<ReconciliationReasonCode, number>;
  results: HistoricalArtifactRepairResult[];
};

const REPORT_SCHEMA_VERSION = 1;
const REPAIRABLE_REASON: ReconciliationReasonCode = "missing-structured-analysis";
const ALL_REASON_CODES: ReconciliationReasonCode[] = [
  "missing-run-record",
  "missing-status-record",
  "status-run-id-mismatch",
  "status-lifecycle-mismatch",
  "missing-canonical-analysis",
  "missing-structured-analysis",
  "invalid-structured-analysis",
  "artifacts-without-run",
];

function emptyMismatchClassCounts(): Record<ReconciliationReasonCode, number> {
  return ALL_REASON_CODES.reduce(
    (acc, code) => {
      acc[code] = 0;
      return acc;
    },
    {} as Record<ReconciliationReasonCode, number>,
  );
}

function listCandidateVideoIds(selectedVideoIds?: string[]): string[] {
  if (selectedVideoIds?.length) {
    return [...new Set(selectedVideoIds)].filter((videoId) => isValidVideoId(videoId)).sort();
  }

  const baseDir = insightsBaseDir();
  if (!fs.existsSync(baseDir)) return [];

  return fs
    .readdirSync(baseDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && isValidVideoId(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

function canRepairInPlace(record: RuntimeReconciliationRecord): boolean {
  return (
    record.reasons.length === 1 &&
    record.reasons[0]?.code === REPAIRABLE_REASON &&
    record.artifactState.canonicalAnalysis &&
    record.runId !== null
  );
}

function buildOperatorEvidence(
  before: RuntimeReconciliationRecord,
  after?: RuntimeReconciliationRecord | null,
): HistoricalArtifactRepairResult["operatorEvidence"] {
  const effective = after ?? before;
  return {
    retryable: effective.retryable,
    analyzeOutcome:
      effective.status === "mismatch"
        ? "retry-needed"
        : effective.status === "resolved"
          ? "resolved"
          : "none",
    resolution: effective.resolution,
    primaryReasonCode: before.reasons[0]?.code ?? null,
  };
}

function repairStructuredAnalysis(videoId: string): { displayArtifact: string | null } {
  const markdown = fs.readFileSync(analysisPath(videoId), "utf8");
  const structured = deriveStructuredAnalysisFromMarkdown(videoId, markdown);
  atomicWriteJson(structuredAnalysisPath(videoId), structured);
  return { displayArtifact: ensureDisplayArtifact(videoId, { refresh: true }) };
}

export function repairHistoricalArtifacts(
  args: {
    videoIds?: string[];
  } = {},
): HistoricalArtifactRepairReport {
  const checkedAt = new Date().toISOString();
  const mismatchClassCounts = emptyMismatchClassCounts();
  const results: HistoricalArtifactRepairResult[] = [];

  for (const videoId of listCandidateVideoIds(args.videoIds)) {
    const before = reconcileRuntimeArtifacts(videoId);
    const reasonCodes = before.reasons.map((reason) => reason.code);
    for (const code of reasonCodes) mismatchClassCounts[code] += 1;

    if (reasonCodes.length === 0) {
      results.push({
        videoId,
        runId: before.runId,
        action: "skipped",
        reasonCodes,
        reconciliationBefore: before.status,
        reconciliationAfter: before.status,
        displayArtifact: null,
        operatorEvidence: buildOperatorEvidence(before, before),
      });
      continue;
    }

    if (!canRepairInPlace(before)) {
      results.push({
        videoId,
        runId: before.runId,
        action: "rerun-needed",
        reasonCodes,
        reconciliationBefore: before.status,
        reconciliationAfter: before.status,
        displayArtifact: null,
        operatorEvidence: buildOperatorEvidence(before, before),
      });
      continue;
    }

    try {
      const repaired = repairStructuredAnalysis(videoId);
      const after = reconcileRuntimeArtifacts(videoId);
      results.push({
        videoId,
        runId: readRunMetadata(videoId)?.runId ?? before.runId,
        action: "repaired",
        reasonCodes,
        reconciliationBefore: before.status,
        reconciliationAfter: after.status,
        displayArtifact: repaired.displayArtifact,
        operatorEvidence: buildOperatorEvidence(before, after),
      });
    } catch (error) {
      results.push({
        videoId,
        runId: before.runId,
        action: "error",
        reasonCodes,
        reconciliationBefore: before.status,
        reconciliationAfter: null,
        displayArtifact: null,
        operatorEvidence: buildOperatorEvidence(before, null),
        error: (error as Error).message,
      });
    }
  }

  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    checkedAt,
    repairedCount: results.filter((result) => result.action === "repaired").length,
    rerunNeededCount: results.filter((result) => result.action === "rerun-needed").length,
    skippedCount: results.filter((result) => result.action === "skipped").length,
    errorCount: results.filter((result) => result.action === "error").length,
    mismatchClassCounts,
    results,
  };
}

function parseCliArgs(argv: string[]): { videoIds?: string[] } {
  const videoIds: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--video-id") {
      const next = argv[index + 1];
      if (next) {
        videoIds.push(next);
        index += 1;
      }
    }
  }

  return videoIds.length > 0 ? { videoIds } : {};
}

function main() {
  const report = repairHistoricalArtifacts(parseCliArgs(process.argv.slice(2)));
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.errorCount === 0 ? 0 : 1;
}

const isDirectExecution =
  typeof process.argv[1] === "string" &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectExecution) {
  main();
}

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { GET as getInsight } from "@/app/api/insight/route";
import { parseStructuredAnalysis } from "@/lib/analysis-contract";
import { getAnalyzeStartEligibility } from "@/lib/analysis";
import { analysisPath, structuredAnalysisPath } from "@/lib/insight-paths";
import { readRuntimeStreamEvent } from "@/lib/runtime-stream";
import { readRuntimeReconciliation, reconcileRuntimeArtifacts } from "@/lib/runtime-reconciliation";
import { repairHistoricalArtifacts } from "../../../scripts/repair-historical-artifacts";

const originalInsightsBaseDir = process.env.INSIGHTS_BASE_DIR;

afterEach(() => {
  if (originalInsightsBaseDir === undefined) {
    delete process.env.INSIGHTS_BASE_DIR;
  } else {
    process.env.INSIGHTS_BASE_DIR = originalInsightsBaseDir;
  }
});

function writeHistoricalMissingStructuredFixture(baseDir: string, videoId = "abc123xyz89") {
  const dir = path.join(baseDir, videoId);
  fs.mkdirSync(dir, { recursive: true });

  const markdown = [
    "---",
    'title: "Historical Repair Test"',
    "---",
    "",
    "## Summary",
    "Historical summary paragraph.",
    "",
    "## Key Takeaways",
    "- Preserve durable authority",
    "",
    "## Action Items",
    "1. Rebuild structured analysis",
    "",
    "## Notable Points",
    "- Existing markdown is the source of truth for this repair.",
  ].join("\n");

  fs.writeFileSync(path.join(dir, "analysis.md"), markdown);
  fs.writeFileSync(path.join(dir, "historical-repair-test.md"), markdown);
  fs.writeFileSync(
    path.join(dir, "video-metadata.json"),
    JSON.stringify(
      {
        videoId,
        title: "Historical Repair Test",
      },
      null,
      2,
    ),
  );
  fs.writeFileSync(
    path.join(dir, "run.json"),
    JSON.stringify(
      {
        schemaVersion: 1,
        videoId,
        provider: "claude-cli",
        command: "claude",
        args: ["-p"],
        status: "complete",
        startedAt: "2026-03-08T20:53:03.157Z",
        promptResolvedAt: "2026-03-08T20:53:03.145Z",
        pid: 23322,
        completedAt: "2026-03-08T20:54:34.905Z",
        exitCode: 0,
        artifacts: {
          canonicalFileName: "analysis.md",
          displayFileName: "historical-repair-test.md",
          metadataFileName: "video-metadata.json",
          stdoutFileName: "worker-stdout.txt",
          stderrFileName: "worker-stderr.txt",
        },
      },
      null,
      2,
    ),
  );
  fs.writeFileSync(
    path.join(dir, "status.json"),
    JSON.stringify(
      {
        status: "complete",
        pid: 23322,
        startedAt: "2026-03-08T20:53:03.157Z",
        completedAt: "2026-03-08T20:54:34.905Z",
      },
      null,
      2,
    ),
  );

  return { dir, videoId, markdown };
}

describe("repairHistoricalArtifacts", () => {
  it("repairs only missing-structured-analysis directories in place and resolves reconciliation", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "historical-artifact-repair-"));
    process.env.INSIGHTS_BASE_DIR = tmpDir;

    const { videoId, dir, markdown } = writeHistoricalMissingStructuredFixture(tmpDir);
    const beforeRun = fs.readFileSync(path.join(dir, "run.json"), "utf8");
    const beforeStatus = fs.readFileSync(path.join(dir, "status.json"), "utf8");

    const mismatch = reconcileRuntimeArtifacts(videoId);
    expect(mismatch.reasons.map((reason) => reason.code)).toEqual(["missing-structured-analysis"]);

    const result = repairHistoricalArtifacts({ videoIds: [videoId] });

    expect(result).toMatchObject({
      repairedCount: 1,
      rerunNeededCount: 0,
      skippedCount: 0,
      mismatchClassCounts: {
        "missing-structured-analysis": 1,
      },
    });
    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toMatchObject({
      videoId,
      action: "repaired",
      reasonCodes: ["missing-structured-analysis"],
      runId: "legacy-20260308205303",
      operatorEvidence: {
        retryable: false,
        analyzeOutcome: "resolved",
        resolution: "resolved",
        primaryReasonCode: "missing-structured-analysis",
      },
    });

    const structuredRaw = fs.readFileSync(structuredAnalysisPath(videoId), "utf8");
    expect(parseStructuredAnalysis(structuredRaw)).toMatchObject({
      videoId,
      title: "Historical Repair Test",
      summary: "Historical summary paragraph.",
      takeaways: ["Preserve durable authority"],
      actionItems: ["Rebuild structured analysis"],
      notablePoints: ["Existing markdown is the source of truth for this repair."],
      reportMarkdown: markdown,
    });
    expect(fs.readFileSync(analysisPath(videoId), "utf8")).toBe(markdown);
    expect(fs.existsSync(path.join(dir, "historical-repair-test.md"))).toBe(true);
    expect(fs.readFileSync(path.join(dir, "run.json"), "utf8")).toBe(beforeRun);
    expect(fs.readFileSync(path.join(dir, "status.json"), "utf8")).toBe(beforeStatus);
    expect(readRuntimeReconciliation(videoId)).toMatchObject({
      status: "resolved",
      resolution: "resolved",
      retryable: false,
      runId: "legacy-20260308205303",
    });
  });

  it("leaves artifacts-without-run directories rerun-needed instead of inventing history", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "historical-artifact-repair-"));
    process.env.INSIGHTS_BASE_DIR = tmpDir;

    const { videoId } = writeHistoricalMissingStructuredFixture(tmpDir, "abc123xy999");
    fs.rmSync(path.join(tmpDir, videoId, "run.json"));

    const result = repairHistoricalArtifacts({ videoIds: [videoId] });

    expect(result).toMatchObject({
      repairedCount: 0,
      rerunNeededCount: 1,
      errorCount: 0,
      mismatchClassCounts: {
        "artifacts-without-run": 1,
      },
    });
    expect(result.results[0]).toMatchObject({
      videoId,
      action: "rerun-needed",
      runId: null,
      reasonCodes: ["artifacts-without-run"],
      reconciliationBefore: "mismatch",
      reconciliationAfter: "mismatch",
      operatorEvidence: {
        retryable: true,
        analyzeOutcome: "retry-needed",
        resolution: "rerun-ready",
        primaryReasonCode: "artifacts-without-run",
      },
    });
    expect(fs.existsSync(path.join(tmpDir, videoId, "run.json"))).toBe(false);
    expect(fs.existsSync(structuredAnalysisPath(videoId))).toBe(false);
    expect(readRuntimeReconciliation(videoId)).toMatchObject({
      status: "mismatch",
      resolution: "rerun-ready",
      runId: null,
    });

    expect(getAnalyzeStartEligibility(videoId)).toMatchObject({
      canStart: false,
      outcome: "retry-needed",
      retryable: true,
      hasArtifacts: true,
    });

    const insightResponse = await getInsight(
      new Request(`http://localhost/api/insight?videoId=${videoId}`),
    );
    const insightBody = (await insightResponse.json()) as {
      status: string;
      lifecycle: string | null;
      retryable: boolean;
      analyzeOutcome: string;
      retryGuidance: { canRetry: boolean; nextAction: string; message: string };
      reconciliation: { status: string; resolution: string; reasons: Array<{ code: string }> };
      run: null | { runId: string };
    };

    expect(insightBody).toMatchObject({
      status: "failed",
      lifecycle: "reconciled",
      retryable: true,
      analyzeOutcome: "retry-needed",
      run: null,
      retryGuidance: {
        canRetry: true,
        nextAction: "rerun-analysis",
      },
      reconciliation: {
        status: "mismatch",
        resolution: "rerun-ready",
      },
    });
    expect(insightBody.retryGuidance.message).toContain("clean rerun");
    expect(insightBody.reconciliation.reasons.map((reason) => reason.code)).toEqual([
      "artifacts-without-run",
    ]);

    const streamEvent = readRuntimeStreamEvent(videoId);
    expect(streamEvent.payload).toMatchObject({
      status: "failed",
      lifecycle: "reconciled",
      stage: { key: "reconciled", label: "Needs Reconciliation" },
      retryGuidance: {
        canRetry: true,
        nextAction: "rerun-analysis",
      },
      reconciliation: {
        status: "mismatch",
        resolution: "rerun-ready",
        retryable: true,
      },
      run: null,
    });
  });
});

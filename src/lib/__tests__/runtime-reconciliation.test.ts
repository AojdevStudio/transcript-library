import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { GET as getInsight } from "@/app/api/insight/route";
import {
  __resetAnalysisRuntimeForTests,
  analysisPath,
  buildRunArtifacts,
  stdoutLogPath,
  structuredAnalysisPath,
  writeRunLifecycle,
} from "@/lib/analysis";
import { readRuntimeReconciliation, reconcileRuntimeArtifacts } from "@/lib/runtime-reconciliation";

const originalInsightsBaseDir = process.env.INSIGHTS_BASE_DIR;

afterEach(() => {
  __resetAnalysisRuntimeForTests();
  if (originalInsightsBaseDir === undefined) {
    delete process.env.INSIGHTS_BASE_DIR;
  } else {
    process.env.INSIGHTS_BASE_DIR = originalInsightsBaseDir;
  }
});

function writeValidStructured(videoId: string) {
  fs.mkdirSync(path.dirname(structuredAnalysisPath(videoId)), { recursive: true });
  fs.writeFileSync(
    structuredAnalysisPath(videoId),
    JSON.stringify({
      schemaVersion: 1,
      videoId,
      title: "Reconciliation Test",
      summary: "A valid summary.",
      takeaways: ["One takeaway"],
      actionItems: ["One action"],
      notablePoints: ["One point"],
      reportMarkdown: "# Analysis\n\nA valid report.",
    }),
  );
}

function writeHistoricalCompletedRunFixture(tmpDir: string, videoId = "hist123xy89") {
  const dir = path.join(tmpDir, videoId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "analysis.md"),
    [
      "---",
      'title: "Historical Fixture"',
      "---",
      "",
      "## Summary",
      "Historical markdown only.",
    ].join("\n"),
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
          displayFileName: "historical-fixture.md",
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
}

describe("runtime reconciliation", () => {
  it("persists a durable mismatch record when a completed run is missing canonical artifacts", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "runtime-reconciliation-"));
    process.env.INSIGHTS_BASE_DIR = tmpDir;

    writeRunLifecycle("abc123xyz89", {
      runId: "run-reconcile-1",
      provider: "claude-cli",
      command: "claude",
      args: ["-p"],
      lifecycle: "completed",
      startedAt: "2026-03-10T20:00:00.000Z",
      promptResolvedAt: "2026-03-10T19:59:59.000Z",
      pid: 1234,
      completedAt: "2026-03-10T20:02:00.000Z",
      exitCode: 0,
      artifacts: buildRunArtifacts("abc123xyz89", "Reconciliation Test", "run-reconcile-1"),
    });

    const record = reconcileRuntimeArtifacts("abc123xyz89");

    expect(record).toMatchObject({
      videoId: "abc123xyz89",
      runId: "run-reconcile-1",
      status: "mismatch",
      resolution: "rerun-ready",
      retryable: true,
    });
    expect(record.reasons.map((reason) => reason.code)).toEqual(
      expect.arrayContaining(["missing-canonical-analysis", "missing-structured-analysis"]),
    );
    expect(readRuntimeReconciliation("abc123xyz89")).toMatchObject({
      status: "mismatch",
      runId: "run-reconcile-1",
    });
  });

  it("marks a previously detected mismatch as resolved once canonical artifacts are restored", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "runtime-reconciliation-"));
    process.env.INSIGHTS_BASE_DIR = tmpDir;

    writeRunLifecycle("abc123xyz89", {
      runId: "run-reconcile-2",
      provider: "claude-cli",
      command: "claude",
      args: ["-p"],
      lifecycle: "completed",
      startedAt: "2026-03-10T20:03:00.000Z",
      promptResolvedAt: "2026-03-10T20:02:59.000Z",
      pid: 1234,
      completedAt: "2026-03-10T20:04:00.000Z",
      exitCode: 0,
      artifacts: buildRunArtifacts("abc123xyz89", "Reconciliation Test", "run-reconcile-2"),
    });

    reconcileRuntimeArtifacts("abc123xyz89");

    fs.mkdirSync(path.dirname(analysisPath("abc123xyz89")), { recursive: true });
    fs.writeFileSync(analysisPath("abc123xyz89"), "# Analysis\n\nRecovered report.");
    writeValidStructured("abc123xyz89");

    const record = reconcileRuntimeArtifacts("abc123xyz89");

    expect(record).toMatchObject({
      status: "resolved",
      resolution: "resolved",
      retryable: false,
      runId: "run-reconcile-2",
    });
    expect(record.detectedAt).toBeTruthy();
    expect(record.resolvedAt).toBeTruthy();
  });

  it("classifies a historical completed directory missing analysis.json without fabricating run history", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "runtime-reconciliation-"));
    process.env.INSIGHTS_BASE_DIR = tmpDir;

    writeHistoricalCompletedRunFixture(tmpDir);

    const record = reconcileRuntimeArtifacts("hist123xy89");

    expect(record).toMatchObject({
      runId: "legacy-20260308205303",
      status: "mismatch",
      resolution: "rerun-ready",
      retryable: true,
      artifactState: {
        canonicalAnalysis: true,
        structuredAnalysis: "missing",
        statusFile: true,
        runFile: true,
      },
    });
    expect(record.reasons).toEqual([
      expect.objectContaining({ code: "missing-structured-analysis" }),
    ]);
  });

  it("surfaces reconciliation mismatch through the insight route instead of silent success", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "runtime-reconciliation-"));
    process.env.INSIGHTS_BASE_DIR = tmpDir;

    fs.mkdirSync(path.dirname(analysisPath("abc123xyz89")), { recursive: true });
    fs.writeFileSync(analysisPath("abc123xyz89"), "# Analysis\n\nThis should not look healthy.");
    fs.writeFileSync(structuredAnalysisPath("abc123xyz89"), "{not-json");
    fs.writeFileSync(stdoutLogPath("abc123xyz89"), "line one\nline two\nline three");
    writeRunLifecycle("abc123xyz89", {
      runId: "run-reconcile-3",
      provider: "claude-cli",
      command: "claude",
      args: ["-p"],
      lifecycle: "completed",
      startedAt: "2026-03-10T20:05:00.000Z",
      promptResolvedAt: "2026-03-10T20:04:59.000Z",
      pid: 1234,
      completedAt: "2026-03-10T20:06:00.000Z",
      exitCode: 0,
      artifacts: buildRunArtifacts("abc123xyz89", "Reconciliation Test", "run-reconcile-3"),
    });

    const response = await getInsight(
      new Request("http://localhost/api/insight?videoId=abc123xyz89"),
    );
    const body = await response.json();

    expect(body.status).toBe("failed");
    expect(body.analyzeOutcome).toBe("retry-needed");
    expect(body.retryable).toBe(true);
    expect(body.stage).toMatchObject({ key: "completed", label: "Completed" });
    expect(body.recentLogs).toEqual(["line one", "line two", "line three"]);
    expect(body.retryGuidance).toMatchObject({
      canRetry: true,
      nextAction: "rerun-analysis",
    });
    expect(body.reconciliation).toMatchObject({
      status: "mismatch",
      resolution: "rerun-ready",
    });
    expect(body.reconciliation.reasons.map((reason: { code: string }) => reason.code)).toContain(
      "invalid-structured-analysis",
    );
  });
});

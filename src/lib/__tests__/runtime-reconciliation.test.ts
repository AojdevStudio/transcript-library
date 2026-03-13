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

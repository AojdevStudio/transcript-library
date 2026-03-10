import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { GET as getAnalyzeStatus } from "@/app/api/analyze/status/route";
import { GET as getInsight } from "@/app/api/insight/route";
import {
  __resetAnalysisRuntimeForTests,
  analysisPath,
  buildRunArtifacts,
  readStatus,
  writeRunLifecycle,
} from "@/lib/analysis";
import { getInsightArtifacts } from "@/lib/insights";

const originalInsightsBaseDir = process.env.INSIGHTS_BASE_DIR;

afterEach(() => {
  __resetAnalysisRuntimeForTests();
  if (originalInsightsBaseDir === undefined) {
    delete process.env.INSIGHTS_BASE_DIR;
  } else {
    process.env.INSIGHTS_BASE_DIR = originalInsightsBaseDir;
  }
});

describe("runtime compatibility", () => {
  it("reconciles stale running status through the shared status route snapshot", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "runtime-compat-"));
    process.env.INSIGHTS_BASE_DIR = tmpDir;

    writeRunLifecycle("abc123xyz89", {
      runId: "run-100",
      provider: "claude-cli",
      command: "claude",
      args: ["-p"],
      lifecycle: "running",
      startedAt: "2026-03-10T19:00:00.000Z",
      promptResolvedAt: "2026-03-10T18:59:59.000Z",
      pid: 999999,
      artifacts: buildRunArtifacts("abc123xyz89", "Compatibility Test", "run-100"),
    });

    const response = await getAnalyzeStatus(
      new Request("http://localhost/api/analyze/status?videoId=abc123xyz89"),
    );
    const body = (await response.json()) as {
      status: string;
      lifecycle: string | null;
      runId: string | null;
    };

    expect(body).toMatchObject({
      status: "failed",
      lifecycle: "interrupted",
      runId: "run-100",
    });
    expect(readStatus("abc123xyz89")).toMatchObject({
      status: "failed",
      lifecycle: "interrupted",
    });
  });

  it("serves insight reads from the same durable run truth and preserves artifact names", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "runtime-compat-"));
    process.env.INSIGHTS_BASE_DIR = tmpDir;

    fs.mkdirSync(path.dirname(analysisPath("abc123xyz89")), { recursive: true });
    fs.writeFileSync(analysisPath("abc123xyz89"), "# Analysis\n\nCompleted report.");
    writeRunLifecycle("abc123xyz89", {
      runId: "run-101",
      provider: "claude-cli",
      command: "claude",
      args: ["-p"],
      lifecycle: "completed",
      startedAt: "2026-03-10T19:05:00.000Z",
      promptResolvedAt: "2026-03-10T19:04:59.000Z",
      pid: 1234,
      completedAt: "2026-03-10T19:06:00.000Z",
      exitCode: 0,
      artifacts: buildRunArtifacts("abc123xyz89", "Compatibility Test", "run-101"),
    });

    const response = await getInsight(
      new Request("http://localhost/api/insight?videoId=abc123xyz89"),
    );
    const body = (await response.json()) as {
      status: string;
      lifecycle: string | null;
      artifacts: ReturnType<typeof getInsightArtifacts>;
      run: { runId: string; lifecycle: string; status: string } | null;
    };

    expect(body.status).toBe("complete");
    expect(body.lifecycle).toBe("completed");
    expect(body.run).toMatchObject({
      runId: "run-101",
      lifecycle: "completed",
      status: "complete",
    });
    expect(body.artifacts).toMatchObject({
      runFileName: "run.json",
      stdoutFileName: "worker-stdout.txt",
      stderrFileName: "worker-stderr.txt",
    });
  });
});

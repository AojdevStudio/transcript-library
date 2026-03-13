import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readCuratedInsight } from "@/lib/insights";

const originalInsightsBaseDir = process.env.INSIGHTS_BASE_DIR;

afterEach(() => {
  if (originalInsightsBaseDir === undefined) {
    delete process.env.INSIGHTS_BASE_DIR;
  } else {
    process.env.INSIGHTS_BASE_DIR = originalInsightsBaseDir;
  }
});

describe("readCuratedInsight", () => {
  it("keeps markdown-only legacy insights readable during the migration window", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "legacy-insight-"));
    process.env.INSIGHTS_BASE_DIR = tmpDir;

    fs.writeFileSync(
      path.join(tmpDir, "abc123xyz89.md"),
      [
        "---",
        'title: "Legacy Insight"',
        "---",
        "",
        "## Summary",
        "Legacy summary paragraph.",
        "",
        "## Key Takeaways",
        "- Takeaway one",
        "",
        "## Action Items",
        "1. Do the thing",
      ].join("\n"),
    );

    expect(readCuratedInsight("abc123xyz89")).toEqual({
      curated: {
        summary: "Legacy summary paragraph.",
        takeaways: ["Takeaway one"],
        actionItems: ["Do the thing"],
      },
      error: null,
      source: "legacy-markdown",
    });
  });

  it("fails loudly when a structured analysis file exists but is invalid", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "invalid-structured-"));
    process.env.INSIGHTS_BASE_DIR = tmpDir;
    const videoDir = path.join(tmpDir, "abc123xyz89");
    fs.mkdirSync(videoDir, { recursive: true });
    fs.writeFileSync(
      path.join(videoDir, "analysis.json"),
      '{"schemaVersion":1,"videoId":"abc123xyz89"}',
    );
    fs.writeFileSync(path.join(videoDir, "analysis.md"), "# Existing report");

    expect(readCuratedInsight("abc123xyz89")).toEqual({
      curated: null,
      error: expect.stringMatching(/structured analysis/i),
      source: "invalid-structured",
    });
  });
});

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  MIGRATION_STATUS_FILE,
  runLegacyInsightMigration,
} from "../../../scripts/migrate-legacy-insights-to-json";

const originalInsightsBaseDir = process.env.INSIGHTS_BASE_DIR;

afterEach(() => {
  if (originalInsightsBaseDir === undefined) {
    delete process.env.INSIGHTS_BASE_DIR;
  } else {
    process.env.INSIGHTS_BASE_DIR = originalInsightsBaseDir;
  }
});

describe("runLegacyInsightMigration", () => {
  it("upgrades legacy markdown-only insights into JSON-first artifacts and records completion", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "legacy-migration-"));
    process.env.INSIGHTS_BASE_DIR = tmpDir;

    fs.writeFileSync(
      path.join(tmpDir, "abc123xyz89.md"),
      [
        "---",
        'title: "Migrated Insight"',
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

    const status = runLegacyInsightMigration();

    expect(status).toMatchObject({
      migratedCount: 1,
      manualReviewCount: 0,
      remainingLegacyCount: 0,
      migratedVideoIds: ["abc123xyz89"],
    });

    const migratedDir = path.join(tmpDir, "abc123xyz89");
    expect(fs.existsSync(path.join(migratedDir, "analysis.json"))).toBe(true);
    expect(fs.existsSync(path.join(migratedDir, "analysis.md"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, "abc123xyz89.md"))).toBe(false);

    const structured = JSON.parse(fs.readFileSync(path.join(migratedDir, "analysis.json"), "utf8"));
    expect(structured).toMatchObject({
      schemaVersion: 1,
      videoId: "abc123xyz89",
      title: "Migrated Insight",
      summary: "Legacy summary paragraph.",
      takeaways: ["Takeaway one"],
      actionItems: ["Do the thing"],
    });

    const statusArtifact = JSON.parse(
      fs.readFileSync(path.join(tmpDir, MIGRATION_STATUS_FILE), "utf8"),
    );
    expect(statusArtifact.remainingLegacyCount).toBe(0);
  });

  it("keeps unresolved legacy markdown for manual review and records the remaining count", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "legacy-manual-review-"));
    process.env.INSIGHTS_BASE_DIR = tmpDir;

    fs.writeFileSync(
      path.join(tmpDir, "abc123xyz89.md"),
      ["# Legacy insight without summary heading", "", "Just freeform notes."].join("\n"),
    );

    const status = runLegacyInsightMigration();

    expect(status.migratedCount).toBe(0);
    expect(status.manualReviewCount).toBe(1);
    expect(status.remainingLegacyCount).toBe(1);
    expect(status.manualReview[0]?.reason).toMatch(/summary|title/i);
    expect(fs.existsSync(path.join(tmpDir, "abc123xyz89.md"))).toBe(true);
  });

  it("supports a check mode that reports remaining legacy artifacts without mutating them", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "legacy-check-only-"));
    process.env.INSIGHTS_BASE_DIR = tmpDir;

    fs.writeFileSync(
      path.join(tmpDir, "abc123xyz89.md"),
      ["---", 'title: "Check Mode"', "---", "", "## Summary", "Legacy summary paragraph."].join(
        "\n",
      ),
    );

    const status = runLegacyInsightMigration({ checkOnly: true });

    expect(status.checkOnly).toBe(true);
    expect(status.migratedCount).toBe(0);
    expect(status.remainingLegacyCount).toBe(1);
    expect(fs.existsSync(path.join(tmpDir, "abc123xyz89.md"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, "abc123xyz89", "analysis.json"))).toBe(false);
  });
});

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { catalogValidationReportPath, rebuildCatalogFromCsv } from "@/lib/catalog-import";

const csvHeader = [
  "video_id",
  "parent_video_id",
  "title",
  "channel",
  "topic",
  "published_date",
  "ingested_date",
  "word_count",
  "chunk",
  "total_chunks",
  "file_path",
].join(",");

function writeCsv(tempRoot: string, name: string, rows: string[][]): string {
  const csvPath = path.join(tempRoot, name);
  fs.writeFileSync(csvPath, [csvHeader, ...rows.map((row) => row.join(","))].join("\n"));
  return csvPath;
}

describe("catalog parity reporting", () => {
  it("writes a durable validation report for successful refreshes", () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "catalog-parity-success-"));
    const liveDbPath = path.join(tempRoot, "data", "catalog", "catalog.db");
    const csvPath = writeCsv(tempRoot, "source.csv", [
      [
        "part-b",
        "video-777",
        "Deep Dive",
        "Channel Gamma",
        "ai",
        "2026-03-07",
        "2026-03-08",
        "250",
        "2",
        "2",
        "gamma/part-2.md",
      ],
      [
        "part-a",
        "video-777",
        "Deep Dive",
        "Channel Gamma",
        "ai",
        "2026-03-07",
        "2026-03-08",
        "300",
        "1",
        "2",
        "gamma/part-1.md",
      ],
      [
        "solo-888",
        "",
        "One Shot",
        "Channel Gamma",
        "ops",
        "2026-03-01",
        "2026-03-02",
        "600",
        "1",
        "1",
        "gamma/solo.md",
      ],
    ]);

    const result = rebuildCatalogFromCsv({ csvPath, liveDbPath, checkOnly: true });
    const report = JSON.parse(fs.readFileSync(result.validationReportPath, "utf8"));

    expect(report.valid).toBe(true);
    expect(report.catalogVersion).toBe(result.catalogVersion);
    expect(report.summary).toEqual({
      videoCount: 2,
      partCount: 3,
      malformedRowCount: 0,
      missingCanonicalVideoIds: [],
      orderingMismatchVideoIds: [],
    });
    expect(report.parity).toEqual({
      canonicalVideoCountMatches: true,
      transcriptPartCountMatches: true,
    });

    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it("updates the last validation report when refresh validation fails without replacing the live db", () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "catalog-parity-failure-"));
    const liveDbPath = path.join(tempRoot, "data", "catalog", "catalog.db");
    const goodCsvPath = writeCsv(tempRoot, "good.csv", [
      [
        "stable123",
        "",
        "Stable Catalog",
        "Channel Stable",
        "ops",
        "2026-01-01",
        "2026-01-02",
        "200",
        "1",
        "1",
        "stable/file.md",
      ],
    ]);
    const badCsvPath = writeCsv(tempRoot, "bad.csv", [
      [
        "broken-a",
        "broken-parent",
        "Broken Catalog",
        "Channel Broken",
        "ops",
        "2026-01-01",
        "2026-01-02",
        "200",
        "1",
        "2",
        "broken/part-1.md",
      ],
      [
        "broken-b",
        "broken-parent",
        "Broken Catalog",
        "Channel Broken",
        "ops",
        "2026-01-01",
        "2026-01-02",
        "200",
        "1",
        "2",
        "broken/part-1-duplicate.md",
      ],
    ]);

    const goodResult = rebuildCatalogFromCsv({ csvPath: goodCsvPath, liveDbPath });

    expect(() => rebuildCatalogFromCsv({ csvPath: badCsvPath, liveDbPath })).toThrow(
      /expected 2 parts/i,
    );

    const report = JSON.parse(fs.readFileSync(catalogValidationReportPath(liveDbPath), "utf8")) as {
      valid: boolean;
      catalogVersion: string;
      errors: string[];
      summary: { videoCount: number; partCount: number; malformedRowCount: number };
    };

    expect(report.valid).toBe(false);
    expect(report.catalogVersion).not.toBe(goodResult.catalogVersion);
    expect(report.summary.videoCount).toBe(0);
    expect(report.errors[0]).toMatch(/expected 2 parts/i);
    expect(fs.existsSync(liveDbPath)).toBe(true);

    fs.rmSync(tempRoot, { recursive: true, force: true });
  });
});

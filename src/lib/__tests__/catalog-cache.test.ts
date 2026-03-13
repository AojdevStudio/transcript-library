import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { rebuildCatalogFromCsv } from "@/lib/catalog-import";

const originalCatalogDbPath = process.env.CATALOG_DB_PATH;
const originalRepoRoot = process.env.PLAYLIST_TRANSCRIPTS_REPO;
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

function createFixtureRepo(rows: string[][]) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "catalog-cache-"));
  const transcriptsRoot = path.join(root, "youtube-transcripts");
  const indexRoot = path.join(transcriptsRoot, "index");
  fs.mkdirSync(indexRoot, { recursive: true });
  fs.writeFileSync(
    path.join(indexRoot, "videos" + ".csv"),
    [csvHeader, ...rows.map((row) => row.join(","))].join("\n"),
  );
  return {
    root,
    csvPath: path.join(indexRoot, "videos.csv"),
    liveDbPath: path.join(root, "data", "catalog", "catalog.db"),
  };
}

async function loadCatalog() {
  vi.resetModules();
  return import("@/lib/catalog");
}

afterEach(() => {
  vi.resetModules();
  if (originalCatalogDbPath === undefined) {
    delete process.env.CATALOG_DB_PATH;
  } else {
    process.env.CATALOG_DB_PATH = originalCatalogDbPath;
  }

  if (originalRepoRoot === undefined) {
    delete process.env.PLAYLIST_TRANSCRIPTS_REPO;
  } else {
    process.env.PLAYLIST_TRANSCRIPTS_REPO = originalRepoRoot;
  }
});

describe("catalog snapshot caching", () => {
  it("reuses the in-process snapshot when the catalog version has not changed", async () => {
    const fixture = createFixtureRepo([
      [
        "cache-1",
        "",
        "Cached Video",
        "Channel Cache",
        "testing",
        "2026-03-03",
        "2026-03-04",
        "300",
        "1",
        "1",
        "cache/main.md",
      ],
    ]);

    process.env.PLAYLIST_TRANSCRIPTS_REPO = fixture.root;
    process.env.CATALOG_DB_PATH = fixture.liveDbPath;
    rebuildCatalogFromCsv({ csvPath: fixture.csvPath, liveDbPath: fixture.liveDbPath });

    const { groupVideos } = await loadCatalog();

    const first = groupVideos();
    const second = groupVideos();

    expect(second).toBe(first);

    fs.rmSync(fixture.root, { recursive: true, force: true });
  });

  it("invalidates the cached snapshot after a rebuild publishes a new catalog version", async () => {
    const fixture = createFixtureRepo([
      [
        "cache-1",
        "",
        "Cached Video",
        "Channel Cache",
        "testing",
        "2026-03-03",
        "2026-03-04",
        "300",
        "1",
        "1",
        "cache/main.md",
      ],
    ]);

    process.env.PLAYLIST_TRANSCRIPTS_REPO = fixture.root;
    process.env.CATALOG_DB_PATH = fixture.liveDbPath;
    rebuildCatalogFromCsv({ csvPath: fixture.csvPath, liveDbPath: fixture.liveDbPath });

    const { getVideo, groupVideos } = await loadCatalog();
    const firstSnapshot = groupVideos();
    expect(getVideo("cache-1")?.title).toBe("Cached Video");

    fs.writeFileSync(
      fixture.csvPath,
      [
        csvHeader,
        [
          "cache-1",
          "",
          "Refreshed Video",
          "Channel Cache",
          "testing",
          "2026-03-05",
          "2026-03-06",
          "300",
          "1",
          "1",
          "cache/main.md",
        ].join(","),
      ].join("\n"),
    );

    rebuildCatalogFromCsv({ csvPath: fixture.csvPath, liveDbPath: fixture.liveDbPath });

    const secondSnapshot = groupVideos();
    expect(secondSnapshot).not.toBe(firstSnapshot);
    expect(getVideo("cache-1")?.title).toBe("Refreshed Video");

    fs.rmSync(fixture.root, { recursive: true, force: true });
  });
});

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

function createScaleFixture(videoCount: number) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "catalog-scale-"));
  const transcriptsRoot = path.join(root, "youtube-transcripts");
  const indexRoot = path.join(transcriptsRoot, "index");
  fs.mkdirSync(indexRoot, { recursive: true });

  const rows: string[] = [];
  const channels = Array.from({ length: 20 }, (_, i) => `ScaleCh${String(i + 1).padStart(2, "0")}`);
  const topics = ["ai", "ops", "design", "eng"];
  const videoIds: string[] = [];

  for (let i = 0; i < videoCount; i++) {
    const videoId = `s${String(i).padStart(4, "0")}abcde`.slice(0, 11);
    videoIds.push(videoId);
    const channel = channels[i % channels.length];
    const topic = topics[i % topics.length];
    const pubDate = `2025-${String((i % 12) + 1).padStart(2, "0")}-15`;
    const filePath = `${channel.toLowerCase()}/${videoId}.md`;
    const absPath = path.join(transcriptsRoot, filePath);
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, `Transcript for ${videoId}`);
    rows.push(
      `${videoId},,Title ${i},${channel},${topic},${pubDate},${pubDate},500,1,1,${filePath}`,
    );
  }

  fs.writeFileSync(path.join(indexRoot, "videos.csv"), [csvHeader, ...rows].join("\n"));
  return {
    root,
    csvPath: path.join(indexRoot, "videos.csv"),
    liveDbPath: path.join(root, "data", "catalog", "catalog.db"),
    videoIds,
  };
}

async function loadCatalog() {
  vi.resetModules();
  return import("@/lib/catalog");
}

afterEach(() => {
  vi.resetModules();
  if (originalCatalogDbPath === undefined) delete process.env.CATALOG_DB_PATH;
  else process.env.CATALOG_DB_PATH = originalCatalogDbPath;
  if (originalRepoRoot === undefined) delete process.env.PLAYLIST_TRANSCRIPTS_REPO;
  else process.env.PLAYLIST_TRANSCRIPTS_REPO = originalRepoRoot;
});

describe("catalog scale regression", () => {
  it("loads and queries a 500-video catalog within acceptable time", async () => {
    const fixture = createScaleFixture(500);
    process.env.PLAYLIST_TRANSCRIPTS_REPO = fixture.root;
    process.env.CATALOG_DB_PATH = fixture.liveDbPath;
    rebuildCatalogFromCsv({ csvPath: fixture.csvPath, liveDbPath: fixture.liveDbPath });

    const { groupVideos, listChannels, listVideosByChannel, getVideo } = await loadCatalog();

    const t0 = performance.now();
    const videos = groupVideos();
    const loadMs = performance.now() - t0;
    expect(videos.size).toBe(500);
    expect(loadMs).toBeLessThan(500);

    const channels = listChannels();
    expect(channels.length).toBe(20);

    const chVids = listVideosByChannel(channels[0].channel);
    expect(chVids.length).toBe(25); // 500 / 20

    const mid = fixture.videoIds[250];
    expect(getVideo(mid)).toBeDefined();
    expect(getVideo(mid)!.videoId).toBe(mid);

    fs.rmSync(fixture.root, { recursive: true, force: true });
  });

  it("snapshot cache returns the same reference on repeated calls", async () => {
    const fixture = createScaleFixture(100);
    process.env.PLAYLIST_TRANSCRIPTS_REPO = fixture.root;
    process.env.CATALOG_DB_PATH = fixture.liveDbPath;
    rebuildCatalogFromCsv({ csvPath: fixture.csvPath, liveDbPath: fixture.liveDbPath });

    const { groupVideos } = await loadCatalog();

    const first = groupVideos();
    const second = groupVideos();
    expect(second).toBe(first); // same reference = cache hit

    fs.rmSync(fixture.root, { recursive: true, force: true });
  });

  it("channel listing is sorted by latest publish date descending", async () => {
    const fixture = createScaleFixture(200);
    process.env.PLAYLIST_TRANSCRIPTS_REPO = fixture.root;
    process.env.CATALOG_DB_PATH = fixture.liveDbPath;
    rebuildCatalogFromCsv({ csvPath: fixture.csvPath, liveDbPath: fixture.liveDbPath });

    const { listChannels } = await loadCatalog();
    const channels = listChannels();

    // Verify descending date order where dates differ
    for (let i = 1; i < channels.length; i++) {
      const prev = channels[i - 1].lastPublishedDate ?? "";
      const curr = channels[i].lastPublishedDate ?? "";
      // Either same date (then alpha sort) or prev >= curr
      expect(prev >= curr || prev === curr).toBe(true);
    }

    fs.rmSync(fixture.root, { recursive: true, force: true });
  });

  it("handles video lookup misses gracefully at scale", async () => {
    const fixture = createScaleFixture(100);
    process.env.PLAYLIST_TRANSCRIPTS_REPO = fixture.root;
    process.env.CATALOG_DB_PATH = fixture.liveDbPath;
    rebuildCatalogFromCsv({ csvPath: fixture.csvPath, liveDbPath: fixture.liveDbPath });

    const { getVideo } = await loadCatalog();
    expect(getVideo("nonexistent")).toBeUndefined();
    expect(getVideo("")).toBeUndefined();

    fs.rmSync(fixture.root, { recursive: true, force: true });
  });
});

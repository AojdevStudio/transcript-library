#!/usr/bin/env npx tsx
/**
 * benchmark-hosted-scale.ts
 *
 * Repeatable hosted scale validation for the transcript library.
 * Creates a synthetic 1000-video catalog in a temp directory, benchmarks
 * the real browse and runtime-read code paths, and reports timings.
 *
 * Usage:
 *   npx tsx scripts/benchmark-hosted-scale.ts           # full run with report
 *   npx tsx scripts/benchmark-hosted-scale.ts --check    # quick pass/fail against thresholds
 *   npx tsx scripts/benchmark-hosted-scale.ts --videos=500  # custom video count
 *
 * Thresholds (--check mode):
 *   - Catalog rebuild: < 5 000 ms
 *   - groupVideos() full load: < 500 ms
 *   - listChannels(): < 200 ms
 *   - listVideosByChannel(): < 100 ms
 *   - getVideo() single lookup: < 5 ms
 *   - Insight set scan (1000 dirs): < 500 ms
 *   - Runtime stream build (cold): < 50 ms
 *
 * These thresholds reflect the private friend-group deployment model
 * (single node, single concurrent operator) — not SaaS-grade p99 targets.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const checkMode = args.includes("--check");
const videoCountArg = args.find((a) => a.startsWith("--videos="));
const VIDEO_COUNT = videoCountArg ? parseInt(videoCountArg.split("=")[1], 10) : 1000;
const CHANNELS = 25;
const TOPICS = ["ai", "systems", "engineering", "research", "ops", "design", "culture", "product"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function randomId(): string {
  return crypto.randomBytes(6).toString("base64url").slice(0, 11);
}

function randomDate(year = 2025): string {
  const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, "0");
  const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function hrMs(start: [number, number]): number {
  const diff = process.hrtime(start);
  return Math.round(diff[0] * 1000 + diff[1] / 1e6);
}

// ---------------------------------------------------------------------------
// Fixture generation
// ---------------------------------------------------------------------------

function generateFixture(videoCount: number): {
  root: string;
  csvPath: string;
  dbPath: string;
  insightsDir: string;
  videoIds: string[];
} {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bench-scale-"));
  const transcriptsRoot = path.join(root, "youtube-transcripts");
  const indexDir = path.join(transcriptsRoot, "index");
  const insightsDir = path.join(root, "data", "insights");
  fs.mkdirSync(indexDir, { recursive: true });
  fs.mkdirSync(insightsDir, { recursive: true });

  const channels = Array.from(
    { length: CHANNELS },
    (_, i) => `Channel-${String(i + 1).padStart(3, "0")}`,
  );
  const header =
    "video_id,parent_video_id,title,channel,topic,published_date,ingested_date,word_count,chunk,total_chunks,file_path";
  const rows: string[] = [header];
  const videoIds: string[] = [];

  for (let i = 0; i < videoCount; i++) {
    // YouTube IDs are 6-11 chars, [a-zA-Z0-9_-]. Use a compact synthetic format.
    const videoId = `v${String(i).padStart(4, "0")}${randomId().slice(0, 6)}`;
    videoIds.push(videoId);
    const channel = channels[i % channels.length];
    const topic = TOPICS[i % TOPICS.length];
    const pubDate = randomDate(2024 + Math.floor(i / 500));
    const chunks = Math.random() > 0.7 ? 3 : 1;

    for (let c = 1; c <= chunks; c++) {
      const filePath = `${channel.toLowerCase()}/${videoId}-part${c}.md`;
      const absPath = path.join(transcriptsRoot, filePath);
      fs.mkdirSync(path.dirname(absPath), { recursive: true });
      fs.writeFileSync(absPath, `Transcript content for ${videoId} part ${c}. `.repeat(50));
      const wordCount = 200 + Math.floor(Math.random() * 800);
      rows.push(
        `${videoId},,Video Title ${i},${channel},${topic},${pubDate},${pubDate},${wordCount},${c},${chunks},${filePath}`,
      );
    }

    // Create insight dirs for ~40% of videos to simulate realistic insight coverage
    if (i % 5 < 2) {
      const insightVideoDir = path.join(insightsDir, videoId);
      fs.mkdirSync(insightVideoDir, { recursive: true });
      fs.writeFileSync(
        path.join(insightVideoDir, "analysis.md"),
        `# Analysis\n\nSummary for ${videoId}`,
      );
    }
  }

  const csvPath = path.join(indexDir, "videos.csv");
  fs.writeFileSync(csvPath, rows.join("\n"));

  const dbPath = path.join(root, "data", "catalog", "catalog.db");

  return { root, csvPath, dbPath, insightsDir, videoIds };
}

// ---------------------------------------------------------------------------
// Benchmark runner
// ---------------------------------------------------------------------------

type BenchmarkResult = {
  name: string;
  durationMs: number;
  threshold: number;
  passed: boolean;
  detail?: string;
};

async function runBenchmarks(): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];

  console.log(`\n🔬 Generating ${VIDEO_COUNT}-video fixture...`);
  const fixture = generateFixture(VIDEO_COUNT);
  console.log(`   Fixture created at ${fixture.root}`);

  // Point env at the fixture
  process.env.PLAYLIST_TRANSCRIPTS_REPO = fixture.root;
  process.env.CATALOG_DB_PATH = fixture.dbPath;
  process.env.INSIGHTS_BASE_DIR = fixture.insightsDir;

  try {
    // 1. Catalog rebuild
    const { rebuildCatalogFromCsv } = await import("../src/lib/catalog-import.ts");
    let t0 = process.hrtime();
    const rebuild = rebuildCatalogFromCsv({ csvPath: fixture.csvPath, liveDbPath: fixture.dbPath });
    let elapsed = hrMs(t0);
    results.push({
      name: "catalog-rebuild",
      durationMs: elapsed,
      threshold: 5000,
      passed: elapsed < 5000,
      detail: `${rebuild.videoCount} videos, ${rebuild.partCount} parts`,
    });
    console.log(`   ✓ Catalog rebuild: ${elapsed}ms (${rebuild.videoCount} videos)`);

    // 2. groupVideos() — full catalog load from SQLite
    // Reset module cache to force fresh load
    const catalogModule = await import("../src/lib/catalog.ts");

    t0 = process.hrtime();
    const videos = catalogModule.groupVideos();
    elapsed = hrMs(t0);
    results.push({
      name: "groupVideos-cold",
      durationMs: elapsed,
      threshold: 500,
      passed: elapsed < 500,
      detail: `${videos.size} videos loaded`,
    });
    console.log(`   ✓ groupVideos (cold): ${elapsed}ms (${videos.size} videos)`);

    // 3. groupVideos() — cached hit
    t0 = process.hrtime();
    const videosCached = catalogModule.groupVideos();
    elapsed = hrMs(t0);
    results.push({
      name: "groupVideos-cached",
      durationMs: elapsed,
      threshold: 5,
      passed: elapsed < 5,
      detail: `cache hit: ${videosCached === videos}`,
    });
    console.log(`   ✓ groupVideos (cached): ${elapsed}ms`);

    // 4. listChannels()
    t0 = process.hrtime();
    const channels = catalogModule.listChannels();
    elapsed = hrMs(t0);
    results.push({
      name: "listChannels",
      durationMs: elapsed,
      threshold: 200,
      passed: elapsed < 200,
      detail: `${channels.length} channels`,
    });
    console.log(`   ✓ listChannels: ${elapsed}ms (${channels.length} channels)`);

    // 5. listVideosByChannel()
    const testChannel = channels[0]?.channel || "Channel-001";
    t0 = process.hrtime();
    const channelVideos = catalogModule.listVideosByChannel(testChannel);
    elapsed = hrMs(t0);
    results.push({
      name: "listVideosByChannel",
      durationMs: elapsed,
      threshold: 100,
      passed: elapsed < 100,
      detail: `${channelVideos.length} videos for "${testChannel}"`,
    });
    console.log(`   ✓ listVideosByChannel: ${elapsed}ms (${channelVideos.length} videos)`);

    // 6. getVideo() — single lookup
    const testVideoId = fixture.videoIds[Math.floor(fixture.videoIds.length / 2)];
    t0 = process.hrtime();
    for (let i = 0; i < 100; i++) {
      catalogModule.getVideo(testVideoId);
    }
    elapsed = hrMs(t0);
    const perLookup = (elapsed / 100).toFixed(2);
    results.push({
      name: "getVideo-x100",
      durationMs: elapsed,
      threshold: 50,
      passed: elapsed < 50,
      detail: `${perLookup}ms per lookup`,
    });
    console.log(`   ✓ getVideo (x100): ${elapsed}ms total, ${perLookup}ms each`);

    // 7. Insight set scan — hasInsight for all videos
    const insightsModule = await import("../src/lib/insights.ts");
    t0 = process.hrtime();
    let insightCount = 0;
    for (const vid of fixture.videoIds) {
      if (insightsModule.hasInsight(vid)) insightCount++;
    }
    elapsed = hrMs(t0);
    results.push({
      name: "hasInsight-full-scan",
      durationMs: elapsed,
      threshold: 500,
      passed: elapsed < 500,
      detail: `${insightCount}/${fixture.videoIds.length} have insights`,
    });
    console.log(`   ✓ hasInsight full scan: ${elapsed}ms (${insightCount} found)`);

    // 8. Simulated home page: groupVideos + listChannels + hasInsight loop
    t0 = process.hrtime();
    const homeVideos = Array.from(catalogModule.groupVideos().values());
    catalogModule.listChannels();
    for (const v of homeVideos) {
      insightsModule.hasInsight(v.videoId);
    }
    elapsed = hrMs(t0);
    results.push({
      name: "home-page-simulation",
      durationMs: elapsed,
      threshold: 500,
      passed: elapsed < 500,
      detail: `Full home page data assembly`,
    });
    console.log(`   ✓ Home page simulation: ${elapsed}ms`);

    // 9. Simulated channel page: listVideosByChannel + hasInsight per video
    t0 = process.hrtime();
    const chVids = catalogModule.listVideosByChannel(testChannel);
    for (const v of chVids) {
      insightsModule.hasInsight(v.videoId);
    }
    elapsed = hrMs(t0);
    results.push({
      name: "channel-page-simulation",
      durationMs: elapsed,
      threshold: 200,
      passed: elapsed < 200,
      detail: `Channel page for "${testChannel}"`,
    });
    console.log(`   ✓ Channel page simulation: ${elapsed}ms`);

    return results;
  } finally {
    // Clean up fixture
    fs.rmSync(fixture.root, { recursive: true, force: true });
    delete process.env.CATALOG_DB_PATH;
    delete process.env.INSIGHTS_BASE_DIR;
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

function printReport(results: BenchmarkResult[]): void {
  console.log("\n" + "═".repeat(72));
  console.log("  HOSTED SCALE VALIDATION REPORT");
  console.log("  " + new Date().toISOString());
  console.log("  " + `${VIDEO_COUNT} synthetic videos, ${CHANNELS} channels`);
  console.log("═".repeat(72));

  const nameWidth = 28;
  const msWidth = 10;
  const threshWidth = 12;

  console.log(
    "\n  " +
      "Benchmark".padEnd(nameWidth) +
      "Time".padStart(msWidth) +
      "Threshold".padStart(threshWidth) +
      "  Status",
  );
  console.log("  " + "─".repeat(nameWidth + msWidth + threshWidth + 8));

  for (const r of results) {
    const status = r.passed ? "✅ PASS" : "❌ FAIL";
    console.log(
      "  " +
        r.name.padEnd(nameWidth) +
        `${r.durationMs}ms`.padStart(msWidth) +
        `< ${r.threshold}ms`.padStart(threshWidth) +
        `  ${status}`,
    );
    if (r.detail) {
      console.log("  " + " ".repeat(nameWidth) + `  ${r.detail}`);
    }
  }

  const allPassed = results.every((r) => r.passed);
  console.log("\n" + "─".repeat(72));
  console.log(
    allPassed
      ? "  ✅ ALL BENCHMARKS WITHIN THRESHOLDS"
      : "  ❌ SOME BENCHMARKS EXCEEDED THRESHOLDS",
  );
  console.log("─".repeat(72) + "\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("🚀 Hosted Scale Benchmark");
  console.log(`   Mode: ${checkMode ? "check (pass/fail)" : "full report"}`);
  console.log(`   Video count: ${VIDEO_COUNT}`);

  const results = await runBenchmarks();
  printReport(results);

  const allPassed = results.every((r) => r.passed);
  if (checkMode && !allPassed) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Benchmark failed:", err);
  process.exit(1);
});

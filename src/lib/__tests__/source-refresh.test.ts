import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rebuildCatalogFromCsv } from "@/lib/catalog-import";

type CatalogRow = {
  videoId: string;
  title: string;
  channel: string;
  topic: string;
  publishedDate: string;
  ingestedDate: string;
  wordCount: string;
  chunk: string;
  totalChunks: string;
  filePath: string;
  transcript: string;
};

const originalRepoRoot = process.env.PLAYLIST_TRANSCRIPTS_REPO;
const originalCatalogDbPath = process.env.CATALOG_DB_PATH;
const originalRemote = process.env.PLAYLIST_TRANSCRIPTS_REMOTE;
const originalBranch = process.env.PLAYLIST_TRANSCRIPTS_BRANCH;
const originalHosted = process.env.HOSTED;
const originalPrivateApiToken = process.env.PRIVATE_API_TOKEN;
const originalInsightsBaseDir = process.env.INSIGHTS_BASE_DIR;

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

function run(command: string, args: string[], cwd: string): string {
  return execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  }).trim();
}

function writeRepoState(repoRoot: string, rows: CatalogRow[]) {
  const transcriptsRoot = path.join(repoRoot, "youtube-transcripts");
  const indexRoot = path.join(transcriptsRoot, "index");
  fs.mkdirSync(indexRoot, { recursive: true });

  for (const row of rows) {
    const transcriptPath = path.join(transcriptsRoot, row.filePath);
    fs.mkdirSync(path.dirname(transcriptPath), { recursive: true });
    fs.writeFileSync(transcriptPath, row.transcript);
  }

  fs.writeFileSync(
    path.join(indexRoot, "videos.csv"),
    [
      csvHeader,
      ...rows.map((row) =>
        [
          row.videoId,
          "",
          row.title,
          row.channel,
          row.topic,
          row.publishedDate,
          row.ingestedDate,
          row.wordCount,
          row.chunk,
          row.totalChunks,
          row.filePath,
        ].join(","),
      ),
    ].join("\n"),
  );
}

function commitAll(repoRoot: string, message: string): string {
  run("git", ["add", "."], repoRoot);
  run("git", ["commit", "-m", message], repoRoot);
  return run("git", ["rev-parse", "HEAD"], repoRoot);
}

function setupGitFixture(initialRows: CatalogRow[]) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "source-refresh-"));
  const remotePath = path.join(root, "remote.git");
  const upstreamPath = path.join(root, "upstream");
  const clonePath = path.join(root, "clone");
  const catalogDbPath = path.join(root, "data", "catalog", "catalog.db");
  const insightsBaseDir = path.join(root, "data", "insights");

  fs.mkdirSync(upstreamPath, { recursive: true });
  run("git", ["init", "--bare", remotePath], root);
  run("git", ["init", "-b", "master"], upstreamPath);
  run("git", ["config", "user.name", "Transcript Library Tests"], upstreamPath);
  run("git", ["config", "user.email", "tests@example.com"], upstreamPath);
  writeRepoState(upstreamPath, initialRows);
  commitAll(upstreamPath, "initial import");
  run("git", ["remote", "add", "origin", remotePath], upstreamPath);
  run("git", ["push", "-u", "origin", "master"], upstreamPath);
  run("git", ["clone", "-b", "master", remotePath, clonePath], root);
  run("git", ["config", "user.name", "Transcript Library Tests"], clonePath);
  run("git", ["config", "user.email", "tests@example.com"], clonePath);

  return {
    root,
    remotePath,
    upstreamPath,
    clonePath,
    catalogDbPath,
    insightsBaseDir,
  };
}

async function loadCatalog() {
  vi.resetModules();
  return import("@/lib/catalog");
}

async function loadRawRoute() {
  vi.resetModules();
  return import("@/app/api/raw/route");
}

function refreshRecordPath(catalogDbPath: string) {
  return path.join(path.dirname(catalogDbPath), "last-source-refresh.json");
}

function validationReportPath(catalogDbPath: string) {
  return path.join(path.dirname(catalogDbPath), "last-import-validation.json");
}

const initialRows: CatalogRow[] = [
  {
    videoId: "alpha123xyz",
    title: "Alpha",
    channel: "Channel A",
    topic: "Testing",
    publishedDate: "2026-03-10",
    ingestedDate: "2026-03-11",
    wordCount: "120",
    chunk: "1",
    totalChunks: "1",
    filePath: "alpha/main.md",
    transcript: "Alpha transcript",
  },
];

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.resetModules();

  if (originalRepoRoot === undefined) delete process.env.PLAYLIST_TRANSCRIPTS_REPO;
  else process.env.PLAYLIST_TRANSCRIPTS_REPO = originalRepoRoot;

  if (originalCatalogDbPath === undefined) delete process.env.CATALOG_DB_PATH;
  else process.env.CATALOG_DB_PATH = originalCatalogDbPath;

  if (originalRemote === undefined) delete process.env.PLAYLIST_TRANSCRIPTS_REMOTE;
  else process.env.PLAYLIST_TRANSCRIPTS_REMOTE = originalRemote;

  if (originalBranch === undefined) delete process.env.PLAYLIST_TRANSCRIPTS_BRANCH;
  else process.env.PLAYLIST_TRANSCRIPTS_BRANCH = originalBranch;

  if (originalHosted === undefined) delete process.env.HOSTED;
  else process.env.HOSTED = originalHosted;

  if (originalPrivateApiToken === undefined) delete process.env.PRIVATE_API_TOKEN;
  else process.env.PRIVATE_API_TOKEN = originalPrivateApiToken;

  if (originalInsightsBaseDir === undefined) delete process.env.INSIGHTS_BASE_DIR;
  else process.env.INSIGHTS_BASE_DIR = originalInsightsBaseDir;
});

describe("source refresh service", () => {
  it("fast-forwards the local repo, rebuilds the catalog, and records an updated refresh", async () => {
    const fixture = setupGitFixture(initialRows);
    process.env.PLAYLIST_TRANSCRIPTS_REPO = fixture.clonePath;
    process.env.CATALOG_DB_PATH = fixture.catalogDbPath;

    rebuildCatalogFromCsv({ liveDbPath: fixture.catalogDbPath });

    writeRepoState(fixture.upstreamPath, [
      ...initialRows,
      {
        videoId: "beta123xyza",
        title: "Beta",
        channel: "Channel B",
        topic: "Testing",
        publishedDate: "2026-03-12",
        ingestedDate: "2026-03-12",
        wordCount: "240",
        chunk: "1",
        totalChunks: "1",
        filePath: "beta/main.md",
        transcript: "Beta transcript",
      },
    ]);
    const upstreamHead = commitAll(fixture.upstreamPath, "add beta");
    run("git", ["push", "origin", "master"], fixture.upstreamPath);

    const { refreshSourceCatalog } = await import("@/lib/source-refresh");
    const result = refreshSourceCatalog({ trigger: "cli" });

    expect(result.outcome).toBe("updated");
    expect(result.phase).toBe("completed");
    expect(result.repo.headAfter).toBe(upstreamHead);
    expect(result.repo.headAfter).not.toBe(result.repo.headBefore);
    expect(result.catalog?.videoCount).toBe(2);

    const { getVideo } = await loadCatalog();
    expect(getVideo("beta123xyza")?.title).toBe("Beta");

    const record = JSON.parse(fs.readFileSync(refreshRecordPath(fixture.catalogDbPath), "utf8"));
    expect(record.outcome).toBe("updated");
    expect(record.repo.headAfter).toBe(upstreamHead);
    expect(record.catalog.videoCount).toBe(2);
  });

  it("surfaces the refreshed transcript through catalog and raw reads without analysis artifacts", async () => {
    const fixture = setupGitFixture(initialRows);
    process.env.PLAYLIST_TRANSCRIPTS_REPO = fixture.clonePath;
    process.env.CATALOG_DB_PATH = fixture.catalogDbPath;
    process.env.INSIGHTS_BASE_DIR = fixture.insightsBaseDir;
    delete process.env.HOSTED;
    delete process.env.PRIVATE_API_TOKEN;

    rebuildCatalogFromCsv({ liveDbPath: fixture.catalogDbPath });

    const { getVideo } = await loadCatalog();
    expect(getVideo("beta123xyza")).toBeUndefined();

    writeRepoState(fixture.upstreamPath, [
      ...initialRows,
      {
        videoId: "beta123xyza",
        title: "Beta",
        channel: "Channel B",
        topic: "Testing",
        publishedDate: "2026-03-12",
        ingestedDate: "2026-03-12",
        wordCount: "240",
        chunk: "1",
        totalChunks: "1",
        filePath: "beta/main.md",
        transcript: "Beta transcript from raw route",
      },
    ]);
    commitAll(fixture.upstreamPath, "add beta");
    run("git", ["push", "origin", "master"], fixture.upstreamPath);

    const { refreshSourceCatalog } = await import("@/lib/source-refresh");
    const refresh = refreshSourceCatalog({ trigger: "cli" });
    expect(refresh.outcome).toBe("updated");

    const refreshedVideo = getVideo("beta123xyza");
    expect(refreshedVideo?.title).toBe("Beta");
    expect(refreshedVideo?.parts[0]?.filePath).toBe("beta/main.md");

    const { GET } = await loadRawRoute();
    const response = await GET(new Request("http://localhost/api/raw?path=beta/main.md"));

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toContain("Beta transcript from raw route");
    expect(fs.existsSync(path.join(fixture.insightsBaseDir, "beta123xyza", "run.json"))).toBe(
      false,
    );
    expect(fs.existsSync(path.join(fixture.root, "data", "runtime", "batches"))).toBe(false);
  });

  it("records a noop refresh when the local repo already matches upstream", async () => {
    const fixture = setupGitFixture(initialRows);
    process.env.PLAYLIST_TRANSCRIPTS_REPO = fixture.clonePath;
    process.env.CATALOG_DB_PATH = fixture.catalogDbPath;

    const initialCatalog = rebuildCatalogFromCsv({ liveDbPath: fixture.catalogDbPath });
    const localHead = run("git", ["rev-parse", "HEAD"], fixture.clonePath);

    const { refreshSourceCatalog } = await import("@/lib/source-refresh");
    const result = refreshSourceCatalog({ trigger: "cli" });

    expect(result.outcome).toBe("noop");
    expect(result.phase).toBe("completed");
    expect(result.repo.headBefore).toBe(localHead);
    expect(result.repo.headAfter).toBe(localHead);
    expect(result.catalog?.version).toBe(initialCatalog.catalogVersion);

    const record = JSON.parse(fs.readFileSync(refreshRecordPath(fixture.catalogDbPath), "utf8"));
    expect(record.outcome).toBe("noop");
    expect(record.repo.headBefore).toBe(localHead);
    expect(record.repo.headAfter).toBe(localHead);
  });

  it("fails before catalog rebuild when fast-forward is impossible and preserves the live catalog", async () => {
    const fixture = setupGitFixture(initialRows);
    process.env.PLAYLIST_TRANSCRIPTS_REPO = fixture.clonePath;
    process.env.CATALOG_DB_PATH = fixture.catalogDbPath;

    rebuildCatalogFromCsv({ liveDbPath: fixture.catalogDbPath });
    const previousValidation = fs.readFileSync(validationReportPath(fixture.catalogDbPath), "utf8");
    const previousDbBytes = fs.readFileSync(fixture.catalogDbPath);

    writeRepoState(fixture.clonePath, [
      {
        ...initialRows[0],
        title: "Alpha local only",
        transcript: "Local divergent transcript",
      },
    ]);
    commitAll(fixture.clonePath, "local only change");

    writeRepoState(fixture.upstreamPath, [
      {
        ...initialRows[0],
        title: "Alpha upstream only",
        transcript: "Upstream divergent transcript",
      },
    ]);
    commitAll(fixture.upstreamPath, "upstream only change");
    run("git", ["push", "origin", "master"], fixture.upstreamPath);

    const { refreshSourceCatalog } = await import("@/lib/source-refresh");
    const result = refreshSourceCatalog({ trigger: "cli" });

    expect(result.outcome).toBe("failed");
    expect(result.phase).toBe("git-fast-forward");
    expect(result.error?.message).toMatch(/fast-forward|Not possible to fast-forward/i);
    expect(fs.readFileSync(fixture.catalogDbPath)).toEqual(previousDbBytes);
    expect(fs.readFileSync(validationReportPath(fixture.catalogDbPath), "utf8")).toBe(
      previousValidation,
    );

    const { getVideo } = await loadCatalog();
    expect(getVideo("alpha123xyz")?.title).toBe("Alpha");
  });

  it("restores the last known-good validation report when catalog rebuild fails after a repo update", async () => {
    const fixture = setupGitFixture(initialRows);
    process.env.PLAYLIST_TRANSCRIPTS_REPO = fixture.clonePath;
    process.env.CATALOG_DB_PATH = fixture.catalogDbPath;

    rebuildCatalogFromCsv({ liveDbPath: fixture.catalogDbPath });
    const previousValidation = fs.readFileSync(validationReportPath(fixture.catalogDbPath), "utf8");
    const previousDbBytes = fs.readFileSync(fixture.catalogDbPath);

    const brokenRows = [
      ...initialRows,
      {
        videoId: "broken123xy",
        title: "Broken",
        channel: "Channel Broken",
        topic: "Testing",
        publishedDate: "2026-03-13",
        ingestedDate: "2026-03-13",
        wordCount: "0",
        chunk: "1",
        totalChunks: "1",
        filePath: "broken/main.md",
        transcript: "This transcript should never publish",
      },
    ];

    writeRepoState(fixture.upstreamPath, brokenRows);
    const brokenHead = commitAll(fixture.upstreamPath, "introduce invalid catalog row");
    run("git", ["push", "origin", "master"], fixture.upstreamPath);

    const { refreshSourceCatalog } = await import("@/lib/source-refresh");
    const result = refreshSourceCatalog({ trigger: "cli" });

    expect(result.outcome).toBe("failed");
    expect(result.phase).toBe("catalog-rebuild");
    expect(result.repo.headAfter).toBe(brokenHead);
    expect(fs.readFileSync(fixture.catalogDbPath)).toEqual(previousDbBytes);
    expect(fs.readFileSync(validationReportPath(fixture.catalogDbPath), "utf8")).toBe(
      previousValidation,
    );

    const record = JSON.parse(fs.readFileSync(refreshRecordPath(fixture.catalogDbPath), "utf8"));
    expect(record.outcome).toBe("failed");
    expect(record.phase).toBe("catalog-rebuild");
    expect(record.repo.headAfter).toBe(brokenHead);
    expect(record.catalog.version).toBe(JSON.parse(previousValidation).catalogVersion);
  });
});

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { rebuildCatalogFromCsv, type CatalogRebuildResult } from "@/lib/catalog-import";
import { catalogDbPath } from "@/lib/catalog-db";
import { playlistTranscriptsRepoRoot } from "@/lib/catalog";
import type { BatchRequestMetadata } from "@/lib/runtime-batches";

export type RefreshOutcome = "updated" | "noop" | "failed";
export type RefreshPhase =
  | "repo-inspect"
  | "git-fetch"
  | "git-fast-forward"
  | "catalog-rebuild"
  | "completed";
export type RefreshTrigger = "sync-hook" | "cli";

export type RefreshRequestMetadata = Pick<
  BatchRequestMetadata,
  | "requestKey"
  | "receivedAt"
  | "idempotencyKey"
  | "identityStrategy"
  | "method"
  | "path"
  | "userAgent"
>;

export type SourceRefreshRecord = {
  schemaVersion: 1;
  trigger: RefreshTrigger;
  outcome: RefreshOutcome;
  phase: RefreshPhase;
  startedAt: string;
  completedAt: string;
  request?: RefreshRequestMetadata;
  repo: {
    remote: string;
    branch: string;
    currentBranch: string;
    headBefore: string;
    headAfter: string;
    upstreamHead: string;
  };
  catalog: {
    version: string | null;
    videoCount: number | null;
    partCount: number | null;
    checkOnly: boolean;
    preservedLastKnownGood: boolean;
  };
  error?: {
    message: string;
  };
};

export type RefreshSourceOptions = {
  trigger: RefreshTrigger;
  request?: RefreshRequestMetadata;
  checkOnly?: boolean;
};

function nowIso(): string {
  return new Date().toISOString();
}

function refreshRecordPath(dbPath = catalogDbPath()): string {
  return path.join(path.dirname(dbPath), "last-source-refresh.json");
}

function validationReportPath(dbPath = catalogDbPath()): string {
  return path.join(path.dirname(dbPath), "last-import-validation.json");
}

function atomicWriteJson(filePath: string, value: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tempPath, JSON.stringify(value, null, 2));
  fs.renameSync(tempPath, filePath);
}

function runGit(repoRoot: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function gitErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return String(error);
}

function sanitizeRequest(request?: RefreshRequestMetadata): RefreshRequestMetadata | undefined {
  if (!request) {
    return undefined;
  }

  return {
    requestKey: request.requestKey,
    receivedAt: request.receivedAt,
    idempotencyKey: request.idempotencyKey,
    identityStrategy: request.identityStrategy,
    method: request.method,
    path: request.path,
    userAgent: request.userAgent,
  };
}

function configuredRemote(): string {
  return process.env.PLAYLIST_TRANSCRIPTS_REMOTE?.trim() || "origin";
}

function configuredBranch(repoRoot: string): { branch: string; currentBranch: string } {
  const currentBranch = runGit(repoRoot, ["rev-parse", "--abbrev-ref", "HEAD"]);
  const branch =
    process.env.PLAYLIST_TRANSCRIPTS_BRANCH?.trim() ||
    (currentBranch !== "HEAD" ? currentBranch : "master");
  return { branch, currentBranch };
}

function inspectRepo(repoRoot: string) {
  runGit(repoRoot, ["rev-parse", "--is-inside-work-tree"]);

  const status = runGit(repoRoot, ["status", "--porcelain"]);
  if (status.trim()) {
    throw new Error("Source repo has local modifications; refusing refresh before git update.");
  }

  const { branch, currentBranch } = configuredBranch(repoRoot);
  const remote = configuredRemote();

  return {
    remote,
    branch,
    currentBranch,
  };
}

function ensureRefreshBranch(
  repoRoot: string,
  remote: string,
  branch: string,
): {
  currentBranch: string;
  headBefore: string;
} {
  const activeBranch = runGit(repoRoot, ["rev-parse", "--abbrev-ref", "HEAD"]);

  if (activeBranch !== branch) {
    try {
      runGit(repoRoot, ["rev-parse", "--verify", `refs/heads/${branch}`]);
      runGit(repoRoot, ["checkout", branch]);
    } catch {
      runGit(repoRoot, ["checkout", "-B", branch, `${remote}/${branch}`]);
    }
  }

  return {
    currentBranch: branch,
    headBefore: runGit(repoRoot, ["rev-parse", "HEAD"]),
  };
}

function readExistingCatalogVersion(dbPath: string): string | null {
  try {
    const report = JSON.parse(fs.readFileSync(validationReportPath(dbPath), "utf8")) as {
      catalogVersion?: string;
    };
    return report.catalogVersion ?? null;
  } catch {
    return null;
  }
}

function readValidationBackup(dbPath: string): string | null {
  try {
    return fs.readFileSync(validationReportPath(dbPath), "utf8");
  } catch {
    return null;
  }
}

function restoreValidationBackup(dbPath: string, backup: string | null) {
  const reportPath = validationReportPath(dbPath);
  if (backup === null) {
    fs.rmSync(reportPath, { force: true });
    return;
  }

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, backup);
}

function writeRefreshRecord(
  record: SourceRefreshRecord,
  dbPath = catalogDbPath(),
): SourceRefreshRecord {
  atomicWriteJson(refreshRecordPath(dbPath), record);
  return record;
}

function buildSuccessRecord(args: {
  startedAt: string;
  trigger: RefreshTrigger;
  request?: RefreshRequestMetadata;
  repo: SourceRefreshRecord["repo"];
  rebuild: CatalogRebuildResult;
  outcome: "updated" | "noop";
  checkOnly: boolean;
}): SourceRefreshRecord {
  return {
    schemaVersion: 1,
    trigger: args.trigger,
    outcome: args.outcome,
    phase: "completed",
    startedAt: args.startedAt,
    completedAt: nowIso(),
    request: sanitizeRequest(args.request),
    repo: args.repo,
    catalog: {
      version: args.rebuild.catalogVersion,
      videoCount: args.rebuild.videoCount,
      partCount: args.rebuild.partCount,
      checkOnly: args.checkOnly,
      preservedLastKnownGood: false,
    },
  };
}

function buildFailureRecord(args: {
  startedAt: string;
  trigger: RefreshTrigger;
  request?: RefreshRequestMetadata;
  repo: SourceRefreshRecord["repo"];
  phase: Exclude<RefreshPhase, "completed">;
  error: unknown;
  checkOnly: boolean;
  lastKnownGoodCatalogVersion: string | null;
  preservedLastKnownGood: boolean;
}): SourceRefreshRecord {
  return {
    schemaVersion: 1,
    trigger: args.trigger,
    outcome: "failed",
    phase: args.phase,
    startedAt: args.startedAt,
    completedAt: nowIso(),
    request: sanitizeRequest(args.request),
    repo: args.repo,
    catalog: {
      version: args.lastKnownGoodCatalogVersion,
      videoCount: null,
      partCount: null,
      checkOnly: args.checkOnly,
      preservedLastKnownGood: args.preservedLastKnownGood,
    },
    error: {
      message: gitErrorMessage(args.error),
    },
  };
}

export function refreshSourceCatalog(options: RefreshSourceOptions): SourceRefreshRecord {
  const startedAt = nowIso();
  const repoRoot = playlistTranscriptsRepoRoot();
  const dbPath = catalogDbPath();
  const checkOnly = options.checkOnly ?? false;
  const lastKnownGoodCatalogVersion = readExistingCatalogVersion(dbPath);

  let repo: SourceRefreshRecord["repo"] = {
    remote: configuredRemote(),
    branch: process.env.PLAYLIST_TRANSCRIPTS_BRANCH?.trim() || "master",
    currentBranch: "unknown",
    headBefore: "unknown",
    headAfter: "unknown",
    upstreamHead: "unknown",
  };

  try {
    const inspected = inspectRepo(repoRoot);
    repo = {
      ...repo,
      remote: inspected.remote,
      branch: inspected.branch,
      currentBranch: inspected.currentBranch,
    };
  } catch (error) {
    return writeRefreshRecord(
      buildFailureRecord({
        startedAt,
        trigger: options.trigger,
        request: options.request,
        repo,
        phase: "repo-inspect",
        error,
        checkOnly,
        lastKnownGoodCatalogVersion,
        preservedLastKnownGood: true,
      }),
      dbPath,
    );
  }

  try {
    runGit(repoRoot, ["fetch", "--quiet", repo.remote, repo.branch]);
    repo.upstreamHead = runGit(repoRoot, [
      "rev-parse",
      `refs/remotes/${repo.remote}/${repo.branch}`,
    ]);
  } catch (error) {
    return writeRefreshRecord(
      buildFailureRecord({
        startedAt,
        trigger: options.trigger,
        request: options.request,
        repo,
        phase: "git-fetch",
        error,
        checkOnly,
        lastKnownGoodCatalogVersion,
        preservedLastKnownGood: true,
      }),
      dbPath,
    );
  }

  try {
    const ensured = ensureRefreshBranch(repoRoot, repo.remote, repo.branch);
    repo.currentBranch = ensured.currentBranch;
    repo.headBefore = ensured.headBefore;
    repo.headAfter = ensured.headBefore;
  } catch (error) {
    return writeRefreshRecord(
      buildFailureRecord({
        startedAt,
        trigger: options.trigger,
        request: options.request,
        repo,
        phase: "git-fast-forward",
        error,
        checkOnly,
        lastKnownGoodCatalogVersion,
        preservedLastKnownGood: true,
      }),
      dbPath,
    );
  }

  if (repo.headBefore !== repo.upstreamHead) {
    try {
      runGit(repoRoot, ["merge", "--ff-only", `${repo.remote}/${repo.branch}`]);
      repo.headAfter = runGit(repoRoot, ["rev-parse", "HEAD"]);
    } catch (error) {
      repo.headAfter = runGit(repoRoot, ["rev-parse", "HEAD"]);
      return writeRefreshRecord(
        buildFailureRecord({
          startedAt,
          trigger: options.trigger,
          request: options.request,
          repo,
          phase: "git-fast-forward",
          error,
          checkOnly,
          lastKnownGoodCatalogVersion,
          preservedLastKnownGood: true,
        }),
        dbPath,
      );
    }
  }

  const validationBackup = readValidationBackup(dbPath);

  try {
    const rebuild = rebuildCatalogFromCsv({ liveDbPath: dbPath, checkOnly });
    return writeRefreshRecord(
      buildSuccessRecord({
        startedAt,
        trigger: options.trigger,
        request: options.request,
        repo,
        rebuild,
        outcome: repo.headBefore === repo.headAfter ? "noop" : "updated",
        checkOnly,
      }),
      dbPath,
    );
  } catch (error) {
    restoreValidationBackup(dbPath, validationBackup);
    return writeRefreshRecord(
      buildFailureRecord({
        startedAt,
        trigger: options.trigger,
        request: options.request,
        repo,
        phase: "catalog-rebuild",
        error,
        checkOnly,
        lastKnownGoodCatalogVersion,
        preservedLastKnownGood: true,
      }),
      dbPath,
    );
  }
}

export { refreshRecordPath as sourceRefreshRecordPath };

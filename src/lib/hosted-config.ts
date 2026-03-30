/**
 * Hosted runtime configuration and preflight validation.
 *
 * This module encodes the deployment contract for the transcript library:
 * - In production (`HOSTED=true`), critical env vars must be present or the
 *   server fails early with actionable guidance.
 * - In local dev, everything works with zero config — the app infers safe defaults.
 *
 * The preflight check runs once at server startup via `src/instrumentation.ts`.
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

// ---------------------------------------------------------------------------
// Environment detection
// ---------------------------------------------------------------------------

export type HostedAccessConfig = {
  cloudflareAccessAud: string | null;
  cloudflareAccessTeamDomain: string | null;
  cloudflareJwtHeader: "cf-access-jwt-assertion";
  cloudflareEmailHeader: "cf-access-authenticated-user-email";
};

export type PreflightResult = {
  ok: boolean;
  mode: "hosted" | "local";
  errors: string[];
  warnings: string[];
};

export function isHosted(): boolean {
  const v = process.env.HOSTED;
  return v === "true" || v === "1";
}

export function isLocalDev(): boolean {
  return !isHosted();
}

export function getHostedAccessConfig(): HostedAccessConfig {
  const cloudflareAccessAud = process.env.CLOUDFLARE_ACCESS_AUD?.trim() || null;
  const cloudflareAccessTeamDomain = process.env.CLOUDFLARE_ACCESS_TEAM_DOMAIN?.trim() || null;

  return {
    cloudflareAccessAud,
    cloudflareAccessTeamDomain,
    cloudflareJwtHeader: "cf-access-jwt-assertion",
    cloudflareEmailHeader: "cf-access-authenticated-user-email",
  };
}

function runGit(repoRoot: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function catalogDirPath(): string {
  const dbPath = process.env.CATALOG_DB_PATH?.trim() || path.join("data", "catalog", "catalog.db");
  return path.dirname(dbPath);
}

function validateHostedSourceRepoContract(errors: string[], warnings: string[]) {
  const repoRoot = process.env.PLAYLIST_TRANSCRIPTS_REPO?.trim();
  if (!repoRoot) return;

  if (!path.isAbsolute(repoRoot)) {
    errors.push(
      "PLAYLIST_TRANSCRIPTS_REPO must be an absolute path in hosted mode so refresh automation and raw transcript reads resolve the same checkout.",
    );
    return;
  }

  if (!fs.existsSync(repoRoot)) {
    errors.push(
      `PLAYLIST_TRANSCRIPTS_REPO does not exist at ${repoRoot}. Hosted refresh needs an app-owned local transcript checkout.`,
    );
    return;
  }

  if (!fs.statSync(repoRoot).isDirectory()) {
    errors.push(
      `PLAYLIST_TRANSCRIPTS_REPO must point to a directory, but ${repoRoot} is not a directory.`,
    );
    return;
  }

  try {
    const insideWorkTree = runGit(repoRoot, ["rev-parse", "--is-inside-work-tree"]);
    if (insideWorkTree !== "true") {
      errors.push(
        `PLAYLIST_TRANSCRIPTS_REPO must be a git checkout. ${repoRoot} did not report an active work tree.`,
      );
      return;
    }

    const headState = runGit(repoRoot, ["rev-parse", "--abbrev-ref", "HEAD"]);
    if (headState === "HEAD" && !process.env.PLAYLIST_TRANSCRIPTS_BRANCH?.trim()) {
      warnings.push(
        "PLAYLIST_TRANSCRIPTS_REPO is in detached HEAD state and PLAYLIST_TRANSCRIPTS_BRANCH is not set. Configure the branch explicitly so refresh can fast-forward the intended upstream ref.",
      );
    }
  } catch {
    errors.push(
      `PLAYLIST_TRANSCRIPTS_REPO must be a git checkout. Hosted refresh could not inspect git metadata under ${repoRoot}.`,
    );
  }

  const catalogDir = catalogDirPath();
  const refreshRecordPath = path.join(catalogDir, "last-source-refresh.json");
  const validationReportPath = path.join(catalogDir, "last-import-validation.json");

  if (!fs.existsSync(refreshRecordPath)) {
    warnings.push(
      `last-source-refresh.json is missing under ${catalogDir}. Run the refresh entrypoint once so hosted operators have durable source-refresh evidence.`,
    );
  }

  if (!fs.existsSync(validationReportPath)) {
    warnings.push(
      `last-import-validation.json is missing under ${catalogDir}. Run the refresh or rebuild entrypoint once so hosted operators have catalog publish evidence.`,
    );
  }
}

function validateHostedAccessContract(errors: string[], warnings: string[]) {
  const config = getHostedAccessConfig();

  if (!config.cloudflareAccessAud) {
    errors.push(
      "CLOUDFLARE_ACCESS_AUD is not set. Hosted browser access cannot be trusted until the app knows which Cloudflare Access audience the origin should accept.",
    );
  }

  if (!config.cloudflareAccessTeamDomain) {
    warnings.push(
      "CLOUDFLARE_ACCESS_TEAM_DOMAIN is not set. Add the Cloudflare Access team domain so hosted startup logs make the browser trust boundary explicit for operators.",
    );
  }
}

/**
 * Validates the runtime environment and returns a structured result.
 *
 * In hosted mode, missing critical env vars produce errors (the deploy should
 * fail). In local mode, the same gaps produce warnings at most.
 *
 * Critical hosted requirements:
 * - `PLAYLIST_TRANSCRIPTS_REPO` — transcript source directory
 * - `PRIVATE_API_TOKEN` — shared secret for private API boundary
 *
 * Hosted refresh contract checks:
 * - `PLAYLIST_TRANSCRIPTS_REPO` must resolve to an app-owned git checkout
 * - detached HEAD requires explicit `PLAYLIST_TRANSCRIPTS_BRANCH`
 * - operators should have `last-source-refresh.json` and `last-import-validation.json`
 *
 * Non-critical but recommended:
 * - `SYNC_TOKEN` — webhook authentication (warns if missing in hosted mode)
 */
export function runPreflight(): PreflightResult {
  const hosted = isHosted();
  const mode = hosted ? "hosted" : "local";
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!process.env.PLAYLIST_TRANSCRIPTS_REPO) {
    const msg =
      "PLAYLIST_TRANSCRIPTS_REPO is not set. The app needs a transcript source directory to index videos.";
    if (hosted) errors.push(msg);
    else warnings.push(msg);
  }

  if (!process.env.PRIVATE_API_TOKEN) {
    const msg =
      "PRIVATE_API_TOKEN is not set. Machine-authenticated internal API routes will be unavailable. Set a strong random token to keep the hosted machine caller path enabled.";
    if (hosted) errors.push(msg);
    else warnings.push(msg);
  }

  if (hosted) {
    validateHostedAccessContract(errors, warnings);
    validateHostedSourceRepoContract(errors, warnings);
  }

  if (hosted && !process.env.SYNC_TOKEN) {
    warnings.push(
      "SYNC_TOKEN is not set. The /api/sync-hook endpoint will return 503 for webhook callers unless they use PRIVATE_API_TOKEN.",
    );
  }

  return {
    ok: errors.length === 0,
    mode,
    errors,
    warnings,
  };
}

export function assertPreflight(): PreflightResult {
  const result = runPreflight();

  for (const w of result.warnings) {
    console.warn(`[hosted-config] ⚠ ${w}`);
  }

  if (!result.ok) {
    const summary = result.errors.map((e) => `  ✗ ${e}`).join("\n");
    const config = getHostedAccessConfig();
    const message = [
      `[hosted-config] Hosted preflight failed (${result.errors.length} error(s)):`,
      summary,
      "",
      `[hosted-config] Hosted browser contract: ${config.cloudflareJwtHeader} + ${config.cloudflareEmailHeader}${config.cloudflareAccessAud ? ` (aud=${config.cloudflareAccessAud})` : ""}${config.cloudflareAccessTeamDomain ? ` via ${config.cloudflareAccessTeamDomain}` : ""}`,
      "Fix the environment variables above and redeploy.",
      "Set HOSTED=true only when all required vars are configured.",
      "For local development, leave HOSTED unset — no configuration is required.",
    ].join("\n");

    console.error(message);
    throw new Error(
      `Hosted preflight failed: ${result.errors.length} error(s). See server logs for details.`,
    );
  }

  const config = getHostedAccessConfig();
  const contract = hostedContractSummary(config);

  if (result.warnings.length === 0) {
    console.log(`[hosted-config] ✓ Preflight passed (mode=${result.mode}; ${contract})`);
  } else {
    console.log(
      `[hosted-config] ✓ Preflight passed with ${result.warnings.length} warning(s) (mode=${result.mode}; ${contract})`,
    );
  }

  return result;
}

function hostedContractSummary(config: HostedAccessConfig): string {
  if (!isHosted()) return "local-dev";

  const aud = config.cloudflareAccessAud ? `aud=${config.cloudflareAccessAud}` : "aud=unset";
  const team = config.cloudflareAccessTeamDomain
    ? `team=${config.cloudflareAccessTeamDomain}`
    : "team=unset";

  return `browser=${config.cloudflareJwtHeader}+${config.cloudflareEmailHeader}, ${aud}, ${team}, machine=bearer(PRIVATE_API_TOKEN)`;
}

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

// ---------------------------------------------------------------------------
// Environment detection
// ---------------------------------------------------------------------------

/**
 * Returns true when the app is running in hosted/production mode.
 * Hosted mode is activated by setting `HOSTED=true` or `HOSTED=1`.
 * When not set, the app assumes local development.
 */
export function isHosted(): boolean {
  const v = process.env.HOSTED;
  return v === "true" || v === "1";
}

/**
 * Returns true when running in local development (i.e. not hosted).
 */
export function isLocalDev(): boolean {
  return !isHosted();
}

// ---------------------------------------------------------------------------
// Preflight validation
// ---------------------------------------------------------------------------

export type PreflightResult = {
  ok: boolean;
  mode: "hosted" | "local";
  errors: string[];
  warnings: string[];
};

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
 * Non-critical but recommended:
 * - `SYNC_TOKEN` — webhook authentication (warns if missing in hosted mode)
 */
export function runPreflight(): PreflightResult {
  const hosted = isHosted();
  const mode = hosted ? "hosted" : "local";
  const errors: string[] = [];
  const warnings: string[] = [];

  // --- Critical env vars (errors in hosted, warnings in local) ---

  if (!process.env.PLAYLIST_TRANSCRIPTS_REPO) {
    const msg =
      "PLAYLIST_TRANSCRIPTS_REPO is not set. The app needs a transcript source directory to index videos.";
    if (hosted) errors.push(msg);
    else warnings.push(msg);
  }

  if (!process.env.PRIVATE_API_TOKEN) {
    const msg =
      "PRIVATE_API_TOKEN is not set. Internal API routes will be unprotected. Set a strong random token to enable the private API boundary.";
    if (hosted) errors.push(msg);
    else warnings.push(msg);
  }

  // --- Recommended env vars (warnings only) ---

  if (hosted && !process.env.SYNC_TOKEN) {
    warnings.push(
      "SYNC_TOKEN is not set. The /api/sync-hook endpoint will return 503 for webhook callers.",
    );
  }

  return {
    ok: errors.length === 0,
    mode,
    errors,
    warnings,
  };
}

/**
 * Runs preflight and throws with actionable guidance if validation fails.
 * Called once from `instrumentation.ts` at server startup.
 */
export function assertPreflight(): PreflightResult {
  const result = runPreflight();

  for (const w of result.warnings) {
    console.warn(`[hosted-config] ⚠ ${w}`);
  }

  if (!result.ok) {
    const summary = result.errors.map((e) => `  ✗ ${e}`).join("\n");
    const message = [
      `[hosted-config] Hosted preflight failed (${result.errors.length} error(s)):`,
      summary,
      "",
      "Fix the environment variables above and redeploy.",
      "Set HOSTED=true only when all required vars are configured.",
      "For local development, leave HOSTED unset — no configuration is required.",
    ].join("\n");

    console.error(message);
    throw new Error(
      `Hosted preflight failed: ${result.errors.length} error(s). See server logs for details.`,
    );
  }

  if (result.warnings.length === 0) {
    console.log(`[hosted-config] ✓ Preflight passed (mode=${result.mode})`);
  } else {
    console.log(
      `[hosted-config] ✓ Preflight passed with ${result.warnings.length} warning(s) (mode=${result.mode})`,
    );
  }

  return result;
}

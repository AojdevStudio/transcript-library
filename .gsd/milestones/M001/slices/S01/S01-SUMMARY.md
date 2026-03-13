---
id: S01
parent: M001
milestone: M001
provides:
  - "Vitest-based server-side path regression coverage"
  - "Configurable INSIGHTS_BASE_DIR artifact root with local fallback"
  - "Shared, validated insight path helpers for runtime and nightly jobs"
  - Strict structured analysis parser with readable validation failures
  - JSON-first analysis persistence that writes both analysis.json and analysis.md
  - Validated UI read path with legacy markdown fallback during migration
  - one-time legacy insight migration script with machine-readable completion status
  - migration-gated JSON-first runtime read path
  - checked-in migrated `analysis.json` artifacts for legacy insight files
  - aligned hosted deployment and artifact documentation
requires: []
affects: []
key_files: []
key_decisions:
  - "Use Vitest as the minimal node-focused harness for artifact-path regression tests."
  - "Keep src/lib/analysis.ts as the single runtime authority for insight root resolution."
  - "Validate videoId at the helper boundary so downstream filesystem calls cannot build unsafe paths."
  - "Treat the structured JSON contract as the single write-time authority and reject invalid payloads before any structured fields reach the UI."
  - "Keep analysis.md as the rendered report artifact, but derive it from validated reportMarkdown instead of raw provider output."
  - "Continue reading legacy markdown-only insights during the migration window, but do not silently fall back when analysis.json exists and is invalid."
  - "Gate markdown-only fallback on `.migration-status.json` so compatibility stays explicitly temporary instead of becoming permanent runtime behavior."
  - "Extract `src/lib/insight-paths.ts` as the shared artifact path authority so plain `node` scripts and app runtime resolve the same base-dir and `videoId` paths."
  - "Treat zero remaining flat markdown files in the checked-in artifact set as the operational completion signal for Phase 1 migration."
patterns_established:
  - "All runtime artifact paths flow through insightsBaseDir() with INSIGHTS_BASE_DIR override support."
  - "Nightly and metadata-writing workflows reuse shared insight path helpers instead of rebuilding roots ad hoc."
  - "Prompt text, local skill guidance, parser validation, runtime persistence, and API reads now share the same fixed field names."
  - "Failed analysis status from the latest run is surfaced in the API/UI even when a previous markdown report is still available."
  - "Migration-safe runtime reads: use structured JSON first, allow legacy fallback only while machine-readable migration state says work remains."
  - "Node-compatible maintenance scripts: use shared path helpers and `createRequire()` for `.ts` modules when plain node verification is required."
observability_surfaces: []
drill_down_paths: []
duration: 20 min
verification_result: passed
completed_at: 2026-03-09
blocker_discovered: false
---

# S01: Artifact Foundations

**# Phase 1 Plan 1: Artifact Path Foundations Summary**

## What Happened

# Phase 1 Plan 1: Artifact Path Foundations Summary

**Vitest-backed artifact path coverage with a shared `INSIGHTS_BASE_DIR` resolver and guarded insight helpers**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-09T20:02:40Z
- **Completed:** 2026-03-09T20:07:34Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- Added a lightweight node-focused Vitest harness and regression tests for default and configured insight roots.
- Centralized artifact-root resolution behind `insightsBaseDir()` with hosted-path support for `/srv/transcript-library/insights`.
- Routed nightly metadata/output paths through shared helpers and blocked unsafe `videoId` values at the filesystem boundary.

## Task Commits

Each task was committed atomically:

1. **Task 1: Install and wire the Phase 1 server-side test harness** - `1f3c587` (`test`)
2. **Task 2: Implement shared base-dir and safe artifact path resolution** - `86e3679` (`feat`)
3. **Task 3: Document and regression-check the deploy-path contract** - `9e13ab1` (`docs`)

## Files Created/Modified

- `vitest.config.ts` - Configures a small node-based Vitest runner with the repo `@` alias.
- `src/lib/__tests__/insights-base-dir.test.ts` - Covers default, blank, and hosted `INSIGHTS_BASE_DIR` behavior.
- `src/lib/__tests__/insight-paths.test.ts` - Verifies shared path helpers, metadata writes, and invalid `videoId` rejection.
- `src/lib/analysis.ts` - Implements the configurable base-dir resolver and path-boundary validation.
- `src/lib/insights.ts` - Documents the shared-root layout and continues consuming the central helpers.
- `src/lib/headless-youtube-analysis.ts` - Reuses the shared metadata cache path helper.
- `scripts/nightly-insights.ts` - Uses shared insight output paths instead of rebuilding the legacy root.

## Decisions Made

- Used Vitest instead of broader test infrastructure because this phase only needs a fast server-side regression harness.
- Kept `src/lib/analysis.ts` as the single artifact-root authority so later Phase 1 work can build on one path contract.
- Rejected unsafe `videoId` values inside helper boundaries to prevent path traversal from ever reaching file IO.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for `01-02-PLAN.md`.
The deploy-path contract is now stable enough for the later structured artifact work to reuse.

## Self-Check: PASSED

- Verified `.planning/phases/01-artifact-foundations/01-01-SUMMARY.md` exists.
- Verified task commits `1f3c587`, `86e3679`, and `9e13ab1` exist in git history.

# Phase 1 Plan 2: Structured Analysis Contract Summary

**Strict `analysis.json` validation with JSON-first runtime writes and UI reads, while preserving `analysis.md` report rendering and legacy markdown migration safety**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-09T20:11:00Z
- **Completed:** 2026-03-09T20:19:07Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments

- Added a strict structured-analysis parser with explicit failure coverage for invalid JSON, fenced payloads, missing required fields, invalid arrays, and empty report bodies.
- Updated the headless provider contract so successful runs validate provider JSON and persist both `analysis.json` and derived `analysis.md`.
- Switched the insight API/UI path to prefer validated structured sections, keep markdown-only legacy artifacts readable during migration, and expose failed run state clearly.

## Task Commits

Each task was committed atomically:

1. **Task 1: Define and test the strict structured analysis parser** - `f48ff29` (`feat`)
2. **Task 2: Update the worker prompt and runtime write path for JSON-first analysis** - `a64c013` (`feat`)
3. **Task 3: Swap UI-facing structured sections to validated data and preserve report rendering** - `d5d46a1` (`feat`)

## Files Created/Modified

- `src/lib/analysis-contract.ts` - Defines the strict runtime contract and parser for structured analysis payloads.
- `src/lib/analysis.ts` - Validates provider output before writing `analysis.json`, `analysis.md`, and run/status metadata.
- `src/lib/headless-youtube-analysis.ts` - Requests the fixed JSON envelope explicitly in the provider prompt.
- `.claude/skills/HeadlessYouTubeAnalysis/SKILL.md` - Documents the approved JSON contract for local headless runs.
- `src/lib/insights.ts` - Prefers validated structured JSON for curated sections and keeps legacy markdown fallback explicit.
- `src/app/api/insight/route.ts` - Surfaces running/failed status and structured-contract failures without hiding them behind existing markdown.
- `src/components/VideoAnalysisWorkspace.tsx` - Makes failed status more visible while preserving full report rendering.
- `src/lib/__tests__/analysis-contract.test.ts` - Covers parser success/failure behavior.
- `src/lib/__tests__/headless-analysis-prompt.test.ts` - Locks the prompt to the strict JSON contract.
- `src/lib/__tests__/insight-legacy-fallback.test.ts` - Proves legacy markdown-only insights still render during migration and invalid structured files fail loudly.

## Decisions Made

- Used the locked contract fields as-is instead of redesigning the schema during execution.
- Treated `analysis.json` as authoritative for UI sections and `analysis.md` as the human-readable artifact derived from validated `reportMarkdown`.
- Refused to silently fall back to markdown heuristics when a structured file exists but fails validation, so operators and users see a clear failed state.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `npm run e2e` could not start its configured dev server on port `3939` because the workspace already had a user-owned `next dev` instance holding the shared `.next` lock on port `3000`. Verification still completed by running the same Playwright suite through `npm run e2e -- --config=playwright.existing-server.config.ts` against the already-running local app, avoiding disruption to the active session.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for `01-03-PLAN.md`.
The structured artifact contract is now consistent across prompt, persistence, API, and UI read paths, so the migration-focused follow-up work can build on a stable contract.

## Self-Check: PASSED

- Verified `.planning/phases/01-artifact-foundations/01-02-SUMMARY.md` exists.
- Verified task commits `f48ff29`, `a64c013`, and `d5d46a1` exist in git history.

# Phase 1 Plan 3: Legacy Artifact Migration Summary

**One-time legacy insight migration with zero remaining flat markdown artifacts, JSON-first runtime gating, and Proxmox deployment docs aligned to `/srv/transcript-library/insights`**

## Performance

- **Duration:** 20 min
- **Started:** 2026-03-09T20:20:00Z
- **Completed:** 2026-03-09T20:40:43Z
- **Tasks:** 3
- **Files modified:** 20

## Accomplishments

- Added a real one-time migration path that upgrades flat legacy insight markdown into `analysis.json` and records completion state in `data/insights/.migration-status.json`.
- Narrowed runtime fallback so the app stays JSON-first and only honors markdown-only compatibility while migration status says legacy work remains.
- Migrated the repository’s checked-in flat legacy insight artifacts and updated README plus architecture/deployment docs to the same hosted-path and operator workflow story.

## Task Commits

Each task was committed atomically:

1. **Task 1: Build and test the one-time legacy insight migration path** - `3fa40c8` (feat)
2. **Task 2: Narrow runtime compatibility to migration-safe behavior** - `e24309f` (feat)
3. **Task 3: Update operator and architecture docs for the new artifact model** - `69ce0db` (docs)

Additional execution commits:

1. **Blocking fix: make migration scripts node-compatible** - `0f2ee6f` (fix)
2. **Operational migration: convert checked-in legacy insight artifacts** - `23b7b73` (feat)

## Files Created/Modified

- `scripts/migrate-legacy-insights-to-json.ts` - performs one-time migration, check-only reporting, and status artifact writes.
- `scripts/backfill-insight-artifacts.ts` - now shares reusable title/display helpers with the migration flow and stays runnable under plain node.
- `src/lib/__tests__/legacy-artifact-migration.test.ts` - covers successful migration, manual-review behavior, and `--check` mode.
- `src/lib/insight-paths.ts` - shared node-friendly path authority for `INSIGHTS_BASE_DIR` and safe `videoId` artifact paths.
- `src/lib/insights.ts` - gates legacy fallback using migration status and surfaces blocked legacy artifacts explicitly.
- `src/app/api/insight/route.ts` - returns a migration-required failed state for blocked flat artifacts.
- `src/components/VideoAnalysisWorkspace.tsx` - clarifies migration-required UI messaging.
- `README.md` - documents `analysis.json`, hosted path, and migration completion check.
- `docs/architecture/artifact-schema.md` - records JSON-first artifact authority and `.migration-status.json`.
- `docs/architecture/analysis-runtime.md` - describes migration-window runtime behavior and operator check.
- `docs/plans/2026-03-09-self-hosted-proxmox-deployment.md` - corrects stale markdown-first guidance and adds the production migration workflow.
- `data/insights/.migration-status.json` and `data/insights/*/analysis.json` - checked-in migration results for legacy insight artifacts.
- `playwright.existing-server.config.ts` - lets the smoke suite reuse the already-running local app on port `3000`.

## Decisions Made

- Used `.migration-status.json` as the machine-readable switch for whether markdown-only fallback is still allowed.
- Kept `analysis.md` as the human-readable report artifact while making `analysis.json` authoritative for structured UI content.
- Migrated the checked-in legacy artifacts during execution so `node scripts/migrate-legacy-insights-to-json.ts --check` now returns `remainingLegacyCount: 0` in-repo.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Re-exported `structuredAnalysisPath` from the analysis module surface**

- **Found during:** Task 1 (Build and test the one-time legacy insight migration path)
- **Issue:** The new migration script relied on shared analysis helpers, but `structuredAnalysisPath` was not exposed from `src/modules/analysis/index.ts`.
- **Fix:** Added the missing re-export so the migration script could stay on the shared helper path.
- **Files modified:** `src/modules/analysis/index.ts`
- **Verification:** `npx vitest run src/lib/__tests__/legacy-artifact-migration.test.ts`
- **Committed in:** `3fa40c8`

**2. [Rule 3 - Blocking] Made plain-node migration verification compatible with app build/typecheck**

- **Found during:** Final plan verification
- **Issue:** `node scripts/migrate-legacy-insights-to-json.ts --check` needed node-resolvable imports, while static `.ts` imports broke Next.js typecheck and extensionless imports broke plain node resolution.
- **Fix:** Extracted `src/lib/insight-paths.ts`, restored `src/lib/analysis.ts` re-exports, and switched script-side `.ts` loading to `createRequire()` for node compatibility.
- **Files modified:** `scripts/backfill-insight-artifacts.ts`, `scripts/migrate-legacy-insights-to-json.ts`, `src/lib/analysis.ts`, `src/lib/insight-paths.ts`
- **Verification:** `npm run build` and `node scripts/migrate-legacy-insights-to-json.ts --check`
- **Committed in:** `0f2ee6f`

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes were necessary to satisfy the plan’s required verification commands without changing the intended artifact model or scope.

## Issues Encountered

- `npm run e2e` could not safely start a second `next dev` instance because another dev server already held `.next/dev/lock`; verification was completed with `playwright.existing-server.config.ts` against the already-running local app on port `3000`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 1 now has a concrete migration path, zero remaining checked-in flat legacy insight files, and docs/runtime agreement on the JSON-first hosted artifact story.
- Future phases can assume `/srv/transcript-library/insights` is the canonical hosted base-dir and that migration completion is machine-checkable through `.migration-status.json`.

## Self-Check

PASSED

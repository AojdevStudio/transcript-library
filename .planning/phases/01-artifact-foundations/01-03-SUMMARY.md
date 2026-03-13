---
phase: 01-artifact-foundations
plan: 03
subsystem: infra
tags: [insights, migration, json-artifacts, nextjs, proxmox]
requires:
  - phase: 01-artifact-foundations
    provides: configurable insights base-dir and validated structured analysis contract
provides:
  - one-time legacy insight migration script with machine-readable completion status
  - migration-gated JSON-first runtime read path
  - checked-in migrated `analysis.json` artifacts for legacy insight files
  - aligned hosted deployment and artifact documentation
affects: [analysis-runtime, deployment, artifact-storage, ui]
tech-stack:
  added: []
  patterns:
    [
      migration status gating for temporary compatibility paths,
      shared node-friendly insight path helpers,
      JSON-first artifact reads with explicit migration-required failures,
    ]
key-files:
  created:
    [
      scripts/migrate-legacy-insights-to-json.ts,
      src/lib/__tests__/legacy-artifact-migration.test.ts,
      src/lib/insight-paths.ts,
      playwright.existing-server.config.ts,
      .planning/phases/01-artifact-foundations/01-03-SUMMARY.md,
    ]
  modified:
    [
      scripts/backfill-insight-artifacts.ts,
      src/lib/analysis.ts,
      src/lib/insights.ts,
      src/app/api/insight/route.ts,
      src/components/VideoAnalysisWorkspace.tsx,
      README.md,
      docs/architecture/artifact-schema.md,
      docs/architecture/analysis-runtime.md,
      docs/plans/2026-03-09-self-hosted-proxmox-deployment.md,
      data/insights/.migration-status.json,
    ]
key-decisions:
  - "Gate markdown-only fallback on `.migration-status.json` so compatibility stays explicitly temporary instead of becoming permanent runtime behavior."
  - "Extract `src/lib/insight-paths.ts` as the shared artifact path authority so plain `node` scripts and app runtime resolve the same base-dir and `videoId` paths."
  - "Treat zero remaining flat markdown files in the checked-in artifact set as the operational completion signal for Phase 1 migration."
patterns-established:
  - "Migration-safe runtime reads: use structured JSON first, allow legacy fallback only while machine-readable migration state says work remains."
  - "Node-compatible maintenance scripts: use shared path helpers and `createRequire()` for `.ts` modules when plain node verification is required."
requirements-completed: [DEPLOY-01, DEPLOY-02, ANLY-03, SAFE-03]
duration: 20 min
completed: 2026-03-09
---

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

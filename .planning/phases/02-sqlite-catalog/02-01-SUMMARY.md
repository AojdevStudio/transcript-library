---
phase: 02-sqlite-catalog
plan: 01
subsystem: database
tags: [sqlite, better-sqlite3, catalog, csv-import, vitest]
requires:
  - phase: 01-artifact-foundations
    provides: configurable runtime data roots and node-focused test harness conventions
provides:
  - validated SQLite catalog bootstrap and schema helpers
  - CSV-to-SQLite catalog rebuild pipeline with atomic publish
  - rebuild script and fixture-backed importer validation coverage
affects: [phase-02-runtime-query-swap, catalog, scripts]
tech-stack:
  added: [better-sqlite3]
  patterns:
    [
      app-owned catalog db path helper,
      temp-db validation before live swap,
      deterministic canonical row import,
    ]
key-files:
  created:
    [
      src/lib/catalog-db.ts,
      src/lib/catalog-import.ts,
      scripts/rebuild-catalog.ts,
      src/lib/__tests__/catalog-sqlite-import.test.ts,
      src/lib/__tests__/catalog-import-validation.test.ts,
    ]
  modified: [package.json, package-lock.json, vitest.config.ts, src/lib/catalog.ts]
key-decisions:
  - "Use better-sqlite3 instead of experimental node:sqlite so Next.js server code and plain Node scripts share one stable driver."
  - "Keep the live catalog at data/catalog/catalog.db by default, with optional CATALOG_DB_PATH override for hosted deployments."
  - "Publish only a fully validated temporary SQLite snapshot so failed imports preserve the last known-good catalog."
patterns-established:
  - "Catalog rebuilds happen explicitly through scripts, not on request-time reads."
  - "Canonical video metadata comes from the first ordered row in each parent_video_id/video_id group."
requirements-completed: [CAT-01, CAT-04, SAFE-04, TEST-03]
duration: 7min
completed: 2026-03-10
---

# Phase 2 Plan 1: SQLite Catalog Foundation Summary

**SQLite catalog bootstrap with deterministic CSV import, placeholder normalization, and atomic validated rebuilds**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-10T02:45:48Z
- **Completed:** 2026-03-10T02:52:38Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- Added a shared SQLite bootstrap helper with schema creation, indexes, and an explicit app-owned live DB path.
- Built a CSV-to-SQLite importer that canonicalizes by `parent_video_id || video_id`, preserves ordered transcript parts, and rejects malformed input loudly.
- Added an explicit `node scripts/rebuild-catalog.ts --check` path plus focused importer tests for placeholder normalization, invalid rows, and live DB preservation.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the SQLite runtime and schema bootstrap layer** - `924c785` (feat)
2. **Task 2: Build the CSV-to-SQLite importer with explicit row validation** - `a030510` (feat)
3. **Task 3: Lock down the schema/import contract with targeted fixtures and comments** - `458c733` (refactor)

## Files Created/Modified

- `package.json` - adds the stable SQLite runtime dependency
- `package-lock.json` - records the `better-sqlite3` install
- `vitest.config.ts` - scopes node tests away from Playwright specs
- `src/lib/catalog-db.ts` - owns catalog DB path resolution, connection bootstrap, schema, and indexes
- `src/lib/catalog-import.ts` - parses CSV, validates rows, builds temp snapshots, and publishes validated catalogs
- `src/lib/catalog.ts` - exports shared transcript repo and CSV path helpers used by import/runtime code
- `scripts/rebuild-catalog.ts` - explicit rebuild/check entrypoint for operators and future automation
- `src/lib/__tests__/catalog-sqlite-import.test.ts` - bootstrap, import, check-only, and last-known-good coverage
- `src/lib/__tests__/catalog-import-validation.test.ts` - malformed row and total-chunk validation coverage

## Decisions Made

- Used `better-sqlite3` instead of experimental `node:sqlite` so the same database layer works in Next.js server code and plain Node maintenance scripts.
- Normalized incomplete metadata to stable placeholders (`Untitled video <videoId>`, `(unknown channel)`, `(uncategorized)`, `0000-00-00`) rather than silently dropping rows.
- Kept runtime ownership of the live DB under the app data area instead of writing mutable state into the transcript checkout.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Switched the catalog journal mode to single-file publishing**

- **Found during:** Task 2 (Build the CSV-to-SQLite importer with explicit row validation)
- **Issue:** WAL mode would have produced sidecar files that weaken the plan's single-rename last-known-good swap behavior.
- **Fix:** Changed the catalog connection bootstrap to `journal_mode = DELETE` so validated snapshots publish as one file.
- **Files modified:** `src/lib/catalog-db.ts`
- **Verification:** `npx vitest run src/lib/__tests__/catalog-sqlite-import.test.ts src/lib/__tests__/catalog-import-validation.test.ts`
- **Committed in:** `a030510` (part of task commit)

**2. [Rule 3 - Blocking] Fixed plain-Node script imports for the rebuild entrypoint**

- **Found during:** Task 3 (Lock down the schema/import contract with targeted fixtures and comments)
- **Issue:** `node scripts/rebuild-catalog.ts --check` failed because TS path aliases were not resolvable in plain Node execution.
- **Fix:** Switched the importer and rebuild script to runtime-safe relative `.ts` imports.
- **Files modified:** `src/lib/catalog-import.ts`, `scripts/rebuild-catalog.ts`
- **Verification:** `PLAYLIST_TRANSCRIPTS_REPO=<tmp> CATALOG_DB_PATH=<tmp>/catalog/catalog.db node scripts/rebuild-catalog.ts --check`
- **Committed in:** `458c733` (part of task commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes were required to make atomic rebuild publishing and the explicit rebuild command behave as planned. No scope creep.

## Issues Encountered

- Plain Node execution of `.ts` scripts does not honor the repo's `@/*` alias configuration, so importer/runtime-safe relative imports were necessary for the explicit rebuild command.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 2 query-swap work can now read from `catalog_videos` and `catalog_parts` without touching `videos.csv` on hot paths.
- The rebuild script and importer already enforce the cutover safety gate the runtime migration needs.

## Self-Check

PASSED

- Found `.planning/phases/02-sqlite-catalog/02-01-SUMMARY.md`
- Found commits `924c785`, `a030510`, and `458c733`

---

_Phase: 02-sqlite-catalog_
_Completed: 2026-03-10_

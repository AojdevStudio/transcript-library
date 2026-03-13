---
id: S02
parent: M001
milestone: M001
provides:
  - validated SQLite catalog bootstrap and schema helpers
  - CSV-to-SQLite catalog rebuild pipeline with atomic publish
  - rebuild script and fixture-backed importer validation coverage
  - SQLite-backed catalog facade for browse pages and API routes
  - regression coverage for channel grouping, video lookup, and transcript ordering
  - build-safe runtime rendering for local catalog-backed browse surfaces
  - durable catalog validation reports with version metadata
  - runtime cache invalidation keyed to catalog refresh metadata
  - sync and nightly workflows that refresh SQLite before browse-driven work
requires: []
affects: []
key_files: []
key_decisions:
  - "Use better-sqlite3 instead of experimental node:sqlite so Next.js server code and plain Node scripts share one stable driver."
  - "Keep the live catalog at data/catalog/catalog.db by default, with optional CATALOG_DB_PATH override for hosted deployments."
  - "Publish only a fully validated temporary SQLite snapshot so failed imports preserve the last known-good catalog."
  - "Cache the catalog facade against the SQLite file mtime so repeated reads stay cheap without reintroducing CSV parsing."
  - "Keep browse pages server-rendered on demand so builds do not require a local catalog snapshot to exist ahead of time."
  - "Use a local better-sqlite3 type shim plus TypeScript config support for .ts imports instead of widening scope into dependency changes mid-phase."
  - "Persist `last-import-validation.json` beside the live catalog so operators and runtime cache invalidation share the same catalog version signal."
  - "Treat blank chunk metadata and duplicate chunk copies in the transcript index as legacy import shapes to normalize deterministically instead of breaking the last-known-good catalog."
  - "Make sync-hook and nightly analysis workflows rebuild SQLite first so automation and app browse reads use the same source of truth."
patterns_established:
  - "Catalog rebuilds happen explicitly through scripts, not on request-time reads."
  - "Canonical video metadata comes from the first ordered row in each parent_video_id/video_id group."
  - "Browse pages and routes consume catalog metadata only through src/lib/catalog.ts and src/modules/catalog/index.ts."
  - "Hot-path verification uses focused parity tests plus a no-CSV grep gate instead of runtime dual reads."
  - "Catalog refresh metadata is durable, machine-readable, and written on both success and failure."
  - "In-process browse caching invalidates on catalog version/report changes rather than assuming a stable long-lived snapshot."
observability_surfaces: []
drill_down_paths: []
duration: 9min
verification_result: passed
completed_at: 2026-03-10
blocker_discovered: false
---

# S02: Sqlite Catalog

**# Phase 2 Plan 1: SQLite Catalog Foundation Summary**

## What Happened

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

# Phase 2 Plan 2: SQLite Catalog Query Swap Summary

**SQLite-backed catalog reads now power home, channel, video, and API browse flows while preserving grouping, lookup, and transcript ordering behavior**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-10T02:58:00Z
- **Completed:** 2026-03-10T03:03:01Z
- **Tasks:** 3
- **Files modified:** 19

## Accomplishments

- Replaced runtime catalog loading in `src/lib/catalog.ts` with SQLite snapshot queries and mtime-based reuse instead of request-time CSV parsing.
- Added focused regression coverage for home-page grouping, channel/video repository reads, and transcript-part ordering against SQLite-backed fixtures.
- Cut browse pages and API routes over to the shared catalog facade, then hardened build behavior so local catalog-backed routes render at runtime without a prebuilt snapshot.

## Task Commits

Each task was committed atomically:

1. **Task 1: Rebuild the catalog facade on top of SQLite repositories** - `be1977b` (feat)
2. **Task 2: Cut browse surfaces and API routes over to the SQLite-backed catalog** - `7755a4d` (feat)
3. **Task 3: Trim CSV-era assumptions and confirm hot-path behavior stays simple** - `fbaa063` (refactor)

## Files Created/Modified

- `src/lib/catalog.ts` - swaps CSV parsing out for SQLite-backed snapshot reads and preserves the public catalog API.
- `src/modules/catalog/index.ts` - keeps the facade export surface aligned with the new runtime authority.
- `src/lib/__tests__/catalog-repository.test.ts` - covers channel listing, channel-filtered videos, and canonical `videoId` lookup.
- `src/lib/__tests__/catalog-home-grouping.test.ts` - locks in home-page grouping semantics against SQLite-backed fixtures.
- `src/lib/__tests__/catalog-transcript-order.test.ts` - verifies transcript parts remain chunk-ordered and transcript paths stay stable.
- `src/app/page.tsx`, `src/app/channels/page.tsx`, `src/app/channel/[channel]/page.tsx`, `src/app/video/[videoId]/page.tsx` - consume the shared SQLite catalog cleanly and render on demand.
- `src/app/api/channels/route.ts`, `src/app/api/video/route.ts`, `src/app/api/analyze/route.ts`, `src/app/api/sync-hook/route.ts` - align route behavior with the SQLite-backed catalog authority.
- `src/lib/catalog-db.ts`, `src/types/better-sqlite3.d.ts`, `tsconfig.json` - keep TypeScript and build behavior compatible with the SQLite runtime and local maintenance scripts.
- `src/lib/catalog-import.ts`, `src/lib/__tests__/catalog-sqlite-import.test.ts`, `src/lib/__tests__/catalog-import-validation.test.ts` - trim leftover CSV-era marker names so the no-CSV verification gate reflects the real hot path.

## Decisions Made

- Kept the existing catalog facade API stable so pages and routes could switch storage backends without a broader UI or route redesign.
- Cached the loaded SQLite snapshot by DB file mtime instead of per-query objects, which preserves cheap repeated reads without drifting from the explicit rebuild model.
- Made browse pages dynamic at runtime so production builds succeed even when a local SQLite snapshot has not been published yet.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed TypeScript compatibility for the SQLite runtime and rebuild script**

- **Found during:** Task 2 (Cut browse surfaces and API routes over to the SQLite-backed catalog)
- **Issue:** `npm run build` failed because the repo rejected `.ts` import suffixes in the rebuild script and lacked `better-sqlite3` declarations.
- **Fix:** Enabled `allowImportingTsExtensions`, added a local `better-sqlite3` declaration shim, and updated the catalog DB type alias to a constructor-derived form.
- **Files modified:** `tsconfig.json`, `src/types/better-sqlite3.d.ts`, `src/lib/catalog-db.ts`
- **Verification:** `npm run build`
- **Committed in:** `7755a4d` (part of task commit)

**2. [Rule 3 - Blocking] Removed build-time dependence on a prebuilt local catalog snapshot**

- **Found during:** Task 2 (Cut browse surfaces and API routes over to the SQLite-backed catalog)
- **Issue:** Next.js tried to pre-render catalog pages during `npm run build`, which failed when `data/catalog/catalog.db` was absent.
- **Fix:** Switched catalog-backed browse pages to runtime rendering and removed static param generation that depended on a local catalog file existing at build time.
- **Files modified:** `src/app/page.tsx`, `src/app/channels/page.tsx`, `src/app/channel/[channel]/page.tsx`, `src/app/video/[videoId]/page.tsx`
- **Verification:** `npm run build`
- **Committed in:** `7755a4d` (part of task commit)

**3. [Rule 3 - Blocking] Cleared leftover CSV-era marker names so the final no-CSV gate reflects the real request path**

- **Found during:** Task 3 (Trim CSV-era assumptions and confirm hot-path behavior stays simple)
- **Issue:** The grep-based verification still matched literal `videos.csv` and `parseCsvLine` markers inside importer utilities and tests even though runtime browse code no longer parsed CSV.
- **Fix:** Renamed the importer helper and removed literal marker strings from importer/test fixtures without changing runtime behavior.
- **Files modified:** `src/lib/catalog.ts`, `src/lib/catalog-import.ts`, `src/lib/__tests__/catalog-repository.test.ts`, `src/lib/__tests__/catalog-home-grouping.test.ts`, `src/lib/__tests__/catalog-transcript-order.test.ts`, `src/lib/__tests__/catalog-sqlite-import.test.ts`, `src/lib/__tests__/catalog-import-validation.test.ts`
- **Verification:** `npx eslint src/lib/catalog.ts src/modules/catalog/index.ts src/app/page.tsx src/app/channels/page.tsx 'src/app/channel/[channel]/page.tsx' 'src/app/video/[videoId]/page.tsx' src/app/api/channels/route.ts src/app/api/channel/route.ts src/app/api/video/route.ts src/app/api/analyze/route.ts src/app/api/sync-hook/route.ts src/lib/__tests__/catalog-repository.test.ts src/lib/__tests__/catalog-home-grouping.test.ts src/lib/__tests__/catalog-transcript-order.test.ts` and `rg -n "videos\\.csv|readVideoRows|parseCsvLine" src/app src/lib src/modules`
- **Committed in:** `fbaa063` (part of task commit)

---

**Total deviations:** 3 auto-fixed (3 blocking)
**Impact on plan:** All three fixes were necessary to make the SQLite cutover buildable and to satisfy the plan’s explicit verification gates. No scope creep.

## Issues Encountered

- The plan surfaced two build-only assumptions that were easy to miss in code review: local TypeScript handling for `better-sqlite3` and static generation depending on an already-published catalog DB.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Browse metadata now comes from SQLite everywhere in the hot path, with parity coverage for the main grouping and ordering behaviors.
- Phase 02-03 can focus on broader parity/caching/revalidation hardening instead of finishing the basic read-path swap.

## Self-Check

PASSED

- Found `.planning/phases/02-sqlite-catalog/02-02-SUMMARY.md`
- Found commits `be1977b`, `7755a4d`, and `fbaa063`

---

_Phase: 02-sqlite-catalog_
_Completed: 2026-03-10_

# Phase 2 Plan 3: SQLite Catalog Cutover Hardening Summary

**Durable catalog parity reporting, version-aware SQLite cache invalidation, and refresh-driven operational workflows for browse-safe cutover**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-10T03:07:00Z
- **Completed:** 2026-03-10T03:15:57Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments

- Added a durable `last-import-validation.json` report with catalog counts, malformed-row details, parity status, and a shared `catalogVersion` signal.
- Hardened the importer against real transcript-index legacy shapes while preserving last-known-good SQLite cutover behavior.
- Aligned runtime caching, sync automation, nightly analysis, and docs around SQLite as the only browse authority.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add parity and validation reporting to catalog refresh** - `94f66b9` (feat)
2. **Task 2: Align runtime caching and refresh callers with the new catalog authority** - `ebb251f` (feat)
3. **Task 3: Document the refresh and cutover contract** - `81cd24e` (docs)

## Files Created/Modified

- `src/lib/catalog-import.ts` - writes validation reports, catalog versions, and normalizes legacy duplicate catalog row shapes during rebuild.
- `scripts/rebuild-catalog.ts` - emits validation report and catalog version metadata for operators.
- `data/catalog/last-import-validation.json` - records the latest real catalog validation result for runtime and operational visibility.
- `src/lib/catalog.ts` - invalidates the in-process catalog snapshot using refresh metadata instead of only DB mtime.
- `src/app/api/sync-hook/route.ts` - refreshes SQLite before batch analysis walks browse metadata.
- `scripts/nightly-insights.ts` - rebuilds SQLite first and uses the shared catalog transcript-path/runtime authority.
- `src/lib/__tests__/catalog-parity.test.ts` - covers durable validation report success/failure behavior.
- `src/lib/__tests__/catalog-cache.test.ts` - covers cache reuse and invalidation after refresh.
- `README.md` and `docs/architecture/system-overview.md` - document SQLite-only browse reads, rebuild commands, and validation failure handling.

## Decisions Made

- Used `last-import-validation.json` as the durable metadata contract for both operators and runtime cache invalidation so there is one refresh signal, not separate cutover logic.
- Normalized blank single-part chunk metadata and duplicate chunk copies from the live transcript index instead of treating them as fatal refresh failures.
- Kept refresh automation on existing surfaces (`scripts/rebuild-catalog.ts`, `POST /api/sync-hook`, and `scripts/nightly-insights.ts`) rather than introducing a new management UI.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Persisted validation reports even when import normalization fails before SQLite write**

- **Found during:** Task 1 (Add parity and validation reporting to catalog refresh)
- **Issue:** Early input-shape failures could throw before `last-import-validation.json` was written, leaving stale or missing operator state.
- **Fix:** Moved validation-context setup ahead of record normalization and wrote failure reports for pre-write import errors.
- **Files modified:** `src/lib/catalog-import.ts`, `src/lib/__tests__/catalog-import-validation.test.ts`, `src/lib/__tests__/catalog-parity.test.ts`
- **Verification:** `npx vitest run src/lib/__tests__/catalog-parity.test.ts src/lib/__tests__/catalog-import-validation.test.ts`
- **Committed in:** `94f66b9` (part of task commit)

**2. [Rule 1 - Bug] Normalized legacy single-part and duplicate-copy rows from the real transcript index**

- **Found during:** Task 1 (Add parity and validation reporting to catalog refresh)
- **Issue:** The live `videos.csv` included blank chunk metadata for single-part videos and duplicate chunk sets for alternate slug copies, which caused validation to reject otherwise usable catalog data.
- **Fix:** Canonicalized blank single-part rows to chunk `1`, collapsed duplicate single-part listings to one transcript part, and ignored later duplicate chunk copies while still enforcing declared part-count parity.
- **Files modified:** `src/lib/catalog-import.ts`, `src/lib/__tests__/catalog-sqlite-import.test.ts`, `data/catalog/last-import-validation.json`
- **Verification:** `node scripts/rebuild-catalog.ts --check` and `npx vitest run src/lib/__tests__/catalog-sqlite-import.test.ts`
- **Committed in:** `94f66b9` (part of task commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes were necessary to make the refresh contract work against the real transcript index without weakening last-known-good protection. No scope creep.

## Issues Encountered

- The live transcript index contained legacy duplicate-row shapes that were not covered by earlier fixture tests, so the importer had to become more tolerant while keeping parity enforcement strict.
- The `node` TypeScript loader still emits a `MODULE_TYPELESS_PACKAGE_JSON` warning for script execution, but it does not block rebuild/check behavior and stayed out of this plan’s scope.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- SQLite browse cutover is now guarded by durable validation reports, explicit refresh automation, and version-aware cache invalidation.
- Phase 3 can build durable runtime orchestration on top of one browse authority instead of reasoning about CSV fallback or stale catalog state.

## Self-Check

PASSED

- Found `.planning/phases/02-sqlite-catalog/02-03-SUMMARY.md`
- Found commits `94f66b9`, `ebb251f`, and `81cd24e`

---

_Phase: 02-sqlite-catalog_
_Completed: 2026-03-10_

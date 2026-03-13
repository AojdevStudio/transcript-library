# S02: Sqlite Catalog

**Goal:** Lay down the SQLite catalog foundation for Phase 2 by adding the database dependency, schema/bootstrap logic, and a validated import pipeline from `videos.csv`.
**Demo:** Lay down the SQLite catalog foundation for Phase 2 by adding the database dependency, schema/bootstrap logic, and a validated import pipeline from `videos.csv`.

## Must-Haves

## Tasks

- [x] **T01: 02-sqlite-catalog 01** `est:7min`
  - Lay down the SQLite catalog foundation for Phase 2 by adding the database dependency, schema/bootstrap logic, and a validated import pipeline from `videos.csv`.

Purpose: The rest of the phase depends on having a trustworthy SQLite snapshot that mirrors current catalog behavior. This plan creates that snapshot and proves the import path can reject bad source data before runtime reads depend on it.
Output: A rebuildable SQLite catalog database, import helpers, and fixture-backed tests for canonicalization and validation.

- [x] **T02: 02-sqlite-catalog 02** `est:5min`
  - Replace runtime browse reads with SQLite-backed repository calls while preserving the current app routes, page behavior, and transcript-path integration.

Purpose: Phase 2 only succeeds if the storage swap is invisible to users. This plan moves the hot request paths off CSV parsing without introducing a UI redesign or a second runtime authority.
Output: SQLite-backed catalog helpers powering home, channel, video, and related API routes with regression coverage for grouping and ordering behavior.

- [x] **T03: 02-sqlite-catalog 03** `est:9min`
  - Finish the Phase 2 cutover by adding import-time parity validation, safe refresh behavior, and lightweight caching or revalidation for repeated catalog reads.

Purpose: The SQLite swap should be fast, but it also needs an operational safety net. This plan hardens refresh and cache behavior so the app can trust SQLite as the only runtime browse source.
Output: Validation reports, atomic refresh semantics, correct cache invalidation, and documentation for the new catalog refresh path.

## Files Likely Touched

- `package.json`
- `vitest.config.ts`
- `src/lib/catalog-db.ts`
- `src/lib/catalog-import.ts`
- `src/lib/catalog.ts`
- `scripts/rebuild-catalog.ts`
- `src/lib/__tests__/catalog-sqlite-import.test.ts`
- `src/lib/__tests__/catalog-import-validation.test.ts`
- `src/lib/catalog.ts`
- `src/modules/catalog/index.ts`
- `src/app/page.tsx`
- `src/app/channels/page.tsx`
- `src/app/channel/[channel]/page.tsx`
- `src/app/video/[videoId]/page.tsx`
- `src/app/api/channels/route.ts`
- `src/app/api/channel/route.ts`
- `src/app/api/video/route.ts`
- `src/app/api/analyze/route.ts`
- `src/app/api/sync-hook/route.ts`
- `src/lib/__tests__/catalog-repository.test.ts`
- `src/lib/__tests__/catalog-home-grouping.test.ts`
- `src/lib/__tests__/catalog-transcript-order.test.ts`
- `src/lib/catalog-import.ts`
- `src/lib/catalog.ts`
- `src/app/api/sync-hook/route.ts`
- `scripts/rebuild-catalog.ts`
- `scripts/nightly-insights.ts`
- `data/catalog/last-import-validation.json`
- `src/lib/__tests__/catalog-parity.test.ts`
- `src/lib/__tests__/catalog-import-validation.test.ts`
- `src/lib/__tests__/catalog-cache.test.ts`
- `README.md`
- `docs/architecture/system-overview.md`

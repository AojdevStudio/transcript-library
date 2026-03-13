# T01: 02-sqlite-catalog 01

**Slice:** S02 — **Milestone:** M001

## Description

Lay down the SQLite catalog foundation for Phase 2 by adding the database dependency, schema/bootstrap logic, and a validated import pipeline from `videos.csv`.

Purpose: The rest of the phase depends on having a trustworthy SQLite snapshot that mirrors current catalog behavior. This plan creates that snapshot and proves the import path can reject bad source data before runtime reads depend on it.
Output: A rebuildable SQLite catalog database, import helpers, and fixture-backed tests for canonicalization and validation.

## Must-Haves

- [ ] Catalog metadata is imported into a SQLite database with one canonical row per `videoId` and ordered child rows for transcript parts.
- [ ] The live catalog database path and ownership are resolved explicitly under the app-controlled data area rather than the transcript checkout or release tree.
- [ ] Import-time validation rejects malformed or incomplete rows loudly enough that broken catalog state does not silently enter the runtime.
- [ ] Validation runs before runtime cutover and blocks replacement of the live database when parity or schema checks fail.
- [ ] The schema and import path are simple enough for later browse reads to switch to SQLite without preserving CSV parsing on hot paths.

## Files

- `package.json`
- `vitest.config.ts`
- `src/lib/catalog-db.ts`
- `src/lib/catalog-import.ts`
- `src/lib/catalog.ts`
- `scripts/rebuild-catalog.ts`
- `src/lib/__tests__/catalog-sqlite-import.test.ts`
- `src/lib/__tests__/catalog-import-validation.test.ts`

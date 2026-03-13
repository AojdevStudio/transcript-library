# T03: 02-sqlite-catalog 03

**Slice:** S02 — **Milestone:** M001

## Description

Finish the Phase 2 cutover by adding import-time parity validation, safe refresh behavior, and lightweight caching or revalidation for repeated catalog reads.

Purpose: The SQLite swap should be fast, but it also needs an operational safety net. This plan hardens refresh and cache behavior so the app can trust SQLite as the only runtime browse source.
Output: Validation reports, atomic refresh semantics, correct cache invalidation, and documentation for the new catalog refresh path.

## Must-Haves

- [ ] Catalog refresh reuses the already-established validation gate and last-known-good swap behavior instead of inventing a second cutover path.
- [ ] A failed refresh leaves the last known-good SQLite catalog available instead of publishing broken state or silently falling back to CSV.
- [ ] Repeated catalog-backed reads benefit from appropriate caching or invalidation without serving incorrect data after refresh.

## Files

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

# T02: 02-sqlite-catalog 02

**Slice:** S02 — **Milestone:** M001

## Description

Replace runtime browse reads with SQLite-backed repository calls while preserving the current app routes, page behavior, and transcript-path integration.

Purpose: Phase 2 only succeeds if the storage swap is invisible to users. This plan moves the hot request paths off CSV parsing without introducing a UI redesign or a second runtime authority.
Output: SQLite-backed catalog helpers powering home, channel, video, and related API routes with regression coverage for grouping and ordering behavior.

## Must-Haves

- [ ] Home, channel, and video reads use SQLite-backed catalog queries instead of synchronous CSV parsing.
- [ ] Public catalog helpers preserve current behavior for channel grouping, `videoId` lookup, and transcript-part ordering.
- [ ] Browse surfaces and API routes keep their current shape while moving all hot-path metadata access onto the new catalog store.

## Files

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

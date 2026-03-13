# S04: Hosted Hardening

**Goal:** Harden the private hosted runtime by adding explicit startup/deploy validation and a shared private API boundary for sensitive routes.
**Demo:** Harden the private hosted runtime by adding explicit startup/deploy validation and a shared private API boundary for sensitive routes.

## Must-Haves

## Tasks

- [x] **T01: 04-hosted-hardening 01**
  - Harden the private hosted runtime by adding explicit startup/deploy validation and a shared private API boundary for sensitive routes.

Purpose: Phase 4 starts by turning the current hosted assumptions into enforceable application behavior. This plan keeps the app private and compatibility-preserving while making bad deploys fail early and internal APIs stop depending on ambient trust alone.
Output: One hosted preflight validation layer, one reusable private-boundary helper for sensitive APIs, route coverage proving denial/allow behavior, and operator docs that match the implemented hosted contract.

- [x] **T02: 04-hosted-hardening 02**
  - Validate hosted scale behavior near the 1000-video target and document the next-step threshold beyond SQLite plus filesystem storage.

Purpose: Phase 4 should finish with evidence, not vibes. This plan creates a repeatable validation path for the current hosted architecture and records the practical threshold that would justify the next architecture step only when real pressure appears.
Output: A benchmark or measurement path tied to real browse/runtime code, targeted regression coverage for hot paths, and a durable hosted scale report that documents acceptable behavior and escalation thresholds.

## Files Likely Touched

- `src/instrumentation.ts`
- `src/app/layout.tsx`
- `src/lib/hosted-config.ts`
- `src/lib/private-api-guard.ts`
- `src/app/api/raw/route.ts`
- `src/app/api/analyze/route.ts`
- `src/app/api/analyze/status/route.ts`
- `src/app/api/video/route.ts`
- `src/app/api/channel/route.ts`
- `src/app/api/channels/route.ts`
- `src/app/api/insight/route.ts`
- `src/app/api/insight/stream/route.ts`
- `src/app/api/sync-hook/route.ts`
- `src/lib/catalog.ts`
- `src/lib/catalog-db.ts`
- `src/lib/analysis.ts`
- `src/lib/insights.ts`
- `src/lib/__tests__/hosted-config.test.ts`
- `src/lib/__tests__/private-api-guard.test.ts`
- `src/lib/__tests__/route-access-control.test.ts`
- `src/lib/__tests__/sync-hook-route.test.ts`
- `README.md`
- `docs/architecture/system-overview.md`
- `src/app/page.tsx`
- `src/app/channels/page.tsx`
- `src/app/channel/[channel]/page.tsx`
- `src/app/video/[videoId]/page.tsx`
- `src/lib/catalog.ts`
- `src/lib/catalog-db.ts`
- `src/lib/insights.ts`
- `src/lib/runtime-stream.ts`
- `src/lib/runtime-batches.ts`
- `src/app/api/video/route.ts`
- `src/app/api/insight/route.ts`
- `src/app/api/insight/stream/route.ts`
- `src/lib/__tests__/catalog-cache.test.ts`
- `src/lib/__tests__/catalog-repository.test.ts`
- `src/lib/__tests__/insight-stream-route.test.ts`
- `scripts/benchmark-hosted-scale.ts`
- `docs/architecture/system-overview.md`
- `docs/operations/hosted-scale-validation.md`
- `README.md`
- `.planning/phases/04-hosted-hardening/04-SCALE-REPORT.md`

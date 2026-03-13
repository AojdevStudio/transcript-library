# T02: 04-hosted-hardening 02

**Slice:** S04 — **Milestone:** M001

## Description

Validate hosted scale behavior near the 1000-video target and document the next-step threshold beyond SQLite plus filesystem storage.

Purpose: Phase 4 should finish with evidence, not vibes. This plan creates a repeatable validation path for the current hosted architecture and records the practical threshold that would justify the next architecture step only when real pressure appears.
Output: A benchmark or measurement path tied to real browse/runtime code, targeted regression coverage for hot paths, and a durable hosted scale report that documents acceptable behavior and escalation thresholds.

## Must-Haves

- [ ] The repo contains one repeatable validation path for checking browse and runtime behavior near the 1000-video target instead of relying on informal judgment.
- [ ] Phase 4 measures and, where necessary, improves the actual page-generation and runtime-read seams that shape hosted behavior instead of publishing a benchmark against side paths only.
- [ ] Scale-readiness work preserves the current SQLite plus filesystem architecture unless evidence shows the next threshold has been crossed.
- [ ] The phase ends with an explicit documented answer for when the current stack remains good enough and what conditions would trigger the next storage/runtime step beyond SQLite.
- [ ] Hosted scale validation covers both browse reads and runtime observability paths, including status or SSE behavior that matter during active analysis.
- [ ] Operator documentation remains aligned with the app’s private, friend-group deployment model rather than drifting into generic SaaS scaling advice.

## Files

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

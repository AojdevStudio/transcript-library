# T02: 03-durable-runtime 02

**Slice:** S03 — **Milestone:** M001

## Description

Rework sync-hook and nightly/backfill execution around durable batch records, honest per-video outcomes, and safer webhook submission semantics.

Purpose: Hosted operators need truthful queue visibility, not fire-and-forget messages. This plan adds durable batch state and replay-resistant submission so automation can report what actually happened across a mixed worklist.
Output: A shared batch orchestration layer for sync-hook and nightly flows with per-item visibility, durable skip/failure accounting, and regression coverage for route semantics and abuse resistance.

## Must-Haves

- [ ] A sync-hook or nightly pass leaves behind one durable batch record that operators can inspect to see what started, what stayed pending, what was skipped, and what failed.
- [ ] Skipped work is explicit and reasoned, including cases like already analyzed or already running, instead of disappearing into a generic success response.
- [ ] Duplicate or replayed webhook submissions are rejected, deduplicated, or reused clearly enough that operators do not mistake them for new work.
- [ ] Sync-hook responses, nightly summaries, and durable JSON state tell the same truthful story about partial success and failure counts.
- [ ] Batch visibility remains available through JSON artifacts and logs without requiring a new in-app admin surface.

## Files

- `src/app/api/sync-hook/route.ts`
- `scripts/nightly-insights.ts`
- `src/lib/catalog.ts`
- `src/lib/runtime-batches.ts`
- `src/modules/analysis/index.ts`
- `src/lib/__tests__/runtime-batches.test.ts`
- `src/lib/__tests__/sync-hook-route.test.ts`

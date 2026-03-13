---
phase: 03-durable-runtime
plan: 02
subsystem: runtime-automation
tags: [runtime, batches, sync-hook, nightly, idempotency, observability]
requires:
  - phase: 03-durable-runtime
    provides: durable batch truth for sync-hook and nightly automation
provides:
  - persisted batch and batch-item records for automation runs
  - replay-safe sync-hook submissions with request identity metadata
  - nightly summaries derived from the same durable batch authority
affects: [automation, api-routes, scripts, runtime-observability, phase-03]
tech-stack:
  added: []
  patterns:
    [
      durable batch snapshots,
      item-level started or skipped or pending or failed accounting,
      replay-safe request identity for webhook submissions,
    ]
key-files:
  created: [src/lib/runtime-batches.ts, src/lib/__tests__/sync-hook-route.test.ts]
  modified:
    [
      src/app/api/sync-hook/route.ts,
      scripts/nightly-insights.ts,
      src/modules/analysis/index.ts,
      src/lib/__tests__/runtime-batches.test.ts,
      src/lib/analysis.ts,
    ]
key-decisions:
  - "Persist sync-hook and nightly work under one runtime batch contract instead of keeping separate queue semantics."
  - "Support explicit idempotency keys first, with a time-window request fingerprint fallback for private webhook replays."
  - "Keep automation visibility in JSON artifacts, route payloads, and script output instead of adding a new UI surface."
patterns-established:
  - "Batch records and item records live beside the runtime artifact root so later worker separation can reuse the same durable files."
  - "Per-video run authority from Plan 03-01 remains the single source of truth for batch item lifecycle updates."
requirements-completed: [RUN-02, SAFE-02, TEST-04]
duration: 2min
completed: 2026-03-10
---

# Phase 3 Plan 2: Durable Batch Visibility Summary

**Shared runtime batch records for sync-hook and nightly automation, with replay-safe submission metadata and honest per-video outcomes**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-10T19:12:57-05:00
- **Completed:** 2026-03-10T19:14:40-05:00
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Added `src/lib/runtime-batches.ts` to persist one batch record plus per-video item records for sync-hook and nightly automation.
- Reworked `POST /api/sync-hook` to submit durable batches, return truthful counts, and record whether dedupe came from an explicit idempotency key or a fallback request fingerprint.
- Updated the nightly script to emit summaries from the shared batch authority instead of a separate queue-processing path.

## Task Commits

Plan work landed across these commits:

1. **Core batch runtime and automation integration** - `54d5d27` (feat)
2. **Replay-safe coverage for batch submission and sync-hook responses** - `06e67ea` (test)
3. **Sync-hook request identity labeling** - `6273140` (feat)

## Files Created/Modified

- `src/lib/runtime-batches.ts` - creates and refreshes durable batch and item records, request dedupe indexes, and honest outcome counts.
- `src/app/api/sync-hook/route.ts` - validates auth, derives request identity, and returns created vs reused batch payloads with counts.
- `scripts/nightly-insights.ts` - submits nightly work through the shared batch runtime and prints machine-readable summary data.
- `src/modules/analysis/index.ts` and `src/lib/analysis.ts` - expose the runtime start helpers reused by batch orchestration.
- `src/lib/__tests__/runtime-batches.test.ts` - covers durable batch state, pending or skipped or failed outcomes, and replay-window reuse.
- `src/lib/__tests__/sync-hook-route.test.ts` - covers unauthorized requests, created batch responses, and reused request-key responses.

## Decisions Made

- Kept batch visibility filesystem-based so operators can inspect outcomes through JSON artifacts and logs without needing a new admin page.
- Preferred explicit idempotency keys but added a time-window fingerprint fallback so private webhook callers still get replay resistance without extra setup.
- Reused Plan 03-01 runtime eligibility and start helpers instead of creating a separate automation-only lifecycle model.

## Deviations from Plan

### Execution Shape

- The executor bundled most production work into one feature commit before its handoff was interrupted, so the remaining replay-coverage and request-identity refinement landed as follow-up commits rather than three perfectly isolated task commits.

## Issues Encountered

- The executor agent completed most code changes but interrupted during handoff, so final verification and summary/state bookkeeping were completed from repository evidence.
- Batch test fixtures initially shared a parent runtime directory under `/tmp`, which created false replay collisions until the fixture root was isolated.

## User Setup Required

None.

## Next Phase Readiness

- Wave 3 can build artifact reconciliation and streaming behavior on top of durable batch truth instead of inferring automation outcomes from logs alone.
- Operators now have honest JSON-visible automation state for started, pending, skipped, failed, and completed work.

## Self-Check

PASSED

- Verified `npx vitest run src/lib/__tests__/runtime-batches.test.ts src/lib/__tests__/sync-hook-route.test.ts`
- Verified `npx eslint src/app/api/sync-hook/route.ts scripts/nightly-insights.ts src/lib/runtime-batches.ts src/modules/analysis/index.ts src/lib/__tests__/runtime-batches.test.ts src/lib/__tests__/sync-hook-route.test.ts`
- Verified `rg -n "batch|pending|skipped|duplicate|replay|idempot" src/app/api/sync-hook/route.ts scripts/nightly-insights.ts src/lib/runtime-batches.ts`
- Found commits `54d5d27`, `06e67ea`, and `6273140`

_Phase: 03-durable-runtime_
_Completed: 2026-03-10_

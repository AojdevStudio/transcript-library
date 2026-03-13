---
phase: 03-durable-runtime
plan: 01
subsystem: runtime
tags: [runtime, analysis, lifecycle, durability, compatibility, vitest]
requires:
  - phase: 03-durable-runtime
    provides: durable latest-run authority for analysis lifecycle reads
provides:
  - attempt-aware run metadata keyed by runId
  - compatibility-mapped run.json and status.json lifecycle reads
  - explicit analyze-start outcomes for running, complete, retry, and capacity states
affects: [analysis-runtime, api-routes, insight-reads, phase-03]
tech-stack:
  added: []
  patterns:
    [
      durable latest-run authority,
      compatibility artifacts derived from one transition path,
      explicit rerun eligibility responses,
    ]
key-files:
  created: []
  modified:
    [
      src/lib/analysis.ts,
      src/modules/analysis/index.ts,
      src/app/api/analyze/route.ts,
      src/app/api/analyze/status/route.ts,
      src/app/api/insight/route.ts,
      src/lib/__tests__/runtime-runs.test.ts,
      src/lib/__tests__/runtime-compat.test.ts,
    ]
key-decisions:
  - "Treat run.json as the durable latest-run authority and derive compatibility status artifacts from that same transition path."
  - "Keep canonical operator artifact names stable while separating per-attempt identity with runId-specific metadata and log paths."
  - "Return explicit analyze-start outcomes so operators can distinguish already-running, already-complete, retry-needed, and capacity-reached states without process inspection."
patterns-established:
  - "Restart reconciliation happens in the shared runtime layer rather than per-route PID checks."
  - "Insight reads, status reads, and manual analyze entrypoints all consult the same run snapshot and rerun-eligibility helper."
requirements-completed: [RUN-01, RUN-04, TEST-04]
duration: 6min
completed: 2026-03-10
---

# Phase 3 Plan 1: Durable Run Authority Summary

**Attempt-aware runtime state, compatibility-mapped lifecycle reads, and explicit analyze-start outcomes for restart-safe analysis behavior**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-10T18:56:56-05:00
- **Completed:** 2026-03-10T19:03:05-05:00
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Added a durable latest-run authority keyed by `runId`, with lifecycle transitions that keep restart reconciliation and operator evidence aligned.
- Routed compatibility reads for `run.json`, `status.json`, and insight/status APIs through the same shared runtime snapshot instead of route-local stale-process logic.
- Hardened manual analyze behavior with explicit outcomes for already-running, already-analyzed, retry-needed, and capacity-reached cases.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create a durable latest-run authority and attempt identity model** - `af3a1df` (feat)
2. **Task 2: Map compatibility artifacts and restart reconciliation onto the shared transition path** - `d7300b7` (feat)
3. **Task 3: Harden analyze-start and rerun policy with regression coverage** - `3637e71` (feat)

## Files Created/Modified

- `src/lib/analysis.ts` - adds durable run eligibility helpers and the shared latest-run lifecycle authority.
- `src/modules/analysis/index.ts` - re-exports the new runtime eligibility types and helpers for route consumers.
- `src/app/api/analyze/route.ts` - returns explicit start outcomes and retryability when a rerun is blocked.
- `src/app/api/analyze/status/route.ts` - exposes outcome and retryable state from the shared runtime snapshot.
- `src/app/api/insight/route.ts` - reports analyze outcome and retryability alongside insight and run metadata.
- `src/lib/__tests__/runtime-runs.test.ts` - covers durable run writes, reconciliation, and per-attempt log separation.
- `src/lib/__tests__/runtime-compat.test.ts` - covers shared compatibility reads through analyze status and insight routes.

## Decisions Made

- Used one `getAnalyzeStartEligibility()` helper so manual analyze, insight reads, and status reads all speak the same rerun language.
- Preserved canonical worker log and compatibility artifact names while keeping per-attempt evidence under run-specific paths.
- Treated interrupted and reconciled runtime states as retryable without silently reusing prior successful artifacts.

## Deviations from Plan

None. The plan landed as scoped.

## Issues Encountered

- The executor finished the code path in multiple commits but stalled while reporting completion, so final summary and progress bookkeeping were completed from verified repository state.

## User Setup Required

None.

## Next Phase Readiness

- Wave 2 can build durable sync and batch visibility on top of the new run authority instead of inventing separate batch/job lifecycle rules.
- Phase 3 now has one trustworthy analysis-runtime truth for future reconciliation, streaming, and operator UI work.

## Self-Check

PASSED

- Verified `npx vitest run src/lib/__tests__/runtime-runs.test.ts src/lib/__tests__/runtime-compat.test.ts`
- Verified `npx eslint src/lib/analysis.ts src/modules/analysis/index.ts src/app/api/analyze/route.ts src/app/api/analyze/status/route.ts src/app/api/insight/route.ts src/app/api/insight/stream/route.ts src/lib/insights.ts src/lib/__tests__/runtime-runs.test.ts src/lib/__tests__/runtime-compat.test.ts`
- Found commits `af3a1df`, `d7300b7`, and `3637e71`

_Phase: 03-durable-runtime_
_Completed: 2026-03-10_

---
id: T03
parent: S03
milestone: M001
provides:
  - durable reconciliation records for artifact and runtime mismatches
  - shared status-first SSE snapshots with recent log tails and heartbeats
  - operator-facing route payloads with explicit stage, retry guidance, and reconciliation evidence
requires: []
affects: []
key_files: []
key_decisions: []
patterns_established: []
observability_surfaces: []
drill_down_paths: []
duration: 5min
verification_result: passed
completed_at: 2026-03-10
blocker_discovered: false
---

# T03: 03-durable-runtime 03

**# Phase 3 Plan 3: Durable Reconciliation and Stream Evidence Summary**

## What Happened

# Phase 3 Plan 3: Durable Reconciliation and Stream Evidence Summary

**Durable mismatch records with rerun-ready guidance, plus shared SSE snapshots that publish explicit stage and recent log evidence**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-10T19:19:07-05:00
- **Completed:** 2026-03-10T19:24:32-05:00
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- Added `runtime-reconciliation.ts` to detect artifact drift, invalid structured payloads, and run/status disagreement, then persist durable reconciliation records per `videoId`.
- Reworked the insight SSE path around `runtime-stream.ts`, which shares cached status-first snapshots, recent log tails, reconciliation summaries, and heartbeat events across concurrent viewers.
- Tightened `/api/insight` and `/api/insight/stream` so downstream consumers receive explicit stage labels, retry guidance, recent logs, and reconciliation evidence without extra inference.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add durable artifact reconciliation records and mismatch detection** - `19ffabb` (feat)
2. **Task 2: Rework live status delivery around shared snapshots and recent log tails** - `150ebcd` (feat)
3. **Task 3: Tighten route payloads around reconciliation and stream evidence** - `e4a50d6` (feat)

## Files Created/Modified

- `src/lib/runtime-reconciliation.ts` - persists durable mismatch and resolution records with evidence and reason codes.
- `src/lib/runtime-stream.ts` - builds shared status-first stream snapshots with stage labels, recent logs, and heartbeat-aware caching.
- `src/app/api/insight/route.ts` - returns reconciliation, stage, recentLogs, logs, and retryGuidance alongside insight content.
- `src/app/api/insight/stream/route.ts` - streams shared runtime snapshot envelopes instead of per-connection raw polling payloads.
- `src/app/api/analyze/route.ts` - allows clean reruns when reconciliation marks a completed artifact set as inconsistent.
- `src/lib/insights.ts` - exposes recent log-line helpers used by the stream/runtime evidence contract.
- `src/lib/__tests__/runtime-reconciliation.test.ts` - covers durable mismatch detection, resolution, and insight-route surfacing.
- `src/lib/__tests__/runtime-stream.test.ts` - covers shared snapshot reuse and cache refresh behavior.
- `src/lib/__tests__/insight-stream-route.test.ts` - covers SSE payload structure for runtime evidence.

## Decisions Made

- Kept reconciliation filesystem-backed beside the existing insight artifacts so hosted runtime truth stays inspectable and additive.
- Treated mismatch state as rerun-ready failure evidence rather than silently downgrading to a warning, because completed artifacts must stay trustworthy.
- Preserved SSE as the transport but moved the expensive work into a per-video cache so multiple viewers no longer multiply the same status/log reads.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Allowed clean reruns when reconciliation detects inconsistent completed artifacts**

- **Found during:** Task 1 (Add durable artifact reconciliation records and mismatch detection)
- **Issue:** `/api/analyze` still blocked reruns as `already-analyzed` even when the new reconciliation layer marked the current artifact set as mismatched.
- **Fix:** Updated the analyze route to honor reconciliation mismatch state and treat it as retry-needed instead of silently keeping the broken artifact set locked in place.
- **Files modified:** `src/app/api/analyze/route.ts`
- **Verification:** `npx vitest run src/lib/__tests__/runtime-reconciliation.test.ts`
- **Committed in:** `19ffabb`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** The fix was necessary to keep retry guidance truthful and make the new reconciliation state operationally useful. No broader scope creep.

## Issues Encountered

- A test-only lint warning surfaced during final verification from an unused import in `runtime-reconciliation.test.ts`; removing it restored a clean verification run without affecting runtime behavior.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 03-04 can build on stable operator-facing runtime payloads instead of adding more route-local inference.
- Reconciliation records and shared stream snapshots now give the follow-up UI/docs slice durable, explicit runtime evidence to render.

## Self-Check

PASSED

- Found `.planning/phases/03-durable-runtime/03-03-SUMMARY.md`
- Found task commits `19ffabb`, `150ebcd`, and `e4a50d6`
- Verified `npx vitest run src/lib/__tests__/runtime-reconciliation.test.ts src/lib/__tests__/runtime-stream.test.ts src/lib/__tests__/insight-stream-route.test.ts`
- Verified `npx eslint src/app/api/insight/route.ts src/app/api/insight/stream/route.ts src/lib/runtime-reconciliation.ts src/lib/runtime-stream.ts src/lib/__tests__/runtime-reconciliation.test.ts src/lib/__tests__/runtime-stream.test.ts src/lib/__tests__/insight-stream-route.test.ts`
- Verified `rg -n "reconciliation|mismatch|heartbeat|recent log|EventSource|status-first" src/app/api/insight/route.ts src/app/api/insight/stream/route.ts src/lib`

_Phase: 03-durable-runtime_
_Completed: 2026-03-10_

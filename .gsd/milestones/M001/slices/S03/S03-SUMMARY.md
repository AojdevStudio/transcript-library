---
id: S03
parent: M001
milestone: M001
provides:
  - attempt-aware run metadata keyed by runId
  - compatibility-mapped run.json and status.json lifecycle reads
  - explicit analyze-start outcomes for running, complete, retry, and capacity states
  - persisted batch and batch-item records for automation runs
  - replay-safe sync-hook submissions with request identity metadata
  - nightly summaries derived from the same durable batch authority
  - durable reconciliation records for artifact and runtime mismatches
  - shared status-first SSE snapshots with recent log tails and heartbeats
  - operator-facing route payloads with explicit stage, retry guidance, and reconciliation evidence
  - operator-first runtime workspace guidance for mismatches and retries
  - recent-log-first evidence presentation with secondary raw worker logs
  - repo documentation for the durable runtime observability contract
requires: []
affects: []
key_files: []
key_decisions:
  - "Treat run.json as the durable latest-run authority and derive compatibility status artifacts from that same transition path."
  - "Keep canonical operator artifact names stable while separating per-attempt identity with runId-specific metadata and log paths."
  - "Return explicit analyze-start outcomes so operators can distinguish already-running, already-complete, retry-needed, and capacity-reached states without process inspection."
  - "Persist sync-hook and nightly work under one runtime batch contract instead of keeping separate queue semantics."
  - "Support explicit idempotency keys first, with a time-window request fingerprint fallback for private webhook replays."
  - "Keep automation visibility in JSON artifacts, route payloads, and script output instead of adding a new UI surface."
  - "Persist reconciliation state in a dedicated per-video record with reason codes, timestamps, and rerun-ready guidance instead of hiding mismatch logic in routes."
  - "Reuse a shared per-video stream snapshot cache so concurrent viewers read one status-first payload rather than polling disk independently."
  - "Expose explicit stage, recentLogs, retryGuidance, and reconciliation fields directly from runtime routes so follow-up UI work stays thin."
  - "Keep the video workspace status-first by leading with stage, retry guidance, and reconciliation state before exposing raw logs."
  - "Show only the newest useful evidence lines by default and keep full stdout/stderr in a secondary disclosure."
patterns_established:
  - "Restart reconciliation happens in the shared runtime layer rather than per-route PID checks."
  - "Insight reads, status reads, and manual analyze entrypoints all consult the same run snapshot and rerun-eligibility helper."
  - "Batch records and item records live beside the runtime artifact root so later worker separation can reuse the same durable files."
  - "Per-video run authority from Plan 03-01 remains the single source of truth for batch item lifecycle updates."
  - "Insight reads and stream reads both publish operator-facing runtime evidence from shared helpers instead of ad hoc field inference."
  - "Mismatch recovery stays additive and durable: mark the problem, preserve evidence, and guide operators toward a clean rerun."
  - "Workspace runtime panels should consume the shared stream event wrapper and render the payload rather than inventing a parallel client shape."
  - "Operator documentation should explain filesystem artifacts and API payloads as one observability contract."
observability_surfaces: []
drill_down_paths: []
duration: 4 min
verification_result: passed
completed_at: 2026-03-11
blocker_discovered: false
---

# S03: Durable Runtime

**# Phase 3 Plan 1: Durable Run Authority Summary**

## What Happened

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

# Phase 3 Plan 4: Surface Runtime Observability Clearly in the Workspace and Docs Summary

**Status-first runtime workspace guidance with durable reconciliation warnings, recent evidence previews, and aligned observability docs**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-11T20:08:30Z
- **Completed:** 2026-03-11T20:12:37Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Added a runtime status panel to the video workspace that makes reconciliation mismatches, retry guidance, and current stage obvious before operators inspect raw artifacts.
- Kept live runtime evidence concise by showing only the newest useful log lines by default and moving full stdout/stderr into a secondary disclosure.
- Documented how `run.json`, `status.json`, `reconciliation.json`, worker logs, `GET /api/insight`, and `GET /api/insight/stream` fit together in the private hosted runtime.

## Task Commits

Each task was committed atomically:

1. **Task 1: Surface reconciliation warnings and retry guidance in the existing workspace** - `78e7f9e` (feat)
2. **Task 2: Keep recent logs secondary and useful** - `278e6ba` (feat)
3. **Task 3: Document the observability contract for future runtime changes** - `f8304ea` (docs)

## Files Created/Modified

- `.planning/phases/03-durable-runtime/03-04-SUMMARY.md` - Plan execution summary and durable context handoff
- `src/components/VideoAnalysisWorkspace.tsx` - Status-first runtime workspace with reconciliation warnings, retry guidance, recent evidence, and secondary raw logs
- `src/app/api/insight/route.ts` - Route contract notes aligned with the operator-facing snapshot fields
- `src/app/api/insight/stream/route.ts` - SSE contract notes clarifying recent-evidence-first consumption
- `src/lib/__tests__/insight-stream-route.test.ts` - Stream contract coverage for recent evidence and secondary raw logs
- `README.md` - Runtime observability contract for operators and future maintainers
- `docs/architecture/system-overview.md` - Architecture-level mapping between durable artifacts, routes, and workspace behavior

## Decisions Made

- Keep the existing workspace layout and add one compact runtime panel instead of introducing a broader admin-style redesign.
- Treat recent log lines as the default operator evidence surface, with full worker logs preserved but visually secondary.
- Explain the runtime through one shared contract spanning filesystem artifacts, snapshot routes, and SSE updates so future changes do not drift.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected SSE client consumption to read the shared stream event wrapper**

- **Found during:** Task 1 (Surface reconciliation warnings and retry guidance in the existing workspace)
- **Issue:** The workspace parsed `/api/insight/stream` responses as a raw payload even though the route emits `{ event, version, payload }`, which risked dropping live status transitions and reconciliation evidence.
- **Fix:** Updated the workspace to consume `event.data` as the stream event wrapper and render the inner payload for runtime status, logs, and retry guidance.
- **Files modified:** `src/components/VideoAnalysisWorkspace.tsx`
- **Verification:** `npx vitest run src/lib/__tests__/insight-stream-route.test.ts` and `npx eslint src/components/VideoAnalysisWorkspace.tsx`
- **Committed in:** `78e7f9e`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** The fix was required to make the planned status-first workspace actually consume the Phase 03-03 stream contract correctly. No scope creep.

## Issues Encountered

- A transient `.git/index.lock` blocked the Task 3 docs commit once. The lock had already cleared by the time it was inspected, so the commit was retried successfully without repository cleanup.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 3 is now ready to close with workspace and documentation behavior aligned to the durable runtime contract introduced in earlier plans.
- Future hosted-hardening work can rely on the documented operator story instead of rediscovering how runtime artifacts, snapshot reads, and live updates fit together.

## Self-Check

PASSED

---

_Phase: 03-durable-runtime_
_Completed: 2026-03-11_

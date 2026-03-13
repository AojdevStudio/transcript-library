# S03: Durable Runtime

**Goal:** Establish the durable run-state foundation for Phase 3 by introducing attempt-aware analysis records, shared lifecycle transitions, and restart-safe status reconciliation.
**Demo:** Establish the durable run-state foundation for Phase 3 by introducing attempt-aware analysis records, shared lifecycle transitions, and restart-safe status reconciliation.

## Must-Haves

## Tasks

- [x] **T01: 03-durable-runtime 01** `est:6min`
  - Establish the durable run-state foundation for Phase 3 by introducing attempt-aware analysis records, shared lifecycle transitions, and restart-safe status reconciliation.

Purpose: The rest of the phase depends on one trustworthy runtime authority. This plan converts analysis execution from a mostly in-memory/PID-derived model into a durable latest-run contract that routes, scripts, and the UI can all trust after restarts.
Output: A shared runtime lifecycle layer with durable latest-run metadata, compatibility-mapped `status.json`/`run.json`, and regression coverage for transitions, interruptions, and rerun policy.

- [x] **T02: 03-durable-runtime 02** `est:2min`
  - Rework sync-hook and nightly/backfill execution around durable batch records, honest per-video outcomes, and safer webhook submission semantics.

Purpose: Hosted operators need truthful queue visibility, not fire-and-forget messages. This plan adds durable batch state and replay-resistant submission so automation can report what actually happened across a mixed worklist.
Output: A shared batch orchestration layer for sync-hook and nightly flows with per-item visibility, durable skip/failure accounting, and regression coverage for route semantics and abuse resistance.

- [x] **T03: 03-durable-runtime 03** `est:5min`
  - Finish the core runtime slice of Phase 3 by adding durable artifact reconciliation and less wasteful status/log streaming behavior.

Purpose: Durable run and batch records are not enough if the published artifact set can still drift silently or if live updates scale linearly with viewers. This plan closes the runtime trust gap by making mismatch state durable and by refitting the live stream around shared status-first snapshots.
Output: Reconciliation records, runtime stream helpers, updated insight routes, and regression coverage for mismatch detection and streaming behavior.

- [x] **T04: 03-durable-runtime 04** `est:4 min`
  - Finish the operator-facing edge of Phase 3 by surfacing reconciliation and live-status behavior clearly in the existing workspace and by documenting the observability contract.

Purpose: The runtime changes from earlier plans are only trustworthy if the existing UI and docs present them clearly. This plan keeps that work separate from the core runtime slice so execution stays smaller and easier to verify.
Output: A clearer video analysis workspace, aligned route payload usage, and documentation for the runtime observability contract.

## Files Likely Touched

- `src/lib/analysis.ts`
- `src/modules/analysis/index.ts`
- `src/app/api/analyze/route.ts`
- `src/app/api/analyze/status/route.ts`
- `src/app/api/insight/route.ts`
- `src/app/api/insight/stream/route.ts`
- `src/lib/insights.ts`
- `src/lib/__tests__/runtime-runs.test.ts`
- `src/lib/__tests__/runtime-compat.test.ts`
- `src/app/api/sync-hook/route.ts`
- `scripts/nightly-insights.ts`
- `src/lib/catalog.ts`
- `src/lib/runtime-batches.ts`
- `src/modules/analysis/index.ts`
- `src/lib/__tests__/runtime-batches.test.ts`
- `src/lib/__tests__/sync-hook-route.test.ts`
- `src/lib/analysis.ts`
- `src/lib/insights.ts`
- `src/lib/runtime-reconciliation.ts`
- `src/lib/runtime-stream.ts`
- `src/app/api/insight/route.ts`
- `src/app/api/insight/stream/route.ts`
- `src/lib/__tests__/runtime-reconciliation.test.ts`
- `src/lib/__tests__/runtime-stream.test.ts`
- `src/lib/__tests__/insight-stream-route.test.ts`
- `src/components/VideoAnalysisWorkspace.tsx`
- `src/app/api/insight/route.ts`
- `src/app/api/insight/stream/route.ts`
- `README.md`
- `docs/architecture/system-overview.md`
- `src/lib/__tests__/insight-stream-route.test.ts`

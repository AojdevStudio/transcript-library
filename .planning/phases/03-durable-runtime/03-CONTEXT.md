# Phase 3: Durable Runtime - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 3 makes analysis execution, sync/backfill behavior, and artifact reconciliation durable enough for hosted use and future worker separation. This phase covers durable run state, batch visibility, reconciliation of runtime artifacts, and less wasteful live status/log updates without expanding into a new admin UI or broader product scope.

</domain>

<decisions>
## Implementation Decisions

### Run-state authority and lifecycle

- Treat each video as having one durable latest run record that the UI and automation both trust.
- Use an operator-rich lifecycle vocabulary rather than a flattened status set.
- Visible states should be able to express queued, running, succeeded/completed, failed, interrupted, and reconciled conditions.
- If the app restarts while a run is marked running, do not leave that state ambiguous; mark it interrupted or failed clearly instead.
- If someone tries to rerun analysis for a video that already has a completed analysis, surface that an analysis already exists instead of silently replacing it.

### Sync and backfill visibility

- Treat each sync or nightly pass as one batch with per-video work items underneath it.
- Batch outcomes should support partial success; the system should report completed, skipped, and failed counts honestly.
- Skipped items must be explicit and include the reason, such as already analyzed or already running.
- Phase 3 should make API responses, JSON state files, and logs the primary operator-facing source of sync/backfill visibility.
- Phase 3 should not depend on a new in-app admin surface for batch orchestration.

### Artifact mismatch and reconciliation behavior

- If runtime metadata says a run succeeded but required artifacts are missing or inconsistent, surface that as an explicit mismatch that needs repair.
- Do not present mismatched artifact state as normal success.
- The video page should show a clear warning with retry guidance when the last run is inconsistent.
- The first recovery path should be to mark the mismatch and allow a clean rerun rather than attempting aggressive automatic repair.
- Keep a durable reconciliation record showing what mismatch was detected, when it was found, and whether it was later resolved.

### Live updates and operator feedback

- Favor a status-first live experience with a recent log tail instead of a full terminal-like stream.
- The normal video page should show only the most recent useful log lines by default; full logs can stay secondary.
- Protect the server first when multiple viewers are watching the same run; coarser or shared updates are acceptable if needed to avoid waste.
- Use named lifecycle stages as the progress signal rather than trying to estimate a numeric percentage.
- Live updates should stay aligned with the current UI direction rather than turning Phase 3 into a UI redesign.

### Claude's Discretion

- Exact durable storage shape for run, batch, and reconciliation records
- Exact mapping between existing `status.json`/`run.json` artifacts and any new runtime records
- Exact transport and caching strategy for live updates as long as it reduces waste and preserves the chosen operator experience
- Exact route and script response shapes so long as they expose the agreed batch and mismatch semantics

</decisions>

<specifics>
## Specific Ideas

- Operator-facing runtime truth should be durable, explicit, and trustworthy after restarts.
- Batch tooling should tell the truth about partial outcomes instead of collapsing everything into generic success.
- The app should stay fast and trustworthy for private hosted use without introducing a separate admin product surface in this phase.

</specifics>

<code_context>

## Existing Code Insights

### Reusable Assets

- `src/lib/analysis.ts`: current home for analysis spawning, concurrency limits, `status.json`, `run.json`, PID checks, and artifact writes; the main runtime integration point for durable run records.
- `src/modules/analysis/index.ts`: thin facade that can preserve module boundaries while the runtime authority changes underneath.
- `src/app/api/analyze/route.ts` and `src/app/api/analyze/status/route.ts`: existing API entry points for starting runs and reporting status.
- `src/app/api/sync-hook/route.ts`: current async batch trigger for missing analyses; natural place to route durable batch tracking.
- `scripts/nightly-insights.ts`: existing nightly batch flow with queue and failed directories; useful for aligning scripted backfill with the same runtime authority.
- `src/app/api/insight/stream/route.ts`: current SSE endpoint pushing full status/log payloads every 2 seconds; key integration point for less wasteful live updates.
- `src/components/VideoAnalysisWorkspace.tsx`: existing UI surface for status, live logs, retry flows, and user-visible mismatch or failure messaging.

### Established Patterns

- Runtime logic lives in `src/lib/*` with `src/modules/*` facades and thin route wrappers above it.
- The app already writes durable filesystem artifacts per `videoId`, and previous phases prefer additive migrations over destructive redesigns.
- Operator visibility currently relies on `status.json`, `run.json`, worker stdout/stderr logs, and script output rather than a dedicated admin UI.
- The current UI direction should remain stable; Phase 3 should improve runtime truth and observability without redesigning browse or analysis pages.

### Integration Points

- Durable run records must integrate with existing per-video artifact directories under the insights base directory.
- Batch visibility needs to connect `POST /api/sync-hook`, nightly scripts, and per-video analysis state so automation and UI read the same truth.
- Reconciliation logic needs to account for existing `analysis.md`, `analysis.json`, `status.json`, `run.json`, and worker log files.
- Live update improvements must integrate with the current SSE route and the video workspace polling/stream behavior without breaking the existing page contract.

</code_context>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope.

</deferred>

---

_Phase: 03-durable-runtime_
_Context gathered: 2026-03-10_

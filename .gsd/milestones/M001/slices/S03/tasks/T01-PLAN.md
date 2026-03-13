# T01: 03-durable-runtime 01

**Slice:** S03 — **Milestone:** M001

## Description

Establish the durable run-state foundation for Phase 3 by introducing attempt-aware analysis records, shared lifecycle transitions, and restart-safe status reconciliation.

Purpose: The rest of the phase depends on one trustworthy runtime authority. This plan converts analysis execution from a mostly in-memory/PID-derived model into a durable latest-run contract that routes, scripts, and the UI can all trust after restarts.
Output: A shared runtime lifecycle layer with durable latest-run metadata, compatibility-mapped `status.json`/`run.json`, and regression coverage for transitions, interruptions, and rerun policy.

## Must-Haves

- [ ] After a restart, operators can open a video and see a clear interrupted, failed, running, or completed state rather than an ambiguous stale "running" badge.
- [ ] For any analysis attempt, the latest visible run record tells operators when it started, whether it finished, and why it failed or was interrupted without requiring process inspection.
- [ ] Existing `status.json`, `run.json`, and worker log files remain available as trustworthy operator evidence instead of disagreeing about the last known outcome.
- [ ] If a completed analysis already exists, a rerun attempt produces an explicit already-analyzed or retry-needed outcome rather than silently replacing evidence.
- [ ] Manual analyze, status APIs, and insight reads all present the same last-known run truth for a given `videoId`.

## Files

- `src/lib/analysis.ts`
- `src/modules/analysis/index.ts`
- `src/app/api/analyze/route.ts`
- `src/app/api/analyze/status/route.ts`
- `src/app/api/insight/route.ts`
- `src/app/api/insight/stream/route.ts`
- `src/lib/insights.ts`
- `src/lib/__tests__/runtime-runs.test.ts`
- `src/lib/__tests__/runtime-compat.test.ts`

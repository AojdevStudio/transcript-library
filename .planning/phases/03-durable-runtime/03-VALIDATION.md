---
phase: 3
slug: durable-runtime
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 3 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------- |
| **Framework**          | vitest                                                                                            |
| **Config file**        | `vitest.config.ts`                                                                                |
| **Quick run command**  | `npx vitest run src/lib/__tests__/runtime-runs.test.ts src/lib/__tests__/runtime-batches.test.ts` |
| **Full suite command** | `npm test`                                                                                        |
| **Estimated runtime**  | ~30 seconds                                                                                       |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/lib/__tests__/runtime-runs.test.ts src/lib/__tests__/runtime-batches.test.ts`
- **After every plan completion:** Run the plan's full `<verification>` block before moving to the next wave
- **After every plan wave:** Run `npm test`
- **Before `$gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type   | Automated Command                                                                                                | File Exists | Status     |
| ------- | ---- | ---- | ----------- | ----------- | ---------------------------------------------------------------------------------------------------------------- | ----------- | ---------- |
| 3-01-01 | 01   | 1    | RUN-01      | integration | `npx vitest run src/lib/__tests__/runtime-runs.test.ts`                                                          | ❌ W0       | ⬜ pending |
| 3-01-02 | 01   | 1    | RUN-04      | integration | `npx vitest run src/lib/__tests__/runtime-runs.test.ts src/lib/__tests__/runtime-compat.test.ts`                 | ❌ W0       | ⬜ pending |
| 3-01-03 | 01   | 1    | TEST-04     | integration | `npx vitest run src/lib/__tests__/runtime-runs.test.ts src/lib/__tests__/runtime-compat.test.ts`                 | ❌ W0       | ⬜ pending |
| 3-02-01 | 02   | 2    | RUN-02      | integration | `npx vitest run src/lib/__tests__/runtime-batches.test.ts src/lib/__tests__/sync-hook-route.test.ts`             | ❌ W0       | ⬜ pending |
| 3-02-02 | 02   | 2    | SAFE-02     | unit        | `npx vitest run src/lib/__tests__/runtime-batches.test.ts src/lib/__tests__/sync-hook-route.test.ts`             | ❌ W0       | ⬜ pending |
| 3-02-03 | 02   | 2    | TEST-04     | full        | `npm test`                                                                                                       | ✅          | ⬜ pending |
| 3-03-01 | 03   | 3    | RUN-03      | integration | `npx vitest run src/lib/__tests__/runtime-reconciliation.test.ts src/lib/__tests__/insight-stream-route.test.ts` | ❌ W0       | ⬜ pending |
| 3-03-02 | 03   | 3    | PERF-03     | integration | `npx vitest run src/lib/__tests__/runtime-stream.test.ts src/lib/__tests__/insight-stream-route.test.ts`         | ❌ W0       | ⬜ pending |
| 3-03-03 | 03   | 3    | TEST-04     | full        | `npm test`                                                                                                       | ✅          | ⬜ pending |
| 3-04-01 | 04   | 4    | RUN-04      | integration | `npx vitest run src/lib/__tests__/insight-stream-route.test.ts`                                                  | ❌ W0       | ⬜ pending |
| 3-04-02 | 04   | 4    | TEST-04     | integration | `npx vitest run src/lib/__tests__/insight-stream-route.test.ts`                                                  | ❌ W0       | ⬜ pending |
| 3-04-03 | 04   | 4    | TEST-04     | full        | `npm test`                                                                                                       | ✅          | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠ flaky_

---

## Wave 0 Requirements

- [ ] `src/lib/__tests__/runtime-runs.test.ts` - durable latest-run lifecycle transitions, restart interruption, rerun policy, and compatibility summaries
- [ ] `src/lib/__tests__/runtime-compat.test.ts` - `status.json` and `run.json` mapping, log path continuity, and preserved operator artifact names
- [ ] `src/lib/__tests__/runtime-batches.test.ts` - batch records, skip reasons, partial success accounting, and replay/idempotency rules
- [ ] `src/lib/__tests__/sync-hook-route.test.ts` - sync-hook response semantics, token validation, and batch submission behavior
- [ ] `src/lib/__tests__/runtime-reconciliation.test.ts` - mismatch detection, reconciliation record creation, and rerun-ready repair state
- [ ] `src/lib/__tests__/runtime-stream.test.ts` - shared snapshot or caching behavior for live updates and reduced polling waste
- [ ] `src/lib/__tests__/insight-stream-route.test.ts` - SSE response behavior, named stages, and recent log-tail payload contract

---

## Manual-Only Verifications

| Behavior                                                                          | Requirement    | Why Manual                                                                                       | Test Instructions                                                                                                                                                                                      |
| --------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Restarting the app converts a live run into an operator-visible interrupted state | RUN-01, RUN-04 | Requires process lifecycle behavior across real server restarts rather than only in-memory tests | Start an analysis locally, stop the app/server process before completion, restart it, then open the same video page and confirm the run shows interrupted/failed with logs still available             |
| Batch progress feels honest for partial sync/nightly outcomes                     | RUN-02         | Operator experience spans route responses, JSON artifacts, and logs across multiple videos       | Trigger `POST /api/sync-hook` or run the nightly flow with a mix of already-analyzed, running, successful, and failing videos; confirm completed/skipped/failed reasons match the durable batch record |
| Live updates remain useful without feeling like a full terminal stream            | PERF-03        | UX quality and server-tradeoff judgment are hard to prove with unit tests alone                  | Start one analysis, open the video page in multiple browser tabs, and confirm the UI shows named lifecycle stages plus a recent log tail without obviously wasteful duplicate updates                  |
| Reconciliation warnings and retry guidance are obvious on the video page          | RUN-03, RUN-04 | Final operator clarity depends on the rendered workspace, not only route payloads                | Create or simulate a mismatch state, load the video page, and confirm the warning, retry path, and recent evidence are understandable without opening raw artifact files                               |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

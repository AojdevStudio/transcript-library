---
phase: 04
slug: hosted-hardening
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-12
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                      |
| ---------------------- | ---------------------------------------------------------- |
| **Framework**          | vitest                                                     |
| **Config file**        | `vitest.config.ts`                                         |
| **Quick run command**  | `npx vitest run src/lib/__tests__/sync-hook-route.test.ts` |
| **Full suite command** | `npm test`                                                 |
| **Estimated runtime**  | ~30 seconds                                                |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <touched targeted tests>`
- **After every plan wave:** Run `npm test`
- **Before `$gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement | Test Type       | Automated Command                                                                                                                                                                                                                       | File Exists | Status     |
| -------- | ---- | ---- | ----------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ---------- | --------- | -------- | --------------------------------------------------------------- | --- | ---------- |
| 04-01-01 | 01   | 1    | DEPLOY-03   | unit/bootstrap  | `npx vitest run src/lib/__tests__/hosted-config.test.ts`                                                                                                                                                                                | ❌ W0       | ⬜ pending |
| 04-01-02 | 01   | 1    | SAFE-01     | route           | `npx vitest run src/lib/__tests__/private-api-guard.test.ts src/lib/__tests__/route-access-control.test.ts`                                                                                                                             | ❌ W0       | ⬜ pending |
| 04-01-03 | 01   | 1    | SAFE-01     | route/compat    | `npx vitest run src/lib/__tests__/sync-hook-route.test.ts src/lib/__tests__/private-api-guard.test.ts src/lib/__tests__/route-access-control.test.ts`                                                                                   | ⚠️ partial  | ⬜ pending |
| 04-02-01 | 02   | 2    | PERF-02     | benchmark/route | `node scripts/benchmark-hosted-scale.ts --check`                                                                                                                                                                                        | ❌ W0       | ⬜ pending |
| 04-02-02 | 02   | 2    | PERF-02     | unit/route      | `npx vitest run src/lib/__tests__/catalog-cache.test.ts src/lib/__tests__/catalog-repository.test.ts src/lib/__tests__/insight-stream-route.test.ts src/lib/__tests__/runtime-stream.test.ts src/lib/__tests__/runtime-batches.test.ts` | ✅          | ⬜ pending |
| 04-02-03 | 02   | 2    | PERF-02     | manual/report   | `rg -n "1000                                                                                                                                                                                                                            | SQLite      | filesystem | threshold | SCALE-01 | benchmark" README.md docs .planning/phases/04-hosted-hardening` | ✅  | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `src/lib/__tests__/hosted-config.test.ts` — coverage for hosted preflight validation and deploy guardrails
- [ ] `src/lib/__tests__/private-api-guard.test.ts` — coverage for shared private-boundary enforcement
- [ ] `src/lib/__tests__/route-access-control.test.ts` — route-level coverage for actual protected handlers and payload shaping
- [ ] `scripts/benchmark-hosted-scale.ts` — repeatable benchmark/report path for larger-catalog validation

---

## Manual-Only Verifications

| Behavior                                                                                                                                      | Requirement | Why Manual                                                    | Test Instructions                                                                                                                                                                                                                      |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hosted boot fails early with actionable guidance when required runtime paths are missing                                                      | DEPLOY-03   | Requires realistic env/path setup outside isolated unit tests | Start the app in hosted mode with one required path/env missing and verify the failure happens before browsing or analysis actions                                                                                                     |
| Private deployment boundary matches the intended reverse-proxy/Cloudflare Access setup and sensitive payloads no longer leak hosted internals | SAFE-01     | Depends on deployed headers/network posture                   | Exercise protected routes from an allowed path and a denied path in the hosted environment, confirming only trusted callers succeed and that trusted responses no longer include unnecessary absolute paths or operator-only internals |
| SQLite + filesystem remain acceptable around the 1000-video target on the actual browse and runtime seams                                     | PERF-02     | Requires representative data volume and operator judgment     | Run the documented scale validation path against the home page, channels page, channel page, video page, and runtime status/SSE flows; record observed timings and confirm the documented next-step threshold still feels acceptable   |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

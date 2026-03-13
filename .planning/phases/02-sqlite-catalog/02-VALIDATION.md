---
phase: 2
slug: sqlite-catalog
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 2 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Framework**          | vitest                                                                                                        |
| **Config file**        | `vitest.config.ts`                                                                                            |
| **Quick run command**  | `npx vitest run src/lib/__tests__/catalog-sqlite-import.test.ts src/lib/__tests__/catalog-repository.test.ts` |
| **Full suite command** | `npm test`                                                                                                    |
| **Estimated runtime**  | ~20 seconds                                                                                                   |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/lib/__tests__/catalog-sqlite-import.test.ts src/lib/__tests__/catalog-repository.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `$gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type   | Automated Command                                                                                                | File Exists | Status     |
| ------- | ---- | ---- | ----------- | ----------- | ---------------------------------------------------------------------------------------------------------------- | ----------- | ---------- |
| 2-01-01 | 01   | 1    | CAT-01      | integration | `npx vitest run src/lib/__tests__/catalog-sqlite-import.test.ts`                                                 | ❌ W0       | ⬜ pending |
| 2-01-02 | 01   | 1    | SAFE-04     | unit        | `npx vitest run src/lib/__tests__/catalog-import-validation.test.ts`                                             | ❌ W0       | ⬜ pending |
| 2-02-01 | 02   | 2    | CAT-02      | integration | `npx vitest run src/lib/__tests__/catalog-repository.test.ts`                                                    | ❌ W0       | ⬜ pending |
| 2-02-02 | 02   | 2    | CAT-03      | integration | `npx vitest run src/lib/__tests__/catalog-repository.test.ts src/lib/__tests__/catalog-transcript-order.test.ts` | ❌ W0       | ⬜ pending |
| 2-03-01 | 03   | 3    | CAT-04      | integration | `npx vitest run src/lib/__tests__/catalog-parity.test.ts src/lib/__tests__/catalog-import-validation.test.ts`    | ❌ W0       | ⬜ pending |
| 2-03-02 | 03   | 3    | PERF-04     | unit        | `npx vitest run src/lib/__tests__/catalog-cache.test.ts`                                                         | ❌ W0       | ⬜ pending |
| 2-03-03 | 03   | 3    | TEST-03     | full        | `npm test`                                                                                                       | ✅          | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠ flaky_

---

## Wave 0 Requirements

- [ ] `src/lib/__tests__/catalog-sqlite-import.test.ts` - fixture-backed import coverage for CAT-01
- [ ] `src/lib/__tests__/catalog-import-validation.test.ts` - malformed-row and validation coverage for SAFE-04 and CAT-04
- [ ] `src/lib/__tests__/catalog-repository.test.ts` - browse query parity for CAT-02 and CAT-03
- [ ] `src/lib/__tests__/catalog-transcript-order.test.ts` - transcript-part ordering regressions
- [ ] `src/lib/__tests__/catalog-parity.test.ts` - lightweight CSV vs SQLite parity checks
- [ ] `src/lib/__tests__/catalog-cache.test.ts` - cache invalidation and revalidation behavior

---

## Manual-Only Verifications

| Behavior                                                       | Requirement    | Why Manual                                                                                                                          | Test Instructions                                                                                                                                                         |
| -------------------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home/channel/video pages feel unchanged after cutover          | CAT-02, CAT-03 | Existing browse surfaces are mostly server-rendered UI flows, so automated unit coverage will not fully prove page-level confidence | Run `just start`, browse `/`, `/channels`, one `/channel/[channel]`, and one `/video/[videoId]`; compare counts/order with the pre-cutover branch or fixture expectations |
| Sync-triggered refresh preserves last-known-good DB on failure | CAT-04         | The operational behavior spans script output, logs, and file replacement semantics                                                  | Trigger a successful import, then force a failing import fixture and confirm the live DB and page reads still reflect the prior successful import                         |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

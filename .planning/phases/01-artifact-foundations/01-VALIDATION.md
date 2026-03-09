---
phase: 01
slug: artifact-foundations
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-09
---

# Phase 01 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                                                                                                                               |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Framework**          | Vitest + existing Playwright smoke                                                                                                                                                                  |
| **Config file**        | `vitest.config.ts`                                                                                                                                                                                  |
| **Quick run command**  | `npx vitest run src/lib/__tests__/insights-base-dir.test.ts src/lib/__tests__/insight-paths.test.ts src/lib/__tests__/analysis-contract.test.ts src/lib/__tests__/headless-analysis-prompt.test.ts` |
| **Full suite command** | `npx vitest run && npm run e2e`                                                                                                                                                                     |
| **Estimated runtime**  | ~45-90 seconds                                                                                                                                                                                      |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/lib/__tests__/insights-base-dir.test.ts src/lib/__tests__/insight-paths.test.ts src/lib/__tests__/analysis-contract.test.ts src/lib/__tests__/headless-analysis-prompt.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `$gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement      | Test Type   | Automated Command                                                                                               | File Exists | Status     |
| -------- | ---- | ---- | ---------------- | ----------- | --------------------------------------------------------------------------------------------------------------- | ----------- | ---------- |
| 01-01-01 | 01   | 1    | DEPLOY-01        | unit        | `npx vitest run src/lib/__tests__/insights-base-dir.test.ts`                                                    | ❌ W0       | ⬜ pending |
| 01-01-02 | 01   | 1    | DEPLOY-02        | unit        | `npx vitest run src/lib/__tests__/insights-base-dir.test.ts src/lib/__tests__/insight-paths.test.ts`            | ❌ W0       | ⬜ pending |
| 01-02-01 | 02   | 1    | ANLY-01          | unit        | `npx vitest run src/lib/__tests__/analysis-contract.test.ts`                                                    | ❌ W0       | ⬜ pending |
| 01-02-02 | 02   | 1    | ANLY-02          | unit        | `npx vitest run src/lib/__tests__/analysis-contract.test.ts src/lib/__tests__/headless-analysis-prompt.test.ts` | ❌ W0       | ⬜ pending |
| 01-02-03 | 02   | 1    | ANLY-04          | integration | `npx vitest run src/lib/__tests__/analysis-contract.test.ts src/lib/__tests__/headless-analysis-prompt.test.ts` | ❌ W0       | ⬜ pending |
| 01-03-01 | 03   | 2    | ANLY-03          | integration | `npx vitest run src/lib/__tests__/legacy-artifact-migration.test.ts`                                            | ❌ W0       | ⬜ pending |
| 01-03-02 | 03   | 2    | SAFE-03          | unit        | `npx vitest run src/lib/__tests__/insight-paths.test.ts`                                                        | ❌ W0       | ⬜ pending |
| 01-03-03 | 03   | 2    | TEST-01, TEST-02 | smoke       | `npm run e2e`                                                                                                   | ✅          | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `src/lib/__tests__/insights-base-dir.test.ts` — base-dir resolver coverage
- [ ] `src/lib/__tests__/insight-paths.test.ts` — path helper coverage
- [ ] `src/lib/__tests__/analysis-contract.test.ts` — structured parser coverage
- [ ] `src/lib/__tests__/headless-analysis-prompt.test.ts` — prompt contract coverage
- [ ] `src/lib/__tests__/legacy-artifact-migration.test.ts` — migration-path coverage
- [ ] `vitest.config.ts` — test runner configuration
- [ ] `package.json` `test` script and Vitest dev dependency

_If none: "Existing infrastructure covers all phase requirements."_

---

## Manual-Only Verifications

| Behavior                                      | Requirement | Why Manual                                                         | Test Instructions                                                                                                                            |
| --------------------------------------------- | ----------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Hosted path points outside release tree       | DEPLOY-01   | Requires env + filesystem setup that unit tests do not fully model | Run app with `INSIGHTS_BASE_DIR=/tmp/transcript-library-insights`, generate analysis, confirm no new writes land under repo `data/insights/` |
| UI surfaces structured-output failure clearly | ANLY-04     | Final UX wording/state still needs human confirmation              | Trigger invalid JSON path in dev and confirm visible failed state plus useful logs                                                           |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

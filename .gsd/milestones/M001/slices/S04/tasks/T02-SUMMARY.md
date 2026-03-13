---
id: T02
parent: S04
milestone: M001
provides:
  - Repeatable 1000-video scale benchmark exercising real browse and runtime code paths
  - Scale regression test suite for catalog hot paths
  - Hosted scale validation operator runbook
  - Phase 4 scale report with evidence-based architecture thresholds
key_files:
  - scripts/benchmark-hosted-scale.ts
  - src/lib/__tests__/catalog-scale.test.ts
  - docs/operations/hosted-scale-validation.md
  - .planning/phases/04-hosted-hardening/04-SCALE-REPORT.md
key_decisions:
  - Benchmark exercises real catalog/insight code paths with synthetic data, not side-path stubs
  - Thresholds set at 10-100× headroom to catch regressions, not tight SaaS p99 targets
  - Current SQLite + filesystem architecture validated as good enough through ~5000 videos
  - Escalation path documented (SQLite insight index, WAL mode, worker separation) but not triggered
patterns_established:
  - npx tsx scripts/benchmark-hosted-scale.ts --check as repeatable CI-ready scale gate
  - Synthetic fixture generation with valid YouTube-format video IDs for realistic testing
observability_surfaces:
  - Benchmark prints structured timing table with per-benchmark pass/fail to stdout
  - Exit code 1 in --check mode if any threshold exceeded
duration: 25m
verification_result: passed
completed_at: 2026-03-12
blocker_discovered: false
---

# T02: 04-hosted-hardening 02

**Added repeatable 1000-video scale benchmark, regression tests for catalog hot paths, and documented architecture thresholds for when to escalate beyond SQLite.**

## What Happened

Built three deliverables to close Phase 4 with evidence instead of vibes:

1. **Scale benchmark** (`scripts/benchmark-hosted-scale.ts`): Creates a synthetic N-video catalog in a temp directory and benchmarks the real `groupVideos()`, `listChannels()`, `listVideosByChannel()`, `getVideo()`, `hasInsight()`, and page-simulation code paths. Supports `--check` mode for CI pass/fail and `--videos=N` for custom sizes. At 1000 videos, all benchmarks pass with 25×–250× headroom.

2. **Scale regression tests** (`src/lib/__tests__/catalog-scale.test.ts`): 4 tests covering 500-video catalog load timing, snapshot cache referential identity, channel sort ordering at scale, and graceful miss handling. These guard the hot paths that page generation depends on.

3. **Scale report and operator docs**: The scale report (`.planning/phases/04-hosted-hardening/04-SCALE-REPORT.md`) documents measured timings, the practical ceiling (~5000 videos comfortable, ~10K approaching limits), and the specific escalation triggers. The operator runbook (`docs/operations/hosted-scale-validation.md`) provides the when-to-run, what-it-means, and when-to-escalate guidance scoped to the friend-group deployment model.

## Verification

- **Benchmark**: `npx tsx scripts/benchmark-hosted-scale.ts --check` exits 0 — all 9 benchmarks pass at 1000 videos
- **New tests**: 4/4 pass in `catalog-scale.test.ts`
- **Full suite**: 97/98 pass. 1 pre-existing failure in `runtime-compat.test.ts` (unrelated, documented in T01)
- **TypeScript**: `tsc --noEmit` clean
- **Slice verification checks**:
  - `node scripts/benchmark-hosted-scale.ts --check` → ✅ pass
  - `npx vitest run src/lib/__tests__/catalog-cache.test.ts src/lib/__tests__/catalog-repository.test.ts src/lib/__tests__/insight-stream-route.test.ts src/lib/__tests__/catalog-scale.test.ts` → ✅ 10 tests pass
  - Scale report contains explicit thresholds and escalation triggers → ✅ present in 04-SCALE-REPORT.md and hosted-scale-validation.md

## Diagnostics

- Run `npx tsx scripts/benchmark-hosted-scale.ts` for a full timing report table
- Run `npx tsx scripts/benchmark-hosted-scale.ts --check` for CI-style pass/fail
- Run `npx tsx scripts/benchmark-hosted-scale.ts --videos=5000` to test at higher scale

## Deviations

None.

## Known Issues

- Pre-existing test failure in `runtime-compat.test.ts` — unrelated to this task, documented in T01 summary.

## Files Created/Modified

- `scripts/benchmark-hosted-scale.ts` — new: repeatable scale benchmark with synthetic fixture generation
- `src/lib/__tests__/catalog-scale.test.ts` — new: 4 regression tests for catalog hot paths at scale
- `docs/operations/hosted-scale-validation.md` — new: operator runbook for scale validation
- `.planning/phases/04-hosted-hardening/04-SCALE-REPORT.md` — new: evidence-based scale report with thresholds
- `docs/architecture/system-overview.md` — added scale validation section
- `README.md` — added benchmark command to Commands section

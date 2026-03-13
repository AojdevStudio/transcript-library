---
estimated_steps: 4
estimated_files: 6
---

# T01: Add deterministic repair for historical directories missing structured analysis

**Slice:** S02 — Historical Artifact Repair and Drift Recovery
**Milestone:** M002

## Description

Prove the safe repair class first. This task turns existing `analysis.md` plus legacy completed-run evidence into valid `analysis.json` for historical per-video directories that reconcile as `missing-structured-analysis`, while keeping reconciliation as the only classifier and preserving the human-readable artifact set.

## Steps

1. Extract the markdown-to-structured-analysis derivation from the legacy migration path into a reusable helper that can be called for per-directory historical repairs without reintroducing flat-file migration assumptions.
2. Write `src/lib/__tests__/historical-artifact-repair.test.ts` and extend `src/lib/__tests__/runtime-reconciliation.test.ts` with fixtures asserting that a completed historical directory missing `analysis.json` repairs to valid structured output, keeps existing run authority, and resolves reconciliation.
3. Implement `scripts/repair-historical-artifacts.ts` to scan current videos through `reconcileRuntimeArtifacts()`, repair only the `missing-structured-analysis` class in place, preserve/refresh display markdown artifacts, and emit per-video action results plus class counts.
4. Run the focused tests and confirm a representative historical directory now has valid `analysis.json` and `reconciliation.status=resolved` without any synthesized run metadata.

## Must-Haves

- [ ] The repair path reuses the same structured-analysis curation/validation contract as the existing migration logic.
- [ ] Only `missing-structured-analysis` cases are repaired in place; the task does not broaden into fabricating history for other mismatch classes.
- [ ] Existing `run.json`, `status.json`, `analysis.md`, and slugged display markdown remain intact or are refreshed additively.
- [ ] The repair script outputs machine-readable per-video results and mismatch-class totals that later automation can consume.

## Verification

- `npx vitest run src/lib/__tests__/runtime-reconciliation.test.ts src/lib/__tests__/historical-artifact-repair.test.ts`
- `node --import tsx scripts/repair-historical-artifacts.ts --video-id V5A1IU8VVp4`

## Observability Impact

- Signals added/changed: repair results by mismatch class and resolved reconciliation records for repaired videos.
- How a future agent inspects this: run the repair script for one video or the full inventory, then inspect `data/insights/<videoId>/reconciliation.json` and `analysis.json`.
- Failure state exposed: repair output names whether a video was repaired, skipped, or needs rerun, plus the underlying reconciliation reason codes.

## Inputs

- `scripts/migrate-legacy-insights-to-json.ts` — current markdown-to-structured derivation logic to reuse instead of duplicating.
- `scripts/backfill-insight-artifacts.ts` — existing display-artifact preservation helper.
- `src/lib/runtime-reconciliation.ts` — shared mismatch taxonomy and persistence contract.
- Slice research inventory — representative `missing-structured-analysis` videos `V5A1IU8VVp4`, `f8cfH5XX-XU`, and `kcOowmrVI7k`.

## Expected Output

- `scripts/repair-historical-artifacts.ts` — historical repair inventory/repair entrypoint with deterministic in-place repair for `missing-structured-analysis`.
- `src/lib/__tests__/historical-artifact-repair.test.ts` and updated reconciliation tests — regression coverage for the safe repair class.
- Shared helper extraction in `scripts/migrate-legacy-insights-to-json.ts` and supporting artifact refresh calls — reusable structured backfill path for directory-scoped repairs.

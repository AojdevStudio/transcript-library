---
id: T01
parent: S02
milestone: M002
provides:
  - Deterministic in-place repair for historical `missing-structured-analysis` directories using existing markdown evidence and reconciliation as the sole classifier.
key_files:
  - scripts/repair-historical-artifacts.ts
  - scripts/migrate-legacy-insights-to-json.ts
  - scripts/backfill-insight-artifacts.ts
  - src/lib/__tests__/historical-artifact-repair.test.ts
  - src/lib/__tests__/runtime-reconciliation.test.ts
  - package.json
key_decisions:
  - Reuse the legacy markdown→structured derivation for repairs and refuse to repair any directory whose reconciliation reasons are not exactly `missing-structured-analysis`.
patterns_established:
  - Repair scripts classify through `reconcileRuntimeArtifacts()` first, mutate only the safe artifact set, then reconcile again to persist resolved state.
observability_surfaces:
  - scripts/repair-historical-artifacts.ts JSON report
  - data/insights/<videoId>/analysis.json
  - data/insights/<videoId>/reconciliation.json
duration: 1h19m
verification_result: passed
completed_at: 2026-03-13T03:39:10Z
blocker_discovered: false
---

# T01: Add deterministic repair for historical directories missing structured analysis

**Added a conservative historical repair path that rebuilds `analysis.json` from existing markdown, refreshes display artifacts, and resolves reconciliation without fabricating run history.**

## What Happened

I extracted the markdown-to-structured-analysis derivation from `scripts/migrate-legacy-insights-to-json.ts` into an exported helper so both migration and historical repair use the same curation and validation contract. I extended `scripts/backfill-insight-artifacts.ts` so a caller can refresh the slugged display markdown additively when canonical markdown already exists.

I added regression coverage in `src/lib/__tests__/runtime-reconciliation.test.ts` for a historical completed directory with legacy `run.json`/`status.json` and no `analysis.json`, proving reconciliation classifies it as `missing-structured-analysis` with normalized legacy run authority. I added `src/lib/__tests__/historical-artifact-repair.test.ts` to prove the repair script rebuilds valid structured output, leaves `run.json` and `status.json` untouched, resolves reconciliation, and refuses to invent history for `artifacts-without-run`.

I implemented `scripts/repair-historical-artifacts.ts` as a machine-readable JSON inventory. It scans directories through `reconcileRuntimeArtifacts()`, repairs only the exact single-reason `missing-structured-analysis` class, refreshes the display markdown from canonical `analysis.md`, and re-runs reconciliation to persist the resolved record. Everything outside that safe boundary returns `rerun-needed` or `skipped`.

The required runtime verification command initially failed because this repo did not have a local `tsx` package, so `node --import tsx ...` could not resolve the loader. I verified that root cause with `npm ls tsx` and `npx tsx --version`, then added `tsx` as a dev dependency so the task's required verification command is now real in this repo.

## Verification

Passed:

- `npx vitest run src/lib/__tests__/runtime-reconciliation.test.ts src/lib/__tests__/historical-artifact-repair.test.ts`
- `node --import tsx scripts/repair-historical-artifacts.ts --video-id V5A1IU8VVp4`
  - Result: `repairedCount: 1`, `reasonCodes: ["missing-structured-analysis"]`, `reconciliationAfter: "resolved"`
- Inspected `data/insights/V5A1IU8VVp4/analysis.json`
  - Result: valid structured payload present with derived summary/takeaways/actionItems and preserved `reportMarkdown`
- Inspected `data/insights/V5A1IU8VVp4/reconciliation.json`
  - Result: `status: "resolved"`, `resolution: "resolved"`, `structuredAnalysis: "valid"`
- Inspected `data/insights/V5A1IU8VVp4/run.json` and `status.json`
  - Result: legacy files unchanged; no synthetic run metadata added

Slice-level verification status:

- `npx vitest run src/lib/__tests__/runtime-reconciliation.test.ts src/lib/__tests__/historical-artifact-repair.test.ts` ✅
- `bash scripts/verify-s02-historical-repair.sh V5A1IU8VVp4 I1NdVZ6l5CQ` ❌ expected at this point; script does not exist yet and is planned for T02

## Diagnostics

To inspect later:

- Run `node --import tsx scripts/repair-historical-artifacts.ts --video-id <videoId>` for one directory or omit `--video-id` for the full inventory.
- Check `data/insights/<videoId>/reconciliation.json` for `status`, `resolution`, and reason codes before/after repair.
- Check `data/insights/<videoId>/analysis.json` for the repaired structured payload.
- The repair report JSON exposes `action` (`repaired`, `rerun-needed`, `skipped`, `error`) plus mismatch totals keyed by reconciliation reason code.

## Deviations

- Added `tsx` as a dev dependency because the task’s required verification command used `node --import tsx`, and the repo did not previously install that loader locally.

## Known Issues

- `scripts/verify-s02-historical-repair.sh` is still missing, so the second slice-level verification command remains pending for T02.

## Files Created/Modified

- `scripts/repair-historical-artifacts.ts` — new repair inventory/repair entrypoint for historical directories.
- `scripts/migrate-legacy-insights-to-json.ts` — exported shared markdown→structured derivation helper.
- `scripts/backfill-insight-artifacts.ts` — added refresh support for slugged display markdown artifacts.
- `src/lib/__tests__/historical-artifact-repair.test.ts` — regression coverage for safe repair and rerun-only boundaries.
- `src/lib/__tests__/runtime-reconciliation.test.ts` — added historical legacy-run reconciliation coverage.
- `package.json` — added local `tsx` dev dependency required by the task verification command.
- `package-lock.json` — lockfile update for `tsx`.
- `data/insights/V5A1IU8VVp4/analysis.json` — repaired structured artifact for the representative historical directory.
- `data/insights/V5A1IU8VVp4/reconciliation.json` — resolved reconciliation persisted after repair.

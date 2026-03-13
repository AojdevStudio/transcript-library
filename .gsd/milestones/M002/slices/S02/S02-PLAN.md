# S02: Historical Artifact Repair and Drift Recovery

**Goal:** Make historical artifact drift operator-readable and repairable by proving deterministic in-place repair for `missing-structured-analysis` while keeping `artifacts-without-run` explicitly rerun-only through the normal runtime path.
**Demo:** A representative historical directory missing `analysis.json` can be repaired into a resolved reconciliation state without inventing run history, and a representative directory with artifacts but no durable run record remains clearly rerun-ready until a normal analysis rerun restores canonical runtime artifacts.

## Must-Haves

- R005: Historical mismatch classification continues to come from `reconcileRuntimeArtifacts()` so scripts, routes, and runtime stream surfaces share one repair contract.
- R005: `missing-structured-analysis` directories gain a deterministic repair path that rebuilds valid `analysis.json` from existing markdown/report evidence, preserves readable artifacts, and resolves reconciliation without requiring a rerun.
- R005: `artifacts-without-run` directories do not receive synthetic `run.json` or invented attempt history; they stay visibly rerun-ready in operator surfaces until repaired by a normal analysis rerun.
- R005: Slice verification proves one representative example from each repair class reaches the expected end state with durable evidence on disk.
- S04 support: the slice leaves a machine-readable repair inventory/operators script output that distinguishes repaired-in-place cases from rerun-only cases so unattended automation has a safe scope boundary.

## Proof Level

- This slice proves: integration
- Real runtime required: yes
- Human/UAT required: no

## Verification

- `npx vitest run src/lib/__tests__/runtime-reconciliation.test.ts src/lib/__tests__/historical-artifact-repair.test.ts`
- `bash scripts/verify-s02-historical-repair.sh V5A1IU8VVp4 I1NdVZ6l5CQ`

## Observability / Diagnostics

- Runtime signals: per-video `reconciliation.json` transitions, repair-script result counts by mismatch class, and canonical rerun lifecycle artifacts under `data/insights/<videoId>/runs/<runId>/`.
- Inspection surfaces: `scripts/repair-historical-artifacts.ts`, `scripts/verify-s02-historical-repair.sh`, `GET /api/insight`, `POST /api/analyze`, and per-video `run.json` / `status.json` / `reconciliation.json`.
- Failure visibility: mismatch reason codes, repair action taken (`repaired` vs `rerun-needed`), latest run identity, and the first operator-readable failure line when rerun fails.
- Redaction constraints: keep provider auth details and filesystem internals out of route payloads while preserving rerun guidance and reason codes.

## Integration Closure

- Upstream surfaces consumed: `src/lib/runtime-reconciliation.ts`, `src/lib/analysis.ts`, `src/app/api/analyze/route.ts`, `src/app/api/insight/route.ts`, `src/lib/runtime-stream.ts`, `scripts/migrate-legacy-insights-to-json.ts`, and `scripts/backfill-insight-artifacts.ts`.
- New wiring introduced in this slice: a historical-repair script that classifies through reconciliation, a reusable structured backfill path for directory-scoped repairs, and a slice verification script that exercises both repair classes through disk artifacts and the normal analyze entrypoint.
- What remains before the milestone is truly usable end-to-end: daily unattended sweep automation, source-repo sync proof, and hosted runtime/deploy/access verification.

## Tasks

- [x] **T01: Add deterministic repair for historical directories missing structured analysis** `est:1h10m`
  - Why: This is the only mismatch class with enough durable evidence for an honest in-place repair, so S02 needs to prove it can be fixed without rerunning or fabricating history.
  - Files: `scripts/repair-historical-artifacts.ts`, `scripts/migrate-legacy-insights-to-json.ts`, `scripts/backfill-insight-artifacts.ts`, `src/lib/runtime-reconciliation.ts`, `src/lib/__tests__/runtime-reconciliation.test.ts`, `src/lib/__tests__/historical-artifact-repair.test.ts`
  - Do: Extract or share the markdown-to-structured-analysis derivation already used by the legacy migration path, add a directory-scoped repair flow that scans videos through `reconcileRuntimeArtifacts()`, repairs only `missing-structured-analysis` cases in place, preserves canonical/display markdown artifacts, and persists a clear per-video action result plus resolved reconciliation state after repair.
  - Verify: `npx vitest run src/lib/__tests__/runtime-reconciliation.test.ts src/lib/__tests__/historical-artifact-repair.test.ts`
  - Done when: a representative `missing-structured-analysis` fixture and checked-in video can be repaired into valid `analysis.json` plus `reconciliation.status=resolved` without creating synthetic run history.
- [x] **T02: Preserve rerun-only repair for artifacts-without-run and prove representative recovery** `est:1h15m`
  - Why: The riskier historical class is where the runtime could lie by inventing provenance, so S02 has to prove those videos stay clearly rerun-ready until the normal analysis path regenerates canonical artifacts.
  - Files: `scripts/repair-historical-artifacts.ts`, `scripts/verify-s02-historical-repair.sh`, `src/app/api/analyze/route.ts`, `src/app/api/insight/route.ts`, `src/lib/runtime-stream.ts`, `src/lib/__tests__/historical-artifact-repair.test.ts`, `.gsd/milestones/M002/slices/S02/S02-SUMMARY.md`
  - Do: Keep `artifacts-without-run` as a no-fix/rerun-needed result in the repair inventory, tighten route/stream assertions where needed so operator surfaces keep exposing retry-needed guidance, and add a verification script that repairs one safe historical directory, confirms one `artifacts-without-run` example remains rerun-ready before rerun, then triggers the normal analysis flow to restore canonical runtime artifacts for that representative video.
  - Verify: `bash scripts/verify-s02-historical-repair.sh V5A1IU8VVp4 I1NdVZ6l5CQ`
  - Done when: the repair script reports `artifacts-without-run` as rerun-needed rather than repaired, operator surfaces stay retryable/readable for that state, and the representative rerun ends with canonical artifacts and resolved reconciliation.

## Files Likely Touched

- `scripts/repair-historical-artifacts.ts`
- `scripts/verify-s02-historical-repair.sh`
- `scripts/migrate-legacy-insights-to-json.ts`
- `scripts/backfill-insight-artifacts.ts`
- `src/lib/runtime-reconciliation.ts`
- `src/lib/analysis.ts`
- `src/lib/runtime-stream.ts`
- `src/app/api/analyze/route.ts`
- `src/app/api/insight/route.ts`
- `src/lib/__tests__/runtime-reconciliation.test.ts`
- `src/lib/__tests__/historical-artifact-repair.test.ts`
- `.gsd/milestones/M002/slices/S02/S02-SUMMARY.md`

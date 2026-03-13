---
estimated_steps: 5
estimated_files: 7
---

# T02: Preserve rerun-only repair for artifacts-without-run and prove representative recovery

**Slice:** S02 — Historical Artifact Repair and Drift Recovery
**Milestone:** M002

## Description

Close the slice by proving the unsafe historical class stays honest. This task keeps `artifacts-without-run` explicitly rerun-only in repair inventory and operator surfaces, then verifies a representative rerun through the normal analysis flow so the repaired end state is canonical runtime output rather than fabricated provenance.

## Steps

1. Extend `src/lib/__tests__/historical-artifact-repair.test.ts` with assertions that `artifacts-without-run` videos are reported as `rerun-needed`, never receive synthesized `run.json`, and remain retryable/readable through reconciliation-driven route payloads.
2. Tighten any route/runtime-stream behavior needed so `GET /api/insight`, analyze start eligibility, and retry guidance continue to surface `retry-needed` for `artifacts-without-run` while allowing a normal rerun when requested.
3. Update `scripts/repair-historical-artifacts.ts` so its machine-readable output clearly distinguishes repaired videos from rerun-only ones and includes the representative reason codes/operators evidence needed by S04.
4. Write `scripts/verify-s02-historical-repair.sh` to repair a representative `missing-structured-analysis` video, confirm a representative `artifacts-without-run` video remains rerun-ready pre-rerun, trigger the normal analyze flow for that video, and assert canonical post-rerun artifacts plus resolved reconciliation.
5. Run the verification script and record the proved safe-repair vs rerun-only boundary in the slice summary for later automation work.

## Must-Haves

- [ ] `artifacts-without-run` remains a visible mismatch class with `rerun-needed` output instead of synthetic run reconstruction.
- [ ] Normal rerun flow is the only repair path for the representative no-run historical video.
- [ ] Operator surfaces continue to expose reason codes, retryability, and durable run evidence before and after rerun.
- [ ] Slice verification covers one representative video from each class and leaves an execution summary the next slice can trust.

## Verification

- `npx vitest run src/lib/__tests__/historical-artifact-repair.test.ts`
- `bash scripts/verify-s02-historical-repair.sh V5A1IU8VVp4 I1NdVZ6l5CQ`

## Observability Impact

- Signals added/changed: repair-inventory action labels (`repaired` vs `rerun-needed`), persisted reconciliation transitions, and representative rerun artifacts/logs.
- How a future agent inspects this: read the repair-script JSON output, inspect `GET /api/insight?videoId=<id>`, and check `data/insights/<videoId>/run.json`, `status.json`, and `runs/<runId>/` after rerun.
- Failure state exposed: when rerun still fails, the representative video keeps the durable failure summary and retry guidance from the normal runtime path.

## Inputs

- `scripts/repair-historical-artifacts.ts` — T01 repair inventory and safe in-place repair path.
- `src/app/api/analyze/route.ts`, `src/app/api/insight/route.ts`, and `src/lib/runtime-stream.ts` — current operator-facing rerun guidance surfaces.
- Slice research inventory — representative `artifacts-without-run` videos including `I1NdVZ6l5CQ`.
- S01 verification pattern — use the normal analyze/status flow and canonical artifact assertions rather than ad hoc file edits.

## Expected Output

- `scripts/verify-s02-historical-repair.sh` — executable proof for both historical repair classes.
- Updated route/runtime/reconciliation coverage — stable rerun guidance and no synthetic history for `artifacts-without-run`.
- `.gsd/milestones/M002/slices/S02/S02-SUMMARY.md` — durable record of the proved repair boundary and representative results.

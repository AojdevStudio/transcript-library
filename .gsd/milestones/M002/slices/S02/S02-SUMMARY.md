---
id: S02
parent: M002
milestone: M002
provides:
  - deterministic in-place repair for historical `missing-structured-analysis` directories
  - explicit rerun-only operator contracts for `artifacts-without-run`
  - a repeatable verification harness proving the boundary between safe repair and canonical rerun recovery
requires:
  - slice: S01
    provides: a real provider-backed analyze recovery flow and verification pattern using the normal `/api/analyze` runtime path
affects:
  - R005
  - R006
  - S04
key_files:
  - scripts/repair-historical-artifacts.ts
  - scripts/verify-s02-historical-repair.sh
  - src/lib/runtime-reconciliation.ts
  - src/lib/analysis.ts
  - src/app/api/analyze/route.ts
  - src/app/api/insight/route.ts
  - src/lib/runtime-stream.ts
key_decisions:
  - Repair only `missing-structured-analysis` in place and never synthesize `run.json` or attempt history for `artifacts-without-run`.
  - Treat artifact directories without a durable latest run as `retry-needed` even if canonical markdown exists, and let `/api/analyze` rerun any retryable reconciliation mismatch.
patterns_established:
  - Historical verification starts by recreating the safe missing-structured condition for one representative, then proves rerun-only recovery for the unsafe class through the normal analyze/status/insight routes.
  - Repair inventory output now carries `operatorEvidence` so unattended automation can distinguish safe auto-repair from rerun-only directories without re-deriving route logic.
  - Canonical rerun proof is asserted from disk artifacts (`run.json`, `status.json`, `analysis.json`, `analysis.md`, display markdown, `runs/<runId>/`) plus resolved reconciliation after the shared insight read.
observability_surfaces:
  - scripts/repair-historical-artifacts.ts
  - scripts/verify-s02-historical-repair.sh
  - GET /api/insight
  - GET /api/analyze/status
  - data/insights/V5A1IU8VVp4/reconciliation.json
  - data/insights/I1NdVZ6l5CQ/run.json
  - data/insights/I1NdVZ6l5CQ/status.json
  - data/insights/I1NdVZ6l5CQ/reconciliation.json
  - data/insights/I1NdVZ6l5CQ/runs/20260313035140843-09e5b2/
drill_down_paths:
  - .gsd/milestones/M002/slices/S02/tasks/T01-SUMMARY.md
  - .gsd/milestones/M002/slices/S02/tasks/T02-SUMMARY.md
duration: 2h 31m
verification_result: passed
completed_at: 2026-03-13T03:54:08Z
---

# S02: Historical Artifact Repair and Drift Recovery

**Shipped a conservative historical repair boundary: `missing-structured-analysis` repairs in place from existing markdown evidence, while `artifacts-without-run` stays visibly rerun-only until a normal analysis run restores canonical runtime artifacts and resolved reconciliation.**

## What Happened

This slice turned historical artifact drift into one shared, operator-readable contract instead of a loose collection of special cases.

T01 established the safe repair class. `scripts/repair-historical-artifacts.ts` now scans through `reconcileRuntimeArtifacts()`, repairs only the exact single-reason `missing-structured-analysis` class, rebuilds `analysis.json` from existing canonical markdown via the same validated derivation used by the legacy migration path, refreshes the display markdown artifact, and persists resolved reconciliation without inventing new run history. Regression coverage proved the representative historical directory could move from mismatch to resolved while leaving legacy `run.json` and `status.json` untouched.

T02 closed the dangerous side of the boundary. The repair inventory now leaves `artifacts-without-run` as `rerun-needed` and publishes `operatorEvidence` describing retryability, analyze outcome, resolution, and primary reason code. Runtime surfaces align with that state: artifact directories without a durable `run.json` are now `retry-needed` rather than `already-analyzed`, `/api/analyze` allows a clean rerun for any retryable reconciliation mismatch, and runtime-stream payloads publish mismatch state as `failed` / `reconciled` with explicit rerun guidance.

The slice-level proof used the representative pair from research:

- `V5A1IU8VVp4` — recreated as `missing-structured-analysis`, then repaired in place to `reconciliation.status = resolved`
- `I1NdVZ6l5CQ` — kept as `artifacts-without-run` with `runId = null` and `retry-needed` operator surfaces until `/api/analyze` was triggered through the normal runtime flow

The representative rerun for `I1NdVZ6l5CQ` completed successfully as `runId: 20260313035140843-09e5b2` with `provider: codex-cli`, `status: complete`, `lifecycle: completed`, canonical structured/canonical/display artifacts on disk, preserved attempt logs under `runs/20260313035140843-09e5b2/`, and `reconciliation.json` resolved after the post-rerun insight read. That is the slice’s core proof: the unsafe class stayed honest until a real runtime replaced it with canonical provenance.

## Verification

Passed locally:

- `npx vitest run src/lib/__tests__/runtime-reconciliation.test.ts src/lib/__tests__/historical-artifact-repair.test.ts`
- `bash scripts/verify-s02-historical-repair.sh V5A1IU8VVp4 I1NdVZ6l5CQ`

Additional regression coverage passed during execution:

- `npx vitest run src/lib/__tests__/analyze-route.test.ts`

The verification script confirmed:

- repair inventory distinguished `repaired` vs `rerun-needed` with explicit `operatorEvidence`
- pre-rerun `GET /api/insight` and `GET /api/analyze/status` both surfaced `retry-needed` for `I1NdVZ6l5CQ`
- no synthetic `run.json` existed before rerun for the no-run representative
- the normal analyze flow produced real `run.json`, `status.json`, `analysis.json`, `analysis.md`, display markdown, and attempt artifacts
- `reconciliation.json` resolved with no reasons after the post-rerun shared insight read

## Deviations

None.

## Known Limitations

- Resolved reconciliation is persisted on the next shared reconciliation read rather than immediately at worker close, so the verification harness intentionally performs a post-rerun `GET /api/insight` before asserting `reconciliation.json` on disk.
- The local rerun proof still depends on Codex being the authenticated provider in this workspace; Claude remains a separate account-state concern from S01.

## Follow-ups

- S04 can consume `scripts/repair-historical-artifacts.ts` `operatorEvidence` to scope unattended repair automation strictly to `missing-structured-analysis` while routing `artifacts-without-run` into rerun-only workflows.
- If immediate resolved reconciliation on disk becomes important for automation, persist the final reconciliation transition at worker completion instead of waiting for the next shared read.

## Files Created/Modified

- `scripts/repair-historical-artifacts.ts` — machine-readable repair inventory with explicit rerun-only operator evidence.
- `scripts/verify-s02-historical-repair.sh` — end-to-end proof for both historical repair classes.
- `src/lib/analysis.ts` — retry-needed eligibility for artifact-only/no-run directories.
- `src/app/api/analyze/route.ts` — rerun unlock for any retryable reconciliation mismatch.
- `src/lib/runtime-stream.ts` — reconciled mismatch payload state and rerun guidance.
- `src/lib/__tests__/historical-artifact-repair.test.ts` — regression coverage for safe repair and rerun-only operator surfaces.
- `src/lib/__tests__/analyze-route.test.ts` — route coverage for rerun-start eligibility on `artifacts-without-run`.
- `data/insights/V5A1IU8VVp4/analysis.json` — representative repaired structured artifact.
- `data/insights/I1NdVZ6l5CQ/run.json` — representative canonical rerun authority.
- `data/insights/I1NdVZ6l5CQ/reconciliation.json` — representative resolved post-rerun reconciliation.

## Forward Intelligence

### What the next slice should know

- `operatorEvidence` in the repair inventory is now the safest machine boundary for unattended automation: `repaired` + `resolved` is auto-fix territory, `rerun-needed` + `retry-needed` is not.
- `artifacts-without-run` can look superficially healthy because `analysis.md` exists, so downstream logic must key off durable run authority or reconciliation, not artifact presence alone.

### What's fragile

- Post-rerun reconciliation persistence still depends on a shared read path (`GET /api/insight` or another reconcile caller). If an automation only watches `status.json`, it can miss the resolved transition until that read occurs.
- The verification harness assumes local Codex auth. If provider auth changes, the rerun proof will fail for environmental reasons even though the repair boundary logic is still correct.

### Authoritative diagnostics

- `scripts/repair-historical-artifacts.ts` output — names the safe vs unsafe classes with explicit operator evidence and reason codes.
- `data/insights/<videoId>/reconciliation.json` — authoritative persisted mismatch/resolution state once a shared reconcile read has occurred.
- `data/insights/I1NdVZ6l5CQ/runs/20260313035140843-09e5b2/` — authoritative evidence that the representative no-run directory was repaired by a real runtime rerun, not fabricated metadata.

### What assumptions changed

- "If canonical markdown exists, analyze start should say already analyzed." — False for historical no-run directories; canonical artifacts without durable provenance must remain `retry-needed`.
- "A successful rerun immediately implies resolved reconciliation on disk." — Not yet; the resolved reconciliation record is persisted by the next shared reconcile read.

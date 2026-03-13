---
id: T02
parent: S02
milestone: M002
provides:
  - retry-needed operator/read contracts for `artifacts-without-run` across repair inventory, eligibility, and runtime stream surfaces
  - a repeatable verification script that proves safe in-place repair for `missing-structured-analysis` and canonical rerun recovery for `artifacts-without-run`
  - representative canonical rerun artifacts for `I1NdVZ6l5CQ` without synthesizing pre-rerun provenance
key_files:
  - scripts/repair-historical-artifacts.ts
  - scripts/verify-s02-historical-repair.sh
  - src/lib/analysis.ts
  - src/app/api/analyze/route.ts
  - src/lib/runtime-stream.ts
  - src/lib/__tests__/historical-artifact-repair.test.ts
  - src/lib/__tests__/analyze-route.test.ts
key_decisions:
  - Treat artifact directories without `run.json` as `retry-needed` instead of `already-analyzed`, even when canonical markdown exists.
  - Keep rerun unlocking in `POST /api/analyze` tied to reconciliation mismatch + retryable eligibility rather than a single legacy outcome string.
patterns_established:
  - Historical verification can safely reset only `analysis.json` for a repairable representative, run the repair inventory, then prove rerun-only recovery through the normal `/api/analyze` flow.
  - Post-rerun verification should hit `GET /api/insight` before asserting `reconciliation.json` because the shared read persists the resolved reconciliation record.
observability_surfaces:
  - scripts/repair-historical-artifacts.ts JSON output
  - scripts/verify-s02-historical-repair.sh
  - GET /api/insight
  - GET /api/analyze/status
  - data/insights/I1NdVZ6l5CQ/run.json
  - data/insights/I1NdVZ6l5CQ/status.json
  - data/insights/I1NdVZ6l5CQ/reconciliation.json
  - data/insights/I1NdVZ6l5CQ/runs/20260313035140843-09e5b2/
duration: 1h 12m
verification_result: passed
completed_at: 2026-03-13T03:54:08Z
blocker_discovered: false
---

# T02: Preserve rerun-only repair for artifacts-without-run and prove representative recovery

**Kept `artifacts-without-run` explicitly rerun-only in every operator surface, then proved the representative repair boundary by repairing `V5A1IU8VVp4` in place and rerunning `I1NdVZ6l5CQ` through the normal analysis flow to canonical resolved artifacts.**

## What Happened

I extended `src/lib/__tests__/historical-artifact-repair.test.ts` to cover the unsafe historical class the slice cared about: the repair inventory now has explicit assertions for `operatorEvidence`, no synthesized `run.json`, `retry-needed` insight payloads, and reconciled runtime-stream output for `artifacts-without-run` directories. Those tests also assert the safe class reports `resolved` operator evidence after in-place repair.

That exposed a real contract gap. `getAnalyzeStartEligibility()` still treated any completed artifact set as `already-analyzed`, which made `artifacts-without-run` look less actionable than the routes and reconciliation state said it was. I changed `src/lib/analysis.ts` so artifact directories without a durable latest run are `retry-needed` and retryable. Then I tightened `POST /api/analyze` so any retryable reconciliation mismatch can start a clean rerun, not just the old `already-analyzed` branch. I added a regression in `src/lib/__tests__/analyze-route.test.ts` to prove that `artifacts-without-run` can actually be rerun.

I updated `src/lib/runtime-stream.ts` so mismatch payloads publish the same effective state as the operator-facing insight route: `status: failed`, `lifecycle: reconciled`, `stage: Needs Reconciliation`, and rerun guidance, even when the raw runtime snapshot would otherwise look complete because canonical markdown exists.

I extended `scripts/repair-historical-artifacts.ts` with per-result `operatorEvidence` so the machine-readable report names not just the action (`repaired` vs `rerun-needed`) but also the downstream operator contract: retryability, analyze outcome, resolution, and primary reason code.

Finally I wrote `scripts/verify-s02-historical-repair.sh`. The script validates the catalog snapshot, clears only `analysis.json` for `V5A1IU8VVp4` to recreate the safe historical repair condition, proves the repair inventory returns `repaired` for that video and `rerun-needed` for `I1NdVZ6l5CQ`, verifies pre-rerun insight/analyze surfaces for the no-run video, starts the local app with `ANALYSIS_PROVIDER=codex-cli`, triggers the normal analyze flow, polls to completion, then asserts canonical post-rerun artifacts plus resolved reconciliation.

The representative rerun completed successfully as `runId: 20260313035140843-09e5b2` for `I1NdVZ6l5CQ`. The resulting directory now has real `run.json`, `status.json`, `analysis.json`, `analysis.md`, slugged markdown, attempt logs, and `reconciliation.json` resolved with no reasons. No synthetic pre-rerun history was created: the historical state stayed `rerun-needed` until the normal runtime path replaced it with canonical output.

## Verification

Passed:

- `npx vitest run src/lib/__tests__/historical-artifact-repair.test.ts`
- `npx vitest run src/lib/__tests__/analyze-route.test.ts`
- `npx vitest run src/lib/__tests__/runtime-reconciliation.test.ts src/lib/__tests__/historical-artifact-repair.test.ts`
- `bash scripts/verify-s02-historical-repair.sh V5A1IU8VVp4 I1NdVZ6l5CQ`

Observed from the representative verification script:

- repair inventory returned `V5A1IU8VVp4 → repaired` with `reasonCodes: ["missing-structured-analysis"]` and `operatorEvidence.analyzeOutcome: "resolved"`
- repair inventory returned `I1NdVZ6l5CQ → rerun-needed` with `reasonCodes: ["artifacts-without-run"]`, `runId: null`, and `operatorEvidence.analyzeOutcome: "retry-needed"`
- pre-rerun `GET /api/insight?videoId=I1NdVZ6l5CQ` returned `status: failed`, `lifecycle: reconciled`, `retryable: true`, `analyzeOutcome: retry-needed`, and reconciliation reason `artifacts-without-run`
- pre-rerun `GET /api/analyze/status?videoId=I1NdVZ6l5CQ` returned `outcome: retry-needed` and `retryable: true`
- rerun completed as `status=complete lifecycle=completed runId=20260313035140843-09e5b2`
- post-rerun disk assertions confirmed `run.json`, `status.json`, `analysis.json`, `analysis.md`, display markdown, and `runs/20260313035140843-09e5b2/` attempt artifacts exist and are non-empty
- post-rerun `reconciliation.json` resolved with `retryable: false` and no remaining reasons

## Diagnostics

To inspect later:

- `node --import tsx scripts/repair-historical-artifacts.ts --video-id V5A1IU8VVp4 --video-id I1NdVZ6l5CQ`
- `bash scripts/verify-s02-historical-repair.sh V5A1IU8VVp4 I1NdVZ6l5CQ`
- `curl -s http://127.0.0.1:3124/api/insight?videoId=I1NdVZ6l5CQ`
- `data/insights/I1NdVZ6l5CQ/run.json` — canonical rerun authority after recovery
- `data/insights/I1NdVZ6l5CQ/status.json` — compatibility lifecycle mirror
- `data/insights/I1NdVZ6l5CQ/reconciliation.json` — resolved mismatch transition after post-rerun insight read
- `data/insights/I1NdVZ6l5CQ/runs/20260313035140843-09e5b2/worker-stdout.txt` and `worker-stderr.txt` — preserved attempt evidence for the representative rerun

## Deviations

None.

## Known Issues

- Resolved reconciliation is persisted on the next shared reconciliation read (`GET /api/insight` or another `reconcileRuntimeArtifacts()` caller) rather than immediately at worker close, so verification needs that read before asserting `reconciliation.json` on disk.

## Files Created/Modified

- `src/lib/__tests__/historical-artifact-repair.test.ts` — adds rerun-only operator-surface assertions and report-evidence expectations for `artifacts-without-run`.
- `src/lib/__tests__/analyze-route.test.ts` — proves retryable reconciliation mismatch can still start a normal rerun.
- `src/lib/analysis.ts` — marks artifact-only/no-run directories as `retry-needed` eligibility instead of `already-analyzed`.
- `src/app/api/analyze/route.ts` — unlocks reruns for any retryable reconciliation mismatch, including `artifacts-without-run`.
- `src/lib/runtime-stream.ts` — publishes mismatch payloads as failed/reconciled with explicit rerun guidance.
- `scripts/repair-historical-artifacts.ts` — adds per-result `operatorEvidence` for automation-safe repair inventory output.
- `scripts/verify-s02-historical-repair.sh` — repeatable proof for the safe-repair vs rerun-only boundary.
- `data/insights/I1NdVZ6l5CQ/run.json` — canonical durable run metadata from the representative rerun.
- `data/insights/I1NdVZ6l5CQ/status.json` — compatibility lifecycle mirror for the representative rerun.
- `data/insights/I1NdVZ6l5CQ/analysis.json` — validated structured output from the representative rerun.
- `data/insights/I1NdVZ6l5CQ/reconciliation.json` — resolved reconciliation persisted after the post-rerun operator read.

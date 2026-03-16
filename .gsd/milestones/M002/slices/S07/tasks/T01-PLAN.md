---
estimated_steps: 5
estimated_files: 3
---

# T01: Encode the hosted launch proof contract and evidence evaluator

**Slice:** S07 — End-to-End Hosted Launch Proof
**Milestone:** M002

## Description

Define the authoritative pass/fail contract for S07 before touching the live host. This task turns the final hosted proof into something testable instead of anecdotal by encoding the exact evidence the slice needs: release layout, runtime health, refresh/sweep records, analysis artifact persistence, and the explicit fact that the real Cloudflare browser proof is a separate human-confirmed check.

## Steps

1. Write `src/lib/hosted-launch-proof.ts` to define the S07 evidence bundle shape, required checks, verdict calculation, and stable failure reason codes for deploy layout, automation state, refresh/sweep state, analysis persistence, and pending browser/UAT proof.
2. Add `src/lib/__tests__/hosted-launch-proof.test.ts` with focused pass/fail fixtures covering missing `tsx`, missing refresh evidence, analysis artifacts written under `/opt/transcript-library/current`, unresolved `manualFollowUpVideoIds`, and a fully passing hosted proof record.
3. Create `scripts/verify-s07-hosted-launch.ts` as the CLI entrypoint that gathers evidence, runs it through the shared evaluator, and emits one structured bundle plus a compact operator summary.
4. Make the CLI report high-signal diagnostics rather than raw command spam: failing check id, phase, selected `videoId`, artifact path, and next inspection surface.
5. Run the targeted Vitest suite and confirm the CLI shape is aligned with the tested evaluator rather than inventing a second set of proof rules.

## Must-Haves

- [ ] One shared evaluator defines what S07 counts as pass, fail, or human-proof-pending instead of scattering that logic across shell checks and docs.
- [ ] The proof contract explicitly distinguishes machine-verifiable hosted evidence from the real Cloudflare browser/UAT step.

## Verification

- `npx vitest run src/lib/__tests__/hosted-launch-proof.test.ts`
- Confirm the CLI emits structured check ids and verdict fields that match the tested evaluator contract.

## Observability Impact

- Signals added/changed: a structured S07 evidence bundle with per-check pass/fail state, failing phase, and selected `videoId`.
- How a future agent inspects this: run `node --import tsx scripts/verify-s07-hosted-launch.ts` and inspect the emitted bundle instead of reconstructing proof from shell history.
- Failure state exposed: missing host prerequisites, bad persistent paths, absent refresh/sweep artifacts, unresolved rerun-only drift, and missing human browser confirmation become explicit verdicts.

## Inputs

- `scripts/verify-s05-hosted-access.sh` — existing hosted route proof that S07 should compose rather than replace.
- `scripts/daily-operational-sweep.ts` — unattended automation entrypoint whose durable evidence must be part of S07.
- `deploy/systemd/transcript-library-sweep.service` and `deploy/systemd/deploy-hook.service` — real hosted execution surfaces the proof needs to inspect.

## Expected Output

- `src/lib/hosted-launch-proof.ts` — authoritative S07 evidence evaluator.
- `src/lib/__tests__/hosted-launch-proof.test.ts` — proof-contract coverage for passing and failing hosted evidence.
- `scripts/verify-s07-hosted-launch.ts` — structured hosted-launch verification CLI.

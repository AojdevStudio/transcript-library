---
estimated_steps: 4
estimated_files: 4
---

# T03: Publish the launch runbook and explicit Cloudflare UAT handoff

**Slice:** S07 — End-to-End Hosted Launch Proof
**Milestone:** M002

## Description

Finish the slice by making the hosted launch proof repeatable for a future operator. The automated verifier can prove most of the topology, but it cannot honestly stand in for the real friend-facing Cloudflare Access OTP/browser experience. This task records that boundary in docs, adds a slice UAT artifact for the manual proof, and ties the existing sync/deploy docs back to the new S07 verifier.

## Steps

1. Write `docs/operations/hosted-launch-proof.md` with the full S07 procedure: prerequisites, env vars, hostnames, how to run the verifier, where the evidence bundle lands, and how to interpret pass/fail versus browser-proof-pending states.
2. Create `.gsd/milestones/M002/slices/S07/S07-UAT.md` as the manual checklist for the real Cloudflare Access friend flow, including hostname, approver identity, timestamp, OTP/browser result, selected `videoId`, analysis artifact path, refresh/sweep evidence paths, and follow-up notes.
3. Update `docs/operations/source-repo-sync-contract.md` and `docs/plans/2026-03-09-self-hosted-proxmox-deployment.md` so they point to the S07 verifier and keep the friend-facing/browser path distinct from machine-only automation paths.
4. Grep the touched docs to confirm the new verifier, Cloudflare Access browser proof, evidence-bundle terminology, and `S07-UAT` handoff are all discoverable from the repo.

## Must-Haves

- [ ] Operators have one truthful runbook that explains what the verifier proves, what it does not prove, and where to inspect the resulting evidence.
- [ ] The real Cloudflare friend-flow proof is captured in a durable slice UAT artifact instead of being left as verbal confirmation or screenshots.

## Verification

- `rg -n "verify-s07-hosted-launch|Cloudflare Access|OTP|browser proof|machine-only|evidence bundle|S07-UAT" docs/operations/hosted-launch-proof.md .gsd/milestones/M002/slices/S07/S07-UAT.md docs/operations/source-repo-sync-contract.md docs/plans/2026-03-09-self-hosted-proxmox-deployment.md`
- Complete the new runbook once and confirm `.gsd/milestones/M002/slices/S07/S07-UAT.md` captures the hostname, timestamp, selected `videoId`, evidence-bundle path, and browser/UAT result.

## Inputs

- `scripts/verify-s07-hosted-launch.ts` — the automated proof authority this runbook must explain.
- `docs/operations/source-repo-sync-contract.md` — existing source-refresh and machine-boundary contract that S07 must reference, not contradict.
- `docs/plans/2026-03-09-self-hosted-proxmox-deployment.md` — deployment topology document that should point to the final launch-proof workflow.

## Expected Output

- `docs/operations/hosted-launch-proof.md` — operator-facing S07 launch proof runbook.
- `.gsd/milestones/M002/slices/S07/S07-UAT.md` — durable manual Cloudflare Access verification artifact.
- `docs/operations/source-repo-sync-contract.md` — explicit pointer from sync contract to final hosted proof workflow.
- `docs/plans/2026-03-09-self-hosted-proxmox-deployment.md` — deployment plan updated to reference the S07 verification path.

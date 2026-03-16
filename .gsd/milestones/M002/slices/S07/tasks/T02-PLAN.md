---
estimated_steps: 5
estimated_files: 6
---

# T02: Prove the live hosted runtime and close host-preflight gaps

**Slice:** S07 — End-to-End Hosted Launch Proof
**Milestone:** M002

## Description

Drive the new S07 verifier against the real Proxmox deployment and close whatever narrow runtime gaps stop a truthful launch proof. This task is where the slice earns its name: it checks the actual release symlink, pm2 process, systemd jobs, refresh/sweep evidence, route boundary behavior, and one hosted analysis completion under `/srv/transcript-library/` using the same Linux user and runtime assumptions that production depends on.

## Steps

1. Run `scripts/verify-s07-hosted-launch.ts` against the live host and capture the initial failures across deploy layout, systemd/pm2 health, refresh evidence, sweep evidence, route-boundary checks, and hosted analysis prerequisites.
2. Fix only the host/runtime mismatches the verifier exposes inside the existing deployment model — for example `tsx` availability, provider CLI PATH/auth under the runtime user, `.env.local` expectations, or service-user parity between pm2 and systemd.
3. Extend the verifier to inspect `readlink /opt/transcript-library/current`, `deploy-manifest.json`, `pm2 show transcript-library`, `journalctl -u deploy-hook`, `journalctl -u transcript-library-sweep`, `last-source-refresh.json`, `last-import-validation.json`, and `data/runtime/daily-operational-sweep/latest.json`.
4. Use the verifier to trigger and wait for one hosted `/api/analyze` run, then assert `analysis.json`, `analysis.md`, `run.json`, `status.json`, and attempt logs land under `/srv/transcript-library/insights/<videoId>/` and not under the release tree.
5. Re-run the live verifier until it passes cleanly, preserving any `manualFollowUpVideoIds` or rerun-only drift as explicit evidence rather than masking them.

## Must-Haves

- [ ] The live proof runs under the real hosted runtime assumptions and verifies persistent storage, deploy layout, unattended automation, and hosted analysis together.
- [ ] Any runtime drift that remains rerun-only stays visible in the proof output instead of being “fixed” by inventing missing run history or hiding manual follow-up work.

## Verification

- `node --import tsx scripts/verify-s07-hosted-launch.ts`
- Confirm the final evidence bundle includes the active release path, sweep/refresh artifact paths, selected `videoId`, analysis artifact paths, and any `manualFollowUpVideoIds`.

## Observability Impact

- Signals added/changed: one live hosted-launch evidence bundle and, where needed, tighter deploy/runtime diagnostics around `tsx`, provider CLI visibility, or service-user assumptions.
- How a future agent inspects this: rerun the S07 verifier, inspect the evidence bundle, then drill into `pm2 show transcript-library`, the systemd journal, or the named artifact paths from the failing check.
- Failure state exposed: host-preflight mismatch, deploy/runtime user mismatch, missing persistent artifacts, route-boundary failure, analysis completion failure, or unresolved manual follow-up state.

## Inputs

- `scripts/verify-s07-hosted-launch.ts` — shared verifier from T01.
- `deploy/setup-lxc.sh` — canonical host bootstrap that may need to close real-runtime gaps.
- `deploy/env.template` — hosted env expectations for provider/runtime parity.
- `deploy/systemd/transcript-library-sweep.service` / `deploy/systemd/deploy-hook.service` — hosted execution surfaces that must match the verified runtime user.
- `scripts/verify-s05-hosted-access.sh` — hosted route-boundary proof that S07 should reuse for the live topology.

## Expected Output

- `scripts/verify-s07-hosted-launch.ts` — live-host proof covering deploy layout, automation evidence, route boundaries, and hosted analysis completion.
- `deploy/setup-lxc.sh` — bootstrap steps corrected only if the live proof exposes missing host prerequisites.
- `deploy/env.template` — env/runtime expectations corrected only if the live proof exposes gaps.
- `deploy/systemd/transcript-library-sweep.service` — service assumptions corrected only if the live proof exposes them.
- `deploy/systemd/deploy-hook.service` — deploy-hook runtime assumptions corrected only if the live proof exposes them.
- `scripts/verify-s05-hosted-access.sh` — reused or lightly adapted if the live proof needs to compose its route-boundary checks.

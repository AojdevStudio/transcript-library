---
estimated_steps: 4
estimated_files: 6
---

# T03: Enforce and document the hosted source-repo contract

**Slice:** S03 — Source Repo Sync Contract and Auto-Refresh
**Milestone:** M002

## Description

Make the repo boundary explicit enough that hosted automation does not rely on tribal knowledge. This task extends hosted preflight and operator docs to spell out the required transcript checkout shape, refresh entrypoints, evidence files, and the launch rule that source refresh remains separate from analysis execution.

## Steps

1. Extend `src/lib/hosted-config.ts` and `src/lib/__tests__/hosted-config.test.ts` so hosted mode validates or warns on refresh-critical assumptions beyond mere presence of `PLAYLIST_TRANSCRIPTS_REPO` (for example: expected git checkout shape, required refresh token/url configuration, or missing source-refresh evidence surfaces).
2. Write `docs/operations/source-repo-sync-contract.md` describing the supported contract between `playlist-transcripts` and this app: upstream owns ingestion + commits, this app owns local checkout refresh + SQLite rebuild, refresh evidence lives beside the catalog, and analysis remains on demand.
3. Update `docs/architecture/system-overview.md` and `docs/plans/2026-03-09-self-hosted-proxmox-deployment.md` so the hosted runtime, cron/webhook assumptions, and inspection commands all reference the new refresh-only contract and evidence files.
4. Record the final contract and hosted/operator expectations in the slice summary so S04, S05, and S06 can build on one documented boundary.

## Must-Haves

- [ ] Hosted preflight and docs name the refresh-critical repo assumptions explicitly instead of implying freshness from directory existence alone.
- [ ] The documentation states clearly that source refresh is refresh-only and analysis remains on-demand or operator-triggered.
- [ ] Operators have named evidence files and commands to inspect refresh success, no-op, and failure cases.
- [ ] The hosted deployment plan reflects the same entrypoints and assumptions as the implemented code.

## Verification

- `npx vitest run src/lib/__tests__/hosted-config.test.ts`
- `rg -n "last-source-refresh|refresh-only|analysis remains on-demand|PLAYLIST_TRANSCRIPTS_REPO" docs/operations/source-repo-sync-contract.md docs/architecture/system-overview.md docs/plans/2026-03-09-self-hosted-proxmox-deployment.md`

## Observability Impact

- Signals added/changed: hosted preflight warnings/errors now cover source-refresh contract gaps, and the docs publish the operator inspection path.
- How a future agent inspects this: run hosted preflight on startup, then follow the documented commands/files to inspect the latest refresh.
- Failure state exposed: missing repo contract assumptions become startup-visible instead of surfacing later as silent stale content.

## Inputs

- `src/lib/source-refresh.ts` and `scripts/refresh-source-catalog.ts` — actual implemented refresh entrypoints to document.
- `src/lib/hosted-config.ts` — existing hosted bootstrap contract.
- `docs/architecture/system-overview.md` and `docs/plans/2026-03-09-self-hosted-proxmox-deployment.md` — current hosted/runtime guidance that still assumes implicit freshness.
- Slice research summary — documented pitfalls around localhost callback assumptions and stale repo state.

## Expected Output

- `docs/operations/source-repo-sync-contract.md` — canonical cross-repo contract and operator troubleshooting guide.
- Updated hosted preflight/tests and deployment docs — enforced and documented source-refresh boundary for unattended use.
- `.gsd/milestones/M002/slices/S03/S03-SUMMARY.md` — slice-level record of the final hosted/source contract.

---
id: T03
parent: S03
milestone: M002
provides:
  - hosted preflight enforcement for the source-refresh repo contract
  - canonical operator documentation for refresh-only source sync and evidence inspection
  - hosted deployment guidance aligned with the implemented refresh entrypoints
key_files:
  - src/lib/hosted-config.ts
  - src/lib/__tests__/hosted-config.test.ts
  - docs/operations/source-repo-sync-contract.md
  - docs/architecture/system-overview.md
  - docs/plans/2026-03-09-self-hosted-proxmox-deployment.md
  - .gsd/milestones/M002/slices/S03/S03-SUMMARY.md
key_decisions:
  - treat the hosted source-refresh contract as startup-visible preflight state instead of relying on directory existence alone
patterns_established:
  - hosted operator docs and preflight checks share one contract: app-owned git checkout, refresh-only entrypoints, durable evidence files, and explicit separation from analysis workflows
observability_surfaces:
  - hosted preflight warnings/errors at startup
  - data/catalog/last-source-refresh.json
  - data/catalog/last-import-validation.json
  - node --import tsx scripts/refresh-source-catalog.ts --check
  - POST /api/sync-hook
duration: 50m
verification_result: passed
completed_at: 2026-03-13T22:49:00-05:00
blocker_discovered: false
---

# T03: Enforce and document the hosted source-repo contract

**Made the hosted source-refresh boundary startup-visible and documented one refresh-only operator contract for repo shape, entrypoints, and evidence files.**

## What Happened

Extended `src/lib/hosted-config.ts` so hosted preflight now validates more than env presence. In hosted mode it now:

- fails if `PLAYLIST_TRANSCRIPTS_REPO` is missing, non-absolute, missing on disk, or not a git checkout
- warns when the transcript checkout is detached HEAD and `PLAYLIST_TRANSCRIPTS_BRANCH` is not configured
- warns when `last-source-refresh.json` and `last-import-validation.json` have not been produced yet
- keeps `SYNC_TOKEN` as a warning-level requirement for dedicated webhook callers while noting that `PRIVATE_API_TOKEN` still works as the universal private-boundary override

Expanded `src/lib/__tests__/hosted-config.test.ts` with real git-checkout fixtures so the new contract is covered against actual repo-shape conditions rather than only env presence.

Wrote `docs/operations/source-repo-sync-contract.md` as the canonical cross-repo/operator doc. It now spells out:

- upstream owns ingestion and commits
- this app owns local checkout refresh plus SQLite rebuild
- refresh entrypoints are `scripts/refresh-source-catalog.ts` and `POST /api/sync-hook`
- refresh evidence lives beside the catalog as `last-source-refresh.json` and `last-import-validation.json`
- refresh is refresh-only and analysis remains on-demand

Updated `docs/architecture/system-overview.md` and `docs/plans/2026-03-09-self-hosted-proxmox-deployment.md` so the hosted/runtime story matches the implemented code. The deployment plan now points operators at the refresh CLI or webhook instead of implying that a bare `git pull` cron is the whole contract, and it names the evidence files/operators should inspect after refresh.

Recorded the final hosted/operator boundary in `.gsd/milestones/M002/slices/S03/S03-SUMMARY.md` so downstream slices inherit one documented source-refresh contract.

## Verification

Passed:

- `npx vitest run src/lib/__tests__/hosted-config.test.ts`
- `npx vitest run src/lib/__tests__/source-refresh.test.ts src/lib/__tests__/sync-hook-route.test.ts src/lib/__tests__/hosted-config.test.ts`
- `bash scripts/verify-s03-source-refresh.sh`
- `rg -n "last-source-refresh|refresh-only|analysis remains on-demand|PLAYLIST_TRANSCRIPTS_REPO" docs/operations/source-repo-sync-contract.md docs/architecture/system-overview.md docs/plans/2026-03-09-self-hosted-proxmox-deployment.md`

Observed directly from verification:

- hosted preflight now surfaces repo-shape/evidence warnings in tests before runtime work begins
- the slice-level refresh proof still shows `noop` then `updated` refresh outcomes, refreshed browse/raw visibility, and no analysis side effects for the synced video
- docs now carry the same refresh-only contract language as the runtime checks

## Diagnostics

Inspect later with:

- `npx vitest run src/lib/__tests__/hosted-config.test.ts`
- `node --import tsx scripts/refresh-source-catalog.ts --check`
- `data/catalog/last-source-refresh.json`
- `data/catalog/last-import-validation.json`
- `docs/operations/source-repo-sync-contract.md`
- hosted startup logs from `assertPreflight()` for repo-shape/evidence warnings or failures

## Deviations

- The deployment document now recommends `CATALOG_DB_PATH=/srv/transcript-library/catalog/catalog.db` so refresh evidence can live on shared mutable storage beside the catalog instead of inside the release tree. This is consistent with the repo’s existing mutable-state separation and makes the documented inspection path coherent for hosted use.

## Known Issues

- None in this task. The remaining work for unattended refresh cadence and hosted proof moves to later slices.

## Files Created/Modified

- `src/lib/hosted-config.ts` — hosted preflight now validates source-refresh repo shape and warns on missing refresh evidence
- `src/lib/__tests__/hosted-config.test.ts` — real git-fixture coverage for hosted repo-contract failures and warnings
- `docs/operations/source-repo-sync-contract.md` — canonical refresh-only cross-repo contract and operator troubleshooting guide
- `docs/architecture/system-overview.md` — updated hosted/runtime overview to reference refresh-only entrypoints and evidence files
- `docs/plans/2026-03-09-self-hosted-proxmox-deployment.md` — aligned hosted deployment plan with refresh CLI/webhook entrypoints and shared catalog evidence storage
- `.gsd/milestones/M002/slices/S03/S03-SUMMARY.md` — recorded the final hosted/operator contract for downstream slices

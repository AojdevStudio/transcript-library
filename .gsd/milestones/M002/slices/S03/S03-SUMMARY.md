---
id: S03
parent: M002
milestone: M002
status: completed
completed_tasks:
  - T01
  - T02
  - T03
pending_tasks: []
last_updated: 2026-03-13T22:50:00-05:00
---

# S03: Source Repo Sync Contract and Auto-Refresh

**Current slice state:** refresh-only source sync is live, has a real contract proof showing that an upstream git commit reaches browse/raw reads without starting analysis work, and now has an explicit hosted/operator contract for repo shape, entrypoints, and evidence surfaces.

## What T01-T02 Proved

- `src/lib/source-refresh.ts` and `scripts/refresh-source-catalog.ts` now own the refresh contract: inspect repo state, fetch, fast-forward, rebuild SQLite, and persist `last-source-refresh.json` without queueing analysis work.
- `POST /api/sync-hook` already reuses that refresh-only authority from T01.
- T02 added a repeatable verification harness in `scripts/verify-s03-source-refresh.sh` that builds a temporary bare upstream repo plus app-owned clone, performs an initial refresh, pushes a second upstream commit, and refreshes again through the supported CLI entrypoint.
- The proof shows the second commit moving from `headBefore=dd0fa7ad2ddeb5cdd29060f16d4cb3bba88158de` to `headAfter=549a2a78aceebf30b4e65b2b33b4be7364f55c6b`, publishes catalog version `423771d0a9198b6f1c988e33c01e81554574a33a2193c7527129939e30b9644d`, and exposes the synced `beta123xyza` video through normal catalog reads and `/api/raw?path=beta/main.md`.
- The same proof confirms no `run.json`, no `status.json`, and no runtime batch artifacts are created for the synced video unless analysis is explicitly invoked.

## Verification Status

Passed during T02:

- `npx vitest run src/lib/__tests__/source-refresh.test.ts src/lib/__tests__/catalog-cache.test.ts`
- `npx vitest run src/lib/__tests__/source-refresh.test.ts src/lib/__tests__/sync-hook-route.test.ts src/lib/__tests__/hosted-config.test.ts`
- `bash scripts/verify-s03-source-refresh.sh`

## Durable Evidence

Rerun and inspect:

- `bash scripts/verify-s03-source-refresh.sh`
- `.gsd/tmp/verify-s03-source-refresh/initial-refresh.json`
- `.gsd/tmp/verify-s03-source-refresh/second-refresh.json`
- `.gsd/tmp/verify-s03-source-refresh/verification-summary.json`
- `.gsd/tmp/verify-s03-source-refresh/runtime/data/catalog/last-source-refresh.json`
- `.gsd/tmp/verify-s03-source-refresh/runtime/data/catalog/last-import-validation.json`
- absence of `.gsd/tmp/verify-s03-source-refresh/runtime/data/insights/beta123xyza/run.json`

## Hosted/Operator Contract Locked in T03

T03 made the hosted source-repo boundary explicit in both startup checks and docs:

- `src/lib/hosted-config.ts` now treats hosted refresh assumptions as startup-visible contract checks instead of inferring freshness from directory existence alone.
- Hosted preflight now fails if `PLAYLIST_TRANSCRIPTS_REPO` is missing, non-absolute, missing on disk, or not a git checkout.
- Hosted preflight now warns when the transcript checkout is detached HEAD without `PLAYLIST_TRANSCRIPTS_BRANCH`, when `SYNC_TOKEN` is absent for dedicated webhook callers, and when `last-source-refresh.json` or `last-import-validation.json` have not been produced yet.
- `docs/operations/source-repo-sync-contract.md` is now the canonical cross-repo/operator document for repo shape, refresh entrypoints, evidence files, failure phases, and the launch rule that refresh is refresh-only while analysis remains on-demand.
- `docs/architecture/system-overview.md` and `docs/plans/2026-03-09-self-hosted-proxmox-deployment.md` now point hosted automation at the refresh CLI or `POST /api/sync-hook` instead of implying that a bare transcript directory or `git pull` cron is the whole contract.

## Slice Closure

S03 now closes with one documented boundary for downstream slices:

- **source refresh:** `node --import tsx scripts/refresh-source-catalog.ts` or `POST /api/sync-hook`
- **refresh evidence:** `last-source-refresh.json` + `last-import-validation.json`
- **analysis trigger:** explicit `/api/analyze` or later operator analysis workflows only

This gives S04-S06 one stable assumption set for unattended refresh, observability, and hosted deployment.

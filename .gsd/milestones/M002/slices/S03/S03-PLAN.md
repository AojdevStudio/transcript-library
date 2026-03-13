# S03: Source Repo Sync Contract and Auto-Refresh

**Goal:** Split source refresh from analysis submission so a real upstream transcript repo update can fast-forward the local checkout, rebuild the SQLite catalog, and surface durable refresh evidence without auto-starting analysis.
**Demo:** After a new transcript commit lands upstream, the library can refresh through the intended sync contract, the new video becomes visible through the normal app/catalog path without a restart, raw transcript reads resolve against the refreshed repo checkout, and no analysis run is started unless requested separately.

## Must-Haves

- R007: A real upstream commit advancing `PLAYLIST_TRANSCRIPTS_REPO` can be pulled into the app-owned local checkout and published into the library automatically through the supported refresh entrypoint.
- R007: Refresh preserves the last-known-good catalog when repo update or catalog rebuild fails, while leaving durable evidence that explains whether the source repo changed, nothing changed, or refresh failed.
- R008: `POST /api/sync-hook` stops using analysis batch submission as its primary behavior and becomes a refresh-only contract; analysis remains user- or operator-triggered elsewhere.
- R008: Slice verification proves that sync-added videos do not gain new analysis artifacts or queued runtime batch work unless an explicit analysis workflow is invoked.
- R009: The cross-repo contract is explicit in code and docs: expected repo layout, git remote/branch assumptions, refresh evidence files, webhook auth/identity rules, and the supported hosted/operator entrypoints are documented and enforced clearly enough for unattended use.

## Proof Level

- This slice proves: integration
- Real runtime required: yes
- Human/UAT required: no

## Verification

- `npx vitest run src/lib/__tests__/source-refresh.test.ts src/lib/__tests__/sync-hook-route.test.ts src/lib/__tests__/hosted-config.test.ts`
- `bash scripts/verify-s03-source-refresh.sh`

## Observability / Diagnostics

- Runtime signals: durable `last-source-refresh.json` records covering source update status, repo commit before/after, catalog version, trigger source, and failure reason; existing `last-import-validation.json` remains the catalog publish proof.
- Inspection surfaces: `POST /api/sync-hook`, the refresh CLI entrypoint, `data/catalog/last-source-refresh.json`, `data/catalog/last-import-validation.json`, and targeted verification script output.
- Failure visibility: refresh outcome (`updated`, `noop`, `failed`), failing phase (`git-fetch`, `git-fast-forward`, `catalog-rebuild`), upstream/local commit refs, request identity, and timestamp remain visible without opening ad hoc logs.
- Redaction constraints: hosted responses and refresh records must avoid leaking filesystem paths, access tokens, or full remote URLs beyond what operators already need.

## Integration Closure

- Upstream surfaces consumed: `scripts/rebuild-catalog.ts`, `src/lib/catalog-import.ts`, `src/lib/catalog.ts`, `src/app/api/raw/route.ts`, `src/lib/runtime-batches.ts`, `src/app/api/sync-hook/route.ts`, `src/lib/hosted-config.ts`, and the upstream `playlist-transcripts` git checkout contract rooted at `PLAYLIST_TRANSCRIPTS_REPO`.
- New wiring introduced in this slice: a shared refresh service/CLI that fast-forwards the local transcript checkout then rebuilds SQLite, a refresh-only sync-hook route using that service, and durable refresh records that future automation can inspect.
- What remains before the milestone is truly usable end-to-end: daily unattended sweep wiring in S04 and hosted deploy/access proof in S05-S07.

## Tasks

- [x] **T01: Introduce a refresh-only source sync service and durable refresh record** `est:1h20m`
  - Why: The slice lives or dies on splitting refresh from analysis while keeping one shared authority for git update, catalog rebuild, and evidence output.
  - Files: `src/lib/source-refresh.ts`, `scripts/refresh-source-catalog.ts`, `src/app/api/sync-hook/route.ts`, `src/lib/runtime-batches.ts`, `src/lib/__tests__/source-refresh.test.ts`, `src/lib/__tests__/sync-hook-route.test.ts`
  - Do: Add a shared refresh service that inspects the `PLAYLIST_TRANSCRIPTS_REPO` checkout, fast-forwards it from the configured remote/branch, rebuilds SQLite only after the repo step succeeds, writes `data/catalog/last-source-refresh.json`, and returns refresh-only outcomes; rewire `/api/sync-hook` to call that service with existing auth/idempotency semantics and stop using `submitRuntimeBatch()` for normal sync behavior.
  - Verify: `npx vitest run src/lib/__tests__/source-refresh.test.ts src/lib/__tests__/sync-hook-route.test.ts`
  - Done when: sync-hook returns refresh outcomes/evidence instead of analysis batch submission, successful refreshes publish a new catalog version, no-op/failed refreshes keep the previous live catalog intact, and no analysis batch/runtime work is started by the sync path.
- [x] **T02: Add a real upstream-change verification path that proves browse freshness without auto-analysis** `est:1h15m`
  - Why: R007 and R008 need a contract-level proof that a real git advance reaches the library and stops there unless analysis is explicitly requested.
  - Files: `scripts/verify-s03-source-refresh.sh`, `src/lib/__tests__/source-refresh.test.ts`, `src/lib/__tests__/catalog-cache.test.ts`, `src/app/api/raw/route.ts`, `src/lib/catalog.ts`, `.gsd/milestones/M002/slices/S03/S03-SUMMARY.md`
  - Do: Build a verification harness around a temporary upstream repo + local clone fixture, prove that a second upstream commit becomes visible after the refresh entrypoint runs, assert the app picks up the refreshed catalog without restart, confirm raw transcript reads resolve from the updated checkout, and assert no new `data/insights/<videoId>/run.json` or batch artifacts appear for the synced video.
  - Verify: `bash scripts/verify-s03-source-refresh.sh`
  - Done when: the verification script demonstrates commit-before/after evidence, a newly added video becomes addressable through the normal catalog/raw paths after refresh, and the synced video still has no analysis run history unless analysis is invoked separately.
- [x] **T03: Enforce and document the hosted source-repo contract** `est:55m`
  - Why: S03 is not complete if refresh works locally but the hosted repo/layout assumptions remain implicit or unverifiable for unattended use.
  - Files: `src/lib/hosted-config.ts`, `src/lib/__tests__/hosted-config.test.ts`, `docs/architecture/system-overview.md`, `docs/plans/2026-03-09-self-hosted-proxmox-deployment.md`, `docs/operations/source-repo-sync-contract.md`, `.gsd/milestones/M002/slices/S03/S03-SUMMARY.md`
  - Do: Extend hosted preflight and operator docs so the app spells out required repo shape, remote/branch assumptions, refresh entrypoints, expected evidence files, and the separation between source refresh and explicit analysis workflows; include the webhook caller contract and the hosted same-machine/URL assumptions that S04-S07 must preserve.
  - Verify: `npx vitest run src/lib/__tests__/hosted-config.test.ts && rg -n "last-source-refresh|refresh-only|PLAYLIST_TRANSCRIPTS_REPO|analysis remains on-demand" docs/architecture/system-overview.md docs/plans/2026-03-09-self-hosted-proxmox-deployment.md docs/operations/source-repo-sync-contract.md`
  - Done when: hosted preflight warns or fails on missing refresh-critical repo assumptions, the docs name the refresh-only contract and evidence surfaces explicitly, and S04/S06 can consume the same entrypoints without rediscovering hidden behavior.

## Files Likely Touched

- `src/lib/source-refresh.ts`
- `scripts/refresh-source-catalog.ts`
- `scripts/verify-s03-source-refresh.sh`
- `src/app/api/sync-hook/route.ts`
- `src/lib/runtime-batches.ts`
- `src/lib/catalog.ts`
- `src/app/api/raw/route.ts`
- `src/lib/hosted-config.ts`
- `src/lib/__tests__/source-refresh.test.ts`
- `src/lib/__tests__/sync-hook-route.test.ts`
- `src/lib/__tests__/hosted-config.test.ts`
- `docs/operations/source-repo-sync-contract.md`
- `docs/architecture/system-overview.md`
- `docs/plans/2026-03-09-self-hosted-proxmox-deployment.md`
- `.gsd/milestones/M002/slices/S03/S03-SUMMARY.md`

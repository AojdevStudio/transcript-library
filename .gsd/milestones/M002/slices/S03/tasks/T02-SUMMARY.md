---
id: T02
parent: S03
milestone: M002
provides:
  - real git-fixture verification for upstream refresh without auto-analysis
  - in-process catalog cache proof after refresh publishes a new snapshot
  - shared transcript path resolution for catalog reads and /api/raw
key_files:
  - scripts/verify-s03-source-refresh.sh
  - src/lib/__tests__/source-refresh.test.ts
  - src/lib/__tests__/catalog-cache.test.ts
  - src/lib/catalog.ts
  - src/app/api/raw/route.ts
  - .gsd/milestones/M002/slices/S03/S03-SUMMARY.md
key_decisions:
  - resolve transcript files through one shared helper so catalog part paths and repo-relative paths stay valid across server-side reads and /api/raw
patterns_established:
  - contract proofs for source refresh use a temporary bare upstream repo plus app-owned clone, then verify the real catalog/raw entrypoints instead of route-only mocks
  - refresh verification records machine-readable evidence under .gsd/tmp/verify-s03-source-refresh for reruns and later inspection
observability_surfaces:
  - .gsd/tmp/verify-s03-source-refresh/initial-refresh.json
  - .gsd/tmp/verify-s03-source-refresh/second-refresh.json
  - .gsd/tmp/verify-s03-source-refresh/verification-summary.json
  - .gsd/tmp/verify-s03-source-refresh/runtime/data/catalog/last-source-refresh.json
  - .gsd/tmp/verify-s03-source-refresh/runtime/data/catalog/last-import-validation.json
  - bash scripts/verify-s03-source-refresh.sh
duration: 1h05m
verification_result: passed
completed_at: 2026-03-13T22:40:00-05:00
blocker_discovered: false
---

# T02: Add a real upstream-change verification path that proves browse freshness without auto-analysis

**Added a real git-backed refresh proof that advances an upstream commit into browse/raw reads and leaves no analysis artifacts behind.**

## What Happened

Extended `src/lib/__tests__/source-refresh.test.ts` with a fixture-backed regression that now proves a second upstream commit becomes visible through the shared catalog and `/api/raw` path without creating `run.json` or runtime batch artifacts. The same file still covers noop, fast-forward failure, and catalog-rebuild failure paths.

Extended `src/lib/__tests__/catalog-cache.test.ts` so the catalog module is loaded before refresh, the source repo advances upstream, `refreshSourceCatalog()` publishes a new SQLite snapshot, and the already-loaded module picks up the new snapshot without a module reload.

Added `scripts/verify-s03-source-refresh.sh` as the contract-level proof for the slice. The script now:

- creates a temporary bare upstream repo and app-owned clone under `.gsd/tmp/verify-s03-source-refresh`
- seeds an initial transcript index and runs the supported refresh CLI entrypoint
- commits a second upstream transcript/video and refreshes again through the same entrypoint
- asserts commit-before/after evidence from `last-source-refresh.json`
- confirms catalog reads and `/api/raw?path=beta/main.md` expose the new transcript after refresh
- confirms no `run.json`, no `status.json`, and no runtime batch artifacts were created for the synced video
- writes repeatable machine-readable evidence files for later inspection

Tightened the runtime path contract by adding shared transcript path resolution in `src/lib/catalog.ts` and reusing it from `src/app/api/raw/route.ts`. `/api/raw` now accepts the transcript-relative file paths that the catalog stores (`beta/main.md`) while still accepting repo-relative `youtube-transcripts/...` inputs and preserving the same traversal guard.

Recorded the proved result in `.gsd/milestones/M002/slices/S03/S03-SUMMARY.md` so the slice has a durable note that upstream refresh is now verified against a real git-shaped change.

## Verification

Passed:

- `npx vitest run src/lib/__tests__/source-refresh.test.ts src/lib/__tests__/catalog-cache.test.ts`
- `npx vitest run src/lib/__tests__/source-refresh.test.ts src/lib/__tests__/sync-hook-route.test.ts src/lib/__tests__/hosted-config.test.ts`
- `bash scripts/verify-s03-source-refresh.sh`

Observed from the contract proof:

- initial refresh: `status=noop`, `headBefore=dd0fa7ad2ddeb5cdd29060f16d4cb3bba88158de`, `headAfter=dd0fa7ad2ddeb5cdd29060f16d4cb3bba88158de`
- second refresh: `status=updated`, `headBefore=dd0fa7ad2ddeb5cdd29060f16d4cb3bba88158de`, `headAfter=549a2a78aceebf30b4e65b2b33b4be7364f55c6b`
- refreshed browse proof: `beta123xyza` titled `Beta` with part path `beta/main.md`
- raw proof: `/api/raw?path=beta/main.md` returned `Beta transcript from refreshed upstream state.`
- no-analysis proof: `run.json=false`, `status.json=false`, `runtime batches=false`

Slice-level verification status after this task:

- `npx vitest run src/lib/__tests__/source-refresh.test.ts src/lib/__tests__/sync-hook-route.test.ts src/lib/__tests__/hosted-config.test.ts` — passed
- `bash scripts/verify-s03-source-refresh.sh` — passed
- Slice remains open because T03 docs/hosted-contract work is still pending.

## Diagnostics

Inspect later with:

- `bash scripts/verify-s03-source-refresh.sh`
- `.gsd/tmp/verify-s03-source-refresh/initial-refresh.json`
- `.gsd/tmp/verify-s03-source-refresh/second-refresh.json`
- `.gsd/tmp/verify-s03-source-refresh/verification-summary.json`
- `.gsd/tmp/verify-s03-source-refresh/runtime/data/catalog/last-source-refresh.json`
- `.gsd/tmp/verify-s03-source-refresh/runtime/data/catalog/last-import-validation.json`
- absence of `.gsd/tmp/verify-s03-source-refresh/runtime/data/insights/beta123xyza/run.json`

The proof distinguishes three failure classes cleanly:

- source update problems before commit movement
- catalog publish problems after repo movement
- accidental analysis side effects after a successful refresh

## Deviations

- The task plan’s observability text referenced the default `data/catalog` and `data/insights` locations. The proof uses a stable isolated workspace under `.gsd/tmp/verify-s03-source-refresh` instead, so reruns do not overwrite the repository’s live catalog or insight artifacts while still leaving durable evidence behind.

## Known Issues

- The hosted/source-contract documentation and preflight clarity for this slice still depend on T03.

## Files Created/Modified

- `scripts/verify-s03-source-refresh.sh` — real git-backed refresh proof with durable evidence files under `.gsd/tmp/verify-s03-source-refresh`
- `src/lib/__tests__/source-refresh.test.ts` — regression coverage for refreshed catalog/raw visibility and absence of analysis artifacts after refresh
- `src/lib/__tests__/catalog-cache.test.ts` — proves an already-loaded catalog module invalidates its snapshot after a real source refresh publishes a new version
- `src/lib/catalog.ts` — shared transcript path resolution used by catalog/runtime consumers
- `src/app/api/raw/route.ts` — switched raw reads onto the shared transcript path resolver so catalog-stored file paths work directly
- `.gsd/milestones/M002/slices/S03/S03-SUMMARY.md` — durable slice note recording the proved upstream-refresh-without-auto-analysis result
- `.gsd/DECISIONS.md` — recorded the shared transcript path resolver decision

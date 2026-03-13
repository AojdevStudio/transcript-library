---
id: T01
parent: S03
milestone: M002
provides:
  - refresh-only source sync authority with durable refresh evidence and webhook reuse
key_files:
  - src/lib/source-refresh.ts
  - scripts/refresh-source-catalog.ts
  - src/app/api/sync-hook/route.ts
  - src/lib/__tests__/source-refresh.test.ts
  - src/lib/__tests__/sync-hook-route.test.ts
key_decisions:
  - target the configured transcript branch explicitly so detached-HEAD checkouts can still fast-forward safely
  - restore the previous last-import-validation.json when a refresh rebuild fails
patterns_established:
  - source refresh owns git fetch/ff-only + catalog rebuild + last-source-refresh.json, while analysis submission stays on explicit workflows
observability_surfaces:
  - data/catalog/last-source-refresh.json
  - data/catalog/last-import-validation.json
  - scripts/refresh-source-catalog.ts
  - POST /api/sync-hook
duration: 1h10m
verification_result: passed
completed_at: 2026-03-13T15:29:00Z
blocker_discovered: false
---

# T01: Introduce a refresh-only source sync service and durable refresh record

**Added a shared source-refresh authority, moved `/api/sync-hook` onto it, and persisted durable refresh records without starting analysis work.**

## What Happened

Built `src/lib/source-refresh.ts` as the one refresh boundary for this slice. It now:

- inspects the configured `PLAYLIST_TRANSCRIPTS_REPO` checkout
- fetches the configured remote/branch
- explicitly targets the configured branch so detached-HEAD checkouts can still fast-forward safely
- runs `git merge --ff-only` only after the repo is in a safe state
- rebuilds the catalog only after the git step succeeds or is a no-op
- writes `data/catalog/last-source-refresh.json` with outcome, phase, repo commit refs, trigger, and request metadata
- restores the previous `last-import-validation.json` if the rebuild step fails so last-known-good catalog proof remains usable

Added `scripts/refresh-source-catalog.ts` as the operator entrypoint. `--check` still runs the repo refresh, but validates the catalog rebuild in check-only mode rather than publishing a new live DB.

Rewired `src/app/api/sync-hook/route.ts` to call the refresh authority instead of `submitRuntimeBatch()`. The route kept its existing bearer-token auth, PRIVATE_API_TOKEN override, and idempotency/request identity extraction, but now returns refresh outcomes (`updated` / `noop` / `failed`) instead of batch-submission payloads.

Wrote fixture-backed Vitest coverage in `source-refresh.test.ts` for updated, noop, git-fast-forward failure, and catalog-rebuild failure cases. Updated `sync-hook-route.test.ts` so the route asserts refresh-only behavior and verifies `submitRuntimeBatch()` is no longer used by sync-hook.

## Verification

Passed:

- `npx vitest run src/lib/__tests__/source-refresh.test.ts src/lib/__tests__/sync-hook-route.test.ts`
- `npx vitest run src/lib/__tests__/source-refresh.test.ts src/lib/__tests__/sync-hook-route.test.ts src/lib/__tests__/hosted-config.test.ts`
- `node --import tsx scripts/refresh-source-catalog.ts --check`

Observed from the real CLI check:

- refresh outcome: `updated`
- phase: `completed`
- repo commits: `headBefore=23f156d6...`, `headAfter=bde98956...`, `upstreamHead=bde98956...`
- catalog evidence: `version=917c2fb9...`, `videoCount=141`, `partCount=226`
- emitted record written to `data/catalog/last-source-refresh.json`

Slice-level verification status after this task:

- `npx vitest run src/lib/__tests__/source-refresh.test.ts src/lib/__tests__/sync-hook-route.test.ts src/lib/__tests__/hosted-config.test.ts` — passed
- `bash scripts/verify-s03-source-refresh.sh` — not yet available in the repo (`No such file or directory`), which is expected T02 work

## Diagnostics

Inspect later with:

- `node --import tsx scripts/refresh-source-catalog.ts --check` for a refresh-only operator run
- `data/catalog/last-source-refresh.json` for refresh outcome, phase, commit refs, and trigger/request metadata
- `data/catalog/last-import-validation.json` for the catalog publish/check proof that pairs with the refresh record
- `POST /api/sync-hook` for the hosted/private refresh entrypoint using the same authority

Failure records now distinguish:

- `repo-inspect`
- `git-fetch`
- `git-fast-forward`
- `catalog-rebuild`

and preserve the previous live catalog/validation proof when the rebuild fails.

## Deviations

- `scripts/refresh-source-catalog.ts --check` was implemented as a real repo refresh plus catalog validation-only rebuild. That keeps the shared authority intact while letting operators verify catalog integrity without publishing a new live DB.

## Known Issues

- `scripts/verify-s03-source-refresh.sh` does not exist yet, so the full slice-level end-to-end verification remains incomplete until T02.
- Running the real CLI check fast-forwarded the local `PLAYLIST_TRANSCRIPTS_REPO` checkout from detached HEAD onto updated `master`, which is correct for the new contract but worth noting for anyone comparing local repo state before/after this task.

## Files Created/Modified

- `src/lib/source-refresh.ts` — new shared refresh authority for git fast-forward, catalog rebuild, and durable refresh records
- `scripts/refresh-source-catalog.ts` — operator/automation CLI over the shared refresh service
- `src/app/api/sync-hook/route.ts` — switched sync-hook from batch submission to refresh-only behavior
- `src/lib/__tests__/source-refresh.test.ts` — real git-fixture coverage for updated/noop/failed refresh paths and last-known-good preservation
- `src/lib/__tests__/sync-hook-route.test.ts` — route coverage for refresh-only outcomes and removal of `submitRuntimeBatch()` from sync-hook
- `.gsd/DECISIONS.md` — recorded detached-HEAD branch targeting and validation-report restoration decisions

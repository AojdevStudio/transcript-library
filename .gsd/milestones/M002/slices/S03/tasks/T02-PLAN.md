---
estimated_steps: 5
estimated_files: 6
---

# T02: Add a real upstream-change verification path that proves browse freshness without auto-analysis

**Slice:** S03 — Source Repo Sync Contract and Auto-Refresh
**Milestone:** M002

## Description

Prove the contract against a real git-shaped change, not just mocked route payloads. This task builds the slice verification harness around a temporary upstream repository and local clone so S03 can demonstrate that a second upstream commit reaches the library through the refresh entrypoint, becomes visible through normal browse/raw paths without restart, and stops short of analysis unless explicitly requested.

## Steps

1. Extend `src/lib/__tests__/source-refresh.test.ts` with fixture-driven coverage for commit-before/after refresh behavior and update any catalog cache tests needed so the app’s SQLite facade is proven to pick up the new snapshot after refresh.
2. Write `scripts/verify-s03-source-refresh.sh` to create a temporary upstream bare repo plus working clone fixture, seed an initial transcript index, perform an initial refresh, commit a second transcript/video upstream, then invoke the supported refresh entrypoint again.
3. In the verification flow, assert commit-before/after evidence from `last-source-refresh.json`, confirm the new video becomes available through normal catalog access and `src/app/api/raw/route.ts` transcript reads, and check that no analysis run/batch artifacts were created for the synced video.
4. Tighten any catalog/raw helpers needed so the verification script can exercise those paths without bypassing the real runtime contract.
5. Run the verification script and record the proved auto-refresh-without-auto-analysis outcome in the slice summary.

## Must-Haves

- [ ] Verification uses a real temporary git upstream/local-checkout relationship rather than only mocks.
- [ ] The refreshed video becomes visible through the same catalog/raw paths the app normally serves.
- [ ] The proof explicitly checks that no analysis run history or runtime batch artifacts are created for the newly synced video.
- [ ] The verification script leaves durable, repeatable evidence another agent can rerun.

## Verification

- `bash scripts/verify-s03-source-refresh.sh`
- `npx vitest run src/lib/__tests__/source-refresh.test.ts src/lib/__tests__/catalog-cache.test.ts`

## Observability Impact

- Signals added/changed: verification output ties git commit movement to refresh records and catalog visibility for a representative new video.
- How a future agent inspects this: rerun `bash scripts/verify-s03-source-refresh.sh`, then inspect `data/catalog/last-source-refresh.json`, `data/catalog/last-import-validation.json`, and the synced video’s absence of `data/insights/<videoId>/run.json`.
- Failure state exposed: the proof distinguishes source-update failure, catalog-publish failure, and accidental analysis side effects.

## Inputs

- `src/lib/source-refresh.ts` and `scripts/refresh-source-catalog.ts` — refresh authority and CLI from T01.
- `src/lib/catalog.ts` and `src/app/api/raw/route.ts` — runtime read paths that must reflect refreshed source state.
- Existing catalog fixture helpers/tests — foundation for temporary transcript repo setup.
- S01 summary — reminder that analysis evidence should only appear when the explicit analyze flow is invoked.

## Expected Output

- `scripts/verify-s03-source-refresh.sh` — repeatable contract-level proof for real upstream refresh behavior.
- Updated refresh/catalog tests — regression coverage for commit advancement, cache pickup, and no-analysis side effects.
- `.gsd/milestones/M002/slices/S03/S03-SUMMARY.md` — durable record of the demonstrated upstream-refresh result.

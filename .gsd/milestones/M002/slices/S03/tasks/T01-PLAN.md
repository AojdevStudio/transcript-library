---
estimated_steps: 4
estimated_files: 6
---

# T01: Introduce a refresh-only source sync service and durable refresh record

**Slice:** S03 — Source Repo Sync Contract and Auto-Refresh
**Milestone:** M002

## Description

Split the existing sync boundary at its real fault line. This task creates a shared refresh authority that fast-forwards the local `PLAYLIST_TRANSCRIPTS_REPO` checkout, rebuilds the SQLite catalog only after that repo step succeeds, and records durable refresh evidence. The sync-hook route then reuses that authority instead of `submitRuntimeBatch()` so source refresh no longer implies analysis work.

## Steps

1. Add `src/lib/source-refresh.ts` as the shared refresh authority: inspect repo state, run the safe git update flow against the configured remote/branch, invoke `rebuildCatalogFromCsv()` only after a successful repo update/no-op, and persist `data/catalog/last-source-refresh.json` with outcome, phase, commit refs, request metadata, and catalog version.
2. Write `src/lib/__tests__/source-refresh.test.ts` to cover updated/no-op/failed refresh cases, including preservation of the last-known-good catalog when git or rebuild fails, and update `src/lib/__tests__/sync-hook-route.test.ts` so the route asserts refresh-only outcomes and that `submitRuntimeBatch()` is no longer the sync-hook dependency.
3. Add `scripts/refresh-source-catalog.ts` as the operator/automation CLI entrypoint over the shared service, and rewire `src/app/api/sync-hook/route.ts` to call the new service while preserving auth, idempotency-key extraction, and hosted payload sanitization.
4. Run the focused tests and inspect the emitted refresh record to confirm the new authority names what changed, when, and why without starting analysis or writing batch artifacts.

## Must-Haves

- [ ] The sync path has one shared refresh authority that owns git fast-forward, catalog rebuild, and durable refresh evidence.
- [ ] `POST /api/sync-hook` no longer uses `submitRuntimeBatch()` as its primary behavior.
- [ ] Failed git or rebuild steps leave the previous live catalog and validation report usable.
- [ ] Refresh records distinguish `updated`, `noop`, and `failed` outcomes with enough detail for unattended diagnosis.

## Verification

- `npx vitest run src/lib/__tests__/source-refresh.test.ts src/lib/__tests__/sync-hook-route.test.ts`
- `node --import tsx scripts/refresh-source-catalog.ts --check`

## Observability Impact

- Signals added/changed: `last-source-refresh.json` with refresh outcome, phase, request metadata, commit refs, and catalog version.
- How a future agent inspects this: run the refresh CLI or sync-hook, then inspect `data/catalog/last-source-refresh.json` and `data/catalog/last-import-validation.json` together.
- Failure state exposed: refresh failures identify whether the break happened before git update, during fast-forward, or during catalog rebuild.

## Inputs

- `src/app/api/sync-hook/route.ts` — current webhook auth/idempotency contract to preserve while changing behavior.
- `src/lib/runtime-batches.ts` — current coupled sync behavior to remove from the source-refresh path without breaking explicit analysis workflows.
- `scripts/rebuild-catalog.ts` and `src/lib/catalog-import.ts` — existing catalog publish authority and atomic last-known-good semantics.
- Slice research summary — required split between source refresh and analysis submission.

## Expected Output

- `src/lib/source-refresh.ts` — shared source-refresh authority and durable refresh record writer.
- `scripts/refresh-source-catalog.ts` — refresh-only CLI entrypoint suitable for operators and later unattended jobs.
- Updated `src/app/api/sync-hook/route.ts` and route/tests — refresh-only sync contract with preserved auth/idempotency behavior.

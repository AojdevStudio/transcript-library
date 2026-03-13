---
id: T01
parent: S04
milestone: M001
provides:
  - Hosted preflight validation at server startup
  - Shared private API boundary guard for all internal routes
  - Response payload sanitization in hosted mode
  - SYNC_TOKEN aligned with universal PRIVATE_API_TOKEN model
key_files:
  - src/lib/hosted-config.ts
  - src/lib/private-api-guard.ts
  - src/instrumentation.ts
key_decisions:
  - Use instrumentation.ts as the concrete server bootstrap preflight entrypoint
  - One shared PRIVATE_API_TOKEN guard for all /api/* routes instead of per-route ad-hoc checks
  - Local dev is zero-config — guard is no-op when HOSTED is unset
  - PRIVATE_API_TOKEN accepted as universal override on sync-hook alongside SYNC_TOKEN
  - sanitizePayload strips filesystem paths, provider details, and worker PIDs in hosted mode
patterns_established:
  - requirePrivateApi(req) guard pattern for route handlers
  - sanitizePayload(obj) for response sanitization
  - isHosted()/isLocalDev() for deployment mode detection
  - assertPreflight() for fail-early deploy validation
observability_surfaces:
  - "[hosted-config]" prefixed console output at server startup showing preflight pass/fail
  - 401 responses with { ok: false, error: "unauthorized" } for rejected API calls in hosted mode
  - 503 responses when PRIVATE_API_TOKEN is not configured in hosted mode
duration: 35m
verification_result: passed
completed_at: 2026-03-12
blocker_discovered: false
---

# T01: 04-hosted-hardening 01

**Added hosted preflight validation, shared private API boundary, and response sanitization across all internal routes.**

## What Happened

Built three layers of hosted hardening:

1. **Preflight validation** (`src/lib/hosted-config.ts` + `src/instrumentation.ts`): Server startup validates `PLAYLIST_TRANSCRIPTS_REPO` and `PRIVATE_API_TOKEN` in hosted mode. Missing vars throw with actionable guidance. Local dev logs warnings but never blocks.

2. **Private API guard** (`src/lib/private-api-guard.ts`): One reusable `requirePrivateApi(req)` function applied to all 9 API route handlers. In hosted mode, requires `Authorization: Bearer <PRIVATE_API_TOKEN>`. In local dev, passes everything through.

3. **Response sanitization**: `sanitizePayload()` strips `absPath`, `filePath`, `provider`, `workerPid`, `remoteAddress`, and other internal fields from hosted responses. Local dev gets full diagnostic detail.

The sync-hook route was aligned: it still accepts `SYNC_TOKEN` (backward compatible) but also accepts `PRIVATE_API_TOKEN` as a universal override. Its response is now sanitized in hosted mode.

## Verification

- **46 new/updated tests pass** across 4 test files:
  - `hosted-config.test.ts` (11 tests): preflight pass/fail, mode detection, assertPreflight throws
  - `private-api-guard.test.ts` (7 tests): local-dev passthrough, hosted rejection, token validation, sanitization
  - `route-access-control.test.ts` (24 tests): every route rejects unauthenticated hosted requests, allows local dev, allows authenticated hosted
  - `sync-hook-route.test.ts` (4 tests): existing tests + PRIVATE_API_TOKEN universal override
- **Full suite**: 93/94 pass. 1 pre-existing failure in `runtime-compat.test.ts` (unrelated).
- **TypeScript**: `tsc --noEmit` clean.
- **Build**: `next build` succeeds.

## Diagnostics

- Server startup logs `[hosted-config] ✓ Preflight passed (mode=hosted|local)` or throws with error list.
- Rejected API calls return `{ ok: false, error: "unauthorized" }` with status 401.
- Missing PRIVATE_API_TOKEN in hosted mode returns 503 from guard (defense-in-depth beyond preflight).

## Deviations

None.

## Known Issues

- Pre-existing test failure in `runtime-compat.test.ts` — unrelated to this task.

## Files Created/Modified

- `src/lib/hosted-config.ts` — new: deployment mode detection and preflight validation
- `src/lib/private-api-guard.ts` — new: shared private API boundary guard and response sanitization
- `src/instrumentation.ts` — new: Next.js server bootstrap hook running preflight
- `src/app/api/video/route.ts` — added guard, removed absPath from response, added sanitization
- `src/app/api/raw/route.ts` — added guard
- `src/app/api/analyze/route.ts` — added guard and response sanitization
- `src/app/api/analyze/status/route.ts` — added guard and response sanitization
- `src/app/api/channel/route.ts` — added guard
- `src/app/api/channels/route.ts` — added guard (signature changed to accept req)
- `src/app/api/insight/route.ts` — added guard and response sanitization
- `src/app/api/insight/stream/route.ts` — added guard and SSE payload sanitization
- `src/app/api/sync-hook/route.ts` — added PRIVATE_API_TOKEN universal override and response sanitization
- `src/lib/__tests__/hosted-config.test.ts` — new: 11 tests for preflight and mode detection
- `src/lib/__tests__/private-api-guard.test.ts` — new: 7 tests for guard and sanitization
- `src/lib/__tests__/route-access-control.test.ts` — new: 24 tests for all-route access control
- `src/lib/__tests__/sync-hook-route.test.ts` — updated: added PRIVATE_API_TOKEN acceptance test
- `docs/architecture/system-overview.md` — added hosted runtime and private API boundary section
- `README.md` — added hosted deployment env vars and zero-config local dev note
- `.gsd/DECISIONS.md` — appended 5 decisions

# T01: 04-hosted-hardening 01

**Slice:** S04 — **Milestone:** M001

## Description

Harden the private hosted runtime by adding explicit startup/deploy validation and a shared private API boundary for sensitive routes.

Purpose: Phase 4 starts by turning the current hosted assumptions into enforceable application behavior. This plan keeps the app private and compatibility-preserving while making bad deploys fail early and internal APIs stop depending on ambient trust alone.
Output: One hosted preflight validation layer, one reusable private-boundary helper for sensitive APIs, route coverage proving denial/allow behavior, and operator docs that match the implemented hosted contract.

## Must-Haves

- [ ] Hosted deployments fail early with actionable operator guidance from a concrete server bootstrap/preflight entrypoint before hosted traffic is served.
- [ ] The app encodes one explicit private-boundary policy for internal API routes instead of relying on implicit perimeter trust alone.
- [ ] Transcript, artifact, and runtime-trigger endpoints reject untrusted callers while preserving the current private deployment model and keeping app-level SaaS auth out of scope.
- [ ] Sensitive route payloads stop leaking internal filesystem paths, artifact path bundles, raw provider/runtime details, or other internals that are unnecessary for trusted private clients.
- [ ] Existing private automation behavior for `SYNC_TOKEN` remains compatible, but it is aligned with the broader hosted guard model instead of staying special-cased forever.
- [ ] Local development remains low-friction and does not require hosted-only configuration just to browse or iterate locally.

## Files

- `src/instrumentation.ts`
- `src/app/layout.tsx`
- `src/lib/hosted-config.ts`
- `src/lib/private-api-guard.ts`
- `src/app/api/raw/route.ts`
- `src/app/api/analyze/route.ts`
- `src/app/api/analyze/status/route.ts`
- `src/app/api/video/route.ts`
- `src/app/api/channel/route.ts`
- `src/app/api/channels/route.ts`
- `src/app/api/insight/route.ts`
- `src/app/api/insight/stream/route.ts`
- `src/app/api/sync-hook/route.ts`
- `src/lib/catalog.ts`
- `src/lib/catalog-db.ts`
- `src/lib/analysis.ts`
- `src/lib/insights.ts`
- `src/lib/__tests__/hosted-config.test.ts`
- `src/lib/__tests__/private-api-guard.test.ts`
- `src/lib/__tests__/route-access-control.test.ts`
- `src/lib/__tests__/sync-hook-route.test.ts`
- `README.md`
- `docs/architecture/system-overview.md`

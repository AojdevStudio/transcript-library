# T03: 01-artifact-foundations 03

**Slice:** S01 — **Milestone:** M001

## Description

Complete Phase 1 by providing the one-time legacy migration path, narrowing compatibility behavior, and updating the docs and operator workflow for the new JSON-first artifact model.

Purpose: The previous plans make the new artifact contract possible; this plan makes it operationally real and prevents Phase 1 from shipping with indefinite compatibility debt.
Output: A migration script, tested upgrade behavior, JSON-first steady-state read path, and updated deployment/runtime documentation.

## Must-Haves

- [ ] Existing markdown-only insights can be upgraded through an explicit one-time migration path instead of requiring permanent long-lived legacy behavior.
- [ ] Post-migration app behavior is JSON-first while preserving analysis.md as the human-readable report artifact.
- [ ] Phase 1 docs describe the canonical hosted path and the operator expectations for artifact storage on Proxmox.
- [ ] Operators have a concrete way to confirm the migration window is complete and that no legacy markdown-only artifacts remain to be upgraded.

## Files

- `scripts/backfill-insight-artifacts.ts`
- `scripts/migrate-legacy-insights-to-json.ts`
- `src/lib/insights.ts`
- `src/app/api/insight/route.ts`
- `src/components/VideoAnalysisWorkspace.tsx`
- `README.md`
- `docs/architecture/artifact-schema.md`
- `docs/architecture/analysis-runtime.md`
- `docs/plans/2026-03-09-self-hosted-proxmox-deployment.md`
- `src/lib/__tests__/legacy-artifact-migration.test.ts`

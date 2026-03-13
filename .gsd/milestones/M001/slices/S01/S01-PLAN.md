# S01: Artifact Foundations

**Goal:** Establish the shared artifact-path foundation for Phase 1 by adding a lightweight test harness, implementing configurable base-dir resolution, and routing all core insight path helpers through it.
**Demo:** Establish the shared artifact-path foundation for Phase 1 by adding a lightweight test harness, implementing configurable base-dir resolution, and routing all core insight path helpers through it.

## Must-Haves

## Tasks

- [x] **T01: 01-artifact-foundations 01** `est:4 min`
  - Establish the shared artifact-path foundation for Phase 1 by adding a lightweight test harness, implementing configurable base-dir resolution, and routing all core insight path helpers through it.

Purpose: This is the deployment-unblocking base layer for the rest of the phase. Without a single path authority, the hosted Proxmox artifact directory will drift across modules and the later structured-analysis work will inherit that inconsistency.
Output: A working `INSIGHTS_BASE_DIR` resolver, updated path helpers, and automated tests covering default/configured path behavior.

- [x] **T02: 01-artifact-foundations 02** `est:8 min`
  - Adopt the strict structured-analysis contract end to end: prompt for it, parse it, persist it, and expose it to the current UI without redesigning the interface.

Purpose: Phase 1 needs deterministic structured fields instead of markdown heuristics for summary/takeaway/action-item rendering. This plan turns the user’s locked contract into the authoritative runtime path.
Output: A validated `analysis.json` flow, derived `analysis.md`, and UI/runtime behavior that surfaces contract failures clearly.

- [x] **T03: 01-artifact-foundations 03** `est:20 min`
  - Complete Phase 1 by providing the one-time legacy migration path, narrowing compatibility behavior, and updating the docs and operator workflow for the new JSON-first artifact model.

Purpose: The previous plans make the new artifact contract possible; this plan makes it operationally real and prevents Phase 1 from shipping with indefinite compatibility debt.
Output: A migration script, tested upgrade behavior, JSON-first steady-state read path, and updated deployment/runtime documentation.

## Files Likely Touched

- `package.json`
- `vitest.config.ts`
- `src/lib/analysis.ts`
- `src/modules/analysis/index.ts`
- `src/lib/insights.ts`
- `src/lib/headless-youtube-analysis.ts`
- `scripts/nightly-insights.ts`
- `src/lib/__tests__/insights-base-dir.test.ts`
- `src/lib/__tests__/insight-paths.test.ts`
- `src/lib/analysis-contract.ts`
- `src/lib/headless-youtube-analysis.ts`
- `src/lib/analysis.ts`
- `src/lib/curation.ts`
- `src/lib/insights.ts`
- `src/modules/curation/index.ts`
- `src/app/api/insight/route.ts`
- `src/components/VideoAnalysisWorkspace.tsx`
- `.claude/skills/HeadlessYouTubeAnalysis/SKILL.md`
- `src/lib/__tests__/analysis-contract.test.ts`
- `src/lib/__tests__/headless-analysis-prompt.test.ts`
- `src/lib/__tests__/insight-legacy-fallback.test.ts`
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

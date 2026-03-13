# T01: 01-artifact-foundations 01

**Slice:** S01 — **Milestone:** M001

## Description

Establish the shared artifact-path foundation for Phase 1 by adding a lightweight test harness, implementing configurable base-dir resolution, and routing all core insight path helpers through it.

Purpose: This is the deployment-unblocking base layer for the rest of the phase. Without a single path authority, the hosted Proxmox artifact directory will drift across modules and the later structured-analysis work will inherit that inconsistency.
Output: A working `INSIGHTS_BASE_DIR` resolver, updated path helpers, and automated tests covering default/configured path behavior.

## Must-Haves

- [ ] Runtime insight paths resolve from INSIGHTS_BASE_DIR when configured and fall back to repo data/insights when unset or blank.
- [ ] All primary insight read and write helpers use shared path resolution rather than rebuilding artifact roots ad hoc.
- [ ] Invalid or unsafe videoId values are rejected at filesystem helper boundaries used by this phase.

## Files

- `package.json`
- `vitest.config.ts`
- `src/lib/analysis.ts`
- `src/modules/analysis/index.ts`
- `src/lib/insights.ts`
- `src/lib/headless-youtube-analysis.ts`
- `scripts/nightly-insights.ts`
- `src/lib/__tests__/insights-base-dir.test.ts`
- `src/lib/__tests__/insight-paths.test.ts`

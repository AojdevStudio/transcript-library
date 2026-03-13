---
id: T02
parent: S01
milestone: M001
provides:
  - Strict structured analysis parser with readable validation failures
  - JSON-first analysis persistence that writes both analysis.json and analysis.md
  - Validated UI read path with legacy markdown fallback during migration
requires: []
affects: []
key_files: []
key_decisions: []
patterns_established: []
observability_surfaces: []
drill_down_paths: []
duration: 8 min
verification_result: passed
completed_at: 2026-03-09
blocker_discovered: false
---

# T02: 01-artifact-foundations 02

**# Phase 1 Plan 2: Structured Analysis Contract Summary**

## What Happened

# Phase 1 Plan 2: Structured Analysis Contract Summary

**Strict `analysis.json` validation with JSON-first runtime writes and UI reads, while preserving `analysis.md` report rendering and legacy markdown migration safety**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-09T20:11:00Z
- **Completed:** 2026-03-09T20:19:07Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments

- Added a strict structured-analysis parser with explicit failure coverage for invalid JSON, fenced payloads, missing required fields, invalid arrays, and empty report bodies.
- Updated the headless provider contract so successful runs validate provider JSON and persist both `analysis.json` and derived `analysis.md`.
- Switched the insight API/UI path to prefer validated structured sections, keep markdown-only legacy artifacts readable during migration, and expose failed run state clearly.

## Task Commits

Each task was committed atomically:

1. **Task 1: Define and test the strict structured analysis parser** - `f48ff29` (`feat`)
2. **Task 2: Update the worker prompt and runtime write path for JSON-first analysis** - `a64c013` (`feat`)
3. **Task 3: Swap UI-facing structured sections to validated data and preserve report rendering** - `d5d46a1` (`feat`)

## Files Created/Modified

- `src/lib/analysis-contract.ts` - Defines the strict runtime contract and parser for structured analysis payloads.
- `src/lib/analysis.ts` - Validates provider output before writing `analysis.json`, `analysis.md`, and run/status metadata.
- `src/lib/headless-youtube-analysis.ts` - Requests the fixed JSON envelope explicitly in the provider prompt.
- `.claude/skills/HeadlessYouTubeAnalysis/SKILL.md` - Documents the approved JSON contract for local headless runs.
- `src/lib/insights.ts` - Prefers validated structured JSON for curated sections and keeps legacy markdown fallback explicit.
- `src/app/api/insight/route.ts` - Surfaces running/failed status and structured-contract failures without hiding them behind existing markdown.
- `src/components/VideoAnalysisWorkspace.tsx` - Makes failed status more visible while preserving full report rendering.
- `src/lib/__tests__/analysis-contract.test.ts` - Covers parser success/failure behavior.
- `src/lib/__tests__/headless-analysis-prompt.test.ts` - Locks the prompt to the strict JSON contract.
- `src/lib/__tests__/insight-legacy-fallback.test.ts` - Proves legacy markdown-only insights still render during migration and invalid structured files fail loudly.

## Decisions Made

- Used the locked contract fields as-is instead of redesigning the schema during execution.
- Treated `analysis.json` as authoritative for UI sections and `analysis.md` as the human-readable artifact derived from validated `reportMarkdown`.
- Refused to silently fall back to markdown heuristics when a structured file exists but fails validation, so operators and users see a clear failed state.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `npm run e2e` could not start its configured dev server on port `3939` because the workspace already had a user-owned `next dev` instance holding the shared `.next` lock on port `3000`. Verification still completed by running the same Playwright suite through `npm run e2e -- --config=playwright.existing-server.config.ts` against the already-running local app, avoiding disruption to the active session.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for `01-03-PLAN.md`.
The structured artifact contract is now consistent across prompt, persistence, API, and UI read paths, so the migration-focused follow-up work can build on a stable contract.

## Self-Check: PASSED

- Verified `.planning/phases/01-artifact-foundations/01-02-SUMMARY.md` exists.
- Verified task commits `f48ff29`, `a64c013`, and `d5d46a1` exist in git history.

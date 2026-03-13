# T02: 01-artifact-foundations 02

**Slice:** S01 — **Milestone:** M001

## Description

Adopt the strict structured-analysis contract end to end: prompt for it, parse it, persist it, and expose it to the current UI without redesigning the interface.

Purpose: Phase 1 needs deterministic structured fields instead of markdown heuristics for summary/takeaway/action-item rendering. This plan turns the user’s locked contract into the authoritative runtime path.
Output: A validated `analysis.json` flow, derived `analysis.md`, and UI/runtime behavior that surfaces contract failures clearly.

## Must-Haves

- [ ] New analysis runs validate provider output against the strict structured contract before structured fields reach the UI.
- [ ] Successful runs write both analysis.json and analysis.md from the validated payload.
- [ ] Existing markdown-only insights remain readable through an explicit transition-safe fallback until the one-time migration is run.
- [ ] Invalid structured output causes explicit failed status and visible error state rather than silently degrading into partial UI content.

## Files

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

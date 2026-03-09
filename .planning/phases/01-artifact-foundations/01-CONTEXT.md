# Phase 1: Artifact Foundations - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 1 unblocks hosted deployment by separating runtime insight storage from the app release tree and by establishing a strict, validated structured analysis artifact for the existing UI. This phase covers configurable artifact storage, the `analysis.json` contract, a one-time migration away from legacy markdown-only artifacts, and the validation/error behavior needed to make those changes safe without redesigning the UI.

</domain>

<decisions>
## Implementation Decisions

### Structured analysis contract

- Use the current skill-defined JSON contract as the Phase 1 contract rather than redesigning it during planning.
- Treat the existing contract as strict for this phase; if the shape needs to change later, update the skill and then update the code.
- `analysis.json` is the forward path for structured data, with `analysis.md` preserved as the human-readable full report artifact.

### Legacy artifact migration

- Do not carry long-term markdown-only compatibility debt as the steady state.
- Create a one-time migration script that converts existing markdown-only insights into the new JSON-backed artifact shape.
- Going forward, new and migrated insights should be JSON-first.

### Failure visibility

- Invalid structured output must fail loudly in both operator-facing logs and user-visible UI state.
- Phase 1 should not hide contract failures behind silent fallbacks that make bad output look successful.

### Production storage path

- Treat `/srv/transcript-library/insights` as the canonical production insights path for the hosted Proxmox deployment.
- Document and support `INSIGHTS_BASE_DIR=/srv/transcript-library/insights` as the production configuration.
- Local development should continue using the current in-repo default when `INSIGHTS_BASE_DIR` is unset.

### Artifact layout expectations

- Keep the current artifact layout under the base directory: one directory per `videoId` with the familiar filenames.
- Do not use Phase 1 to substantially redesign the artifact folder structure.
- Missing directories should be created automatically during normal runtime writes.
- If the configured directory still cannot be written, surface the failure clearly in both logs and UI state.

### Claude's Discretion

- Exact internal validation-library choice and parser implementation details
- Exact shape of migration-script ergonomics and operator invocation
- Exact test split between unit, integration, and smoke coverage as long as the required behaviors are protected

</decisions>

<specifics>
## Specific Ideas

- "JSON baby" is the operating preference after the one-time migration.
- Existing implementation plans are committed inputs for this phase:
  - `docs/plans/2026-03-09-configurable-insights-base-dir.md`
  - `docs/plans/2026-03-09-structured-analysis-json-contract.md`
- Production deployment layout should align with the existing Proxmox deployment direction:
  - app releases under `/opt/transcript-library/releases/...`
  - mutable runtime state under `/srv/transcript-library/...`
- UI direction should remain stable; this phase should change backend/storage behavior without turning into a UI redesign.

</specifics>

<code_context>

## Existing Code Insights

### Reusable Assets

- `src/lib/analysis.ts`: owns current artifact-path helpers, run/status metadata, provider spawning, and is the natural home for base-dir resolution and path centralization.
- `src/lib/insights.ts`: owns artifact reads, preview/curation loading, and compatibility handling for current insight files.
- `src/lib/headless-youtube-analysis.ts`: owns prompt construction and cached video metadata writes, so it is a key integration point for structured output and metadata-path consistency.
- `src/lib/curation.ts`: currently derives UI sections heuristically from markdown and is the main transition point from markdown heuristics to validated structured sections.
- `src/components/VideoAnalysisWorkspace.tsx`: already has UI status handling that can surface structured-analysis failures without redesigning the interface.
- `docs/plans/2026-03-09-configurable-insights-base-dir.md` and `docs/plans/2026-03-09-structured-analysis-json-contract.md`: existing phased implementation detail to reuse instead of replanning from scratch.

### Established Patterns

- Runtime/business logic lives in `src/lib/*` and is re-exported through thin `src/modules/*/index.ts` facades.
- The app currently preserves additive compatibility for older artifact formats, but the user wants this phase to prefer a one-time cleanup path over permanent compatibility debt.
- Error handling today includes many silent fallback branches, so Phase 1 should deliberately improve clarity where structured-output and storage failures occur.
- There is no established unit-test runner yet; adding Vitest or an equivalent server-side test harness fits the current gap and the committed implementation plans.

### Integration Points

- `/api/insight` and related insight readers must consume the new structured artifact path without breaking the current video workspace.
- Analysis worker output generation in `src/lib/analysis.ts` and `src/lib/headless-youtube-analysis.ts` must coordinate the new `analysis.json` + `analysis.md` write flow.
- Artifact migration should connect to existing `scripts/` operational tooling rather than inventing a one-off hidden path.

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

_Phase: 01-artifact-foundations_
_Context gathered: 2026-03-09_

# Phase 1: Artifact Foundations - Research

**Researched:** 2026-03-09
**Domain:** Filesystem-backed artifact storage, structured analysis contracts, and test infrastructure for a Next.js Node runtime
**Confidence:** HIGH

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- Use the current skill-defined JSON contract as the Phase 1 contract rather than redesigning it during planning.
- Treat the existing contract as strict for this phase; if the shape needs to change later, update the skill and then update the code.
- `analysis.json` is the forward path for structured data, with `analysis.md` preserved as the human-readable full report artifact.
- Do not carry long-term markdown-only compatibility debt as the steady state.
- Create a one-time migration script that converts existing markdown-only insights into the new JSON-backed artifact shape.
- Going forward, new and migrated insights should be JSON-first.
- Invalid structured output must fail loudly in both operator-facing logs and user-visible UI state.
- Treat `/srv/transcript-library/insights` as the canonical production insights path for the hosted Proxmox deployment.
- Document and support `INSIGHTS_BASE_DIR=/srv/transcript-library/insights` as the production configuration.
- Local development should continue using the current in-repo default when `INSIGHTS_BASE_DIR` is unset.
- Keep the current artifact layout under the base directory: one directory per `videoId` with the familiar filenames.
- Missing directories should be created automatically during normal runtime writes.
- If the configured directory still cannot be written, surface the failure clearly in both logs and UI state.

### Claude's Discretion

- Exact internal validation-library choice and parser implementation details
- Exact shape of migration-script ergonomics and operator invocation
- Exact test split between unit, integration, and smoke coverage as long as the required behaviors are protected

### Deferred Ideas (OUT OF SCOPE)

- None — discussion stayed within phase scope

</user_constraints>

<research_summary>

## Summary

Phase 1 is best implemented as a focused artifact-contract hardening pass, not as a broad runtime rewrite. The codebase already has clear integration seams in `src/lib/analysis.ts`, `src/lib/insights.ts`, `src/lib/headless-youtube-analysis.ts`, `src/lib/curation.ts`, and `src/components/VideoAnalysisWorkspace.tsx`. That means we can centralize artifact path resolution, add a strict structured-analysis parser, and preserve the current UI by changing the data contract under existing read surfaces rather than by redesigning components.

The strongest implementation path is:

- centralize all artifact root/path construction behind `insightsBaseDir()` and related helpers
- validate provider output before it becomes UI data
- write `analysis.json` and derive `analysis.md` from validated payloads
- replace permanent markdown-only fallback with a one-time migration script
- install a lightweight server-side test runner so this behavior is repeatable

**Primary recommendation:** Plan Phase 1 as three executable tracks: storage-path centralization, structured-contract adoption, and migration-plus-verification.
</research_summary>

<standard_stack>

## Standard Stack

The established libraries/tools for this phase:

### Core

| Library                                            | Version         | Purpose                                                     | Why Standard                                                                          |
| -------------------------------------------------- | --------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Existing Node.js `fs` + `path` APIs                | project runtime | Artifact path resolution, directory creation, migration IO  | Already used everywhere in the runtime and matches the repo’s filesystem-first design |
| Existing TypeScript runtime modules in `src/lib/*` | project-local   | Central home for storage and contract logic                 | Fits current code organization and avoids unnecessary framework churn                 |
| Vitest                                             | add in Phase 1  | Unit/integration-style verification for server-side helpers | Lowest-friction way to add focused coverage for TypeScript modules in this repo       |

### Supporting

| Library                                    | Version           | Purpose                                                    | When to Use                                                    |
| ------------------------------------------ | ----------------- | ---------------------------------------------------------- | -------------------------------------------------------------- |
| Playwright                                 | already installed | Smoke verification for no-regression UI/runtime flows      | Use after contract/storage changes to confirm pages still load |
| Existing module facades in `src/modules/*` | project-local     | Preserve public import surfaces while lib internals change | Use when exported APIs need to remain stable for pages/routes  |

### Alternatives Considered

| Instead of                                  | Could Use                              | Tradeoff                                                                 |
| ------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------ |
| Vitest                                      | Jest                                   | Heavier setup for a repo that currently has no server-side unit harness  |
| Hand-maintained long-term markdown fallback | One-time migration script              | Migration adds one explicit step but avoids ongoing compatibility debt   |
| Broad artifact-layout redesign              | Keep current `videoId` directory shape | Current layout is already understood by the codebase and deployment docs |

**Installation:**

```bash
npm install -D vitest
```

</standard_stack>

<architecture_patterns>

## Architecture Patterns

### Recommended Project Structure

```text
src/
├── lib/                  # artifact/runtime logic stays here
├── modules/              # public re-export boundaries stay stable
└── components/           # existing UI surfaces consume the new contract

scripts/
└── [migration script]    # one-time markdown -> json artifact upgrade
```

### Pattern 1: Centralized path authority

**What:** All code that builds insight artifact paths should route through one shared base-dir resolver plus helper functions.
**When to use:** Any read or write path touching `analysis.json`, `analysis.md`, metadata, logs, or status files.
**Example:**

```ts
export function insightsBaseDir(): string {
  const configured = process.env.INSIGHTS_BASE_DIR?.trim();
  if (configured) return path.resolve(configured);
  return path.join(process.cwd(), "data", "insights");
}
```

### Pattern 2: Validate before persist-before-render

**What:** Treat provider output as untrusted input, validate it into a typed structure, then persist canonical artifacts from that validated structure.
**When to use:** Any output received from `claude` or `codex` before it becomes UI data or disk artifacts.
**Example:**

```ts
const parsed = parseStructuredAnalysis(rawProviderOutput);
writeFileSync(jsonPath, JSON.stringify(parsed, null, 2));
writeFileSync(markdownPath, parsed.reportMarkdown);
```

### Pattern 3: Explicit migration instead of permanent dual-mode logic

**What:** Convert legacy artifacts once, then make the new format the default operating model.
**When to use:** Existing markdown-only insights that must survive the transition without adding indefinite read-path complexity.
**Example:**

```ts
for (const videoId of legacyVideoIds) {
  const markdown = readLegacyMarkdown(videoId);
  const structured = buildStructuredArtifactFromLegacy(markdown, videoId);
  writeStructuredArtifacts(videoId, structured);
}
```

### Anti-Patterns to Avoid

- **Duplicated path construction:** building `process.cwd()/data/insights/...` in multiple modules guarantees drift.
- **Silent parse fallback on invalid JSON:** hides broken provider output and undermines the whole point of a strict contract.
- **Permanent legacy-mode branching everywhere:** spreads compatibility debt across API, UI, and runtime layers.
  </architecture_patterns>

<dont_hand_roll>

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem                 | Don't Build                                  | Use Instead                                               | Why                                                                                |
| ----------------------- | -------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Server-side test runner | ad hoc node scripts for assertions           | Vitest                                                    | Better watch/run ergonomics, clear failures, and TypeScript module testing support |
| Path resolution policy  | scattered string concatenation               | centralized helper functions in `src/lib/analysis.ts`     | Reduces duplication and improves deploy-path consistency                           |
| UI contract parsing     | implicit markdown heading heuristics forever | strict parser for `analysis.json` plus one migration path | Makes UI behavior deterministic and easier to test                                 |

**Key insight:** The custom work here should be domain-specific contract and migration logic, not reinvention of testing or path-governance basics.
</dont_hand_roll>

<common_pitfalls>

## Common Pitfalls

### Pitfall 1: Partial path migration

**What goes wrong:** Some helpers use `INSIGHTS_BASE_DIR`, while others still hardcode `data/insights`.
**Why it happens:** Path logic currently lives in multiple modules.
**How to avoid:** Grep for all existing `data/insights` construction and route them through shared helpers before declaring the refactor done.
**Warning signs:** Local dev works, but metadata/log/status files still land in the release tree in hosted mode.

### Pitfall 2: Contract introduced only at read time

**What goes wrong:** The app adds `analysis.json` readers but still lets invalid provider output be written unvalidated.
**Why it happens:** It feels easier to validate only where UI consumes the file.
**How to avoid:** Parse and validate at write time, then persist only validated artifacts.
**Warning signs:** Corrupt `analysis.json` files exist on disk or UI failures only happen after the fact.

### Pitfall 3: Migration debt disguised as compatibility

**What goes wrong:** Markdown-only fallback stays in the app indefinitely because migration never becomes operationally explicit.
**Why it happens:** Compatibility feels safer in the short term.
**How to avoid:** Make the one-time migration script part of the plan and define a clear post-migration steady state.
**Warning signs:** New code keeps branching on “legacy or new” with no removal point.
</common_pitfalls>

<code_examples>

## Code Examples

Verified patterns from this repository:

### Central artifact ownership

```ts
// Source: src/modules/analysis/index.ts
export {
  insightDir,
  insightsBaseDir,
  statusPath,
  analysisPath,
  metadataCachePath,
} from "@/lib/analysis";
```

### Current curation seam to replace with strict structured fields

```ts
// Source: src/lib/curation.ts
export function curateYouTubeAnalyzer(md: string): CuratedInsight {
  // currently derives summary/takeaways/notable/action sections heuristically
}
```

### Existing UI status surface

```ts
// Source: src/components/VideoAnalysisWorkspace.tsx
type Status = "idle" | "running" | "complete" | "failed";
// existing UI already has visible status/error state that can surface contract failures
```

</code_examples>

<sota_updates>

## State of the Art (2024-2025)

What's changed recently:

| Old Approach                            | Current Approach                                           | When Changed              | Impact                                            |
| --------------------------------------- | ---------------------------------------------------------- | ------------------------- | ------------------------------------------------- |
| Heuristic UI parsing from markdown only | structured UI contracts plus markdown as a report artifact | current product direction | more predictable rendering and easier testing     |
| Smoke-only browser testing              | combine smoke coverage with focused server-side unit tests | modern TS app practice    | lower regression risk for storage/runtime helpers |

**New tools/patterns to consider:**

- Structured machine-readable artifacts alongside human-readable reports
- Validation at IO boundaries rather than trusting model output

**Deprecated/outdated:**

- Permanent reliance on markdown heading heuristics for UI-critical structured sections
- Release-tree runtime writes for hosted deployment
  </sota_updates>

<open_questions>

## Open Questions

1. **How much of the current markdown curation logic remains after migration?**
   - What we know: structured fields should become the forward path.
   - What's unclear: whether markdown heuristics stay only for migration tooling or remain as a narrow emergency fallback.
   - Recommendation: planner should explicitly constrain heuristic curation to migration/backfill or legacy-only code paths.

2. **Should the migration script infer structured sections heuristically from old markdown or require operator review for edge cases?**
   - What we know: user wants a one-time migration, not permanent dual support.
   - What's unclear: how strict the script should be about imperfect legacy artifacts.
   - Recommendation: plan for deterministic best-effort migration with clear logging of files that need manual review.
     </open_questions>

## Validation Architecture

- Add Wave 0 test infrastructure for server-side TypeScript module tests using Vitest.
- Protect these behaviors with automated checks:
  - `insightsBaseDir()` default/configured/blank handling
  - shared path helpers resolving under `INSIGHTS_BASE_DIR`
  - structured analysis parser success/failure cases
  - prompt contract asking for strict JSON output
  - one representative migration-path test or fixture
- Keep Playwright smoke coverage as a final no-regression check for the existing UI shell.

<sources>
## Sources

### Primary (HIGH confidence)

- Repository source files:
  - `src/lib/analysis.ts`
  - `src/lib/insights.ts`
  - `src/lib/headless-youtube-analysis.ts`
  - `src/lib/curation.ts`
  - `src/components/VideoAnalysisWorkspace.tsx`
- Committed phase inputs:
  - `docs/plans/2026-03-09-configurable-insights-base-dir.md`
  - `docs/plans/2026-03-09-structured-analysis-json-contract.md`
- Project planning artifacts:
  - `.planning/PROJECT.md`
  - `.planning/REQUIREMENTS.md`
  - `.planning/phases/01-artifact-foundations/01-CONTEXT.md`

### Secondary (MEDIUM confidence)

- `.planning/codebase/STRUCTURE.md`
- `.planning/codebase/CONVENTIONS.md`
- `.planning/codebase/TESTING.md`

### Tertiary (LOW confidence - needs validation)

- None
  </sources>

<metadata>
## Metadata

**Research scope:**

- Core technology: filesystem artifact management and structured analysis parsing
- Ecosystem: server-side testing approach for this repo
- Patterns: centralized path authority, strict IO validation, explicit migration
- Pitfalls: partial path migration, silent parse fallback, permanent compatibility debt

**Confidence breakdown:**

- Standard stack: HIGH - mostly project-local decisions with one lightweight testing addition
- Architecture: HIGH - strongly anchored in current repo seams and committed implementation plans
- Pitfalls: HIGH - directly reflected in current code and concern inventory
- Code examples: HIGH - sourced from the repo itself

**Research date:** 2026-03-09
**Valid until:** 2026-04-08
</metadata>

---

_Phase: 01-artifact-foundations_
_Research completed: 2026-03-09_
_Ready for planning: yes_

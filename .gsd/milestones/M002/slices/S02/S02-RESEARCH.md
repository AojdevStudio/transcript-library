# M002/S02 — Research

**Date:** 2026-03-13

## Summary

S02 directly owns **R005** (historical broken analysis artifacts are detectable, understandable, and rerunnable). The slice also constrains **R006** downstream, because S04 can only automate repairs that S02 proves are safe and mechanically classifiable. In practice, this slice is not about the old flat markdown migration anymore. That migration gate already reports `remainingLegacyCount: 0` in `data/insights/.migration-status.json`. The real problem is the checked-in per-video artifact population under `data/insights/<videoId>/`.

A dry scan through the current runtime authority (`reconcileRuntimeArtifacts`) shows **11 of 13** checked-in video directories currently reconcile as mismatches. The mismatches collapse into two dominant categories: **8 `artifacts-without-run`** cases and **3 `missing-structured-analysis`** cases. That is useful because it narrows S02 from a vague “historical drift” problem into two concrete repair classes with different safety envelopes.

The key constraint is provenance. The codebase already has a safe deterministic repair path for “markdown exists but structured JSON is missing” via the same curation/validation logic used in the legacy migration script. It does **not** have enough durable evidence to honestly reconstruct historical `run.json` for directories that only have `analysis.md`/`analysis.json` and no run record. Those should remain explicitly **rerun-ready**, not silently “fixed” by inventing history.

## Recommendation

Treat S02 as two separate repair contracts:

1. **Repair-in-place: `missing-structured-analysis`**
   - Reuse the markdown → structured JSON derivation from `scripts/migrate-legacy-insights-to-json.ts` for directories that already have `run.json` and `analysis.md` but lack `analysis.json`.
   - Normalize the legacy runtime records into the modern contract only if the implementation explicitly rewrites them; the current readers normalize in memory but do not persist upgrades.
   - Verify this class by repairing one representative historical directory and proving `reconciliation.json` moves from `mismatch` to `resolved` without requiring a rerun.

2. **Rerun-only repair: `artifacts-without-run`**
   - Do **not** synthesize historical `run.json` or `runs/<runId>/` state for directories that lack a durable run record.
   - Surface them clearly as `rerun-ready` via reconciliation and the insight/analyze routes, then repair a representative example by running the normal analysis flow again.
   - The rerun is the honest repair because it regenerates canonical runtime artifacts (`run.json`, `status.json`, `analysis.json`, `analysis.md`, slugged markdown, attempt logs) instead of fabricating provenance.

This keeps S02 additive and operator-safe: deterministic backfill where the source artifact is sufficient, rerun where it is not.

## Don't Hand-Roll

| Problem                                                       | Existing Solution                                                        | Why Use It                                                                                                                                           |
| ------------------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Classifying historical drift                                  | `src/lib/runtime-reconciliation.ts`                                      | It is already the shared runtime authority used by routes and SSE payloads; a repair script should classify through it, not invent a second scanner. |
| Converting markdown into valid structured JSON                | `scripts/migrate-legacy-insights-to-json.ts` + `parseStructuredAnalysis` | The curation and validation path already exists and enforces the same structured artifact contract the app reads.                                    |
| Preserving human-readable slugged markdown artifacts          | `scripts/backfill-insight-artifacts.ts`                                  | It already knows how to derive display artifact names from metadata/frontmatter and avoids duplicating slug logic.                                   |
| Determining whether rerun is allowed from user-visible routes | `src/app/api/analyze/route.ts` + `src/app/api/insight/route.ts`          | The current route contract already upgrades mismatch state into `retry-needed` / rerun guidance. S02 should extend that contract, not bypass it.     |

## Existing Code and Patterns

- `src/lib/runtime-reconciliation.ts` — Defines the current mismatch taxonomy: `artifacts-without-run`, `missing-structured-analysis`, `missing-canonical-analysis`, `invalid-structured-analysis`, and run/status disagreement cases. It also persists `reconciliation.json` and marks mismatches as `rerun-ready`.
- `src/lib/analysis.ts` — Normalizes legacy `run.json` and `status.json` formats **in memory** (`normalizeRunFile`, `normalizeStatusFile`) but does not rewrite them on disk. That means any “cleanup” that expects modern files must persist them deliberately.
- `src/app/api/analyze/route.ts` — Already allows reruns when `getAnalyzeStartEligibility()` says “already analyzed” but reconciliation says the latest artifacts are inconsistent. This is the route-level escape hatch S02 should preserve.
- `src/app/api/insight/route.ts` — Forces mismatch states into `status: failed`, `analyzeOutcome: retry-needed`, and `retryable: true`, which is the current operator-facing contract for drift.
- `src/lib/runtime-stream.ts` — Uses reconciliation plus runtime snapshot to generate retry guidance. S02 repairs should continue flowing through this payload rather than adding a separate UI-only signal.
- `scripts/migrate-legacy-insights-to-json.ts` — Useful for structured backfill logic, but it only scans flat legacy files at `data/insights/<videoId>.md`. It does **not** repair per-directory historical drift.
- `scripts/backfill-insight-artifacts.ts` — Provides `ensureDisplayArtifact(videoId)`, which should be reused if a repair recreates or normalizes canonical markdown.
- `src/lib/__tests__/runtime-reconciliation.test.ts` — Encodes the intended behavior for mismatch detection, resolution, and insight-route surfacing. This is the current contract test to extend.

## Current Historical Inventory

Dry scan performed by calling `reconcileRuntimeArtifacts(videoId)` across `data/insights/*`.

### Mismatch classes now

- **`artifacts-without-run` (8 videos)**
  - `HGPTUc7tEq4`
  - `I1NdVZ6l5CQ`
  - `PJnCPqPheX0`
  - `bzWI3Dil9Ig`
  - `d8d9EZHU7fw`
  - `mZzhfPle9QU`
  - `pAIF7vZm5k0`
  - `sOPhVSeimtI`
- **`missing-structured-analysis` (3 videos)**
  - `V5A1IU8VVp4`
  - `f8cfH5XX-XU`
  - `kcOowmrVI7k`
- **Healthy baselines**
  - `RpUTF_U4kiw` → `resolved` after S01 proof run
  - `We7BZVKbCVw` → `ok` idle/no artifacts baseline

### What the classes mean operationally

- `missing-structured-analysis` is the safer repair class because those videos already have:
  - `analysis.md`
  - legacy `run.json`
  - legacy `status.json`
  - enough title metadata to rebuild slugged markdown if needed
- `artifacts-without-run` is the riskier class because the runtime has no durable run authority to attach the artifacts to. Some of these have `analysis.json` + `analysis.md`; others have only `analysis.md` and a legacy `status.json`; none have `run.json`.

## Constraints

- The project rule is additive migration, not destructive rewrite. Historical repair should preserve existing readable artifacts and write missing contract files, not delete evidence.
- The app remains machine-keyed by `videoId`; any repair scanner or script should operate at the `data/insights/<videoId>/` boundary.
- `run.json` is the durable latest-run authority. If a directory has no run record, the runtime currently treats that as a mismatch by design.
- `status.json` and `run.json` legacy normalization happens on read only. Bulk repair that wants modern records on disk must explicitly rewrite them.
- `reconcileRuntimeArtifacts()` writes `reconciliation.json` as a side effect. Any scan or script using it will mutate the artifact tree.
- Legacy markdown fallback is already gated off by `.migration-status.json` with `remainingLegacyCount: 0`, so S02 cannot rely on the old flat-file compatibility path to hide directory drift.
- There is currently no checked-in repair script for per-directory historical drift. The only scripts in this area are migration, display-artifact backfill, catalog rebuild, nightly batch work, and S01 verification.

## Common Pitfalls

- **Faking provenance for `artifacts-without-run`** — Avoid writing synthetic `run.json` from partial evidence like `status.json` timestamps alone. That would make the runtime look healthier by inventing history instead of repairing it.
- **Assuming legacy migration already solved this slice** — `scripts/migrate-legacy-insights-to-json.ts` only handles flat root markdown files. The current historical drift lives inside per-video directories.
- **Trusting absence of `reconciliation.json` as health** — Many directories had no reconciliation file until scanned. Health must be computed from current artifacts, not inferred from whether reconciliation has been persisted before.
- **Calling normalized legacy records “clean” without persisting them** — `readRunMetadata()` and `readStatus()` normalize legacy JSON in memory, but the on-disk files remain legacy until something rewrites them.
- **Building a second mismatch detector for scripts** — Use `reconcileRuntimeArtifacts()` so the script path, API path, and SSE path share one classification contract.

## Open Risks

- `artifacts-without-run` may tempt an overreach into synthetic history reconstruction. That would violate the current durable-run model and make S04 automation unsafe.
- Some directories in the safer class still lack `runs/<runId>/` attempt directories. If “clean runtime state” is interpreted to require attempt-level history, in-place repair may still be insufficient and a rerun may be the only truly clean end state.
- `reconciliation.json` currently stores log-tail evidence from the latest stdout/stderr files when present. Historical directories with sparse or missing logs may end up with weak evidence, so operator readability may still need improvement even after classification.
- Bulk scan/repair scripts will mutate the repository state because reconciliation writes through to disk. Tests and verification should account for that explicitly.
- S04 automation depends on S02 proving exactly which categories are safe to auto-repair. If the slice blurs in-place repair and rerun-only repair, the daily sweep scope will stay ambiguous.

## Skills Discovered

| Technology                    | Skill                                        | Status                                                                                          |
| ----------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Next.js App Router            | `wshobson/agents@nextjs-app-router-patterns` | available externally — install with `npx skills add wshobson/agents@nextjs-app-router-patterns` |
| Vitest                        | `onmax/nuxt-skills@vitest`                   | available externally — install with `npx skills add onmax/nuxt-skills@vitest`                   |
| better-sqlite3                | none found                                   | no relevant published skill found via `npx skills find "better-sqlite3"`                        |
| Debugging process (installed) | `systematic-debugging`                       | installed locally and used as process guidance for this research                                |

## Sources

- Current drift taxonomy and persisted reconciliation contract (source: `src/lib/runtime-reconciliation.ts`)
- Legacy run/status normalization behavior and durable run authority rules (source: `src/lib/analysis.ts`)
- Operator-facing mismatch/rerun contract in workspace reads (source: `src/app/api/insight/route.ts`)
- Rerun unlocking when analysis artifacts exist but reconciliation says mismatch (source: `src/app/api/analyze/route.ts`)
- Runtime stream retry guidance and shared payload shape (source: `src/lib/runtime-stream.ts`)
- Legacy markdown migration scope and limitations (source: `scripts/migrate-legacy-insights-to-json.ts`)
- Display artifact regeneration helper (source: `scripts/backfill-insight-artifacts.ts`)
- Existing reconciliation contract tests (source: `src/lib/__tests__/runtime-reconciliation.test.ts`)
- Existing compatibility tests around durable runtime state (source: `src/lib/__tests__/runtime-compat.test.ts`)
- Migration gate already complete with `remainingLegacyCount: 0` (source: `data/insights/.migration-status.json`)
- Representative historical mismatch examples:
  - `data/insights/f8cfH5XX-XU/reconciliation.json`
  - `data/insights/I1NdVZ6l5CQ/reconciliation.json`
  - `data/insights/V5A1IU8VVp4/reconciliation.json`
- External skill discovery results:
  - `npx skills find "next.js"`
  - `npx skills find "vitest"`
  - `npx skills find "better-sqlite3"`

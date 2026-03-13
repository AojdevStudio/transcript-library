# Phase 2: SQLite Catalog - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 2 moves catalog-backed browsing from synchronous `videos.csv` parsing to SQLite-backed reads while preserving the current home, channel, and video navigation behavior. This phase covers the catalog import shape, the refresh workflow that keeps SQLite up to date, and the minimum validation needed to trust SQLite as the only runtime browse source without turning the phase into a broader runtime or UI redesign.

</domain>

<decisions>
## Implementation Decisions

### Catalog authority and browse shape

- SQLite becomes the authority for browseable catalog metadata in Phase 2.
- Model browsing around one canonical video record per `videoId`, with transcript parts stored as ordered child records for video-detail reads.
- Preserve explicit transcript chunk ordering as the source of truth for transcript-part display.
- When source rows disagree, use a single canonical row for shared video metadata rather than merging fields opportunistically.
- When source data is incomplete but still usable, import the video with safe placeholders such as unknown channel or undated instead of blocking browsing.

### Refresh model

- Normal home, channel, and video metadata reads should be SQLite-only once Phase 2 lands.
- Catalog refresh should happen through explicit import/sync workflows rather than during normal page or API reads.
- Reuse the project’s existing command and hook surfaces for refreshes instead of introducing a new operator UI in this phase.
- Eventual freshness is acceptable for this private workflow; the catalog does not need near-real-time updates between refresh runs.

### Validation and cutover behavior

- Do not keep a runtime CSV fallback path once Phase 2 ships.
- Keep validation lightweight: sanity checks on schema, required fields, counts, and ordering are enough.
- If a refresh fails validation, keep the last known-good SQLite catalog in place instead of publishing partial or broken data.
- If SQLite is missing or invalid at runtime, fail clearly for the operator instead of silently serving CSV again.
- Surface refresh failures through command output and server logs, not a new in-app admin surface.

### Claude's Discretion

- Exact SQLite table names, column layout, indexes, and migration file organization
- Exact import ergonomics inside the existing script/hook flow
- Exact shape of the lightweight validation report as long as it remains additive and does not create a long-lived dual-read runtime

</decisions>

<specifics>
## Specific Ideas

- "Keep it simple" is the guiding preference for Phase 2.
- "Rip off the Band-Aid" means SQLite should replace CSV for runtime browsing rather than introducing a prolonged mixed-read migration.
- Any validation added for `CAT-04` should stay lightweight and import-time only; the user does not want a heavy parity harness or a second runtime source of truth.

</specifics>

<code_context>

## Existing Code Insights

### Reusable Assets

- `src/lib/catalog.ts`: current authority for catalog loading, grouping, channel summaries, video lookup, and transcript part ordering; Phase 2 will replace its CSV-backed internals while preserving its public responsibilities.
- `src/modules/catalog/index.ts`: thin facade that already centralizes catalog exports for pages, routes, and scripts.
- `src/app/page.tsx`: home page depends on `listChannels()` and `groupVideos()` for stats and featured channel browsing.
- `src/app/channels/page.tsx` and `src/app/channel/[channel]/page.tsx`: rely on channel summaries and channel-filtered video lists, so they are the main browse-regression surfaces.
- `src/app/video/[videoId]/page.tsx` and `src/app/api/video/route.ts`: depend on stable `getVideo()` results and ordered transcript parts.
- `src/app/api/channels/route.ts` and `src/app/api/channel/route.ts`: lightweight API wrappers that should inherit the SQLite swap through the shared catalog module.
- `src/app/api/sync-hook/route.ts` and existing `scripts/` tooling: natural integration points for explicit catalog refresh behavior.

### Established Patterns

- Runtime/domain logic lives in `src/lib/*` with `src/modules/*` re-export facades; Phase 2 should keep that split.
- `videoId` remains the machine key across routes, catalog lookups, artifacts, and runtime operations.
- The app currently uses request-time cached helpers (`react` `cache`) around catalog reads; Phase 2 can preserve that public shape while changing the storage backend.
- The current UI direction is intentionally stable, so the SQLite migration should not introduce new catalog management screens or browse-surface redesigns.

### Integration Points

- The catalog import path must read from `PLAYLIST_TRANSCRIPTS_REPO` and continue resolving transcript file paths for the video page.
- Channel grouping, published-date ordering, and transcript-part ordering must stay behaviorally consistent with current browse flows.
- Refresh behavior should connect to existing sync/import automation instead of creating a second operational workflow.
- Lightweight validation should gate catalog replacement during import, not reintroduce CSV into normal runtime reads.

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

_Phase: 02-sqlite-catalog_
_Context gathered: 2026-03-09_

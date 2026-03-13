# Phase 2: SQLite Catalog - Research

**Researched:** 2026-03-10
**Domain:** SQLite-backed catalog storage, import/cutover flow, and browse-path caching for a Next.js Node runtime
**Confidence:** HIGH

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- SQLite becomes the authority for browseable catalog metadata in Phase 2.
- Runtime home, channel, and video metadata reads should be SQLite-only after cutover.
- The canonical machine key remains `videoId`.
- Transcript parts stay ordered child records for video-detail reads.
- Runtime should not keep a CSV fallback after Phase 2 ships.
- Refreshes happen through explicit import/sync workflows, not normal page reads.
- Validation stays lightweight and import-time only.
- If refresh validation fails, keep the last known-good SQLite catalog in place.
- Runtime failures should be operator-visible, not silently fall back to CSV.

### Claude's Discretion

- Exact table names, migration/bootstrap file layout, and index naming
- Exact import ergonomics inside current scripts/hooks
- Exact lightweight validation report shape

</user_constraints>

<research_summary>

## Summary

Phase 2 should be planned as a hard replacement of `src/lib/catalog.ts` internals, not as a new data layer beside the old one. The repo already has the right seam: pages, API routes, and scripts consume a small catalog facade through `src/lib/catalog.ts` and `src/modules/catalog/index.ts`. That means the safest path is:

1. add an explicit catalog import pipeline that reads `videos.csv`, normalizes rows, writes a fresh SQLite file, validates it, and atomically swaps it into place
2. replace hot-path browse reads with narrow SQLite queries instead of rebuilding an in-memory `Map` of the entire catalog on every request path
3. preserve current public catalog semantics exactly: one canonical `Video` per `videoId`, ordered transcript parts, channel summaries ordered by latest publish date, and transcript files still read from `PLAYLIST_TRANSCRIPTS_REPO`

The biggest planning implications are:

- do not store the SQLite file inside the transcript git checkout or release tree
- do not keep the current triple-cache shape (`rows` cache + grouped map cache + React cache)
- make cutover atomic by publishing only a fully validated DB file
- fix test targeting while adding catalog tests, because current `vitest.config.ts` is broad enough to pick up Playwright files

**Primary recommendation:** plan Phase 2 as three tracks that mirror the roadmap:

- `02-01`: importer, schema, DB-path ownership, and atomic publish
- `02-02`: runtime query swap under the existing catalog facade
- `02-03`: validation, parity coverage, and page/query caching posture

</research_summary>

<standard_stack>

## Standard Stack

### Core

| Tool                                         | Purpose                      | Recommendation                                                                     |
| -------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------- |
| SQLite file database                         | Browseable catalog authority | Use a single local SQLite file with atomic replacement on refresh                  |
| `csv-parse/sync`                             | Import-time CSV parsing      | Prefer a real parser over extending the hand-rolled hot-path parser                |
| Existing `src/lib/*` + `src/modules/*` split | Runtime ownership boundary   | Keep `src/lib/catalog.ts` as the public API and move backend details underneath it |
| Vitest                                       | Import/query/parity tests    | Extend the existing node-focused test style under `src/lib/__tests__`              |

### Driver Recommendation

The planning-safe recommendation is: **pick one SQLite driver in `02-01`, but keep it behind a tiny adapter so the rest of the phase is not driver-coupled.**

Why this needs an explicit planning decision:

- the repo's current local Node runtime is `v25.6.1`, and local inspection shows `node:sqlite` still emits an `ExperimentalWarning`
- older repo notes already flagged `node:sqlite` as experimental
- a native dependency such as `better-sqlite3` is mature, but adds build/runtime compatibility work that should be a deliberate choice, not an accidental side effect

So the architecture should assume:

- `src/lib/catalog-db.ts` owns driver-specific connection/open/close logic
- `src/lib/catalog.ts` and importer code only depend on a small query/exec API
- the driver decision is finalized once planning confirms the team's runtime pinning expectations

### Storage Location Recommendation

Do **not** write the catalog DB into:

- the app release tree
- the playlist transcript git checkout

The DB is mutable runtime state. It should live alongside other mutable hosted data under `/srv/transcript-library/...` in production, with a local default under the repo for development. The plan should introduce one explicit catalog-path helper now rather than smuggling this state into an existing repo directory.

</standard_stack>

<architecture_patterns>

## Architecture Patterns

### Pattern 1: Preserve the catalog facade, replace the backend

Keep these public responsibilities in `src/lib/catalog.ts`:

- `listChannels()`
- `listVideosByChannel(channel)`
- `getVideo(videoId)`
- `groupVideos()` only if still needed by callers
- `absTranscriptPath(filePath)`

But change the implementation so these functions query SQLite instead of loading/parsing/grouping `videos.csv`.

This keeps page, route, and script imports stable while allowing the internals to become query-driven.

### Pattern 2: Normalize once during import, not on every request

Current hot paths do all of this repeatedly:

- stat `videos.csv`
- read it synchronously
- parse CSV
- group rows
- sort transcript parts
- aggregate channels

Phase 2 should move normalization to import time. Runtime reads should only do:

- open current SQLite file
- run prepared query
- shape the result into the existing `Video` / `ChannelSummary` types

This directly satisfies `CAT-01` and `PERF-01`.

### Pattern 3: Atomic publish with last-known-good preservation

Refresh flow should be:

1. read CSV from `PLAYLIST_TRANSCRIPTS_REPO`
2. build a fresh temp DB in the same directory as the live DB
3. run lightweight validation/parity checks against the temp DB
4. if validation passes, rename temp DB into place atomically
5. if validation fails, keep the old DB and emit a report

That is the cleanest way to satisfy `CAT-04` without keeping a dual-read runtime.

### Pattern 4: One canonical video row plus ordered child parts

Recommended schema shape:

```text
catalog_videos
- video_id TEXT PRIMARY KEY
- title TEXT NOT NULL
- channel TEXT NOT NULL
- topic TEXT NOT NULL
- published_date TEXT NOT NULL
- ingested_date TEXT NOT NULL
- total_chunks INTEGER NOT NULL
- source_row_count INTEGER NOT NULL

catalog_parts
- video_id TEXT NOT NULL REFERENCES catalog_videos(video_id) ON DELETE CASCADE
- chunk_index INTEGER NOT NULL
- word_count INTEGER NOT NULL
- file_path TEXT NOT NULL
- PRIMARY KEY (video_id, chunk_index)
```

Recommended indexes:

- `catalog_videos(channel, published_date DESC, video_id)`
- `catalog_videos(published_date DESC, channel, video_id)`
- `catalog_parts(video_id, chunk_index)`

This is enough for Phase 2. Do not add transcript-content blobs, FTS tables, or an analysis-state join yet.

### Pattern 5: Deterministic canonicalization during import

The context explicitly rejects opportunistic metadata merging. So the importer needs one deterministic canonical-row rule when multiple CSV rows disagree for the same logical video.

Recommended rule:

- group rows by canonical `videoId` (`parent_video_id || video_id`)
- sort rows in each group by `chunk`, then `file_path`
- take the first sorted row as the canonical metadata source for shared fields
- preserve topic de-duplication in first-seen order when building channel summaries
- always derive `totalChunks` from the actual imported part rows, not from a source column alone

This is simple, deterministic, and easy to test.

</architecture_patterns>

<query_design>

## Query Design

These query shapes align with current call sites and roadmap scope.

### `getVideo(videoId)`

- query one row from `catalog_videos`
- query ordered parts from `catalog_parts where video_id = ? order by chunk_index asc`
- shape into the current `Video` type

### `listVideosByChannel(channel)`

- query from `catalog_videos where channel = ? order by published_date desc, video_id asc`
- keep channel matching exact-string and case-sensitive unless the phase explicitly chooses to change behavior
- no transcript parts needed

### `listChannels()`

Use a grouped query for counts and latest publish date:

```sql
select
  channel,
  count(*) as video_count,
  max(published_date) as last_published_date
from catalog_videos
group by channel
order by last_published_date desc, channel asc;
```

Then run a second narrow query for distinct non-empty topics by channel and assemble `topics: string[]` in TypeScript. That avoids relying on SQLite-specific string aggregation behavior for ordered arrays.

### `groupVideos()`

This function is still used by:

- `src/app/page.tsx`
- `src/app/channels/page.tsx`
- `src/app/video/[videoId]/page.tsx`
- `src/app/api/sync-hook/route.ts`
- `scripts/nightly-insights.ts`

So planning should decide whether to:

- keep `groupVideos()` as a compatibility helper that loads all videos from SQLite on demand, or
- replace its remaining call sites with narrower queries and retire it

The better Phase 2 shape is to shrink its use instead of preserving a "load the whole catalog" habit forever.

</query_design>

<implementation_plan_inputs>

## Planning Inputs By Requirement

### `CAT-01`

- Replace synchronous `videos.csv` parsing on hot request paths with SQLite queries behind `src/lib/catalog.ts`
- Keep CSV reads import-only

### `CAT-02`

- Add the channel and publish-date indexes above
- Ensure channel pages use `where channel = ? order by published_date desc`
- Ensure channel-summary pages use grouped queries, not runtime regrouping from all videos

### `CAT-03`

- Preserve canonical `videoId = parent_video_id || video_id`
- Preserve transcript-part ordering by `chunk_index asc`
- Preserve channel ordering by latest publish date desc, then channel asc
- Preserve topic array order as first-seen, not alphabetized
- Preserve transcript file lookup through `absTranscriptPath(filePath)` and filesystem reads on the video page

### `CAT-04`

- Validate temp DB before publish
- Compare representative behaviors against importer expectations before cutover
- Emit a validation report instead of silently swapping a broken DB

### `PERF-01`

- Eliminate CSV stat/read/parse/group work from request paths
- Avoid rebuilding a full `Map<string, Video>` for routes that only need one row or one channel

### `PERF-04`

- Use one process-local DB/statement cache keyed to the current DB file
- Keep React request-level `cache()` where it meaningfully dedupes repeated same-request reads
- Prefer explicit page revalidation posture over indefinite stale static output

### `SAFE-04`

- Validate raw CSV rows into a normalized internal shape before insert
- Reuse existing repo patterns: strict `videoId` validation, path normalization, and small runtime guards
- Reject or loudly report malformed rows instead of filling the DB with partial garbage

### `TEST-03`

- Add import, query, and parity tests with temp dirs and fixture CSV data
- Scope Vitest to unit/integration tests so it does not ingest Playwright files during normal runs

</implementation_plan_inputs>

## Validation Architecture

This phase does justify a dedicated validation architecture, because validation is the only thing standing between "refresh succeeded" and "runtime browse state is now wrong with no CSV fallback."

Recommended validation layers:

### 1. Input validation

Before insert, validate every CSV row into a normalized importer record:

- canonical `videoId` must be non-empty and pass the same safe-ID policy used elsewhere in the repo
- `chunk` must parse to a positive integer
- `word_count` must parse to a non-negative integer
- `file_path` must be a relative transcript path and must not escape the transcript root
- empty `channel` should normalize to `"(unknown)"`
- empty `published_date` may remain empty, because UI already handles undated videos

Bad rows should fail the import loudly unless the missing field is explicitly allowed by context.

### 2. Structural DB validation

After import into the temp DB, verify:

- `PRAGMA integrity_check` returns success
- `catalog_videos` primary keys are unique
- every `catalog_parts.video_id` has a matching parent row
- every video has at least one part
- `total_chunks` matches the number of imported parts
- chunk sequences are unique per video and ordered without duplicates

### 3. Behavioral parity validation

Validate behaviors the UI depends on, not just table shape:

- total imported video count matches grouped canonical source count
- a representative multi-part video returns parts ordered by `chunk_index`
- channel summaries return the same channel count and latest-date ordering expected from source grouping rules
- lookup for a sampled `videoId` returns the canonical metadata row, not merged drift

This should stay import-time only and can compare against the importer's in-memory normalized model rather than a permanent old runtime path.

### 4. Publish gating

- if any validation step fails, do not swap the DB
- leave the last-known-good DB untouched
- write a small report artifact and log enough detail for the operator

Recommended artifacts:

- `catalog-validation.json`
- command output / server logs

That is enough for `CAT-04` and `SAFE-04` without turning Phase 2 into a large migration harness project.

## Caching And Revalidation Strategy

The current code has redundant catalog caching layers. Phase 2 should simplify them.

Recommended caching model:

- one process-local connection manager that reopens the DB when the live DB file changes
- prepared statements cached per open connection
- React `cache()` on read helpers that are called repeatedly within a single render/request tree

Important correctness detail:

- if refresh publishes a new DB via atomic rename, a long-lived process may still hold an old file handle
- so the connection manager must key itself off the live DB file metadata and reopen on change

For Next page freshness, the simplest Phase 2-compatible posture is:

- add modest route revalidation for catalog-backed pages, because refresh is explicit and eventual freshness is acceptable
- review `generateStaticParams()` usage on channel/video pages at the same time, because route enumeration currently snapshots catalog state at build time

That is safer than assuming build-time static output will somehow notice an external SQLite file change.

## File And Module Recommendations

Recommended additions:

```text
src/lib/catalog.ts                 # existing facade; swap internals
src/lib/catalog-db.ts              # connection manager + prepared statements
src/lib/catalog-import.ts          # CSV -> normalized rows -> SQLite temp DB
src/lib/catalog-validation.ts      # import-time validation/parity checks
src/lib/catalog-paths.ts           # live DB path + temp DB path helpers
src/lib/__tests__/catalog-*.test.ts
scripts/refresh-catalog.ts         # optional explicit CLI entrypoint if needed
```

Recommended runtime edits:

- `src/app/page.tsx`
- `src/app/channels/page.tsx`
- `src/app/channel/[channel]/page.tsx`
- `src/app/video/[videoId]/page.tsx`
- `src/app/api/channel/route.ts`
- `src/app/api/channels/route.ts`
- `src/app/api/video/route.ts`
- `src/app/api/sync-hook/route.ts`
- `scripts/nightly-insights.ts`

The key planning goal is to keep those edits shallow by preserving the catalog facade.

<dont_hand_roll>

## Don't Hand-Roll

- Do not extend the custom CSV parser when a proven import parser can be used once during refresh
- Do not build a bespoke migration framework; a temp DB + validation + rename flow is enough
- Do not add a permanent CSV-vs-SQLite runtime comparison layer
- Do not move transcript contents into SQLite in this phase
- Do not preserve `groupVideos()` as the dominant access pattern if a narrower query already exists

</dont_hand_roll>

<common_pitfalls>

## Common Pitfalls

### Pitfall 1: Publishing a DB from inside the transcript git checkout

That creates repo dirtiness and future sync friction. Keep the DB in dedicated mutable runtime storage.

### Pitfall 2: Keeping old connection handles after atomic swap

The file may be replaced successfully while the process keeps querying the old DB handle. Reopen on file change.

### Pitfall 3: Treating `total_chunks` source data as authoritative

Source rows can drift. Derive `totalChunks` from actual imported parts.

### Pitfall 4: Reintroducing full-catalog loads through compatibility helpers

If `groupVideos()` survives unchanged everywhere, Phase 2 will store metadata in SQLite but still behave like an in-memory catalog dump.

### Pitfall 5: Silent normalization of truly malformed input

Placeholders for missing-but-usable fields are fine. Quietly accepting invalid IDs, duplicate chunk numbers, or unsafe paths is not.

### Pitfall 6: Preserving an existing unknown-channel mismatch accidentally

Current summaries normalize empty channels to `"(unknown)"`, while detail filtering uses exact raw channel equality. Planning should decide whether to preserve that bug for strict compatibility or fix it intentionally with test coverage.

### Pitfall 7: Assuming current testing docs are fully current

The codebase now has Vitest tests in `src/lib/__tests__`, but `vitest.config.ts` is still broad enough to catch Playwright files unless scoped more tightly.

</common_pitfalls>

<code_examples>

## Code Examples

Current behavior seams the plan should preserve:

### Canonical ID and part aggregation today

```ts
const id = r.parent_video_id || r.video_id;
```

### Current part ordering rule

```ts
v.parts.sort((a, b) => a.chunk - b.chunk);
```

### Current channel ordering rule

```ts
if (da !== db) return db.localeCompare(da);
return a.channel.localeCompare(b.channel);
```

### Current transcript ownership boundary

```ts
export function absTranscriptPath(filePath: string): string {
  return path.join(repoRoot(), "youtube-transcripts", filePath);
}
```

Those behaviors matter more than preserving the current CSV-loading internals.

</code_examples>

## Testing Strategy

High-value test cases for `TEST-03`:

- imports a single-chunk video into one parent row and one part row
- imports out-of-order multipart rows and returns ordered parts
- canonicalizes `parent_video_id || video_id` correctly
- uses the chosen deterministic canonical metadata row when source rows disagree
- normalizes missing channel to `"(unknown)"`
- keeps undated videos queryable
- preserves current exact-string channel matching semantics
- preserves topic ordering as first-seen within channel summaries
- rejects duplicate chunk numbers for the same video
- rejects unsafe transcript file paths
- refuses to publish temp DB when validation fails
- reopens the live connection after DB swap

Testing style should match current repo practice:

- temp dirs via `fs.mkdtempSync`
- env override/restore in `afterEach`
- real filesystem artifacts rather than mocking everything

Planning note:

- tighten `vitest.config.ts` or the test include pattern while adding these tests, because the current default config is broad enough to collide with Playwright specs

## Open Questions

These are the only planning-relevant unknowns that still materially affect implementation shape:

1. Which SQLite driver should `02-01` standardize on for the repo's actual Node/Bun workflow?
2. What exact runtime path/config should own the live catalog DB in local vs hosted environments?
3. Should `groupVideos()` be kept as a compatibility helper for one phase, or should `02-02` remove most of its remaining call sites immediately?
4. Should Phase 2 intentionally fix the current `"(unknown)"` channel-detail mismatch, or preserve it for strict no-regression behavior and defer the cleanup?

Everything else needed for planning is already clear enough to break into executable work.

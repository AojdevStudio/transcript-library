# Research Summary

## Project Type

Subsequent milestone for a private, self-hosted transcript library that already works today but needs safer storage, faster indexed reads, and more durable runtime behavior before and during Proxmox deployment.

## Key Findings

### Storage Decision

- Moving from `videos.csv` to **SQLite now** is the right call
- At the current and near-term scale, SQLite is a much better fit than CSV parsing and does not yet justify a larger network database
- The recommended model is **hybrid persistence**:
  - SQLite for catalog/query data, lightweight structured analysis metadata, and durable job state
  - filesystem for large artifacts, logs, markdown reports, and compatibility paths

### Deployment Decision

- The **configurable insights base directory** is a real prerequisite for safe hosted deployment
- The **structured `analysis.json` contract** is an independent quality improvement that also reduces UI fragility
- Together, those two changes materially unblock the Proxmox rollout

### Performance Decision

- Current page/API latency risk mostly comes from:
  - synchronous full-catalog parsing
  - heavy filesystem reads on hot paths
  - request-time assembly work that should become indexed lookups
- SQLite plus selective caching/revalidation is the clearest path to faster home/channel browsing

### Architectural Direction

- Keep the app as a single private Next.js server for now
- Add a repository layer and SQLite-backed query model rather than jumping to a distributed architecture
- Move job/run truth away from PID-only logic toward durable records

## Recommended Requirement Emphasis

1. Deployment-safe insight storage
2. Structured analysis contract
3. SQLite catalog migration
4. Durable job/run tracking and sync visibility
5. Data validation, reconciliation, and API hardening
6. Targeted performance cleanup for hot paths and streaming/status behavior

## Watch Outs

- Do not over-scope the roadmap trying to solve every concern in one undifferentiated phase
- Do not move all artifacts into the database prematurely
- Do not ship the SQLite migration without validation/parity checks against the current catalog behavior

## Bottom Line

The app can scale to the user’s stated near-term needs without moving to a “real DB” beyond SQLite. SQLite is the real database solution to adopt now. It should make catalog-backed UI rendering smoother by replacing synchronous CSV parsing with indexed local queries, and it makes caching/revalidation strategies easier to apply cleanly. A larger database should remain a future option only if the deployment model changes materially beyond a single private hosted node.

# Research: Architecture

## Recommended System Shape

Keep the app as a **single private Next.js server** for now, but split persistence responsibilities more clearly:

1. **Transcript source layer**
   - External transcript repository remains the source of transcript files
   - Import/index process reads from that repo and records normalized metadata in SQLite

2. **Catalog/query layer**
   - SQLite becomes the canonical source for home page, channel page, per-video metadata, coverage summaries, and job records
   - App pages and route handlers query SQLite through typed repository helpers

3. **Analysis runtime layer**
   - Next.js route handlers trigger local CLI analysis
   - Durable run/job state is written to SQLite
   - Large report artifacts continue to be written to the filesystem under configurable base directories

4. **Artifact layer**
   - Filesystem directories remain keyed by `videoId`
   - `analysis.json` and `analysis.md` are siblings
   - markdown/log/status compatibility remains additive during migration

5. **Presentation layer**
   - Existing UI remains mostly unchanged
   - Pages load metadata from SQLite and fetch detailed artifact content only when needed

## Component Boundaries

### Ingest / Indexing

- Source: `PLAYLIST_TRANSCRIPTS_REPO`
- Responsibilities:
  - read and validate upstream transcript index/content
  - normalize records into SQLite tables
  - record sync times and import errors

### Catalog Queries

- Used by:
  - home page
  - channels page
  - channel detail page
  - video metadata lookups
- Responsibilities:
  - indexed reads
  - sort/filter/pagination
  - coverage and recent summaries

### Analysis Jobs

- Used by:
  - analyze trigger API
  - sync hook
  - future batch worker path
- Responsibilities:
  - create durable run/job records
  - enforce concurrency policy
  - update lifecycle states
  - connect runtime results back to artifact storage

### Artifact Reader

- Used by:
  - insight API
  - video workspace
  - log/SSE endpoints
- Responsibilities:
  - read structured analysis payloads
  - expose markdown report when present
  - reconcile missing or mismatched files against job state

## Suggested Data Flow

### Read path

1. Page/API requests lightweight metadata from SQLite
2. Route decides whether artifact file access is needed
3. Artifact layer reads only the specific files required for that view
4. Response is cached or revalidated according to freshness needs

### Analysis path

1. User or sync hook requests analysis
2. App creates/updates durable job row in SQLite
3. Runtime spawns CLI worker
4. Worker writes artifacts under configurable base directory
5. Completion updates structured metadata and job status
6. UI reads status from durable state and fetches artifacts on demand

## Suggested Build Order

1. Centralize insights base-dir resolution
2. Add structured `analysis.json` contract and compatibility fallbacks
3. Introduce SQLite schema for catalog metadata and job state
4. Build/import the SQLite catalog from transcript repo data
5. Swap home/channel/video metadata reads to SQLite
6. Move durable job tracking and sync/backfill visibility into SQLite-backed records
7. Tighten API exposure, validation, and reconciliation logic
8. Optimize SSE/status delivery once the data model is cleaner

## Why This Architecture Fits

- It solves the **current bottlenecks first** instead of inventing distributed infrastructure
- It preserves the **human-readable artifact workflow**
- It avoids forcing transcript bodies or large markdown blobs into relational storage prematurely
- It gives a natural place to put **durable queue/run state**
- It supports better caching because metadata reads become stable, indexed, and smaller

## Phase Implications

- Phase 1 should unblock hosted deployment and stabilize artifact contracts
- Phase 2 should move the catalog/query path to SQLite
- Phase 3 should harden job tracking, backfill durability, and observability
- Phase 4 should address scale/security/performance cleanup around the new persistence boundaries

# Research: Stack

## Scope

Subsequent-milestone research for a private, self-hosted transcript library and analysis workspace that already runs as a single Next.js app and now needs better scale, stronger runtime safety, and cleaner persistence.

## Recommended Stack Direction

### Keep

- **Next.js App Router + React + TypeScript** for the application shell, server rendering, and current UI flow
- **Node.js runtime** for route handlers, filesystem access, and local CLI orchestration
- **Filesystem artifact storage keyed by `videoId`** for large analysis artifacts, logs, markdown review files, and operational run outputs

### Add Now

- **SQLite** as the primary catalog and query store for video metadata, transcript-part index metadata, channel lookups, analysis summaries, and durable job records
- **WAL mode + explicit indexes** so reads stay fast while background analysis writes continue
- **A typed repository/data-access layer** between app routes/pages and raw SQL so the current `src/modules/* -> src/lib/*` shape can evolve cleanly
- **Structured `analysis.json` contract** as the UI-facing canonical structured payload, with `analysis.md` preserved as a human-readable derivative/report artifact

### Optional Tooling Choice

- **Prefer direct SQLite access first** if the schema remains modest and the goal is fast, predictable migration from CSV parsing
- **Add a migration/schema tool only if it reduces operational friction**
  - Best fit if desired: a lightweight TypeScript-friendly migration layer around SQLite
  - Avoid introducing a networked database platform just to gain schema management

## Why SQLite Fits This Project

- The deployment target is a **single private Proxmox-hosted instance**, not a horizontally scaled public SaaS
- The current bottleneck is **synchronous full-catalog file parsing**, not distributed transactional complexity
- At around **1000 videos**, SQLite is comfortably within scope for indexed catalog queries, channel filtering, pagination, and metadata lookups
- SQLite gives a much cleaner answer than CSV for:
  - channel pages
  - recent/recently analyzed lists
  - coverage counts
  - queued/running/completed job queries
  - artifact reconciliation metadata

## Recommended Persistence Split

### SQLite should own

- video catalog rows
- transcript-part metadata and ordering
- channel/grouping metadata
- analysis summary fields from `analysis.json`
- durable analysis job/run records
- ingest timestamps, status, and lightweight operational facts

### Filesystem should keep owning

- transcript source files in the external transcript repo
- `analysis.md`
- `analysis.json`
- `status.json`, `run.json`, and worker logs during the transition period
- slugged markdown review artifacts
- other large append-only or human-auditable files

## Caching Guidance

- SQLite does **not** replace caching by itself, but it makes caching much more useful because read queries become stable and indexable
- For Next.js:
  - cache home/channel query helpers where freshness can be revalidated
  - invalidate on sync/ingest or analysis completion
  - keep highly live analysis-status reads dynamic
- Favor **query-result caching** and **route revalidation** over ad hoc in-memory file snapshots

## Recommended Near-Term Choices

| Area              | Recommendation                | Why                                                                      |
| ----------------- | ----------------------------- | ------------------------------------------------------------------------ |
| Catalog store     | SQLite now                    | Solves the current synchronous full-catalog parse bottleneck cleanly     |
| Job tracking      | SQLite-backed durable records | Removes fragile PID-only assumptions                                     |
| Artifact storage  | Keep filesystem               | Fits large markdown/log artifacts and current review workflow            |
| Query access      | Repository helpers            | Makes Next.js page and API reads simpler and cacheable                   |
| DB mode           | WAL                           | Better read/write concurrency on a single hosted node                    |
| Full DB migration | Not yet                       | No evidence yet that artifact blobs need to move into relational storage |

## What Not To Use Yet

- **Postgres or a hosted DB service**: adds ops complexity without solving today’s main problem better than SQLite
- **Redis-only queueing/caching layer**: premature for a single-node private deployment
- **Putting all markdown/log artifacts in the DB**: makes manual inspection and compatibility harder for little immediate gain
- **Client-side fetching as the primary fix for slow pages**: the root issue is storage/query strategy, not where rendering happens

## Confidence

- **High**: SQLite is the right next step for catalog/query performance at current and near-term scale
- **High**: Filesystem artifacts should stay in place for now as part of a hybrid model
- **Medium**: Whether a schema tool/ORM is worth adding immediately depends on how much schema churn the roadmap introduces
- **Medium**: A future move beyond SQLite should be driven by real multi-node, multi-writer, or operational requirements rather than fear of 1000 videos

# Research: Features

## Scope

This project is not defining a new product surface. It is defining the table stakes and differentiating operational capabilities for a private transcript-and-insights library that needs to become safer and faster without changing its UI identity.

## Table Stakes

### Catalog And Browsing

- Fast home page and channel page loads from indexed catalog reads
- Reliable per-video lookup by `videoId`
- Stable transcript-part ordering and assembly
- Predictable pagination/filtering paths once the catalog grows

### Analysis Runtime

- User can trigger analysis on a video and see trustworthy status
- Analysis jobs survive server restarts or at least fail into a durable, inspectable state
- Runtime writes go to a deployment-safe storage location outside the release tree
- Structured analysis fields exist for the UI and fail clearly when invalid

### Artifact And Data Integrity

- Existing artifacts continue to render during migration
- Partial writes are detectable instead of silently treated as success
- Catalog/input corruption fails loudly enough to debug
- Internal path builders enforce safe `videoId` and artifact boundaries

### Operations

- Hosted deployment has a clear prerequisite checklist
- Environment/config validation happens early
- Backfill/sync workflows report how much work actually started and what remains
- Logs and run metadata stay understandable during incidents

### Security For A Private Deployment

- Internal APIs are explicitly protected by the private deployment boundary or app-level checks
- Webhook triggering has better replay/abuse resistance
- File-reading routes do not expose more local data than necessary

## Differentiators

- Beautiful, already-liked UI preserved while backend internals improve
- Human-readable markdown artifacts remain available for manual review
- Hybrid persistence model optimized for this domain instead of forcing all data into one store
- Future-friendly path toward worker separation without requiring that complexity immediately

## Anti-Features

- Public sign-up or multi-tenant user management
- Billing/subscription mechanics
- Broad UI redesign unrelated to runtime/storage needs
- Premature migration to a larger network database before SQLite has been proven insufficient
- Replacing `videoId` as the core machine key

## Complexity Notes

| Area                                | Complexity  | Notes                                                                     |
| ----------------------------------- | ----------- | ------------------------------------------------------------------------- |
| Configurable insights base dir      | Low-Medium  | Mostly path centralization plus regression coverage                       |
| Structured `analysis.json` contract | Medium      | Requires parser/validation and compatibility fallbacks                    |
| CSV to SQLite catalog migration     | Medium-High | Schema design, backfill, read-path swap, and deploy/runtime coordination  |
| Durable job/run tracking            | High        | Touches operational model, retries, status transitions, and observability |
| Sync/backfill durability            | Medium-High | Needs queue semantics or at least durable pending-state behavior          |
| API hardening in private deployment | Medium      | Boundary clarification, token policy, and exposure reduction              |
| SSE scaling and polling pressure    | Medium      | Likely improved with better status storage and connection budgeting       |

## Dependency Notes

- Structured analysis depends on the analysis runtime contract, but is independent of the base-dir refactor
- Proxmox deployment is effectively blocked by:
  - configurable insights base dir
  - confidence in the structured analysis output contract
- Fast browsing depends on:
  - SQLite catalog migration
  - reduced synchronous file work on page/API hot paths
- Durable queue/job work depends on choosing where job state lives, which strongly suggests SQLite

# Research: Pitfalls

## 1. Migrating the catalog store without a compatibility window

### Risk

Switching pages directly from CSV to SQLite without a staged import/validation path can create silent mismatches between what the transcript repo contains and what the app renders.

### Warning Signs

- Home/channel counts differ before and after migration
- Missing videos on one route but not another
- Transcript-part ordering changes unexpectedly

### Prevention

- Keep a temporary parity-check path during migration
- Compare CSV-derived and SQLite-derived counts/orderings before flipping the default
- Add tests around representative catalog edge cases

### Phase

Address during the SQLite migration phase.

## 2. Treating SQLite as a silver bullet without designing indexes

### Risk

Moving to SQLite but keeping table scans, poor sort strategies, or oversized row payloads will reduce the benefit versus the current CSV flow.

### Warning Signs

- Channel pages still perform large scans
- Query latency rises with video count
- Sorting and filtering require post-processing in Node

### Prevention

- Design for actual read patterns first
- Add indexes for `videoId`, channel, publish date, and common sort/filter combinations
- Keep bulky text/blob content out of hot query tables

### Phase

Address during schema and query design.

## 3. Keeping job truth split across files only

### Risk

If queue/run truth remains spread between status files, PID checks, and logs, the app will stay fragile across restarts even after the catalog migrates.

### Warning Signs

- “Running” jobs with no actual worker
- Conflicting `status.json` and UI states
- Batch flows claiming success without durable progress tracking

### Prevention

- Introduce durable job rows early
- Define one authoritative lifecycle model
- Treat file artifacts as outputs, not the only source of truth

### Phase

Address with runtime hardening after the catalog foundation is in place or alongside it if feasible.

## 4. Moving too much into the database too early

### Risk

Putting markdown reports, raw logs, or large transcript bodies into SQLite immediately could complicate migration and manual troubleshooting.

### Warning Signs

- Schema balloons quickly
- Operational debugging becomes harder
- Import and backup routines become heavier without clear product benefit

### Prevention

- Use a hybrid model first
- Store query-friendly metadata in SQLite
- Keep large review and log artifacts on disk until there is evidence to move them

### Phase

Applies throughout roadmap scoping.

## 5. Regressing the current UI while fixing backend internals

### Risk

The user explicitly likes the current UI. Backend refactors that change response shape or timing unexpectedly could create accidental UX regressions.

### Warning Signs

- Existing analysis panels lose sections
- Pages flash between incomplete states
- Current routes require UI rewrites just to consume new storage

### Prevention

- Add compatibility adapters
- Preserve response contracts until replacements are proven
- Test home, channel, video, and analysis flows during each migration step

### Phase

Applies to every implementation phase.

## 6. Ignoring self-hosting runtime details

### Risk

A system that works locally may behave differently behind a tunnel/reverse proxy on Proxmox, especially around streaming, file paths, and runtime permissions.

### Warning Signs

- SSE/log streaming stalls in hosted mode
- Runtime writes target the release directory
- Environment assumptions fail only after deployment

### Prevention

- Separate runtime data paths from app release paths
- validate env and filesystem prerequisites at startup
- test hosted behavior explicitly, not just local dev

### Phase

Address in deployment-unblocking and operations phases.

## 7. Trying to solve every concern in one pass

### Risk

The active scope is broad. If everything is attacked at once, the roadmap may become unexecutable and hard to verify.

### Warning Signs

- Phases contain unrelated systems work
- Success criteria are too vague to prove
- Critical-path deployment blockers compete with optional cleanup

### Prevention

- Sequence by leverage
- Prioritize deployment unblockers, then catalog/query performance, then runtime durability, then broader cleanup
- Explicitly descale if roadmap coverage becomes too diffuse

### Phase

Address during roadmap creation.

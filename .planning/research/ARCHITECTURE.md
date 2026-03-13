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

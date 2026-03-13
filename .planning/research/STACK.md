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

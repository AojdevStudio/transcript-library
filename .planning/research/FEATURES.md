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

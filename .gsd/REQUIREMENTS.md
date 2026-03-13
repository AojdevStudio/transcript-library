# Requirements

## Active

### DEPLOY-03 — Hosted deployment prerequisites are validated clearly enough that missing critical environment or filesystem requirements fail before user-triggered analysis flows

- Status: active
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Hosted deployment prerequisites are validated clearly enough that missing critical environment or filesystem requirements fail before user-triggered analysis flows

### SAFE-01 — Internal API routes that expose transcripts, artifacts, or local path-derived data are protected appropriately for the private hosted deployment model

- Status: active
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Internal API routes that expose transcripts, artifacts, or local path-derived data are protected appropriately for the private hosted deployment model

### PERF-02 — Page generation and read strategies remain practical as the library approaches roughly 1000 videos

- Status: active
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Page generation and read strategies remain practical as the library approaches roughly 1000 videos

## Validated

### RUN-01 — Analysis job lifecycle state is stored durably enough that run status does not depend only on in-memory counters or PID checks

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Analysis job lifecycle state is stored durably enough that run status does not depend only on in-memory counters or PID checks

### RUN-02 — Sync/backfill flows report what work started, what remains pending, and what failed instead of only returning a generic success message

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Sync/backfill flows report what work started, what remains pending, and what failed instead of only returning a generic success message

### SAFE-02 — Webhook-triggered batch analysis has stronger abuse resistance through improved validation, replay protection, or equivalent safeguards appropriate to the deployment

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Webhook-triggered batch analysis has stronger abuse resistance through improved validation, replay protection, or equivalent safeguards appropriate to the deployment

### DEPLOY-01 — Operator can configure the base insights storage directory via environment configuration so runtime artifacts can live outside the deployed app tree

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Operator can configure the base insights storage directory via environment configuration so runtime artifacts can live outside the deployed app tree

### DEPLOY-02 — Existing local development behavior continues to work when the configurable insights storage directory is unset

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Existing local development behavior continues to work when the configurable insights storage directory is unset

### ANLY-01 — New analysis runs write a validated `analysis.json` artifact alongside `analysis.md`

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

New analysis runs write a validated `analysis.json` artifact alongside `analysis.md`

### ANLY-02 — The UI reads summary, takeaways, action items, and other structured sections from validated structured analysis data instead of markdown heuristics

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

The UI reads summary, takeaways, action items, and other structured sections from validated structured analysis data instead of markdown heuristics

### ANLY-03 — Existing markdown-only insights continue to render through a compatibility fallback during migration

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Existing markdown-only insights continue to render through a compatibility fallback during migration

### ANLY-04 — Invalid structured analysis payloads fail clearly and leave enough operational evidence to debug the failure

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Invalid structured analysis payloads fail clearly and leave enough operational evidence to debug the failure

### CAT-01 — Catalog metadata is stored in SQLite instead of requiring synchronous `videos.csv` parsing on hot request paths

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Catalog metadata is stored in SQLite instead of requiring synchronous `videos.csv` parsing on hot request paths

### CAT-02 — Home and channel pages load their catalog data through indexed queries that scale cleanly to at least the project’s near-term catalog size

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Home and channel pages load their catalog data through indexed queries that scale cleanly to at least the project’s near-term catalog size

### CAT-03 — Video lookup by `videoId`, channel grouping, and transcript-part ordering remain correct after the catalog migration

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Video lookup by `videoId`, channel grouping, and transcript-part ordering remain correct after the catalog migration

### CAT-04 — Catalog migration includes validation or parity checks that catch differences between the old CSV behavior and the new SQLite-backed behavior before the old path is removed

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Catalog migration includes validation or parity checks that catch differences between the old CSV behavior and the new SQLite-backed behavior before the old path is removed

### RUN-03 — Artifact state can be reconciled well enough that mismatches between output files and job status are detectable instead of silently treated as normal

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Artifact state can be reconciled well enough that mismatches between output files and job status are detectable instead of silently treated as normal

### RUN-04 — Existing observability artifacts such as `status.json`, `run.json`, and worker logs remain available or are mapped cleanly during the transition

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Existing observability artifacts such as `status.json`, `run.json`, and worker logs remain available or are mapped cleanly during the transition

### SAFE-03 — Lower-level path and artifact helpers enforce safe `videoId` and path-construction rules so internal refactors do not bypass validation accidentally

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Lower-level path and artifact helpers enforce safe `videoId` and path-construction rules so internal refactors do not bypass validation accidentally

### SAFE-04 — Catalog and SQLite-backed browse inputs are validated consistently enough that malformed data fails loudly instead of degrading silently

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Catalog and SQLite-backed browse inputs are validated consistently enough that malformed data fails loudly instead of degrading silently

### PERF-01 — Hot request paths reduce unnecessary synchronous filesystem work so common private browsing stays fast under hosted use

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Hot request paths reduce unnecessary synchronous filesystem work so common private browsing stays fast under hosted use

### PERF-03 — Live status/log streaming avoids unbounded polling or connection behavior that degrades noticeably as concurrent viewers increase

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Live status/log streaming avoids unbounded polling or connection behavior that degrades noticeably as concurrent viewers increase

### PERF-04 — The app uses caching or revalidation strategies where appropriate to improve repeated catalog-backed reads without compromising correctness

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

The app uses caching or revalidation strategies where appropriate to improve repeated catalog-backed reads without compromising correctness

### TEST-01 — Automated tests cover the configurable insights base directory behavior and insight path resolution

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Automated tests cover the configurable insights base directory behavior and insight path resolution

### TEST-02 — Automated tests cover the structured analysis parser/contract and compatibility fallbacks

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Automated tests cover the structured analysis parser/contract and compatibility fallbacks

### TEST-03 — Automated tests cover SQLite-backed catalog reads and migration parity for representative catalog cases

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Automated tests cover SQLite-backed catalog reads and migration parity for representative catalog cases

### TEST-04 — Automated tests cover critical runtime lifecycle paths such as status transitions, sync behavior, and artifact reconciliation

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Automated tests cover critical runtime lifecycle paths such as status transitions, sync behavior, and artifact reconciliation

## Deferred

## Out of Scope

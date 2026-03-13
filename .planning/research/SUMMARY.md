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

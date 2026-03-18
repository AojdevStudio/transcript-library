# Queue

## 2026-03-18 — M004: Event-Driven Sync Integration

- **Depends on:** M002
- **Runs before:** M003
- **Scope:** Wire `playlist-transcripts` GitHub Actions to call hosted `/api/sync-hook` via dedicated automation hostname, enable nightly sweep timer as backup, prove end-to-end event-driven content propagation.
- **Cross-repo:** Owns the upstream workflow change in `playlist-transcripts`.

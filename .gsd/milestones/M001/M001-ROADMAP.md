# M001: Migration

**Vision:** Transcript Library is a private, desktop-first web app for a small friend group to browse a shared YouTube playlist, read transcripts, watch videos, and review AI-generated insight artifacts.

## Success Criteria

## Slices

- [x] **S01: Artifact Foundations** `risk:medium` `depends:[]`
  > After this: Establish the shared artifact-path foundation for Phase 1 by adding a lightweight test harness, implementing configurable base-dir resolution, and routing all core insight path helpers through it.
- [x] **S02: Sqlite Catalog** `risk:medium` `depends:[S01]`
  > After this: Lay down the SQLite catalog foundation for Phase 2 by adding the database dependency, schema/bootstrap logic, and a validated import pipeline from `videos.csv`.
- [x] **S03: Durable Runtime** `risk:medium` `depends:[S02]`
  > After this: Establish the durable run-state foundation for Phase 3 by introducing attempt-aware analysis records, shared lifecycle transitions, and restart-safe status reconciliation.
- [x] **S04: Hosted Hardening** `risk:medium` `depends:[S03]`
  > After this: Harden the private hosted runtime by adding explicit startup/deploy validation and a shared private API boundary for sensitive routes.

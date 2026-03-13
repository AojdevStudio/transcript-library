# Transcript Library

## What This Is

Transcript Library is a private, desktop-first web app for a small friend group to browse a shared YouTube playlist, read transcripts, watch videos, and review AI-generated insight artifacts. The current app already works as a filesystem-backed Next.js research workspace; this project initialization focuses on making that architecture safer, faster, and more deployment-ready for a private Proxmox-hosted environment without changing the UI direction users already like.

## Core Value

The library must stay fast and trustworthy for private knowledge browsing and analysis, even as the catalog grows and runtime analysis moves onto a hosted Proxmox container.

## Requirements

### Validated

- ✓ Browse the video catalog by home, channel, and per-video pages — existing
- ✓ Read transcript content and transcript parts from the shared transcript repository — existing
- ✓ Trigger headless transcript analysis through local CLI providers — existing
- ✓ Store insight artifacts on disk keyed by `videoId` with operational files such as `status.json`, `run.json`, and worker logs — existing
- ✓ Render structured video workspaces that combine player, transcript, and analysis surfaces in the current UI — existing
- ✓ Expose private internal API routes for catalog, transcript, insight, and analysis workflows inside a trusted environment — existing

### Active

- [ ] Refactor insight artifact storage to support a configurable `INSIGHTS_BASE_DIR` so runtime data can live outside the deployed app tree and unblock Proxmox hosting
- [ ] Add a strict `analysis.json` contract alongside `analysis.md` so the UI reads validated structured analysis fields while preserving markdown as the canonical review artifact
- [ ] Replace catalog indexing from `videos.csv` with a SQLite-backed catalog so home and channel views use indexed queries instead of synchronous full-catalog parsing
- [ ] Preserve the existing UI experience and avoid regressions in current browsing, reading, and analysis flows while the storage architecture changes underneath
- [ ] Improve private-deployment safety around internal APIs, webhook triggering, and analysis execution for the Proxmox-hosted environment
- [ ] Replace fragile process/PID-based analysis run tracking with a more durable job model that survives restarts and future worker separation
- [ ] Improve analysis batch durability and observability so sync/backfill flows report what started, what remains, and what failed
- [ ] Reduce synchronous filesystem IO in hot request paths to keep private hosted browsing latency under roughly 400 ms
- [ ] Revisit build/runtime assumptions that may not scale well at 1000+ videos, including static param generation, transcript loading, and SSE polling behavior
- [ ] Strengthen catalog and artifact validation, reconciliation, and defensive path handling so corrupted files fail clearly instead of degrading silently
- [ ] Add focused automated coverage around analysis lifecycle, catalog parsing/storage, artifact consistency, and critical API behaviors
- [ ] Validate environment and dependency prerequisites earlier so deploy-time misconfiguration is caught before user-triggered flows fail
- [ ] Make an explicit architecture decision about the longer-term storage model, with SQLite as the committed next step and future DB escalation evaluated against actual scaling pressure

### Out of Scope

- UI redesign or major visual direction changes — the current UI is already meeting expectations and this cycle is focused on architecture
- Public SaaS-style onboarding, billing, or multi-tenant account management — this remains a private internal tool for a small friend group
- Moving provider selection into the UI — provider switching should remain behind the server runtime
- Replacing `videoId` as the machine key for artifacts and runtime operations — current storage and workflow assumptions depend on that stable identifier

## Context

The current app is a brownfield Next.js App Router codebase with React 19, TypeScript, Tailwind, filesystem-backed artifacts, and local CLI-based analysis providers. Catalog reads currently come from `PLAYLIST_TRANSCRIPTS_REPO` via `videos.csv`, while generated insight artifacts live under `data/insights/<videoId>/`.

The next deployment target is a private Proxmox LXC container exposed through a private tunnel so trusted collaborators can access the hosted website. Analysis execution will continue to happen through locally installed CLI providers on that container. The app should remain private, feel fast in normal browsing, and keep the current UI intact while architectural internals shift.

Two implementation plans are already treated as committed input for this project:

- `docs/plans/2026-03-09-configurable-insights-base-dir.md`
- `docs/plans/2026-03-09-structured-analysis-json-contract.md`

Additional active pressure comes from the codebase concerns inventory. The current roadmap should address concerns `#1`, `#3`, `#4`, `#5`, `#6`, `#7`, `#8`, `#9`, `#10`, `#11`, `#12`, `#13`, and `#14` from `.planning/codebase/CONCERNS.md`. Concern `#2` is acknowledged as real and still relevant, but the near-term deployment assumption is that runtime execution happens inside a private Proxmox LXC environment with existing safety hooks, so it is not the lead constraint for this initialization cycle.

The big open architectural question is scale: whether the current filesystem-first approach remains sufficient around 1000 videos, how much SQLite improves read performance and operational simplicity right now, and what conditions would justify a future move to a larger database-backed architecture. This project should answer that question explicitly rather than leaving it implicit.

## Constraints

- **Deployment**: Private Proxmox LXC hosting with tunnel-based access — the system must be safe for hosted private use without assuming public SaaS infrastructure
- **Performance**: Browsing should feel fast, with a target of roughly sub-400 ms page/API responses for common private usage — current synchronous full-catalog parsing is a known bottleneck
- **UI Stability**: Preserve the current interface and user experience — this cycle is about architectural improvement, not product redesign
- **Storage Model**: Keep `videoId` as the machine key and continue writing human-readable markdown artifacts where useful — existing artifacts and workflows depend on those conventions
- **Runtime Providers**: Analysis continues to run through local/private CLI tools on the server runtime — worker execution should stay compatible with future separation but not require it yet
- **Migration Strategy**: Prefer additive migrations over destructive rewrites of artifact formats and stored data — existing insights and compatibility paths must keep working during the transition
- **Observability**: Maintain and improve observability through `status.json`, `run.json`, and worker logs — operational state should become clearer, not more opaque

## Key Decisions

| Decision                                                                                                         | Rationale                                                                                                                          | Outcome   |
| ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------- |
| Keep the existing UI direction stable                                                                            | The user is happy with the current interface and wants this cycle focused on infrastructure, storage, and runtime correctness      | — Pending |
| Treat configurable insights storage and structured `analysis.json` as prerequisite architecture work             | These two items unblock the Proxmox deployment path and improve runtime/data quality independently                                 | — Pending |
| Move catalog indexing from CSV to SQLite now                                                                     | Home and channel views currently parse the full catalog synchronously; indexed queries are the preferred near-term performance fix | — Pending |
| Treat the concerns inventory as active scope unless roadmap sizing forces adjustment                             | The goal is to harden the current brownfield system rather than shipping one isolated feature                                      | — Pending |
| Keep the app private and hosted behind trusted access rather than introducing full public auth/product expansion | This matches the repo’s actual audience, deployment model, and non-goals                                                           | ✓ Good    |

---

_Last updated: 2026-03-09 after initialization_

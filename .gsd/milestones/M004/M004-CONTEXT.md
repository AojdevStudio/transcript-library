---
depends_on: [M002]
---

# M004: Event-Driven Sync Integration — Context

**Gathered:** 2026-03-18
**Status:** Queued — pending auto-mode execution

## Project Description

M004 wires the last gap in the Transcript Library content pipeline: making the upstream `playlist-transcripts` GitHub Actions workflow call the hosted `/api/sync-hook` after every successful push, so new transcript content propagates to the hosted library automatically and immediately rather than waiting for the nightly sweep.

## Why This Milestone

After M002, the hosted app is live and proven — but upstream transcript updates only reach it through the daily operational sweep at 3am. The architecture gap: `playlist-transcripts` pushes to GitHub, but nothing tells the hosted Transcript Library to refresh. The `/api/sync-hook` route and `source-refresh.ts` are already built and tested, but they have no upstream caller. This milestone closes that gap by making the content pipeline event-driven while keeping the nightly sweep as a safety net.

## User-Visible Outcome

### When this milestone is complete, the user can:

- see new transcripts appear in the hosted library within minutes of the upstream GitHub Actions sync completing, without manual intervention or waiting for the nightly sweep
- trust that the nightly sweep catches anything the event-driven path misses, so content is never more than ~24 hours stale

### Entry point / environment

- Entry point: `playlist-transcripts` GitHub Actions → POST to hosted `/api/sync-hook` → automatic refresh
- Environment: GitHub Actions runner calling the hosted Proxmox deployment through Cloudflare Tunnel
- Live dependencies involved: `playlist-transcripts` GitHub repo and Actions, Cloudflare Tunnel with a dedicated automation hostname, hosted Transcript Library `/api/sync-hook` route, `SYNC_TOKEN` for bearer auth

## Completion Class

- Contract complete means: the GitHub Actions workflow has a tested step that calls the hosted sync endpoint, the Cloudflare tunnel routes the automation hostname to the app, and the nightly sweep timer is enabled as backup
- Integration complete means: a real upstream transcript push triggers a GitHub Actions run that calls the hosted sync-hook and the hosted app refreshes its catalog with durable evidence
- Operational complete means: the event-driven path and nightly backup both work under the real hosted topology, and a missed sync-hook call does not leave the library stale beyond the next nightly sweep

## Final Integrated Acceptance

To call this milestone complete, we must prove:

- a real push to `playlist-transcripts` triggers the GitHub Actions workflow, which calls the hosted `/api/sync-hook`, and the hosted library reflects the new content with durable refresh evidence
- the nightly sweep timer is enabled and can independently refresh the library if the event-driven path fails
- the dedicated automation hostname routes through Cloudflare Tunnel to the app's sync-hook without passing through the Cloudflare Access friend gate

## Risks and Unknowns

- GitHub Actions network egress to the dedicated automation hostname must pass through Cloudflare Tunnel without Access interference — the tunnel ingress rule must bypass Access for this hostname while keeping the friend-facing hostname protected
- `SYNC_TOKEN` must be stored as a GitHub Actions secret in the `playlist-transcripts` repo — this requires repo admin access
- The `playlist-transcripts` workflow currently has no post-push notification step — the new step must handle failures gracefully (non-blocking, so a sync-hook failure doesn't fail the transcript sync itself)
- The cloudflared config on Proxmox needs a new ingress rule for the automation hostname — this is a runtime config change on the live host

## Existing Codebase / Prior Art

- `src/app/api/sync-hook/route.ts` — existing webhook handler that accepts `SYNC_TOKEN` bearer auth and calls `refreshSourceCatalog()`; already tested and deployed
- `src/lib/source-refresh.ts` — canonical refresh authority that fast-forwards the local checkout, rebuilds SQLite, and writes durable evidence
- `deploy/cloudflared-config.yml` — current tunnel config with `library.aojdevstudio.me` (friend-facing) and `library-deploy.aojdevstudio.me` (deploy webhook); needs a third hostname for sync
- `deploy/systemd/transcript-library-sweep.timer` — existing systemd timer for daily sweep at 3am; needs to be enabled on the host
- `../desktop-commander/repos/playlist-transcripts/.github/workflows/sync-playlist.yml` — current upstream workflow that syncs transcripts and pushes; needs a new step to call the sync-hook
- `deploy/env.template` — documents `SYNC_TOKEN` as an optional hosted var; should be treated as required for event-driven sync

> See `.gsd/DECISIONS.md` for all architectural and pattern decisions — it is an append-only register; read it during planning, append to it during execution.

## Relevant Requirements

- R007 — upstream transcript updates should appear automatically; this milestone makes propagation event-driven instead of relying solely on the nightly sweep
- R008 — sync and analysis remain decoupled; the sync-hook stays refresh-only, no auto-analysis
- R009 — the cross-repo contract becomes explicit with a documented GitHub Actions → sync-hook integration path

## Scope

### In Scope

- Add a post-push step to `playlist-transcripts` GitHub Actions that calls the hosted `/api/sync-hook` with `SYNC_TOKEN` bearer auth
- Add a dedicated automation hostname (`library-sync.aojdevstudio.me`) to the Cloudflare Tunnel config, routing to `localhost:3000`
- Ensure the automation hostname bypasses Cloudflare Access (machine callers, not friend-facing)
- Enable the existing `transcript-library-sweep.timer` on the hosted system as the nightly backup
- Deprecate any stale localhost:3939 assumptions in documentation
- Deprecate any stale assumption that `/api/sync-hook` starts analysis
- End-to-end proof that a real upstream push propagates to the hosted library through the event-driven path
- Document the sync integration contract (which repo calls what, with what auth, and what happens on failure)

### Out of Scope / Non-Goals

- Changing `/api/sync-hook` behavior (it already does refresh-only, no analysis)
- Monitoring/alerting for missed syncs beyond the nightly sweep safety net
- App deploy automation (deploy-hook is separate and already exists)
- Multi-playlist support (M003 scope)
- Any changes to the friend-facing Cloudflare Access configuration

## Technical Constraints

- `/api/sync-hook` must remain refresh-only — no auto-analysis
- The GitHub Actions sync step failure must not block the transcript sync workflow (non-blocking / continue-on-error)
- `SYNC_TOKEN` is the auth mechanism; do not leak `PRIVATE_API_TOKEN` to the upstream repo
- Keep deploy and sync hooks on separate hostnames with independent auth
- The nightly sweep must function independently as a fallback, not depend on the event-driven path

## Integration Points

- `playlist-transcripts` GitHub repo — owns the Actions workflow that needs the new sync-hook call step
- Cloudflare Tunnel / DNS — needs a new automation hostname and ingress rule
- Hosted Transcript Library — existing `/api/sync-hook` route is the target
- GitHub Actions Secrets — `SYNC_TOKEN` and the sync-hook URL must be stored as repo secrets in `playlist-transcripts`
- systemd on Proxmox — the sweep timer must be enabled

## Open Questions

- Should the sync-hook call in GitHub Actions use a simple `curl` step or a GitHub Action for webhook delivery? — `curl` is simpler and has no external dependency; likely the right choice for a private integration
- Should the automation hostname DNS be configured via Cloudflare dashboard or via API/Terraform? — dashboard is fine for a one-time private setup; no need to over-automate

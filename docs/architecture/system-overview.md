# System Overview

## Product

Transcript Library is a private internal tool for a small friend group. The group shares a YouTube playlist, ingests transcripts into a local transcript repository, and uses AI analysis to turn long videos into searchable, discussable knowledge.

## Core flow

1. A video is added to the shared playlist and lands in the transcript repo.
2. `node scripts/rebuild-catalog.ts` validates transcript metadata from `PLAYLIST_TRANSCRIPTS_REPO` and atomically publishes `data/catalog/catalog.db`.
3. A user opens a video page and watches the YouTube video inside the app.
4. The user starts analysis from the app.
5. The server resolves metadata, builds a deterministic headless prompt, and launches the configured provider runtime.
6. The runtime writes status, logs, metadata, run metadata, and markdown artifacts into `data/insights/<videoId>/`.
7. The app reads those artifacts and renders the analysis alongside the video.

## Major subsystems

- Catalog: transcript indexing and video/channel lookup
- Video workspace: in-app watch/read experience
- Analysis runtime: prompt construction, provider selection, process execution
- Insight storage: stable per-video artifact directories
- Knowledge browsing: curated markdown/knowledge content

## Runtime observability

The durable runtime surfaces one operator-facing contract across files, routes, and UI:

- `run.json` is the latest durable run authority for a video. It stores run identity, lifecycle, provider, model, and timing.
- `status.json` is the compatibility status artifact derived from the same lifecycle transitions so older reads and quick filesystem checks stay aligned.
- `worker-stdout.txt` and `worker-stderr.txt` are the raw evidence trail for a run. They are still written canonically, but the normal workspace treats them as secondary evidence.
- `reconciliation.json` is the durable mismatch record. It explains when a completed run no longer matches the expected artifacts, when the mismatch was detected, and whether a clean rerun is the correct next step.
- `GET /api/insight` assembles the status-first snapshot used by the video workspace. It reads the durable run state, reconciliation status, artifact names, retry guidance, and recent useful log lines.
- `GET /api/insight/stream` serves the same live-status story over SSE using a shared per-video cache, so concurrent viewers reuse one snapshot stream instead of hammering the filesystem independently.

This means operators can trust the video page first, then fall back to raw files when needed. If reconciliation reports a mismatch, the UI does not present that state as normal success.

## Hosted runtime and private API boundary

The app supports two deployment modes controlled by the `HOSTED` environment variable:

- **Local dev** (`HOSTED` unset): No authentication required. All API routes are open. No configuration needed to browse or iterate.
- **Hosted** (`HOSTED=true`): Server startup runs a preflight check via `src/instrumentation.ts` that validates critical env vars (`PLAYLIST_TRANSCRIPTS_REPO`, `PRIVATE_API_TOKEN`). Missing vars fail the deploy early with actionable guidance.

All internal API routes (`/api/*`) are protected by a shared private API boundary (`src/lib/private-api-guard.ts`). In hosted mode, callers must present `Authorization: Bearer <PRIVATE_API_TOKEN>`. In local dev, the guard is a no-op.

The `/api/sync-hook` endpoint continues to accept its own `SYNC_TOKEN` for backward compatibility with existing webhook callers. `PRIVATE_API_TOKEN` is also accepted as a universal override on sync-hook.

In hosted mode, response payloads are sanitized to strip internal filesystem paths, provider details, and worker PIDs. Local dev responses include full diagnostic detail.

### Required env vars (hosted mode)

| Variable                    | Purpose                                            |
| --------------------------- | -------------------------------------------------- |
| `HOSTED`                    | Set to `true` or `1` to enable hosted mode         |
| `PLAYLIST_TRANSCRIPTS_REPO` | Absolute path to transcript source directory       |
| `PRIVATE_API_TOKEN`         | Shared secret for private API boundary             |
| `SYNC_TOKEN`                | Webhook authentication (recommended, not required) |

## Scale validation

The hosted deployment has a repeatable validation path for checking browse and runtime behavior as the catalog grows:

```bash
npx tsx scripts/benchmark-hosted-scale.ts --check
```

At 1000 videos, all benchmarks operate with 25×–250× headroom. The current SQLite + filesystem architecture is validated through at least 5000 videos. See `docs/operations/hosted-scale-validation.md` for thresholds, escalation triggers, and runbook details.

## Design invariants

- Lookup key is always `videoId`
- Runtime browse reads come from SQLite only, never directly from `videos.csv`
- Failed catalog validation preserves the last known-good `catalog.db`
- Human review uses slugged markdown artifacts
- Provider choice does not leak into the UI contract
- Analysis execution remains separable from the web app
- Runtime outputs are inspectable from both filesystem and API surfaces

## Catalog operations

- Live browse catalog: `data/catalog/catalog.db` by default, or `CATALOG_DB_PATH` when configured
- Validation report: `data/catalog/last-import-validation.json`
- Manual validation: `node scripts/rebuild-catalog.ts --check`
- Manual publish: `node scripts/rebuild-catalog.ts`
- Automated refresh callers: `POST /api/sync-hook` and `scripts/nightly-insights.ts`

## Analysis runtime operations

- Start a run: `POST /api/analyze?videoId=...`
- Read the latest durable workspace snapshot: `GET /api/insight?videoId=...`
- Follow live stage and recent evidence: `GET /api/insight/stream?videoId=...`
- Review raw filesystem evidence: `run.json`, `status.json`, `reconciliation.json`, `worker-stdout.txt`, and `worker-stderr.txt` under `data/insights/<videoId>/`

The preferred recovery path for failed or mismatched runs is a clean rerun from the workspace. Manual inspection of raw files is available for debugging, but it is not the primary operator workflow.

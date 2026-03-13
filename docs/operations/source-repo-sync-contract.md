# Source Repo Sync Contract

This document defines the supported boundary between the upstream `playlist-transcripts` repository and Transcript Library.

## Contract Summary

- **Upstream `playlist-transcripts` owns ingestion and commits.** It pulls playlist changes, writes transcript files, rebuilds its transcript index, and pushes git commits.
- **Transcript Library owns refreshing its local checkout.** It fast-forwards the local `PLAYLIST_TRANSCRIPTS_REPO` checkout, rebuilds SQLite from that checkout, and records refresh evidence beside the catalog.
- **Refresh is refresh-only.** It updates source state and browse state; it does **not** start analysis work.
- **Analysis remains on-demand.** Users start it from `/api/analyze`, or operators trigger it through explicit analysis workflows such as nightly repair/sweep jobs.

If you need new browse content to appear automatically, use the refresh entrypoints below. If you need AI artifacts for a video, run an analysis workflow separately.

## Supported Repository Shape

Hosted and unattended use assume `PLAYLIST_TRANSCRIPTS_REPO` points to an app-owned local git checkout with this shape:

```text
PLAYLIST_TRANSCRIPTS_REPO/
  .git/
  youtube-transcripts/
    index/
      videos.csv
    <slug>/
      main.md
      ...
```

Required assumptions:

- `PLAYLIST_TRANSCRIPTS_REPO` is an **absolute path**.
- It is a **git worktree/checkout**, not just a copied directory.
- The app can run `git fetch` and `git merge --ff-only` there.
- If the checkout is ever detached HEAD, set `PLAYLIST_TRANSCRIPTS_BRANCH` explicitly.
- `PLAYLIST_TRANSCRIPTS_REMOTE` defaults to `origin` if unset.
- `PLAYLIST_TRANSCRIPTS_BRANCH` defaults to the current checked-out branch, or `master` when the checkout is detached and no branch is configured.

Why this matters:

- Browse and search read from SQLite built from `videos.csv`.
- Raw transcript reads (`/api/raw`) read directly from `PLAYLIST_TRANSCRIPTS_REPO`.
- A stale or non-git directory makes both surfaces lie differently.

## What Refresh Actually Does

The refresh contract is implemented by `src/lib/source-refresh.ts` and exposed through two supported entrypoints:

### 1. Operator CLI

```bash
node --import tsx scripts/refresh-source-catalog.ts
node --import tsx scripts/refresh-source-catalog.ts --check
```

Behavior:

1. inspect the configured transcript checkout
2. `git fetch` the configured remote/branch
3. fast-forward the local checkout with `git merge --ff-only`
4. rebuild the SQLite catalog from `videos.csv`
5. write durable refresh evidence to `last-source-refresh.json`
6. preserve the last known-good catalog proof if the rebuild fails

`--check` still performs the source refresh, but validates the catalog rebuild in check-only mode instead of publishing a new live SQLite database.

### 2. Hosted/Webhook Entry Point

```http
POST /api/sync-hook
Authorization: Bearer <SYNC_TOKEN or PRIVATE_API_TOKEN>
```

Behavior:

- Uses the same refresh authority as the CLI.
- Accepts `SYNC_TOKEN` for dedicated webhook callers.
- Also accepts `PRIVATE_API_TOKEN` as the hosted private-boundary override.
- Records request identity metadata in the refresh record.
- Returns refresh outcomes (`updated`, `noop`, `failed`) instead of analysis batch submission details.

## What Refresh Does **Not** Do

Refresh does **not**:

- queue or start AI analysis
- create `data/insights/<videoId>/run.json`
- create `status.json` for new videos
- call provider CLIs
- synthesize analysis artifacts just because a transcript commit landed upstream

That separation is intentional. Source refresh keeps browse state current. Analysis remains on-demand.

## Evidence Files and Inspection Commands

Refresh evidence lives beside the catalog, usually under `data/catalog/` unless `CATALOG_DB_PATH` points elsewhere.

### Durable evidence files

- `last-source-refresh.json` — the source-refresh authority record
- `last-import-validation.json` — the catalog publish/check proof paired with the refresh record

### `last-source-refresh.json` tells you

- refresh `outcome`: `updated`, `noop`, or `failed`
- failing `phase`: `repo-inspect`, `git-fetch`, `git-fast-forward`, `catalog-rebuild`, or `completed`
- `headBefore`, `headAfter`, and `upstreamHead`
- configured `remote` and `branch`
- trigger source: `cli` or `sync-hook`
- request identity metadata for webhook-triggered refreshes
- whether the catalog rebuild was `checkOnly`
- whether the last known-good validation proof was preserved

### Inspect the latest refresh

```bash
node --import tsx scripts/refresh-source-catalog.ts --check
cat data/catalog/last-source-refresh.json
cat data/catalog/last-import-validation.json
```

If `CATALOG_DB_PATH` is set, inspect the sibling files next to that configured database path instead of `data/catalog/`.

### Interpret the outcomes

#### Success with source change

- `outcome: "updated"`
- `phase: "completed"`
- `headBefore != headAfter`
- `headAfter == upstreamHead`

Meaning: the local checkout advanced and the catalog rebuild finished.

#### Success with no upstream change

- `outcome: "noop"`
- `phase: "completed"`
- `headBefore == headAfter == upstreamHead`

Meaning: the refresh entrypoint ran correctly, but there was nothing new to publish.

#### Failure before source movement

- `outcome: "failed"`
- `phase: "repo-inspect"` or `phase: "git-fetch"`

Meaning: the checkout shape or remote update failed before the app could move the local repo.

#### Failure after source movement but before browse publish

- `outcome: "failed"`
- `phase: "git-fast-forward"` or `phase: "catalog-rebuild"`

Meaning: source refresh did not reach a new stable browse snapshot. Inspect both evidence files and resolve the underlying git/catalog issue.

## Hosted Preflight Expectations

In hosted mode (`HOSTED=true`), startup preflight now checks more than variable presence:

- `PLAYLIST_TRANSCRIPTS_REPO` must be configured
- it must be an absolute path
- it must exist and be a git checkout
- detached HEAD without `PLAYLIST_TRANSCRIPTS_BRANCH` produces a warning
- missing `last-source-refresh.json` produces a warning
- missing `last-import-validation.json` produces a warning
- missing `SYNC_TOKEN` produces a warning because dedicated webhook callers will get `503` unless they use `PRIVATE_API_TOKEN`

This is a startup-visible contract. The goal is to fail or warn before operators discover stale browse content later.

## Hosted Topologies

Two supported automation shapes:

### A. Same-machine cron

Use cron/systemd on the app host to run:

```bash
cd /opt/transcript-library/current
node --import tsx scripts/refresh-source-catalog.ts
```

Use this when the app host is the only machine responsible for keeping the local checkout fresh.

### B. Upstream webhook or external caller

Have a trusted automation caller hit:

```text
POST https://<host>/api/sync-hook
```

with `Authorization: Bearer <SYNC_TOKEN>` (or `PRIVATE_API_TOKEN` when you intentionally want the broader private boundary token).

For hosted deployment, do **not** rely on the historical `http://localhost:3939/api/sync-hook` callback assumption from upstream scripts unless the caller really is running on the same machine and port layout.

## Troubleshooting

### Startup warns that refresh evidence files are missing

Cause: the host has never completed a refresh/rebuild in this runtime location.

Fix:

```bash
node --import tsx scripts/refresh-source-catalog.ts --check
node --import tsx scripts/refresh-source-catalog.ts
```

### Startup fails because the transcript repo is not a git checkout

Cause: `PLAYLIST_TRANSCRIPTS_REPO` points at a copied directory, wrong path, or partially mounted volume.

Fix: point it at the persistent local clone/worktree the app is allowed to fast-forward.

### Refresh succeeds but there are still no analysis artifacts for the new video

That is expected. Refresh is refresh-only. Start analysis explicitly with `/api/analyze` or the operator analysis workflow you intend to use.

### Refresh fails after a catalog rebuild attempt

Inspect:

- `last-source-refresh.json`
- `last-import-validation.json`
- the refresh CLI output

The refresh record preserves the failure phase and whether the last known-good validation proof was kept in place.

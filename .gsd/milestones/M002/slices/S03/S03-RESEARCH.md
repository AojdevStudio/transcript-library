# M002/S03 — Research

**Date:** 2026-03-13

## Summary

This slice owns **R007**, **R008**, and **R009**.

- **R007 — New transcript updates from the source repo appear automatically in the library**
- **R008 — Ingestion and analysis stay decoupled**
- **R009 — Source-of-truth contract between `playlist-transcripts` and this app is explicit and reliable**

The current codebase already has a strong **catalog rebuild** contract, but not a trustworthy **source repo refresh** contract. The app knows how to rebuild `data/catalog/catalog.db` from `PLAYLIST_TRANSCRIPTS_REPO/youtube-transcripts/index/videos.csv`, validate that snapshot, publish it atomically, and pick it up without a restart. What it does **not** currently own is keeping the upstream repo fresh on disk. Every current path assumes the filesystem checkout at `PLAYLIST_TRANSCRIPTS_REPO` is already up to date.

There is also a direct conflict with the slice boundary: the current `POST /api/sync-hook` route is not a refresh-only entrypoint. It delegates to `submitRuntimeBatch()`, which rebuilds the catalog **and** immediately attempts to start analysis work for eligible videos. That violates the launch decision and active requirement to keep ingestion and analysis decoupled. S03 therefore needs more than documentation. It needs a contract split: a **refresh-only** path that proves new upstream content becomes visible automatically, and a separate explicit analysis path that remains user- or operator-triggered.

## Recommendation

Treat the cross-repo contract as a **two-stage boundary**:

1. **Upstream repo owns transcript ingestion and git history**
   - `playlist-transcripts` remains responsible for pulling YouTube data, classifying it, rebuilding `videos.csv`, and committing/pushing changes.
   - This repo should not reimplement transcript ingestion logic.

2. **Transcript Library owns refreshing its local catalog from a fresh local clone**
   - S03 should introduce or formalize a **refresh-only** contract that:
     - verifies or updates the local clone/worktree of `PLAYLIST_TRANSCRIPTS_REPO`
     - rebuilds SQLite from `videos.csv`
     - emits durable evidence of what changed or that nothing changed
     - does **not** auto-start analysis

The cleanest direction for M002 is:

- keep the app’s existing validated catalog importer (`rebuildCatalogFromCsv()`) as the rebuild authority
- stop using `submitRuntimeBatch()` as the sync boundary
- add a **catalog refresh service/script/route** that produces durable refresh evidence
- reserve `submitRuntimeBatch()` for explicit operator workflows such as nightly repair or later unattended sweep logic in S04

This preserves the work already done in M001 and aligns the system with the milestone decision: **new videos should appear automatically, but analysis remains on demand**.

## Don’t Hand-Roll

| Problem                                                         | Existing Solution                                                                    | Why Use It                                                                                                                                          |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rebuilding browse data from the upstream repo                   | `src/lib/catalog-import.ts` via `rebuildCatalogFromCsv()`                            | It already parses `videos.csv`, validates parity, writes a temp SQLite snapshot, and atomically publishes the live catalog.                         |
| Detecting whether the app should pick up a new catalog snapshot | `src/lib/catalog.ts` mtime + validation-report cache invalidation                    | The app already reloads the catalog when `catalog.db` or `last-import-validation.json` changes. No restart hook is needed.                          |
| Durable automation-style evidence                               | `data/catalog/last-import-validation.json` and `src/lib/runtime-batches.ts` patterns | The repo already prefers JSON-visible operator evidence over hidden state. Reuse that pattern for refresh records instead of inventing opaque logs. |
| Hosted env guardrails                                           | `src/lib/hosted-config.ts` + `src/instrumentation.ts`                                | Hosted startup already validates `PLAYLIST_TRANSCRIPTS_REPO` presence. Extend the contract rather than creating a parallel config story.            |

## Existing Code and Patterns

- `src/lib/catalog-import.ts` — the real catalog authority. Reads `PLAYLIST_TRANSCRIPTS_REPO/youtube-transcripts/index/videos.csv`, validates required headers and row shapes, writes a temp SQLite DB, validates parity and ordering, then atomically renames it into place.
- `src/lib/catalog.ts` — the runtime catalog facade. Browse reads come from SQLite only, and the in-process cache invalidates when `catalog.db` or `last-import-validation.json` changes.
- `scripts/rebuild-catalog.ts` — the clean CLI entrypoint for manual or unattended catalog refresh. This is the best starting point for a refresh-only contract.
- `src/lib/runtime-batches.ts` — currently the chokepoint where catalog rebuild and analysis submission are coupled. It should be reused carefully, or split, not treated as the sync contract unchanged.
- `src/app/api/sync-hook/route.ts` — current webhook entrypoint. It is replay-safe and authenticated, but its semantics are wrong for S03 because it triggers analysis work.
- `scripts/nightly-insights.ts` — another coupled path. It calls `submitRuntimeBatch()` and therefore rebuilds the catalog before trying to start analysis. Useful for S04, but not the right refresh contract for S03.
- `src/app/api/raw/route.ts` — serves raw transcript files directly from `PLAYLIST_TRANSCRIPTS_REPO`. This means stale repo state affects not just catalog freshness but transcript-body reads too.
- `../desktop-commander/repos/playlist-transcripts/sync_playlist.sh` — upstream sync pipeline. It already does `git pull --ff-only origin master`, runs ingest/classify/index scripts, commits, pushes, and then tries to call `http://localhost:3939/api/sync-hook` if `SYNC_TOKEN` is set.
- `docs/plans/2026-03-09-self-hosted-proxmox-deployment.md` — current hosted direction says the transcript repo should live at `/srv/transcript-library/playlist-transcripts` and be refreshed by cron using `git pull --ff-only`.

## Constraints

- **Browse reads must stay SQLite-backed.** The codebase explicitly avoids serving browse views directly from `videos.csv`. Any sync work must end in a rebuilt `catalog.db`, not ad hoc CSV reads.
- **Failed refresh must preserve last-known-good data.** `rebuildCatalogFromCsv()` already gives this via temp DB + atomic rename. S03 should preserve that guarantee.
- **`videoId` remains the machine key.** New sync behavior cannot introduce alternative runtime identity.
- **Ingestion and analysis must remain decoupled.** Active requirement R008 and milestone decisions forbid turning “new transcript arrived” into “run AI analysis automatically.”
- **Operator evidence should be JSON-visible.** The repo’s pattern is durable status files (`run.json`, `status.json`, validation reports, batch JSON), not hidden daemon state.
- **Hosted runtime data lives outside the release tree.** The current hosted plan expects `PLAYLIST_TRANSCRIPTS_REPO=/srv/transcript-library/playlist-transcripts`, so S03 should assume refresh works against a persistent external repo clone.
- **Current hosted preflight only validates presence, not freshness.** `runPreflight()` checks that `PLAYLIST_TRANSCRIPTS_REPO` exists as config, but it does not verify git state, branch, remote, or staleness.

## Common Pitfalls

- **Treating `/api/sync-hook` as a harmless refresh endpoint** — today it rebuilds the catalog and then starts analysis for eligible videos. That breaks R008. Split or replace this contract before calling it “sync.”
- **Assuming `PLAYLIST_TRANSCRIPTS_REPO` implies a fresh checkout** — every current read path trusts the directory blindly. Without an explicit `git pull` or webhook-triggered update step, a “refresh” can silently rebuild the same stale snapshot.
- **Requiring an app restart after catalog refresh** — unnecessary. `src/lib/catalog.ts` already invalidates the snapshot cache based on DB/report mtimes.
- **Proving refresh only with changed `catalog.db`** — that shows rebuild happened, not that the local source repo actually advanced. S03 needs durable evidence for source update detection too.
- **Keeping the upstream localhost callback unchanged for hosted** — `playlist-transcripts/sync_playlist.sh` currently posts to `http://localhost:3939/api/sync-hook`. That same-machine assumption does not match the Proxmox + Cloudflare deployment shape.

## Open Risks

- The current repo boundary is ambiguous: this app owns rebuilding from a local path, but the hosted deployment plan currently puts `git pull --ff-only` outside the app in cron. S03 needs to decide whether the official contract is **“external agent keeps repo fresh, app refreshes catalog”** or **“app-owned refresh also updates the repo checkout.”**
- If S03 keeps using the existing sync-hook/batch flow, the milestone will likely fail R008 even if new videos appear reliably.
- There is no current durable “last source sync” record comparable to `run.json` or `last-import-validation.json`. Without that, unattended operations will have weak evidence for “nothing changed” vs “repo update failed” vs “catalog rebuild failed.”
- `src/app/api/raw/route.ts` reads transcript files directly from the repo path, so partial or inconsistent repo updates could surface raw-file drift even if the previous SQLite catalog remains intact.
- The upstream repo’s `sync_playlist.sh` commits on `master`, pulls first, and can fail on missing YouTube cookies or auth changes. S03 should avoid assuming upstream sync is always successful just because the local repo exists.

## Skills Discovered

| Technology        | Skill                                                           | Status                                                                                                                    |
| ----------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Next.js           | `wshobson/agents@nextjs-app-router-patterns`                    | not installed — promising external skill (`npx skills add wshobson/agents@nextjs-app-router-patterns`)                    |
| Cloudflare Tunnel | `vm0-ai/vm0-skills@cloudflare-tunnel`                           | not installed — promising external skill (`npx skills add vm0-ai/vm0-skills@cloudflare-tunnel`)                           |
| Proxmox           | `bastos/skills@proxmox-admin`                                   | not installed — promising external skill (`npx skills add bastos/skills@proxmox-admin`)                                   |
| SQLite            | `martinholovsky/claude-skills-generator@sqlite database expert` | not installed — promising external skill (`npx skills add martinholovsky/claude-skills-generator@sqlite-database-expert`) |

## Sources

- Slice ownership and requirement intent for R007/R008/R009 (source: [`REQUIREMENTS.md`](../../../../REQUIREMENTS.md))
- S03 milestone outcome and dependency expectations (source: [`M002-ROADMAP.md`](../../M002-ROADMAP.md))
- Existing hosted/runtime direction and source repo integration points (source: [`M002-CONTEXT.md`](../../M002-CONTEXT.md))
- Existing decision to keep ingestion and analysis decoupled for launch (source: [`DECISIONS.md`](../../../../DECISIONS.md))
- Current sync-hook behavior, auth model, and request identity semantics (source: [`src/app/api/sync-hook/route.ts`](../../../../../src/app/api/sync-hook/route.ts))
- Current batch coupling of catalog rebuild plus analysis submission (source: [`src/lib/runtime-batches.ts`](../../../../../src/lib/runtime-batches.ts))
- Catalog import contract, validation rules, and atomic publish behavior (source: [`src/lib/catalog-import.ts`](../../../../../src/lib/catalog-import.ts))
- Runtime catalog cache invalidation and source repo path assumptions (source: [`src/lib/catalog.ts`](../../../../../src/lib/catalog.ts))
- Existing batch/runtime tests showing current intended behavior (source: [`src/lib/__tests__/runtime-batches.test.ts`](../../../../../src/lib/__tests__/runtime-batches.test.ts))
- Existing sync-hook tests showing created/reused webhook semantics but no refresh-only contract (source: [`src/lib/__tests__/sync-hook-route.test.ts`](../../../../../src/lib/__tests__/sync-hook-route.test.ts))
- Hosted preflight contract for `PLAYLIST_TRANSCRIPTS_REPO`, `PRIVATE_API_TOKEN`, and `SYNC_TOKEN` (source: [`src/lib/hosted-config.ts`](../../../../../src/lib/hosted-config.ts), [`src/instrumentation.ts`](../../../../../src/instrumentation.ts))
- Upstream repo behavior, auto-sync cadence, and the existing localhost callback assumption (source: [`../desktop-commander/repos/playlist-transcripts/README.md`](../../../../../../desktop-commander/repos/playlist-transcripts/README.md), [`../desktop-commander/repos/playlist-transcripts/sync_playlist.sh`](../../../../../../desktop-commander/repos/playlist-transcripts/sync_playlist.sh))
- Hosted deployment plan’s current assumption that transcript repo refresh happens via cron `git pull --ff-only` under `/srv/transcript-library/playlist-transcripts` (source: [`docs/plans/2026-03-09-self-hosted-proxmox-deployment.md`](../../../../../docs/plans/2026-03-09-self-hosted-proxmox-deployment.md))

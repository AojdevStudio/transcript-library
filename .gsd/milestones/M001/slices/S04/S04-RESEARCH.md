# Phase 4: Hosted Hardening - Research

**Researched:** 2026-03-12
**Domain:** Private hosted readiness, trust-boundary enforcement, deploy prerequisite validation, and scale-readiness around the 1000-video target
**Confidence:** HIGH

<user_constraints>

## User Constraints

### Locked Product / Deployment Constraints

- The app remains a private internal tool for a small friend group, not a SaaS product.
- `videoId` stays the machine key for artifacts and runtime state.
- Human-readable markdown artifacts remain alongside machine-readable artifacts.
- Provider switching stays behind the server runtime, not in the UI.
- The hosted direction is a private Proxmox container with authenticated private access, not a public internet app.
- Analysis execution must remain compatible with future worker separation.
- Additive migrations are preferred over destructive storage redesigns.
- Observability through `status.json`, `run.json`, and worker logs must remain intact.

### Phase Requirements In Scope

- `DEPLOY-03`: hosted deploy prerequisites fail early instead of surfacing only inside user-triggered flows
- `SAFE-01`: internal API routes that expose transcripts, artifacts, or path-derived data are protected appropriately for the private hosted deployment
- `PERF-02`: page generation and read strategies stay practical as the library approaches roughly 1000 videos

### Roadmap Shape To Preserve

- `04-01`: add startup/deploy validation and tighten private API exposure rules
- `04-02`: validate hosted scale behavior and document the next-step threshold beyond SQLite

</user_constraints>

<research_summary>

## Summary

Phase 4 should be planned as the final hosted-readiness seam, not as a general auth rewrite and not as a database migration phase.

The repo is already close to the target shape:

- artifact storage is deploy-safe via `INSIGHTS_BASE_DIR`
- catalog reads are SQLite-backed
- runtime state is durable enough for one hosted node
- webhook replay resistance and runtime observability already exist

The remaining gaps are specific and concentrated:

1. The app still mostly trusts the deployment perimeter instead of enforcing a private API trust boundary in-process.
2. Deploy prerequisites are validated only when code paths are touched, not at boot.
3. The current browse/runtime implementation will probably survive 1000 videos on one host, but not cleanly if the app keeps hydrating the full catalog, scanning the filesystem for browse summaries, and rereading runtime/log state per request.

**Primary recommendation:** plan Phase 4 around one hosted-mode contract.

That contract should:

- validate environment, filesystem, and CLI prerequisites at startup
- require a configured private-route gate before exposing sensitive APIs in hosted mode
- redact operator-only path and runtime details from viewer-facing responses
- prove 1000-video readiness with selective SQLite queries, less filesystem-derived browse state, and a documented threshold for when runtime coordination or storage must evolve

**Most important planning implication:** do not treat Phase 4 as “just add middleware” or “just run a benchmark.” It needs one coherent hosted contract spanning boot validation, route exposure policy, and scale evidence.

</research_summary>

<key_findings>

## Key Findings From Current Code And Docs

### 1. Hosted deployment direction is clear, but startup validation is still late-bound

The repo docs consistently assume a private Proxmox deployment with release code under `/opt/transcript-library/current` and mutable runtime state under `/srv/transcript-library/`. README and deployment docs already document:

- `PLAYLIST_TRANSCRIPTS_REPO=/srv/transcript-library/playlist-transcripts`
- `INSIGHTS_BASE_DIR=/srv/transcript-library/insights`
- optional `CATALOG_DB_PATH=/srv/transcript-library/catalog/catalog.db`

But runtime validation is still mostly lazy:

- `src/lib/catalog.ts` throws only when catalog access is attempted
- `src/lib/analysis.ts` throws only when prompt/provider execution is attempted
- provider CLIs and filesystem writability are not validated at boot

That is the exact `DEPLOY-03` gap.

### 2. Current API protection is perimeter-only except for `/api/sync-hook`

The app has no app-wide auth gate or `middleware.ts`-level protection. Sensitive routes are callable if the deployment exposes them:

- `src/app/api/video/route.ts`
- `src/app/api/raw/route.ts`
- `src/app/api/insight/route.ts`
- `src/app/api/insight/stream/route.ts`
- `src/app/api/analyze/route.ts`
- `src/app/api/analyze/status/route.ts`
- `src/app/api/channel/route.ts`
- `src/app/api/channels/route.ts`

Existing validation is mostly input/path validation:

- `videoId` validation through `src/lib/insight-paths.ts`
- path-prefix validation in `src/app/api/raw/route.ts`

The one explicit caller-auth pattern is the bearer token on `src/app/api/sync-hook/route.ts`.

That means `SAFE-01` is not “tighten a few routes.” It is “define and enforce the private hosted trust boundary.”

### 3. Several current responses leak more internal detail than Phase 4 should allow

Sensitive data currently exposed includes:

- `/api/video` returning transcript contents plus `absPath`
- `/api/insight` returning artifact metadata from `getInsightArtifacts()` including absolute paths
- `/api/insight` and `/api/insight/stream` returning logs, reconciliation details, and latest run metadata
- latest run metadata including provider command details
- `/api/raw` acting as a generic file-read endpoint under `PLAYLIST_TRANSCRIPTS_REPO`

This is acceptable only if the perimeter is perfectly trusted. Phase 4 should assume the hosted boundary deserves defense in depth.

### 4. SQLite is present, but browse reads still behave like an in-memory snapshot system

`src/lib/catalog.ts` still loads all `catalog_videos` and all `catalog_parts` into memory, builds one `Map<string, Video>`, and serves queries from that snapshot until mtime changes.

That means SQLite is improving import correctness and cold-path data shape, but the runtime is not yet using SQLite as a selective query engine for:

- channel summaries
- per-channel listings
- per-video metadata
- per-video parts

This is the core `PERF-02` finding. At 1000 videos, row count is probably still fine, but full hydration plus repeated higher-level scans is unnecessary pressure.

### 5. Browse pages still redo filesystem-derived summary work

The home page, channels page, and channel detail page all opt into `force-dynamic` and compute analysis counts by iterating videos and calling `hasInsight()`.

Insight presence and recent-insight state are still derived from filesystem scans in `src/lib/insights.ts` and `src/lib/recent.ts`, not from SQLite or a compact manifest.

This means browse performance is still partly tied to:

- `readdirSync`
- `existsSync`
- full-catalog iteration
- request-time recomputation of summary data

That is not fatal at 1000 videos, but it is exactly the kind of “works until hosted load feels weird” pattern Phase 4 should clean up.

### 6. Video detail and transcript APIs are still sync-read heavy

Hot transcript paths still read full transcript parts synchronously:

- `src/app/video/[videoId]/page.tsx`
- `src/app/api/video/route.ts`
- `src/app/api/analyze/route.ts`
- `src/lib/runtime-batches.ts`

For the video page, this is probably fine for one viewer on one server. For concurrent hosted use, the risk is tail latency and event-loop blocking, not absolute impossibility.

Phase 4 does not need a streaming rewrite, but it should validate that transcript-heavy pages stay within practical hosted latency and document where that stops being true.

### 7. Runtime streaming is improved, but still somewhat chatty

Phase 3 already added a shared per-video snapshot cache in `src/lib/runtime-stream.ts`, which is the right shape.

Remaining inefficiencies worth addressing in Phase 4:

- `/api/insight` duplicates work by separately reading runtime snapshot, eligibility, reconciliation, stream payload, and artifact metadata
- runtime stream rebuilds still tail logs and recent lines separately
- reconciliation appears to rewrite durable state even when nothing changed
- active SSE connections still poll every 2 seconds per client

This is probably acceptable for one hosted node and a small trusted group, but it should be part of the 1000-video scale-readiness evidence.

### 8. The real “beyond SQLite” threshold is runtime coordination, not catalog size alone

The docs already frame SQLite as the near-term choice and a larger DB as a future option. Current code inspection suggests the likely first scaling trigger is not “1000 videos is too many rows for SQLite.”

The more realistic threshold is one or more of:

- more than one app process or hosted instance
- materially higher concurrent viewers on runtime-heavy pages
- runtime truth that can no longer depend on process-local caches and directory scans
- a need for worker separation with shared coordination across processes

So Phase 4 should document:

- SQLite + filesystem remains sufficient for the 1000-video target on one private hosted node if reads become more selective
- the next migration trigger is shared runtime coordination or materially higher write/concurrency demands, not raw catalog volume

</key_findings>

<standard_stack>

## Standard Stack

### Keep

| Tool / Pattern                                  | Why it fits this phase                             | Recommendation   |
| ----------------------------------------------- | -------------------------------------------------- | ---------------- |
| Private perimeter hosting plus in-app hardening | Matches the actual product and deployment model    | Keep             |
| `better-sqlite3` catalog storage                | Already adopted and stable in repo                 | Keep for Phase 4 |
| Filesystem-backed insight/runtime artifacts     | Still the correct near-term authority for this app | Keep             |
| Shared runtime services under `src/lib/*`       | Existing repo seam for cross-route behavior        | Extend           |
| Vitest for route/runtime/config tests           | Already established and fast                       | Extend           |

### Add

| Capability                            | Why this phase needs it                                  | Recommendation                                                   |
| ------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------- |
| Central hosted-mode validator         | Needed for `DEPLOY-03`                                   | Add one shared startup/deploy validation module                  |
| Central private-route gate            | Needed for `SAFE-01`                                     | Add one shared route-protection helper or middleware-backed gate |
| Redacted route response contracts     | Needed to tighten trust boundary without breaking app UX | Add viewer-safe response shaping                                 |
| Synthetic scale fixtures / benchmarks | Needed for `PERF-02` evidence                            | Add reproducible 1000-video validation path                      |

### Avoid For This Phase

| Option                               | Why not now                                            |
| ------------------------------------ | ------------------------------------------------------ |
| Full user/session auth product       | Out of scope for this private hosted cycle             |
| Moving insight artifacts into SQLite | Unnecessary scope increase                             |
| Replacing SSE with WebSockets        | The issue is read amplification, not transport choice  |
| Immediate migration beyond SQLite    | Not justified by current evidence                      |
| Multi-node runtime design            | Needed only once runtime coordination pressure is real |

</standard_stack>

<architecture_patterns>

## Architecture Patterns

### Pattern 1: One hosted-mode contract

Add a single hosted-mode concept, for example through a shared config layer such as:

- `HOSTED_PRIVATE_MODE=true`
- `PRIVATE_API_AUTH_TOKEN=...` or equivalent

That flag should drive both:

- startup validation
- sensitive-route protection

This prevents drift where hosted mode is “documented” but not enforced.

### Pattern 2: Startup validation must be explicit, aggregated, and operator-readable

Phase 4 should add a shared validator that runs before the app starts accepting hosted traffic.

Recommended checks:

- required env presence:
  - `PLAYLIST_TRANSCRIPTS_REPO`
  - hosted auth secret / route gate config
  - provider selection sanity if analysis is enabled
- filesystem checks:
  - transcript repo exists and is readable
  - insights base dir exists or can be created
  - insights base dir is writable for analysis/runtime artifacts
  - catalog DB parent directory is writable if rebuilds occur on-host
- executable checks:
  - selected provider CLI available on `PATH`
  - optional support tools like `yt-dlp` classified as warn vs fail
- hosted policy checks:
  - if hosted mode is on, sensitive-route gate must be configured

The output should be aggregated and specific, not first-failure-only.

### Pattern 3: Centralize private API gating instead of scattering route conditionals

Sensitive routes should not each invent their own auth logic. Add one shared gate and apply it consistently to:

- transcript content routes
- insight/runtime routes
- analysis-triggering routes
- browse metadata routes if they remain private-only

The key planning decision is not the exact mechanism. For this private app, any of these are acceptable if centralized:

- shared-secret header
- Basic Auth
- trusted proxy header from the private access layer

Recommendation: use the smallest hosted-private mechanism that is easy to validate at boot and easy to test locally.

### Pattern 4: Separate viewer-safe data from operator-only data

Phase 4 should not just add auth around existing payloads. It should tighten payload shape.

Recommended split:

- viewer-safe:
  - transcript text
  - curated insight content
  - coarse analysis status/stage
  - minimal retry guidance
- operator-only:
  - absolute filesystem paths
  - raw log tails
  - provider command/args
  - detailed reconciliation reasons if they reveal internals
  - artifact path bundle

Even if one route gate protects all sensitive routes today, designing the contracts this way avoids rework if the perimeter changes later.

### Pattern 5: Use SQLite as a query engine, not a full snapshot cache

For `PERF-02`, add targeted query helpers rather than hydrating the whole catalog for all browse operations.

Recommended targets:

- `listChannels()` should query channel summary rows directly
- `listVideosByChannel(channel)` should query one channel directly
- `getVideo(videoId)` should query one video plus its ordered parts
- browse pages should consume pre-aggregated or selectively queried insight counts

Small summary caches are still fine. Full-catalog hydration should stop being the default browse path.

### Pattern 6: Move insight-presence summaries off request-time filesystem scans

Home/channel summary reads should not depend on repeatedly scanning `INSIGHTS_BASE_DIR`.

Recommended near-term options:

1. Add an `insight_ready` or equivalent summary table/column in SQLite refreshed by backfill/runtime completion.
2. Or generate a compact manifest file that browse reads can trust without rescanning directories.

Recommendation: prefer SQLite-backed summary metadata because it keeps browse reads in one queryable authority.

### Pattern 7: Make scale validation evidence part of the phase deliverable

Phase 4 should not hand-wave the 1000-video target.

The phase should produce explicit evidence for:

- cold and warm page/API behavior
- catalog invalidation behavior after rebuild
- transcript-heavy page latency
- SSE/runtime behavior under concurrent viewers

That evidence should end in a written threshold statement for when SQLite plus filesystem is no longer enough.

</architecture_patterns>

<dont_hand_roll>

## Don't Hand-Roll

- Do not build a bespoke multi-role auth system for this phase.
- Do not invent route-by-route protection rules with inconsistent headers or secrets.
- Do not build a custom benchmark framework if Vitest fixtures plus a small script can generate synthetic catalog/runtime data.
- Do not create a second runtime authority for “scale mode.” Reuse the current runtime services and instrument them.
- Do not move transcript blobs or insight markdown into SQLite just to satisfy the scale-readiness story.

</dont_hand_roll>

<common_pitfalls>

## Common Pitfalls

### 1. Treating network privacy as sufficient protection

That is the current model, but it is exactly what `SAFE-01` says to tighten. Phase 4 should assume deployment mistakes happen and add in-app defense in depth.

### 2. Validating only env presence, not operability

`DEPLOY-03` is not satisfied by “env var exists.” The validator should test readability, writability, and executable availability where those are required.

### 3. Keeping absolute paths in API payloads

Removing path leaks is one of the highest-leverage hardening wins in this phase.

### 4. Measuring only catalog query speed

The likely hosted bottlenecks are broader:

- request-time filesystem scans
- transcript file reads
- duplicated runtime/log reads
- runtime coordination assumptions

### 5. Declaring SQLite the problem too early

Current evidence points more strongly at browse/runtime read patterns than at SQLite row-count limits.

### 6. Benchmarking without a reproducible fixture

The phase should leave behind a repeatable synthetic fixture or validation script so future changes can rerun the 1000-video check.

</common_pitfalls>

## Implementation Guidance By Plan

### 04-01: Add startup/deploy validation and tighten private API exposure rules

Recommended scope:

1. Add a shared hosted/deploy validation module.
2. Fail startup in hosted mode when critical env, filesystem, or route-gate prerequisites are missing.
3. Add one central sensitive-route gate.
4. Apply it to transcript, insight, analysis, and runtime routes.
5. Remove absolute path exposure from payloads.
6. Narrow or disable `/api/raw` in hosted mode unless it becomes a strict allowlist-based transcript reader.
7. Decide whether logs and run metadata remain on the existing routes or move behind an operator-only route split.

Recommended file seams:

- new shared config/validation module under `src/lib/`
- shared route-auth helper or `middleware.ts`
- response-shaping changes in:
  - `src/app/api/video/route.ts`
  - `src/app/api/raw/route.ts`
  - `src/app/api/insight/route.ts`
  - `src/app/api/insight/stream/route.ts`
  - `src/app/api/analyze/route.ts`
  - `src/app/api/analyze/status/route.ts`

### 04-02: Validate hosted scale behavior and document the next-step threshold beyond SQLite

Recommended scope:

1. Replace full-catalog browse hydration with selective SQLite queries for core browse reads.
2. Stop deriving browse summary state from request-time filesystem scans.
3. Reduce duplicated runtime/log reads on `/api/insight` and `/api/insight/stream`.
4. Add synthetic 1000-video validation fixtures and benchmark commands.
5. Write the explicit “stay on SQLite until…” threshold based on evidence.

Recommended threshold statement to validate or refine during implementation:

- Stay on SQLite + filesystem for:
  - one private hosted node
  - roughly 1000 videos
  - modest concurrent viewers
  - local CLI-backed analysis
- Revisit architecture when:
  - multiple app processes/instances must share runtime truth
  - browse reads still require full-catalog hydration
  - runtime streams create unacceptable disk/read amplification under normal usage
  - analysis queueing/execution needs shared coordination beyond one node

## Code Examples

### Current code paths Phase 4 should build around

- Deploy/env/catalog seams:
  - `src/lib/catalog.ts`
  - `src/lib/catalog-db.ts`
  - `src/lib/analysis.ts`
  - `scripts/rebuild-catalog.ts`
- Sensitive API seams:
  - `src/app/api/raw/route.ts`
  - `src/app/api/video/route.ts`
  - `src/app/api/insight/route.ts`
  - `src/app/api/insight/stream/route.ts`
  - `src/app/api/analyze/route.ts`
  - `src/app/api/analyze/status/route.ts`
- Browse/runtime scale seams:
  - `src/app/page.tsx`
  - `src/app/channels/page.tsx`
  - `src/app/channel/[channel]/page.tsx`
  - `src/app/video/[videoId]/page.tsx`
  - `src/lib/insights.ts`
  - `src/lib/runtime-stream.ts`
  - `src/lib/runtime-batches.ts`

### Existing repo evidence to preserve

- `README.md` already documents the hosted path contract and private runtime story.
- `docs/plans/2026-03-09-self-hosted-proxmox-deployment.md` already defines the intended hosted topology.
- Phase 3 already established durable runtime records, replay-aware sync batching, and a shared SSE snapshot cache. Phase 4 should extend that foundation rather than rethinking it.

## Validation Architecture

Phase 4 should produce a `04-VALIDATION.md` that treats validation as three layers.

### Layer 1: Fast automated route/config validation

Run on every task touching hosted validation or route gating.

Expected coverage:

- hosted mode fails when required env is missing
- hosted mode fails when transcript repo is unreadable
- hosted mode fails when insights dir is not writable
- hosted mode fails when private-route auth config is missing
- sensitive routes reject unauthenticated requests consistently
- redacted payload contracts exclude absolute paths and operator-only internals

Likely command shape:

- targeted Vitest runs for route and config tests

### Layer 2: Synthetic 1000-video scale validation

Run after scale-related tasks and before phase sign-off.

Expected coverage:

- home/channels/channel/video render timings under a 1000-video fixture
- `/api/video` and `/api/insight` response timings under the same fixture
- catalog cold-load versus warm-cache timing
- SSE behavior with concurrent viewers

Expected deliverables:

- benchmark command or script
- reproducible synthetic fixture definition
- recorded threshold notes in docs

### Layer 3: Manual hosted deploy verification

Run once before phase completion.

Expected checks:

- hosted boot fails fast with intentionally missing env/paths
- hosted boot succeeds with the documented Proxmox-style directory layout
- authenticated private users can browse, read, and analyze normally
- unauthenticated or misconfigured requests fail closed
- no sensitive path leakage appears in route payloads
- normal private usage still feels responsive with a large fixture

## Open Questions To Resolve During Planning

1. What exact private-route mechanism should be the standard for this repo: shared-secret header, Basic Auth, or trusted proxy header?
2. Should logs and reconciliation detail stay on existing routes behind stronger auth, or split into operator-only routes?
3. Should insight-presence summary state live in SQLite directly or in a generated manifest consumed by browse pages?
4. What exact timing thresholds should count as “practical” for the 1000-video target in this repo?

## Recommended Phase Framing

If planning needs one sentence:

Phase 4 closes the last gap between “private app that works” and “private hosted system with explicit safety and scale contracts” by enforcing a hosted trust boundary, failing fast on deploy misconfiguration, and proving that SQLite plus filesystem remains sufficient through the 1000-video target on one hosted node.

# Phase 3: Durable Runtime - Research

**Researched:** 2026-03-10
**Domain:** Durable analysis execution, batch visibility, artifact reconciliation, and live status delivery for a hosted Next.js + filesystem runtime
**Confidence:** HIGH

<user_constraints>

## User Constraints (from 03-CONTEXT.md, REQUIREMENTS.md, STATE.md)

### Locked Decisions

- Keep the machine key as `videoId`.
- Treat each video as having one durable latest run record that both UI and automation trust.
- Use explicit lifecycle states that can represent queued, running, completed/succeeded, failed, interrupted, and reconciled conditions.
- If the app restarts while a run is marked running, do not leave that ambiguous; mark it interrupted or failed clearly.
- If an analysis already exists, do not silently replace it on rerun attempts.
- Treat each sync/nightly pass as one batch with per-video work items underneath it.
- Batch reporting must tell the truth about completed, skipped, pending, and failed work.
- Skipped work must be explicit and reasoned.
- `status.json`, `run.json`, and worker logs must remain available or map cleanly during transition.
- Artifact mismatches must be surfaced explicitly, not silently normalized into success.
- First recovery path for mismatches is durable marking plus clean rerun, not aggressive auto-repair.
- Live updates should be status-first with a recent log tail, and should protect the server when multiple viewers watch the same run.
- Keep provider switching behind the server runtime and preserve future worker separation.
- Prefer additive filesystem-compatible migrations over destructive artifact redesigns.

### Phase Requirements In Scope

- `RUN-01`: durable lifecycle state, not only memory/PID checks
- `RUN-02`: honest sync/backfill progress and failures
- `RUN-03`: detectable artifact mismatch and reconciliation
- `RUN-04`: preserve `status.json`, `run.json`, and worker logs
- `SAFE-02`: stronger abuse resistance for webhook-triggered batch analysis
- `PERF-03`: avoid wasteful live polling/connection behavior
- `TEST-04`: automated coverage for lifecycle, sync, and reconciliation

</user_constraints>

<research_summary>

## Summary

Phase 3 should be planned as a runtime-authority refactor, not as a UI phase and not as a worker-service phase. The repo already has the right boundaries:

- `src/lib/analysis.ts` owns run spawning and durable per-video artifacts
- `src/modules/analysis/index.ts` gives a stable facade
- `/api/analyze`, `/api/sync-hook`, and `scripts/nightly-insights.ts` are the current run entry points
- `/api/insight`, `/api/analyze/status`, and `/api/insight/stream` are the current readers

The central problem is that runtime truth is split across:

- process-local concurrency state in `globalThis.__analysisRunningCount`
- `status.json`
- `run.json`
- artifact existence checks like `analysis.md`
- route-local stale PID reconciliation
- console logs and a stale nightly queue flow

That split is survivable for local use, but it is not durable enough for hosted use or future worker separation.

**Primary recommendation:** plan Phase 3 around a single runtime state layer that all routes and scripts use. Keep filesystem-backed artifacts as the near-term durable store, keep `status.json` and `run.json` as compatibility/operator surfaces, add durable batch and reconciliation records, and move route logic to thin wrappers around shared runtime services.

**Most important planning implication:** do not solve this with more route conditionals. Add explicit runtime records and shared services first, then re-point routes and scripts at them.

</research_summary>

<key_findings>

## Key Findings From Current Code

### 1. Run durability exists, but authority is fragmented

Current run startup and completion logic is centralized in [`src/lib/analysis.ts`](/Users/ossieirondi/Projects/transcript-library/src/lib/analysis.ts), which is good. It already writes:

- `status.json`
- `run.json`
- `video-metadata.json`
- `worker-stdout.txt`
- `worker-stderr.txt`
- canonical analysis artifacts

But durable truth is still incomplete because:

- concurrency is enforced only with a process-local counter
- stale `running` reconciliation happens in read routes, not in one shared runtime layer
- `run.json` can remain `running` while `status.json` is rewritten to `failed`
- there is no durable run identity beyond `videoId`
- reruns overwrite the same root logs and metadata

### 2. Batch orchestration is the weakest part of the runtime

[`src/app/api/sync-hook/route.ts`](/Users/ossieirondi/Projects/transcript-library/src/app/api/sync-hook/route.ts) currently:

- validates a bearer token
- refreshes catalog
- loops videos inline
- skips already analyzed/running videos
- stops entirely when concurrency is full
- returns `{ ok: true, message: "analysis triggered" }` before durable work results exist

This does not meet `RUN-02`. There is no batch record, no per-video child status, no durable skip reasons, and no honest response payload for partial work.

### 3. Nightly/backfill is out of sync with the real runtime

[`scripts/nightly-insights.ts`](/Users/ossieirondi/Projects/transcript-library/scripts/nightly-insights.ts) still writes queue jobs and tries to invoke `scripts/analysis-worker.sh`, but that worker script is no longer present. The live runtime now uses inline provider spawning through [`spawnAnalysis()` in `src/lib/analysis.ts`](/Users/ossieirondi/Projects/transcript-library/src/lib/analysis.ts).

This is the strongest repo-specific signal that Phase 3 should unify sync-hook and nightly under one batch/runtime service instead of letting them drift further apart.

### 4. Artifact reads already have compatibility logic, but no general reconciliation model

[`src/lib/insights.ts`](/Users/ossieirondi/Projects/transcript-library/src/lib/insights.ts) already:

- falls back between current and legacy log names
- handles legacy markdown migration state
- reads log tails and run metadata for the UI

What is missing is a durable reconciliation record for mismatches like:

- `run.json` says complete but `analysis.json` is missing
- `analysis.md` exists but `analysis.json` is invalid
- `status.json` says running but PID is dead
- `status.json` and `run.json` disagree
- canonical analysis artifacts exist but latest run metadata is absent

### 5. Live updates are SSE-shaped but still polling-heavy

[`src/app/api/insight/stream/route.ts`](/Users/ossieirondi/Projects/transcript-library/src/app/api/insight/stream/route.ts) reads disk every 2 seconds per connection, and [`src/components/VideoAnalysisWorkspace.tsx`](/Users/ossieirondi/Projects/transcript-library/src/components/VideoAnalysisWorkspace.tsx) also polls `/api/insight` every 3 seconds while a run is active.

That means:

- duplicated no-store traffic
- duplicated disk reads of status/run/log tails
- costs that scale with viewers, not with actual runtime changes

This is the core `PERF-03` planning seam.

### 6. Abuse resistance is present but incomplete

`/api/sync-hook` does constant-time bearer token comparison, which is a good baseline, but it still lacks:

- replay protection
- idempotent batch submission
- durable request identity
- batch-level dedupe

That means `SAFE-02` should be planned into the batch layer, not left as a thin route-only concern.

</key_findings>

<standard_stack>

## Standard Stack

### Keep

| Tool / Pattern                                                                                                             | Why it fits this phase                                       | Recommendation                                         |
| -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------ |
| Filesystem-backed durable JSON artifacts                                                                                   | Already the repo's operational model                         | Keep as the authority for Phase 3                      |
| `atomicWriteJson()` pattern in [`src/lib/analysis.ts`](/Users/ossieirondi/Projects/transcript-library/src/lib/analysis.ts) | Already used for durable writes                              | Reuse for all new runtime/batch/reconciliation records |
| `src/lib/*` + `src/modules/*` split                                                                                        | Good seam for moving route/script logic into shared services | Preserve                                               |
| Existing operator artifacts (`status.json`, `run.json`, worker logs)                                                       | Explicit requirement `RUN-04`                                | Preserve and map cleanly                               |
| Vitest node-focused test harness                                                                                           | Already established in the repo                              | Extend for runtime lifecycle and reconciliation tests  |

### Avoid For This Phase

| Option                               | Why not now                                                                                           |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Moving runtime authority into SQLite | Increases scope and couples Phase 3 to a new persistence mode when filesystem artifacts already exist |
| Building a separate admin UI         | Explicitly out of scope for this phase                                                                |
| Replacing SSE with WebSockets        | Unnecessary surface-area increase; the real problem is shared snapshot delivery and reduced polling   |
| Full automatic artifact repair       | Phase context explicitly prefers mismatch marking plus clean rerun                                    |

### Recommendation

Use the existing filesystem artifact model as the durable store, but formalize it into three record types:

1. per-video latest run record
2. per-batch record with child items
3. per-video reconciliation record

</standard_stack>

<architecture_patterns>

## Architecture Patterns

### Pattern 1: One runtime authority layer, thin routes and scripts

Add a dedicated runtime service layer under `src/lib/` and route everything through it:

- manual analyze
- sync-hook
- nightly/backfill
- status reads
- SSE snapshot reads
- artifact reconciliation reads

The point is not more abstractions for their own sake. The point is to stop duplicating lifecycle rules across:

- [`src/app/api/analyze/route.ts`](/Users/ossieirondi/Projects/transcript-library/src/app/api/analyze/route.ts)
- [`src/app/api/analyze/status/route.ts`](/Users/ossieirondi/Projects/transcript-library/src/app/api/analyze/status/route.ts)
- [`src/app/api/insight/route.ts`](/Users/ossieirondi/Projects/transcript-library/src/app/api/insight/route.ts)
- [`src/app/api/insight/stream/route.ts`](/Users/ossieirondi/Projects/transcript-library/src/app/api/insight/stream/route.ts)
- [`src/app/api/sync-hook/route.ts`](/Users/ossieirondi/Projects/transcript-library/src/app/api/sync-hook/route.ts)
- [`scripts/nightly-insights.ts`](/Users/ossieirondi/Projects/transcript-library/scripts/nightly-insights.ts)

Recommended seam names:

- `src/lib/runtime-runs.ts`
- `src/lib/runtime-batches.ts`
- `src/lib/runtime-reconciliation.ts`
- `src/lib/runtime-stream.ts`

Exact filenames can vary, but planning should preserve this separation of concerns.

### Pattern 2: Make `run.json` the rich latest-run authority and `status.json` the compatibility summary

Right now `status.json` and `run.json` are written separately and can drift. Phase 3 should make one write path authoritative.

Recommended shape:

- `run.json` becomes the latest-run authority for the video
- `status.json` remains as a compatibility/operator summary derived from the same transition
- both are updated together by one transition function, not ad hoc route logic

This satisfies `RUN-04` while removing split-brain lifecycle handling.

### Pattern 3: Introduce `runId` now, even if the UI still only shows the latest run

Future worker separation gets much easier if each attempt has an identity now.

Recommended minimum:

- every run gets a `runId`
- `run.json` at the video root stores the latest run summary including `runId`
- attempt-scoped logs and optional raw provider output can live under a per-run subdirectory
- canonical published analysis remains at the video root

That gives the planner room to support:

- interrupted vs failed semantics
- reconciliation tied to a specific attempt
- future worker callbacks keyed by `runId`
- retry without erasing all evidence

### Pattern 4: Separate run workspace from published latest artifacts

Today `spawnAnalysis()` initializes root artifacts directly and truncates logs at run start. That is fragile for reruns and mismatch handling.

Recommended model:

- attempt writes to a run workspace first
- completion validation runs against that workspace
- successful publish updates canonical root artifacts
- failed/incomplete runs keep their own evidence without pretending success

This is the cleanest path to reliable mismatch detection without aggressive repair.

### Pattern 5: Sync-hook and nightly should use one batch model

Do not keep two orchestration models:

- live inline loop in `sync-hook`
- stale queue worker model in nightly

Use one batch service that:

- creates a durable batch record
- snapshots the candidate worklist
- records per-video child items
- starts what it can honestly start
- records what it skipped and why
- allows future worker/service execution to update the same batch item files

### Pattern 6: Reconciliation should be explicit and durable

Reconciliation should not just be “route noticed something odd.”

Add a durable reconciliation record per video, for example:

- `reconciliation.json`

It should record:

- `videoId`
- `lastCheckedAt`
- `status` such as `clean`, `mismatch`, `resolved`
- mismatch reason codes
- which run was involved
- when mismatch was first detected
- when and how it was resolved

That directly supports `RUN-03` and the video-page warning requirement in `03-CONTEXT.md`.

### Pattern 7: Keep live updates status-first and shared

The stream contract is already close to what the phase wants. Keep the payload centered on:

- lifecycle state
- stage
- timestamps
- error
- recent log tail
- artifact/reconciliation summary

But stop doing full disk polling per connection.

Recommended near-term design:

- SSE remains the transport
- runtime writes publish in-process invalidation events keyed by `videoId`
- SSE connections subscribe to a shared per-video snapshot producer
- when no event fires, send only heartbeat events on a coarse interval
- on reconnect or restart, rebuild snapshot from durable files

This keeps the stream grounded in durable state while reducing redundant disk work.

</architecture_patterns>

<data_model_recommendation>

## Data Model Recommendation

### Per-video latest-run record

Keep the latest run summary at the existing root path:

- `data/insights/<videoId>/run.json`

Recommended additions to the current shape:

- `runId`
- `state`: `queued | running | completed | failed | interrupted | mismatched | reconciled`
- `stage`: `preparing | spawning | analyzing | validating | publishing | finalizing`
- `trigger`: `manual | sync-hook | nightly | repair`
- `batchId?`
- `attemptNumber`
- `requestedAt`
- `startedAt`
- `completedAt`
- `interruptedAt?`
- `publishedArtifacts`
- `workspaceArtifacts`
- `reconciliationStatus`
- `skipReason?` for cases where a batch item references a non-started latest state

Recommended rule: keep operator-friendly filenames and preserve existing fields where possible, rather than breaking readers unnecessarily.

### Per-video status compatibility record

Keep:

- `data/insights/<videoId>/status.json`

But narrow it to a compatibility summary generated from the same transition function that writes `run.json`.

### Attempt workspace

Recommended additive structure:

- `data/insights/<videoId>/runs/<runId>/run.json`
- `data/insights/<videoId>/runs/<runId>/worker-stdout.txt`
- `data/insights/<videoId>/runs/<runId>/worker-stderr.txt`
- `data/insights/<videoId>/runs/<runId>/provider-output.json` when applicable
- `data/insights/<videoId>/runs/<runId>/analysis.json` before publish
- `data/insights/<videoId>/runs/<runId>/analysis.md` before publish

The UI does not need to surface historical runs in this phase, but the runtime should preserve them.

### Reconciliation record

Recommended path:

- `data/insights/<videoId>/reconciliation.json`

Recommended reason codes:

- `missing-analysis-json`
- `missing-analysis-md`
- `invalid-analysis-json`
- `status-run-disagreement`
- `stale-running-pid`
- `published-artifact-missing`
- `workspace-publish-incomplete`

### Batch records

Recommended durable location:

- `data/runtime/batches/<batchId>/batch.json`
- `data/runtime/batches/<batchId>/items/<videoId>.json`

This keeps batch state out of per-video insight roots while still allowing items to point back to `videoId` and `runId`.

Recommended `batch.json` fields:

- `batchId`
- `source`: `sync-hook | nightly | manual-backfill`
- `requestedAt`
- `startedAt`
- `completedAt`
- `status`: `queued | running | partial | completed | failed`
- `catalogVersion`
- `requestedBy`
- `counts`: `total | pending | queued | running | completed | skipped | failed`
- `replayKey?`

Recommended per-item fields:

- `videoId`
- `status`: `pending | skipped | queued | running | completed | failed`
- `reason?`
- `runId?`
- `startedAt?`
- `completedAt?`
- `error?`

</data_model_recommendation>

<repo_specific_seams>

## Codebase Seams The Planner Should Use

### Best existing extension points

- [`src/lib/analysis.ts`](/Users/ossieirondi/Projects/transcript-library/src/lib/analysis.ts)
  This is the current runtime core and should remain the provider-spawn boundary.

- [`src/modules/analysis/index.ts`](/Users/ossieirondi/Projects/transcript-library/src/modules/analysis/index.ts)
  This barrel can preserve imports while internals are reorganized.

- [`src/lib/insights.ts`](/Users/ossieirondi/Projects/transcript-library/src/lib/insights.ts)
  Best place to centralize artifact snapshot reads and reconciliation-aware display helpers.

- [`src/lib/insight-paths.ts`](/Users/ossieirondi/Projects/transcript-library/src/lib/insight-paths.ts)
  Keep this as the single path authority; extend it rather than introducing duplicate runtime-path builders.

- [`src/app/api/insight/route.ts`](/Users/ossieirondi/Projects/transcript-library/src/app/api/insight/route.ts) and [`src/app/api/insight/stream/route.ts`](/Users/ossieirondi/Projects/transcript-library/src/app/api/insight/stream/route.ts)
  These should become consumers of shared snapshot + reconciliation helpers, not places that perform their own lifecycle repair.

- [`src/app/api/sync-hook/route.ts`](/Users/ossieirondi/Projects/transcript-library/src/app/api/sync-hook/route.ts) and [`scripts/nightly-insights.ts`](/Users/ossieirondi/Projects/transcript-library/scripts/nightly-insights.ts)
  These should become thin batch-trigger wrappers over the same shared orchestration service.

### Seams to remove or narrow

- Route-local stale PID reconciliation in multiple readers
- Direct “artifact exists means complete” fallback as a primary status authority
- Process-local concurrency as the only admission control signal
- Separate orchestration logic for nightly vs sync-hook

</repo_specific_seams>

<recommended_approach>

## Recommended Approach

### Recommendation A: Treat Phase 3 as a shared runtime-state migration, not a provider rewrite

Do not expand into remote execution yet. Keep local CLI spawning, but make the state transitions durable and explicit enough that a future worker can update the same records.

### Recommendation B: Add a transition-driven runtime API

Create explicit runtime operations such as:

- create queued run
- start run
- complete run
- fail run
- interrupt stale run
- mark mismatch
- resolve mismatch
- create batch
- update batch item
- finalize batch counts

Every durable write should go through these operations so `run.json`, `status.json`, batch counts, and reconciliation state cannot drift independently.

### Recommendation C: Change analyze behavior when a complete analysis already exists

This is a required phase behavior from `03-CONTEXT.md`.

Recommended behavior:

- manual analyze returns a conflict response when latest state is `completed` and artifacts are consistent
- rerun is only allowed when state is `failed`, `interrupted`, or `mismatched`
- batch flows mark such videos as `skipped` with reason `already-analyzed`

That preserves trust in canonical artifacts and avoids silent replacement.

### Recommendation D: Make restart reconciliation a real runtime step

On server boot or first relevant runtime access, scan latest runs and reconcile any stale `running` state into `interrupted` or `failed` consistently in both `run.json` and `status.json`.

Do not leave that logic spread across routes.

### Recommendation E: Keep streaming advisory, not authoritative

Streaming should never be the place where state becomes correct. It should only read the runtime authority and publish compact updates.

### Recommendation F: Fix nightly by deleting the stale queue model, not reviving it

The nightly script should either:

- call the shared batch creation/orchestration service directly, or
- invoke a shared CLI wrapper around that same service

Do not repair the old `data/queue` flow in parallel with the new runtime.

</recommended_approach>

<dont_hand_roll>

## Don't Hand-Roll

- Do not invent a second path-construction system outside [`src/lib/insight-paths.ts`](/Users/ossieirondi/Projects/transcript-library/src/lib/insight-paths.ts).
- Do not keep separate lifecycle logic in three read routes plus the stream route.
- Do not add a custom progress percentage model; use named lifecycle stages.
- Do not introduce a database-backed job system in this phase unless planning proves filesystem durability is insufficient.
- Do not auto-repair mismatched artifacts into a fake success state.
- Do not preserve the stale nightly queue worker design.

</dont_hand_roll>

<common_pitfalls>

## Common Pitfalls

### Pitfall 1: Updating only `status.json`

Current code already shows the failure mode: route reconciliation can rewrite `status.json` while `run.json` stays stale. Phase 3 should never transition one without the other.

### Pitfall 2: Treating artifact existence as the only truth

Current readers still sometimes treat `analysis.md` presence as completion. That is useful as a compatibility fallback, but it should not remain the main authority once durable run records exist.

### Pitfall 3: Solving concurrency only in memory

`globalThis.__analysisRunningCount` is acceptable as a local optimization, but not as the sole durable admission signal for hosted use.

### Pitfall 4: Making SSE “real-time” by increasing polling frequency

That would worsen `PERF-03`. The right fix is shared snapshot invalidation/coalescing, not faster loops.

### Pitfall 5: Recording batch success too early

`sync-hook` currently returns success before any durable batch truth exists. Phase 3 should return batch creation truth immediately and batch progress truth durably afterward.

### Pitfall 6: Over-scoping into auth/UI/platform work

This phase is about durable runtime semantics. Avoid turning it into:

- a new admin dashboard
- Phase 4 auth work
- worker-service extraction
- a SQLite migration for runtime data

</common_pitfalls>

<test_strategy>

## Test Strategy

The current test suite covers artifact paths and migration behavior, but not runtime lifecycle or batch durability. Phase 3 should add tests around shared runtime services first, with thin-route smoke coverage second.

### Unit tests to add

- run transition tests
  Verify allowed transitions and synchronized writes to `run.json` and `status.json`.

- stale-running reconciliation tests
  Verify a dead PID transitions latest state to `interrupted` or `failed` consistently.

- artifact reconciliation tests
  Verify success + missing artifact becomes `mismatched`, writes `reconciliation.json`, and does not report normal success.

- publish/promotion tests
  Verify failed workspace publish does not claim completed root artifacts.

- batch accounting tests
  Verify `completed`, `skipped`, `failed`, `pending`, and `running` counts stay honest.

- skip-reason tests
  Verify `already-analyzed`, `already-running`, and capacity-related skips are durable and explicit.

- webhook replay/idempotency tests
  Verify duplicate hook deliveries within the replay window do not create duplicate batches.

### Integration-style tests to add

- sync-hook service test
  Create a batch, assert returned batch summary, advance items, and verify final counts.

- nightly script/service alignment test
  Verify nightly uses the same batch/runtime service path as sync-hook.

- snapshot reader test
  Verify `/api/insight`-style snapshot output reflects reconciliation and latest-run state.

- live update coalescing test
  Verify repeated stream subscribers for the same `videoId` do not trigger independent full snapshot reads on every tick.

### Testability seam the planner should preserve

Refactor provider execution behind a small interface so tests can use a fake runner instead of real `claude`/`codex` child processes. That will make `TEST-04` achievable without fragile end-to-end process tests.

</test_strategy>

<validation_architecture>

## Validation Architecture

The planner should generate `03-VALIDATION.md` around shared runtime behaviors, not route-by-route repetition.

### Validation layers

#### 1. Runtime record correctness

Validate that shared runtime transition functions:

- write `run.json` and `status.json` together
- preserve required operator artifacts
- never report `completed` without required published artifacts
- produce explicit `interrupted` or `failed` state after restart reconciliation

#### 2. Batch truthfulness

Validate that sync-hook and nightly/backfill:

- create durable batch records
- report honest per-item and aggregate counts
- preserve explicit skip reasons
- do not collapse partial work into generic success

#### 3. Reconciliation correctness

Validate that mismatches between durable metadata and artifact files:

- are detected deterministically
- produce a durable reconciliation record
- surface warning state in the snapshot consumed by the video page
- allow rerun guidance without silently masking the mismatch

#### 4. Live update efficiency

Validate that active-run viewing:

- uses status-first SSE snapshots
- avoids independent full polling loops per viewer
- sends a recent log tail rather than unbounded log streaming
- remains correct after reconnect/restart by rebuilding from durable state

#### 5. Abuse resistance

Validate that webhook-triggered batch creation:

- rejects invalid or replayed requests
- does not create duplicate durable batches for the same delivery key
- leaves durable evidence of accepted/rejected trigger attempts where appropriate

### Suggested validation scenarios

- manual analyze on fresh video -> queued/running/completed with published artifacts
- manual analyze on already completed video -> conflict, no silent replacement
- server restart during running job -> latest run becomes interrupted/failed durably
- `run.json` says completed but `analysis.json` is missing -> mismatch detected and surfaced
- sync-hook with mixed worklist -> honest completed/skipped/failed counts
- repeated sync-hook delivery with same replay key -> no duplicate batch
- multiple viewers watching same run -> shared status updates without redundant route polling
- nightly/backfill path -> same durable batch semantics as sync-hook

### Exit signals for the phase

- runtime truth no longer depends on route-local PID checks or process-local counters alone
- sync-hook and nightly both use the same durable batch semantics
- mismatch state is first-class and visible
- `status.json`, `run.json`, and logs still exist and remain operator-usable
- automated tests cover the critical lifecycle, batch, and reconciliation paths

</validation_architecture>

<planning_notes>

## Planning Notes

### Highest-value decomposition

The planner will likely get the cleanest outcome by splitting Phase 3 into tracks roughly like:

1. durable latest-run authority and transition layer
2. durable batch model for sync-hook/nightly plus webhook hardening
3. reconciliation + shared status-first live snapshot delivery

That matches the repo's current fault lines better than splitting by route file.

### Dependencies to respect

- Preserve current artifact root and `videoId` path authority from [`src/lib/insight-paths.ts`](/Users/ossieirondi/Projects/transcript-library/src/lib/insight-paths.ts)
- Preserve provider boundary in [`src/lib/analysis.ts`](/Users/ossieirondi/Projects/transcript-library/src/lib/analysis.ts)
- Preserve existing UI contract shape where possible, especially for [`src/components/VideoAnalysisWorkspace.tsx`](/Users/ossieirondi/Projects/transcript-library/src/components/VideoAnalysisWorkspace.tsx)
- Preserve operator-observable JSON/log files required by `RUN-04`

### Open choices the planner can still decide

- exact filenames and directory names for run/batch/reconciliation records
- whether interrupted and mismatched are top-level states or state + reason combinations
- whether latest root artifacts are copied or renamed from per-run workspaces
- exact replay-protection header contract for sync-hook
- exact SSE invalidation implementation as long as it is shared/coalesced and durability remains file-backed

</planning_notes>

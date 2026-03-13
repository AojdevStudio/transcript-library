# T03: 03-durable-runtime 03

**Slice:** S03 — **Milestone:** M001

## Description

Finish the core runtime slice of Phase 3 by adding durable artifact reconciliation and less wasteful status/log streaming behavior.

Purpose: Durable run and batch records are not enough if the published artifact set can still drift silently or if live updates scale linearly with viewers. This plan closes the runtime trust gap by making mismatch state durable and by refitting the live stream around shared status-first snapshots.
Output: Reconciliation records, runtime stream helpers, updated insight routes, and regression coverage for mismatch detection and streaming behavior.

## Must-Haves

- [ ] When runtime metadata and published artifacts disagree, the system records an explicit mismatch state instead of presenting normal success.
- [ ] Operators can tell which run is affected, when the mismatch was detected, and whether the next safe step is a clean rerun.
- [ ] Live status delivery remains status-first with recent log tails, but avoids obviously wasteful duplicate polling work as concurrent viewers increase.
- [ ] Insight routes expose reconciliation and live-status evidence clearly enough for downstream UI work to stay simple and trustworthy.

## Files

- `src/lib/analysis.ts`
- `src/lib/insights.ts`
- `src/lib/runtime-reconciliation.ts`
- `src/lib/runtime-stream.ts`
- `src/app/api/insight/route.ts`
- `src/app/api/insight/stream/route.ts`
- `src/lib/__tests__/runtime-reconciliation.test.ts`
- `src/lib/__tests__/runtime-stream.test.ts`
- `src/lib/__tests__/insight-stream-route.test.ts`

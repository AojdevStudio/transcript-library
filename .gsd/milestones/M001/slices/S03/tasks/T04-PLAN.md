# T04: 03-durable-runtime 04

**Slice:** S03 — **Milestone:** M001

## Description

Finish the operator-facing edge of Phase 3 by surfacing reconciliation and live-status behavior clearly in the existing workspace and by documenting the observability contract.

Purpose: The runtime changes from earlier plans are only trustworthy if the existing UI and docs present them clearly. This plan keeps that work separate from the core runtime slice so execution stays smaller and easier to verify.
Output: A clearer video analysis workspace, aligned route payload usage, and documentation for the runtime observability contract.

## Must-Haves

- [ ] The existing video workspace shows mismatch warnings, retry guidance, and status-first runtime evidence clearly enough that operators do not mistake broken artifacts for success.
- [ ] Recent useful log output is visible without turning the page into a terminal-like admin surface, and full logs remain secondary.
- [ ] The documented observability contract explains how `status.json`, `run.json`, worker logs, and live status reads relate so future runtime changes do not create operator confusion.
- [ ] UI and docs stay aligned with the current private, desktop-first product direction rather than expanding Phase 3 into a broader redesign.

## Files

- `src/components/VideoAnalysisWorkspace.tsx`
- `src/app/api/insight/route.ts`
- `src/app/api/insight/stream/route.ts`
- `README.md`
- `docs/architecture/system-overview.md`
- `src/lib/__tests__/insight-stream-route.test.ts`

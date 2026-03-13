# Research: Pitfalls

## 1. Migrating the catalog store without a compatibility window

### Risk

Switching pages directly from CSV to SQLite without a staged import/validation path can create silent mismatches between what the transcript repo contains and what the app renders.

### Warning Signs

- Home/channel counts differ before and after migration
- Missing videos on one route but not another
- Transcript-part ordering changes unexpectedly

### Prevention

- Keep a temporary parity-check path during migration
- Compare CSV-derived and SQLite-derived counts/orderings before flipping the default
- Add tests around representative catalog edge cases

### Phase

Address during the SQLite migration phase.

## 2. Treating SQLite as a silver bullet without designing indexes

### Risk

Moving to SQLite but keeping table scans, poor sort strategies, or oversized row payloads will reduce the benefit versus the current CSV flow.

### Warning Signs

- Channel pages still perform large scans
- Query latency rises with video count
- Sorting and filtering require post-processing in Node

### Prevention

- Design for actual read patterns first
- Add indexes for `videoId`, channel, publish date, and common sort/filter combinations
- Keep bulky text/blob content out of hot query tables

### Phase

Address during schema and query design.

## 3. Keeping job truth split across files only

### Risk

If queue/run truth remains spread between status files, PID checks, and logs, the app will stay fragile across restarts even after the catalog migrates.

### Warning Signs

- “Running” jobs with no actual worker
- Conflicting `status.json` and UI states
- Batch flows claiming success without durable progress tracking

### Prevention

- Introduce durable job rows early
- Define one authoritative lifecycle model
- Treat file artifacts as outputs, not the only source of truth

### Phase

Address with runtime hardening after the catalog foundation is in place or alongside it if feasible.

## 4. Moving too much into the database too early

### Risk

Putting markdown reports, raw logs, or large transcript bodies into SQLite immediately could complicate migration and manual troubleshooting.

### Warning Signs

- Schema balloons quickly
- Operational debugging becomes harder
- Import and backup routines become heavier without clear product benefit

### Prevention

- Use a hybrid model first
- Store query-friendly metadata in SQLite
- Keep large review and log artifacts on disk until there is evidence to move them

### Phase

Applies throughout roadmap scoping.

## 5. Regressing the current UI while fixing backend internals

### Risk

The user explicitly likes the current UI. Backend refactors that change response shape or timing unexpectedly could create accidental UX regressions.

### Warning Signs

- Existing analysis panels lose sections
- Pages flash between incomplete states
- Current routes require UI rewrites just to consume new storage

### Prevention

- Add compatibility adapters
- Preserve response contracts until replacements are proven
- Test home, channel, video, and analysis flows during each migration step

### Phase

Applies to every implementation phase.

## 6. Ignoring self-hosting runtime details

### Risk

A system that works locally may behave differently behind a tunnel/reverse proxy on Proxmox, especially around streaming, file paths, and runtime permissions.

### Warning Signs

- SSE/log streaming stalls in hosted mode
- Runtime writes target the release directory
- Environment assumptions fail only after deployment

### Prevention

- Separate runtime data paths from app release paths
- validate env and filesystem prerequisites at startup
- test hosted behavior explicitly, not just local dev

### Phase

Address in deployment-unblocking and operations phases.

## 7. Trying to solve every concern in one pass

### Risk

The active scope is broad. If everything is attacked at once, the roadmap may become unexecutable and hard to verify.

### Warning Signs

- Phases contain unrelated systems work
- Success criteria are too vague to prove
- Critical-path deployment blockers compete with optional cleanup

### Prevention

- Sequence by leverage
- Prioritize deployment unblockers, then catalog/query performance, then runtime durability, then broader cleanup
- Explicitly descale if roadmap coverage becomes too diffuse

### Phase

Address during roadmap creation.

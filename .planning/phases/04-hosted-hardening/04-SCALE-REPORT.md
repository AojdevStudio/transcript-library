# Phase 04 Scale Report

**Date:** 2026-03-12
**Video target:** 1000
**Current catalog size:** ~12 videos (production), 1000 (benchmark synthetic)
**Architecture:** SQLite catalog + filesystem insight artifacts + in-process snapshot cache

## Evidence Summary

Benchmark run against 1000 synthetic videos on a single development machine:

| Benchmark                           | Result | Threshold | Headroom |
| ----------------------------------- | ------ | --------- | -------- |
| Catalog rebuild (CSV → SQLite)      | 30 ms  | 5 000 ms  | 167×     |
| groupVideos cold load               | 2 ms   | 500 ms    | 250×     |
| groupVideos cached                  | 0 ms   | 5 ms      | ∞        |
| listChannels                        | 0 ms   | 200 ms    | ∞        |
| listVideosByChannel                 | 0 ms   | 100 ms    | ∞        |
| getVideo ×100 lookups               | 2 ms   | 50 ms     | 25×      |
| hasInsight full scan (400 insights) | 3 ms   | 500 ms    | 167×     |
| Home page simulation                | 0 ms   | 500 ms    | ∞        |
| Channel page simulation             | 0 ms   | 200 ms    | ∞        |

## Conclusion

**The current SQLite + filesystem architecture is good enough.**

At 1000 videos, every benchmark operates with 25×–250× headroom below the defined thresholds. The architecture has no observable bottleneck at this scale.

### Why it works

1. **SQLite reads are fast.** The catalog snapshot loads 1000 videos with all parts in ~2ms. SQLite's B-tree indexes on `(channel, published_date)` and `(video_id, chunk_index)` make all query patterns O(log n) or better.

2. **In-process snapshot cache eliminates repeated reads.** After the first cold load, `groupVideos()` returns the same Map reference. Cache invalidation uses catalog version + mtime, so rebuilds publish new snapshots without restart.

3. **Insight scanning is cheap.** The TTL-cached `buildInsightSet()` does one `readdir` + per-directory `existsSync`. At 400 insight directories, this takes 3ms and caches for 5 seconds.

4. **Page generation is dominated by rendering, not data.** All browse data assembly (catalog queries + insight checks) completes in <1ms for any page type at 1000 videos.

### Estimated practical ceiling

Based on linear extrapolation and architectural bottleneck analysis:

- **~5000 videos:** Still comfortable. Catalog load ~10ms, insight scan ~15ms.
- **~10 000 videos:** Approaching noticeable latency on cold loads. In-process Map holding 10K Video objects uses ~20MB RAM.
- **~50 000 videos:** Would likely require replacing filesystem insight scanning with a SQLite index.

### When to revisit

The repeatable validation path is: `npx tsx scripts/benchmark-hosted-scale.ts --check`

Run this benchmark when:

- The catalog crosses 500 real videos
- Changes touch `catalog.ts`, `catalog-db.ts`, or `insights.ts`
- A deployment feels slower than expected

### What the next step would be (only when needed)

1. **Index insight metadata in SQLite** instead of filesystem readdir
2. **Switch from in-process cache to SQLite WAL reads** if multiple processes need concurrent access
3. **Separate analysis workers** from the browse server if CPU contention appears

These are documented escalation paths, not current recommendations. The friend-group deployment model (single node, single operator) doesn't warrant any of these today.

## Alignment with deployment model

This report is scoped to the private, friend-group deployment:

- No multi-tenant considerations
- No public traffic patterns
- No CDN or edge distribution
- No horizontal scaling

The thresholds and escalation paths reflect what matters for this specific use case.

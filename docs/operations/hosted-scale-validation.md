# Hosted Scale Validation

Repeatable validation path for verifying the transcript library behaves acceptably as the catalog grows toward and beyond 1000 videos.

## Who this is for

Operators of this private friend-group deployment. This is not SaaS capacity planning.

## Quick check

```bash
npx tsx scripts/benchmark-hosted-scale.ts --check
```

Exit code 0 means all benchmarks are within thresholds. Exit code 1 means at least one exceeded.

## Full report

```bash
npx tsx scripts/benchmark-hosted-scale.ts
```

Prints a detailed timing table with pass/fail per benchmark.

## Custom video count

```bash
npx tsx scripts/benchmark-hosted-scale.ts --videos=2000
```

## What it measures

The benchmark creates a synthetic catalog of N videos in a temp directory, runs the **real** browse and runtime code paths, and reports timings:

| Benchmark                 | What it exercises                                | Threshold  |
| ------------------------- | ------------------------------------------------ | ---------- |
| `catalog-rebuild`         | CSV parse → SQLite write → validation            | < 5 000 ms |
| `groupVideos-cold`        | Full catalog load from SQLite into memory        | < 500 ms   |
| `groupVideos-cached`      | In-process snapshot cache hit                    | < 5 ms     |
| `listChannels`            | Channel aggregation from in-memory snapshot      | < 200 ms   |
| `listVideosByChannel`     | Filtered video list for one channel              | < 100 ms   |
| `getVideo-x100`           | 100 single-video lookups (Map.get)               | < 50 ms    |
| `hasInsight-full-scan`    | Filesystem readdir + exists check for all videos | < 500 ms   |
| `home-page-simulation`    | groupVideos + listChannels + hasInsight loop     | < 500 ms   |
| `channel-page-simulation` | listVideosByChannel + hasInsight per video       | < 200 ms   |

## Thresholds rationale

These thresholds assume:

- **Single operator at a time.** This is a friend-group tool, not a public app.
- **Server-rendered pages.** All browse reads happen in Next.js server components.
- **One node.** No horizontal scaling, CDN, or edge caching.

The thresholds are deliberately generous (10-100× headroom at 1000 videos) because the goal is catching regressions, not benchmarking toward hard limits.

## When to run

- After significant changes to `catalog.ts`, `catalog-db.ts`, `catalog-import.ts`, or `insights.ts`
- Before deploying a version that adds substantially more videos
- When considering whether the current stack needs replacement

## What the results mean

At 1000 videos, the current architecture (SQLite catalog + filesystem insights) operates well within acceptable bounds:

- Catalog rebuild: ~30ms (167× under threshold)
- Full catalog load: ~2ms (250× under threshold)
- Page simulations: <1ms

**The current stack is good enough through at least 5000 videos.** Based on observed scaling characteristics (linear catalog growth, O(1) lookups, TTL-cached insight scans), the practical ceiling is likely around 10,000 videos before you'd notice page generation slowing down.

## When to escalate beyond SQLite

Consider the next architecture step if:

1. **Catalog rebuild exceeds 3 seconds** — indicates CSV parsing or SQLite write throughput is bottlenecking
2. **Cold groupVideos exceeds 200ms** — indicates in-memory snapshot is getting too large
3. **hasInsight full scan exceeds 1 second** — indicates filesystem readdir is struggling with directory count
4. **Multiple concurrent operators** routinely experience stale data due to in-process caching
5. **Insight artifact count exceeds 5000** — directory listing and stat calls will dominate

**What the next step would look like:**

- Replace filesystem insight scanning with a SQLite metadata index
- Move from in-process snapshot cache to SQLite WAL mode reads
- Consider worker separation if analysis execution contends with browse reads

**What you should NOT do preemptively:**

- Migrate to Postgres/Turso/Neon — SQLite is the right tool for single-node, single-operator
- Add Redis caching — the in-process cache with TTL is simpler and sufficient
- Add CDN or edge functions — private deployment behind Cloudflare Access doesn't benefit

# Artifact Schema

All analysis artifacts live under the configured insights base directory.

- Local default: `data/insights/<videoId>/`
- Canonical hosted path: `/srv/transcript-library/insights/<videoId>/`

## Canonical files

- `analysis.json`
  - authoritative structured artifact consumed by the UI
- `analysis.md`
  - human-readable report artifact derived from `analysis.json`
- `<slugified-video-title>.md`
  - human-readable duplicate for manual inspection
- `video-metadata.json`
  - resolved metadata cache
- `run.json`
  - provider execution metadata
- `worker-stdout.txt`
  - live stdout log
- `worker-stderr.txt`
  - live stderr log
- `status.json`
  - compact job lifecycle state

## Root-level operational files

- `.migration-status.json`
  - machine-readable summary of the one-time legacy markdown migration
  - records `lastRunAt`, migrated/manual-review counts, and `remainingLegacyCount`

## `status.json`

```json
{
  "status": "running | complete | failed",
  "pid": 12345,
  "startedAt": "ISO timestamp",
  "completedAt": "ISO timestamp?",
  "error": "string?"
}
```

## `run.json`

```json
{
  "schemaVersion": 1,
  "videoId": "string",
  "provider": "claude-cli | codex-cli",
  "model": "string?",
  "command": "string",
  "args": ["string"],
  "status": "running | complete | failed",
  "startedAt": "ISO timestamp",
  "promptResolvedAt": "ISO timestamp",
  "pid": 12345,
  "completedAt": "ISO timestamp?",
  "exitCode": 0,
  "error": "string?",
  "artifacts": {
    "structuredFileName": "analysis.json",
    "canonicalFileName": "analysis.md",
    "displayFileName": "slug.md",
    "metadataFileName": "video-metadata.json",
    "stdoutFileName": "worker-stdout.txt",
    "stderrFileName": "worker-stderr.txt"
  }
}
```

## `video-metadata.json`

Contains:

- source provenance
- title/channel/topic/published date
- source URL
- description
- extracted GitHub repos
- inferred content type
- fixed analysis depth
- schema version for cache invalidation

## Rules

- `videoId` is the storage key
- `analysis.json` is authoritative for summary, takeaway, and action-item UI data
- `analysis.md` remains the human-readable review artifact
- title-based filenames are additive, not canonical
- artifact names should stay provider-neutral even when the provider changes
- legacy flat `data/insights/<videoId>.md` files are transitional and should be eliminated by the
  one-time migration script

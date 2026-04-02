# Coolify Migration Design

**Date:** 2026-04-02
**Status:** Approved
**Scope:** Merge playlist-transcripts into transcript-library, deploy via Coolify on Proxmox

---

## Problem

Two repos that should be one:

- `transcript-library` (Next.js app) on LXC 101 via pm2/deploy-hook/systemd/cloudflared
- `playlist-transcripts` (Python pipeline) syncing every 4h via GitHub Actions

The sync webhook between them broke silently. Transcripts haven't updated since 2026-03-14 (19 days stale). The deployment stack has 6 moving parts doing what Coolify does out of the box.

## Decision

Merge repos. Deploy via Coolify on a new Proxmox LXC. Decommission LXC 101 after validation.

---

## Architecture

### Unified Repo Structure

```
transcript-library/
├── pipeline/                        # was playlist-transcripts
│   ├── scripts/                     # Python pipeline (ingest, classify, index)
│   ├── youtube-transcripts/         # Transcript vault
│   │   ├── inbox/                   # Raw yt-dlp downloads (transient)
│   │   ├── index/                   # CSVs: videos, channels, topics
│   │   └── topics/                  # Classified transcripts by topic
│   │       ├── ai-llms/
│   │       ├── business/
│   │       ├── faith/
│   │       ├── finance-investing/
│   │       ├── hardware-homelab/
│   │       └── software-engineering/
│   ├── playlists.yml                # Multi-playlist config
│   ├── sync_playlist.sh             # Orchestrator
│   └── requirements.txt             # pyyaml, yt-dlp deps
├── data/
│   ├── catalog/catalog.db           # SQLite (volume-mounted)
│   └── insights/<videoId>/          # Analysis artifacts (volume-mounted)
├── src/                             # Next.js 16 app
├── .github/workflows/
│   ├── sync-playlist.yml            # Every 4h: fetch transcripts, commit, push
│   ├── claude.yml                   # Claude bot for issues/PRs
│   └── claude-code-review.yml       # Automated PR review
├── Dockerfile
├── docker-compose.yml
├── package.json
└── justfile
```

### Pipeline Trigger Flow

```
GitHub Action (cron: every 4h)
  → yt-dlp fetches new videos from all playlists
  → Python: ingest → classify → build_index → build_summary
  → git commit + push to main
  → Push triggers Coolify auto-deploy webhook
  → App rebuilds with new transcripts baked in

Coolify cron (daily)
  → Runs analysis sweep on unprocessed videos
  → Claude CLI generates insights for new content
  → Writes to volume-mounted data/insights/
```

### Multi-Playlist Support

Expand existing `playlists.yml`:

```yaml
playlists:
  - name: main-curated
    url: "https://youtube.com/playlist?list=PLnuGPVqDkDzSAf93OH2Zq1_6yXWZZOjdz"
    enabled: true
  - name: spirit-talk
    url: "https://youtube.com/playlist?list=PLnuGPVqDkDzSxB9GByqQDr3t2Izl-hEoz"
    enabled: true
  - name: bitcoin
    url: "https://youtube.com/playlist?list=PLxxxxxxx"
    enabled: false # enable when ready
```

Add `playlist` field to transcript frontmatter so the UI can filter by playlist. The existing topic classifier continues to work for topic-based browsing.

---

## Coolify Deployment

### Infrastructure

- **New LXC** created via Proxmox community script
  - Debian 13, 4 GB RAM (bump to 8 GB since app runs here too), 30 GB disk, 2 cores
  - Coolify dashboard at `http://<LXC_IP>:8000`
  - Single-server mode (Coolify deploys to itself)

### Docker Compose

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - catalog-data:/app/data/catalog
      - insights-data:/app/data/insights
      - /home/deploy/.claude:/home/node/.claude:ro
    environment:
      - HOSTED=true
      - NODE_ENV=production
      - PRIVATE_API_TOKEN=${PRIVATE_API_TOKEN}
      - CLOUDFLARE_ACCESS_AUD=${CLOUDFLARE_ACCESS_AUD}
      - ANALYSIS_PROVIDER=claude-cli
      - CLAUDE_ANALYSIS_MODEL=${CLAUDE_ANALYSIS_MODEL}

volumes:
  catalog-data:
  insights-data:
```

### Dockerfile

```dockerfile
FROM node:22-slim

RUN npm install -g @anthropic-ai/claude-code
RUN apt-get update && apt-get install -y git python3 python3-pip && rm -rf /var/lib/apt/lists/*
RUN pip3 install --break-system-packages pyyaml

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

### Claude CLI Auth

Volume-mount `/home/deploy/.claude` from the host into the container as read-only. The OAuth session persists on the host. If it expires, re-auth on the host — the container picks it up on next analysis run.

### Cloudflare Tunnel

Add ingress rule to LXC 102's cloudflared config (`proxmox/cloudflared/config.yml`):

```yaml
- hostname: library.aojdevstudio.me
  service: http://<coolify-lxc-ip>:3000
```

Existing Cloudflare Access policies stay unchanged.

---

## Repo Merge Strategy

Use `git subtree add` to preserve commit history from playlist-transcripts:

```bash
cd ~/Projects/transcript-library
git remote add transcripts https://github.com/AojdevStudio/playlist-transcripts.git
git fetch transcripts
git subtree add --prefix=pipeline transcripts master --squash
```

Then:

- Move `.github/workflows/sync-playlist.yml` from `pipeline/.github/` to `.github/workflows/`
- Update paths in the workflow to reference `pipeline/` prefix
- Update `sync_playlist.sh` paths accordingly
- Remove the separate `PLAYLIST_TRANSCRIPTS_REPO` env var — app reads from `./pipeline/youtube-transcripts/`

---

## What Goes in Homelab Repo

The app code stays in `AojdevStudio/transcript-library`. The homelab repo gets:

- Documentation in `proxmox/CLAUDE.md` about the Coolify LXC (IP, purpose, access)
- Cloudflare tunnel config update in `proxmox/cloudflared/config.yml`
- Entry in `KNOWN_ISSUES.md` if there are migration caveats

---

## Decommission Plan

After migration is validated:

1. Stop pm2 on LXC 101
2. Stop deploy-hook and sweep timer
3. Stop cloudflared
4. Back up `/srv/transcript-library/` (SQLite + insights) to NAS
5. Remove LXC 101 from Proxmox
6. Remove old cloudflared ingress rule for LXC 101
7. Clean up `deploy/` directory in repo (or keep as historical reference)

---

## Risks

| Risk                                         | Mitigation                                                          |
| -------------------------------------------- | ------------------------------------------------------------------- |
| Claude CLI OAuth expires in container        | Re-auth on host, container picks up via volume mount                |
| Repo grows large with transcript history     | Transcripts are text (~244 files, <50MB total). Manageable.         |
| GitHub Action yt-dlp breaks (cookies expire) | Monitor Action failures. YT_COOKIES secret needs periodic refresh.  |
| Coolify LXC resource contention              | Start with 8 GB RAM. Monitor via Coolify dashboard.                 |
| Merge conflicts from unmerged branches       | Resolve existing merge conflicts in transcript-library before merge |

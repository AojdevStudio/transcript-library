# Coolify Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Merge playlist-transcripts into transcript-library, deploy via Coolify on a new Proxmox LXC, decommission LXC 101.

**Architecture:** Unified repo with embedded Python pipeline. GitHub Actions polls YouTube playlists every 4h, commits transcripts, pushes. Coolify auto-deploys on push. Coolify cron runs daily analysis sweep via Claude CLI (OAuth session volume-mounted from host).

**Tech Stack:** Next.js 16, SQLite (better-sqlite3), Python 3.11 (yt-dlp pipeline), Docker, Coolify, Cloudflare Tunnel, Claude CLI

**Design doc:** `docs/plans/2026-04-02-coolify-migration-design.md`

---

## Phase 1: Repo Cleanup (prerequisite)

### Task 1: Resolve merge conflicts in transcript-library

The repo has unresolved conflict markers in 5 files. These MUST be resolved before any merge operation.

**Files:**

- Modify: `justfile:53` — merge conflict between HEAD and gsd/M002/S04
- Modify: `docs/plans/2026-03-09-self-hosted-proxmox-deployment.md` — 19 conflict blocks
- Modify: `docs/operations/source-repo-sync-contract.md` — 6+ conflict blocks
- Modify: `docs/architecture/system-overview.md` — 5+ conflict blocks
- Modify: `README.md:275-286` — 3 conflict blocks

**Step 1: Identify all conflict markers**

Run: `cd ~/Projects/transcript-library && grep -rn '<<<<<<<' --include='*.md' --include='justfile' . | grep -v node_modules | grep -v .gsd`

**Step 2: Resolve each file**

For each file, read it, understand both sides of the conflict, pick the correct resolution (generally HEAD/main wins, incorporate any new recipes from branches).

For `justfile`: keep both `rebuild-catalog`, `rebuild-catalog-check`, AND `backfill-insights` recipes. Remove all `<<<<<<<`, `=======`, `>>>>>>>` markers.

For `.md` docs: the deployment plan doc is being superseded by the Coolify migration design. Resolve conflicts by taking the most complete version of each section.

**Step 3: Verify no markers remain**

Run: `grep -rn '<<<<<<<' --include='*.md' --include='justfile' . | grep -v node_modules | grep -v .gsd`
Expected: no output

**Step 4: Commit**

```bash
git add -A
git commit -m "fix: resolve all merge conflict markers in justfile and docs"
```

---

## Phase 2: Merge Repos

### Task 2: Merge playlist-transcripts into transcript-library via git subtree

**Step 1: Add remote**

```bash
cd ~/Projects/transcript-library
git remote add transcripts https://github.com/AojdevStudio/playlist-transcripts.git
git fetch transcripts
```

**Step 2: Subtree add**

```bash
git subtree add --prefix=pipeline transcripts master --squash
```

This creates `pipeline/` containing the entire playlist-transcripts repo. The `--squash` condenses the history into one merge commit.

**Step 3: Verify structure**

Run: `ls pipeline/`
Expected: `playlists.yml`, `sync_playlist.sh`, `requirements.txt`, `youtube-transcripts/`, `.github/`, etc.

Run: `ls pipeline/youtube-transcripts/topics/`
Expected: `ai-llms/`, `business/`, `faith/`, `finance-investing/`, `hardware-homelab/`, `software-engineering/`

**Step 4: Commit is automatic** (subtree add creates its own commit)

### Task 3: Move GitHub Action from pipeline/ to repo root

The sync workflow needs to live at `.github/workflows/` in the repo root (GitHub only reads from there).

**Files:**

- Move: `pipeline/.github/workflows/sync-playlist.yml` → `.github/workflows/sync-playlist.yml`
- Delete: `pipeline/.github/` (the claude.yml and claude-code-review.yml in the pipeline are duplicates of ones already in the repo root)

**Step 1: Move the workflow**

```bash
cp pipeline/.github/workflows/sync-playlist.yml .github/workflows/sync-playlist.yml
rm -rf pipeline/.github
```

**Step 2: Update paths in sync-playlist.yml**

Every path reference must be prefixed with `pipeline/`. Key changes:

```yaml
# In the "Run sync" step, change:
run: |
  cd pipeline
  ./sync_playlist.sh

# In the "Push changes" step, change:
run: |
  if ! git diff --quiet || ! git diff --cached --quiet; then
    git add -A
    git commit -m "Update playlist transcripts $(date -u '+%Y-%m-%d %H:%M UTC')" || true
    git push
  else
    echo "No changes to push."
  fi
```

The sync_playlist.sh uses `REPO="$(cd "$(dirname "$0")" && pwd)"` which will correctly resolve to `pipeline/` since it lives there.

**Step 3: Verify workflow syntax**

Run: `cat .github/workflows/sync-playlist.yml | head -20`
Expected: `name: Sync Playlist Transcripts` with correct paths

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: migrate sync-playlist workflow to unified repo"
```

### Task 4: Update app to read transcripts from pipeline/ instead of external repo

The app currently reads from `process.env.PLAYLIST_TRANSCRIPTS_REPO` (an absolute external path). Change it to read from `./pipeline` relative to the repo root.

**Files:**

- Modify: `src/lib/catalog.ts:65-73` — change `playlistTranscriptsRepoRoot()`
- Modify: `src/lib/hosted-config.ts:70+` — remove PLAYLIST_TRANSCRIPTS_REPO validation
- Modify: `src/lib/analysis.ts:420-422` — update transcript path resolution
- Modify: `src/app/api/raw/route.ts:10` — update raw file serving path

**Step 1: Update `src/lib/catalog.ts`**

Change `playlistTranscriptsRepoRoot()` at line 65:

```typescript
export function playlistTranscriptsRepoRoot(): string {
  // In unified repo, transcripts live at ./pipeline
  const override = process.env.PLAYLIST_TRANSCRIPTS_REPO;
  if (override) return override; // Allow override for local dev flexibility
  return path.join(process.cwd(), "pipeline");
}
```

**Step 2: Update `src/lib/hosted-config.ts`**

Remove the hard error for missing `PLAYLIST_TRANSCRIPTS_REPO` in hosted mode. The pipeline/ directory ships with the app now. Keep the validation that the directory exists, but point it at `./pipeline`:

- Remove the required check for `PLAYLIST_TRANSCRIPTS_REPO` (around line 172)
- Change the directory existence check to validate `path.join(process.cwd(), 'pipeline', 'youtube-transcripts')` exists
- Remove the git worktree / detached HEAD checks (no longer relevant — it's part of the repo, not a separate clone)

**Step 3: Update `src/app/api/raw/route.ts`**

The route at line 10 should call `playlistTranscriptsRepoRoot()` which now returns `./pipeline` by default.

**Step 4: Update `src/lib/analysis.ts`**

Same pattern — it already calls `playlistTranscriptsRepoRoot()`, so the upstream change propagates.

**Step 5: Test locally**

```bash
# Remove PLAYLIST_TRANSCRIPTS_REPO from .env.local (or comment it out)
just build
```

Expected: build succeeds, app can find transcripts at `./pipeline/youtube-transcripts/`

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: read transcripts from embedded pipeline/ directory"
```

---

## Phase 3: Multi-Playlist Support

### Task 5: Add playlist field to transcript frontmatter

The Python ingest script needs to tag each transcript with which playlist it came from.

**Files:**

- Modify: `pipeline/youtube-transcripts/scripts/ingest_transcript.py` — add `playlist` field to YAML frontmatter
- Modify: `pipeline/sync_playlist.sh` — pass playlist name to ingest script
- Modify: `pipeline/playlists.yml` — add Spirit Talk playlist

**Step 1: Update playlists.yml**

```yaml
playlists:
  - name: main-curated
    url: "https://youtube.com/playlist?list=PLnuGPVqDkDzSAf93OH2Zq1_6yXWZZOjdz"
    enabled: true
  - name: spirit-talk
    url: "https://youtube.com/playlist?list=PLnuGPVqDkDzSxB9GByqQDr3t2Izl-hEoz"
    enabled: true
```

**Step 2: Update sync_playlist.sh**

The script iterates playlists from `playlists.yml`. It needs to pass the playlist `name` to `ingest_transcript.py` so the frontmatter includes `playlist: spirit-talk`. Read the current script to understand the iteration pattern, then add a `--playlist` argument to the ingest call.

**Step 3: Update ingest_transcript.py**

Add `--playlist` CLI argument. Write it into the YAML frontmatter as `playlist: <name>`.

**Step 4: Test**

```bash
cd pipeline && ./sync_playlist.sh
```

Expected: new transcripts have `playlist: main-curated` or `playlist: spirit-talk` in frontmatter.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: multi-playlist support with playlist frontmatter tagging"
```

### Task 6: Add playlist filtering to the Next.js UI

**Files:**

- Modify: `src/lib/catalog.ts` — add playlist field to VideoRow, index from frontmatter
- Modify: video listing pages — add playlist filter/tabs

**Step 1: Read the current catalog rebuild logic**

Check `scripts/rebuild-catalog.ts` and `src/lib/catalog-db.ts` to understand how the SQLite catalog is built from transcript files.

**Step 2: Add `playlist` column to the catalog DB schema**

In the catalog rebuild script, add `playlist TEXT` to the videos table. Parse it from the transcript frontmatter.

**Step 3: Add playlist filter to the UI**

Add a playlist selector/tabs to the video listing page. Filter videos by `WHERE playlist = ?` when a playlist is selected.

**Step 4: Test**

```bash
just rebuild-catalog
just start
```

Expected: UI shows playlist tabs, filtering works.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: playlist filtering in catalog and UI"
```

---

## Phase 4: Dockerize

### Task 7: Create Dockerfile

**Files:**

- Create: `Dockerfile`

**Step 1: Write the Dockerfile**

```dockerfile
FROM node:22-slim AS base

# Install system deps for Python pipeline and Claude CLI
RUN apt-get update && \
    apt-get install -y --no-install-recommends git python3 python3-pip python3-venv && \
    rm -rf /var/lib/apt/lists/*

# Install Claude CLI globally
RUN npm install -g @anthropic-ai/claude-code

WORKDIR /app

# Install Node dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy app + pipeline
COPY . .

# Bootstrap Python venv for pipeline scripts
RUN python3 -m venv pipeline/.venv && \
    pipeline/.venv/bin/pip install -r pipeline/requirements.txt

# Build Next.js
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

**Step 2: Test build locally**

```bash
docker build -t transcript-library .
```

Expected: builds successfully

**Step 3: Test run locally**

```bash
docker run -p 3000:3000 \
  -v $(pwd)/data/catalog:/app/data/catalog \
  -v $(pwd)/data/insights:/app/data/insights \
  transcript-library
```

Expected: app starts, accessible at http://localhost:3000

**Step 4: Commit**

```bash
git add Dockerfile
git commit -m "feat: add Dockerfile for Coolify deployment"
```

### Task 8: Create docker-compose.yml

**Files:**

- Create: `docker-compose.yml`

**Step 1: Write docker-compose.yml**

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - catalog-data:/app/data/catalog
      - insights-data:/app/data/insights
      - claude-auth:/home/node/.claude:ro
    environment:
      - HOSTED=true
      - NODE_ENV=production
      - PRIVATE_API_TOKEN=${PRIVATE_API_TOKEN}
      - CLOUDFLARE_ACCESS_AUD=${CLOUDFLARE_ACCESS_AUD}
      - CLOUDFLARE_ACCESS_TEAM_DOMAIN=${CLOUDFLARE_ACCESS_TEAM_DOMAIN}
      - ANALYSIS_PROVIDER=${ANALYSIS_PROVIDER:-claude-cli}
      - CLAUDE_ANALYSIS_MODEL=${CLAUDE_ANALYSIS_MODEL}
      - SYNC_TOKEN=${SYNC_TOKEN}
    restart: unless-stopped

volumes:
  catalog-data:
  insights-data:
  claude-auth:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /home/deploy/.claude
```

**Step 2: Commit**

```bash
git add docker-compose.yml
git commit -m "feat: add docker-compose.yml for Coolify"
```

### Task 9: Add .dockerignore

**Files:**

- Create: `.dockerignore`

**Step 1: Write .dockerignore**

```
node_modules
.git
.gsd
.next
data/catalog
data/insights
pipeline/.venv
pipeline/youtube-transcripts/inbox
deploy
mockups
test-results
*.log
```

**Step 2: Commit**

```bash
git add .dockerignore
git commit -m "chore: add .dockerignore"
```

---

## Phase 5: Install Coolify on Proxmox

### Task 10: Create Coolify LXC via community script

This task is performed on the **Proxmox host** via SSH.

**Step 1: SSH into Proxmox**

```bash
ssh proxmox
```

**Step 2: Run the community script**

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/ct/coolify.sh)"
```

During the interactive setup:

- Accept defaults (Debian 13, 2 cores, 4096 MB RAM, 30 GB disk)
- **Override RAM to 8192 MB** (app runs on same LXC)
- Note the assigned LXC ID and IP address

**Step 3: Verify Coolify is running**

Open browser: `http://<coolify-lxc-ip>:8000`
Expected: Coolify setup wizard

**Step 4: Complete Coolify initial setup**

- Create admin account
- Configure localhost server (Coolify manages the same machine it runs on)

**Step 5: Record the LXC details**

Note the LXC ID, IP address, and Coolify dashboard URL for the homelab repo docs.

### Task 11: Connect Coolify to GitHub

**Step 1: In Coolify dashboard**

Go to: Sources → Add New → GitHub App

Follow the OAuth flow to connect your `AojdevStudio` GitHub organization.

**Step 2: Verify connection**

The `AojdevStudio/transcript-library` repo should be visible in Coolify's repo picker.

### Task 12: Create the application in Coolify

**Step 1: Create new project**

In Coolify: Projects → Add New → name it "Transcript Library"

**Step 2: Add application**

- Source: GitHub → `AojdevStudio/transcript-library` → branch `main`
- Build pack: Docker Compose
- Docker Compose file: `docker-compose.yml`
- Auto-deploy: enabled

**Step 3: Configure environment variables**

In the app's Environment tab, add:

- `PRIVATE_API_TOKEN` = (generate a new one)
- `CLOUDFLARE_ACCESS_AUD` = (from current LXC 101 config)
- `CLOUDFLARE_ACCESS_TEAM_DOMAIN` = `aojdevstudio`
- `ANALYSIS_PROVIDER` = `claude-cli`
- `CLAUDE_ANALYSIS_MODEL` = (current value from LXC 101)
- `SYNC_TOKEN` = (from current LXC 101 config)

**Step 4: Configure persistent storage**

Verify the volumes from docker-compose.yml are recognized. Coolify should auto-detect them.

**Step 5: Deploy**

Trigger first deploy from the Coolify dashboard. Watch the build logs.

Expected: app builds and starts on port 3000.

### Task 13: Set up Claude CLI auth on Coolify LXC

**Step 1: SSH into the Coolify LXC**

```bash
ssh root@<coolify-lxc-ip>
```

**Step 2: Create deploy user and auth Claude CLI**

```bash
useradd -m -s /bin/bash deploy
su - deploy
npx @anthropic-ai/claude-code login
```

Follow the OAuth flow to authenticate. This creates `/home/deploy/.claude/` with the session.

**Step 3: Verify the volume mount works**

Check that the Docker container can see the auth files:

```bash
docker exec <container-id> ls /home/node/.claude/
```

Expected: OAuth session files visible

### Task 14: Configure Coolify cron for daily analysis

**Step 1: In Coolify dashboard**

Go to the app → Scheduled Tasks → Add

- Name: `daily-analysis-sweep`
- Command: `npm run daily:sweep`
- Schedule: `0 3 * * *` (03:00 UTC daily)

**Step 2: Verify cron**

Wait for next execution or trigger manually from the dashboard.

---

## Phase 6: Wire Cloudflare Tunnel

### Task 15: Update Cloudflare tunnel config

**Files:**

- Modify: `proxmox/cloudflared/config.yml` (in homelab repo)

**Step 1: Add ingress rule for Coolify LXC**

Add before the catch-all rule:

```yaml
- hostname: library.aojdevstudio.me
  service: http://<coolify-lxc-ip>:3000
```

**Step 2: Optionally add Coolify dashboard access**

```yaml
- hostname: coolify.aojdevstudio.me
  service: http://<coolify-lxc-ip>:8000
```

**Step 3: Deploy the config to LXC 102**

```bash
scp proxmox/cloudflared/config.yml root@10.69.1.178:/etc/cloudflared/config.yml
ssh root@10.69.1.178 'docker restart cloudflared'
```

**Step 4: Verify**

Open: `https://library.aojdevstudio.me`
Expected: transcript-library app loads via Cloudflare tunnel from the Coolify LXC

**Step 5: Commit homelab changes**

```bash
cd ~/Projects/homelab
git add proxmox/cloudflared/config.yml
git commit -m "feat: route transcript-library to Coolify LXC"
```

---

## Phase 7: Validate and Decommission

### Task 16: Parallel validation

Run both old (LXC 101) and new (Coolify LXC) simultaneously for 48 hours.

**Checklist:**

- [ ] App loads at `library.aojdevstudio.me`
- [ ] Cloudflare Access OTP works
- [ ] Video listing shows all 244+ transcripts
- [ ] Video playback + transcript reading works
- [ ] Analysis pipeline runs (trigger manually via Coolify cron)
- [ ] GitHub Action sync runs (check Actions tab)
- [ ] Auto-deploy fires on push (make a trivial commit, watch Coolify)
- [ ] SQLite catalog persists across deploys (redeploy, check data survives)
- [ ] Daily sweep cron fires at 03:00 UTC

### Task 17: Update homelab repo documentation

**Files:**

- Modify: `proxmox/CLAUDE.md` — add Coolify LXC to service inventory
- Modify: `CLAUDE.md` (root) — update Service Architecture section
- Modify: `KNOWN_ISSUES.md` — remove LXC 101 references if applicable

**Step 1: Update proxmox/CLAUDE.md**

Add Coolify LXC entry with IP, LXC ID, what it runs, Coolify dashboard URL.

**Step 2: Update root CLAUDE.md**

In the Service Architecture section, replace LXC 101 references with the Coolify LXC.

**Step 3: Commit**

```bash
git add -A
git commit -m "docs: add Coolify LXC to homelab documentation"
```

### Task 18: Decommission LXC 101

Only after Task 16 validation passes.

**Step 1: Back up persistent data from LXC 101**

```bash
ssh root@<lxc-101-ip>
tar czf /tmp/transcript-library-backup.tar.gz /srv/transcript-library/
```

Copy to NAS:

```bash
scp root@<lxc-101-ip>:/tmp/transcript-library-backup.tar.gz NAS:/volume1/backups/
```

**Step 2: Stop all services on LXC 101**

```bash
ssh root@<lxc-101-ip>
pm2 stop all
systemctl stop deploy-hook transcript-library-sweep.timer
systemctl stop cloudflared
```

**Step 3: Remove cloudflared ingress for old LXC 101**

Remove the old `library.aojdevstudio.me` route pointing to LXC 101 from `proxmox/cloudflared/config.yml` (should already be replaced in Task 15).

**Step 4: Destroy LXC 101 on Proxmox**

```bash
ssh proxmox
pct stop 101
pct destroy 101
```

**Step 5: Update homelab repo**

Remove any LXC 101-specific config, commit.

```bash
git add -A
git commit -m "chore: decommission LXC 101 after Coolify migration"
```

---

## Summary

| Phase | Tasks | Description                                                |
| ----- | ----- | ---------------------------------------------------------- |
| 1     | 1     | Resolve merge conflicts                                    |
| 2     | 2-4   | Merge repos, migrate workflow, update app paths            |
| 3     | 5-6   | Multi-playlist support (pipeline + UI)                     |
| 4     | 7-9   | Dockerfile, docker-compose, .dockerignore                  |
| 5     | 10-14 | Install Coolify, connect GitHub, deploy, Claude auth, cron |
| 6     | 15    | Wire Cloudflare tunnel                                     |
| 7     | 16-18 | Validate, document, decommission                           |

**Total tasks:** 18
**Estimated phases:** 7 (can be done over multiple sessions)
**Critical path:** Phase 1 → 2 → 4 → 5 (Coolify install can happen in parallel with Phases 2-4)

#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

WORK_DIR="$ROOT_DIR/.gsd/tmp/verify-s03-source-refresh"
REMOTE_REPO="$WORK_DIR/remote.git"
UPSTREAM_REPO="$WORK_DIR/upstream"
CLONE_REPO="$WORK_DIR/clone"
RUNTIME_DIR="$WORK_DIR/runtime"
CATALOG_DB_PATH="$RUNTIME_DIR/data/catalog/catalog.db"
INSIGHTS_BASE_DIR="$RUNTIME_DIR/data/insights"
INITIAL_REFRESH_JSON="$WORK_DIR/initial-refresh.json"
SECOND_REFRESH_JSON="$WORK_DIR/second-refresh.json"
VERIFY_SUMMARY_JSON="$WORK_DIR/verification-summary.json"
VIDEO_ID_INITIAL="alpha123xyz"
VIDEO_ID_REFRESHED="beta123xyza"

rm -rf "$WORK_DIR"
mkdir -p "$WORK_DIR" "$RUNTIME_DIR"

export PLAYLIST_TRANSCRIPTS_REPO="$CLONE_REPO"
export PLAYLIST_TRANSCRIPTS_REMOTE="origin"
export PLAYLIST_TRANSCRIPTS_BRANCH="master"
export CATALOG_DB_PATH
export INSIGHTS_BASE_DIR
unset HOSTED
unset PRIVATE_API_TOKEN

run_git() {
  local repo="$1"
  shift
  git -C "$repo" "$@"
}

write_repo_state() {
  local repo="$1"
  local include_beta="$2"
  mkdir -p "$repo/youtube-transcripts/index" "$repo/youtube-transcripts/alpha"
  cat >"$repo/youtube-transcripts/alpha/main.md" <<'EOF'
Alpha transcript from initial upstream state.
EOF

  if [[ "$include_beta" == "1" ]]; then
    mkdir -p "$repo/youtube-transcripts/beta"
    cat >"$repo/youtube-transcripts/beta/main.md" <<'EOF'
Beta transcript from refreshed upstream state.
EOF
  else
    rm -rf "$repo/youtube-transcripts/beta"
  fi

  {
    echo 'video_id,parent_video_id,title,channel,topic,published_date,ingested_date,word_count,chunk,total_chunks,file_path'
    echo "$VIDEO_ID_INITIAL,,Alpha,Channel A,Testing,2026-03-10,2026-03-11,120,1,1,alpha/main.md"
    if [[ "$include_beta" == "1" ]]; then
      echo "$VIDEO_ID_REFRESHED,,Beta,Channel B,Testing,2026-03-12,2026-03-12,240,1,1,beta/main.md"
    fi
  } >"$repo/youtube-transcripts/index/videos.csv"
}

commit_all() {
  local repo="$1"
  local message="$2"
  run_git "$repo" add .
  run_git "$repo" commit -m "$message" >/dev/null
  run_git "$repo" rev-parse HEAD
}

run_refresh() {
  local output_file="$1"
  node --import tsx scripts/refresh-source-catalog.ts >"$output_file"
  cat "$output_file"
  printf '\n'
}

echo "==> creating temporary upstream bare repo and working seed"
git init --bare "$REMOTE_REPO" >/dev/null
mkdir -p "$UPSTREAM_REPO"
git -C "$WORK_DIR" init -b master "$UPSTREAM_REPO" >/dev/null
run_git "$UPSTREAM_REPO" config user.name "Transcript Library Verify"
run_git "$UPSTREAM_REPO" config user.email "verify@example.com"
write_repo_state "$UPSTREAM_REPO" 0
INITIAL_HEAD="$(commit_all "$UPSTREAM_REPO" "initial transcript import")"
run_git "$UPSTREAM_REPO" remote add origin "$REMOTE_REPO"
run_git "$UPSTREAM_REPO" push -u origin master >/dev/null

echo "==> cloning the app-owned checkout fixture"
git clone -b master "$REMOTE_REPO" "$CLONE_REPO" >/dev/null
run_git "$CLONE_REPO" config user.name "Transcript Library Verify"
run_git "$CLONE_REPO" config user.email "verify@example.com"

echo "==> initial refresh through the supported CLI entrypoint"
run_refresh "$INITIAL_REFRESH_JSON"

echo "==> asserting the new video is absent before the upstream change"
node --import tsx <<'NODE'
const catalogModule = await import('./src/lib/catalog.ts');
const { getVideo } = catalogModule.default ?? catalogModule;
const videoId = process.env.VIDEO_ID_REFRESHED ?? 'beta123xyza';
const video = getVideo(videoId);
if (video) {
  throw new Error(`expected ${videoId} to be absent before refresh, found ${video.title}`);
}
console.log(JSON.stringify({ ok: true, beforeRefreshVideoPresent: false, videoId }, null, 2));
NODE

echo "==> committing a second upstream transcript/video"
write_repo_state "$UPSTREAM_REPO" 1
UPDATED_HEAD="$(commit_all "$UPSTREAM_REPO" "add refreshed beta transcript")"
run_git "$UPSTREAM_REPO" push origin master >/dev/null

echo "==> second refresh through the supported CLI entrypoint"
run_refresh "$SECOND_REFRESH_JSON"

echo "==> verifying refresh evidence, browse visibility, raw reads, and no-analysis side effects"
VIDEO_ID_INITIAL="$VIDEO_ID_INITIAL" VIDEO_ID_REFRESHED="$VIDEO_ID_REFRESHED" INITIAL_HEAD="$INITIAL_HEAD" UPDATED_HEAD="$UPDATED_HEAD" VERIFY_SUMMARY_JSON="$VERIFY_SUMMARY_JSON" node --import tsx <<'NODE'
import fs from 'node:fs';
import path from 'node:path';

const catalogModule = await import('./src/lib/catalog.ts');
const { getVideo } = catalogModule.default ?? catalogModule;
const rawRouteModule = await import('./src/app/api/raw/route.ts');
const { GET } = rawRouteModule.default ?? rawRouteModule;

const initialRefresh = JSON.parse(fs.readFileSync(path.join(process.cwd(), '.gsd/tmp/verify-s03-source-refresh/initial-refresh.json'), 'utf8'));
const secondRefresh = JSON.parse(fs.readFileSync(path.join(process.cwd(), '.gsd/tmp/verify-s03-source-refresh/second-refresh.json'), 'utf8'));
const refreshRecord = JSON.parse(fs.readFileSync(path.join(path.dirname(process.env.CATALOG_DB_PATH!), 'last-source-refresh.json'), 'utf8'));
const validationReport = JSON.parse(fs.readFileSync(path.join(path.dirname(process.env.CATALOG_DB_PATH!), 'last-import-validation.json'), 'utf8'));
const refreshedVideoId = process.env.VIDEO_ID_REFRESHED!;
const initialVideoId = process.env.VIDEO_ID_INITIAL!;
const initialHead = process.env.INITIAL_HEAD!;
const updatedHead = process.env.UPDATED_HEAD!;
const verifySummaryPath = process.env.VERIFY_SUMMARY_JSON!;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

assert(initialRefresh.status === 'noop', `expected initial refresh status noop, got ${initialRefresh.status}`);
assert(initialRefresh.repo.headBefore === initialHead, `expected initial refresh headBefore ${initialHead}, got ${initialRefresh.repo.headBefore}`);
assert(initialRefresh.repo.headAfter === initialHead, `expected initial refresh headAfter ${initialHead}, got ${initialRefresh.repo.headAfter}`);
assert(secondRefresh.status === 'updated', `expected second refresh status updated, got ${secondRefresh.status}`);
assert(secondRefresh.repo.headBefore === initialHead, `expected second refresh headBefore ${initialHead}, got ${secondRefresh.repo.headBefore}`);
assert(secondRefresh.repo.headAfter === updatedHead, `expected second refresh headAfter ${updatedHead}, got ${secondRefresh.repo.headAfter}`);
assert(secondRefresh.repo.upstreamHead === updatedHead, `expected second refresh upstreamHead ${updatedHead}, got ${secondRefresh.repo.upstreamHead}`);
assert(refreshRecord.outcome === 'updated', `expected last-source-refresh outcome updated, got ${refreshRecord.outcome}`);
assert(refreshRecord.repo.headBefore === initialHead, `expected record headBefore ${initialHead}, got ${refreshRecord.repo.headBefore}`);
assert(refreshRecord.repo.headAfter === updatedHead, `expected record headAfter ${updatedHead}, got ${refreshRecord.repo.headAfter}`);
assert(validationReport.catalogVersion === refreshRecord.catalog.version, 'expected validation report catalogVersion to match refresh record');

const initialVideo = getVideo(initialVideoId);
assert(initialVideo?.title === 'Alpha', `expected initial video Alpha, got ${initialVideo?.title ?? '<missing>'}`);
const refreshedVideo = getVideo(refreshedVideoId);
assert(refreshedVideo?.title === 'Beta', `expected refreshed video Beta, got ${refreshedVideo?.title ?? '<missing>'}`);
assert(refreshedVideo?.parts[0]?.filePath === 'beta/main.md', `expected beta part path beta/main.md, got ${refreshedVideo?.parts[0]?.filePath ?? '<missing>'}`);

const rawResponse = await GET(new Request('http://localhost/api/raw?path=beta/main.md'));
assert(rawResponse.status === 200, `expected raw route HTTP 200, got ${rawResponse.status}`);
const rawText = await rawResponse.text();
assert(rawText.includes('Beta transcript from refreshed upstream state.'), 'expected raw route to return refreshed transcript text');

const runJsonPath = path.join(process.env.INSIGHTS_BASE_DIR!, refreshedVideoId, 'run.json');
const statusJsonPath = path.join(process.env.INSIGHTS_BASE_DIR!, refreshedVideoId, 'status.json');
const runtimeBatchRoot = path.join(path.dirname(process.env.INSIGHTS_BASE_DIR!), 'runtime', 'batches');
assert(!fs.existsSync(runJsonPath), `unexpected analysis run.json created at ${runJsonPath}`);
assert(!fs.existsSync(statusJsonPath), `unexpected analysis status.json created at ${statusJsonPath}`);
assert(!fs.existsSync(runtimeBatchRoot), `unexpected runtime batch artifacts created at ${runtimeBatchRoot}`);

const summary = {
  ok: true,
  refresh: {
    initial: {
      status: initialRefresh.status,
      headBefore: initialRefresh.repo.headBefore,
      headAfter: initialRefresh.repo.headAfter,
    },
    second: {
      status: secondRefresh.status,
      headBefore: secondRefresh.repo.headBefore,
      headAfter: secondRefresh.repo.headAfter,
      catalogVersion: refreshRecord.catalog.version,
      videoCount: refreshRecord.catalog.videoCount,
      partCount: refreshRecord.catalog.partCount,
    },
  },
  browse: {
    refreshedVideoId,
    refreshedTitle: refreshedVideo.title,
    refreshedPartPath: refreshedVideo.parts[0].filePath,
    rawPreview: rawText.trim(),
  },
  analysisSideEffects: {
    runJsonPresent: fs.existsSync(runJsonPath),
    statusJsonPresent: fs.existsSync(statusJsonPath),
    runtimeBatchArtifactsPresent: fs.existsSync(runtimeBatchRoot),
  },
  evidence: {
    refreshRecordPath: path.join(path.dirname(process.env.CATALOG_DB_PATH!), 'last-source-refresh.json'),
    validationReportPath: path.join(path.dirname(process.env.CATALOG_DB_PATH!), 'last-import-validation.json'),
    initialRefreshPath: path.join(process.cwd(), '.gsd/tmp/verify-s03-source-refresh/initial-refresh.json'),
    secondRefreshPath: path.join(process.cwd(), '.gsd/tmp/verify-s03-source-refresh/second-refresh.json'),
  },
};

fs.writeFileSync(verifySummaryPath, JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
NODE

echo "==> verification evidence written under $WORK_DIR"

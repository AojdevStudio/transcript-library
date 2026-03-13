#!/usr/bin/env bash
set -euo pipefail

REPAIR_VIDEO_ID="${1:-}"
RERUN_VIDEO_ID="${2:-}"
if [[ -z "$REPAIR_VIDEO_ID" || -z "$RERUN_VIDEO_ID" ]]; then
  echo "usage: bash scripts/verify-s02-historical-repair.sh <repairableVideoId> <rerunVideoId>" >&2
  exit 64
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -f .env.local ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
fi

export ANALYSIS_PROVIDER="${ANALYSIS_PROVIDER:-codex-cli}"
export HOSTED="${HOSTED:-}"
PORT="${VERIFY_PORT:-3124}"
BASE_URL="http://127.0.0.1:${PORT}"
LOG_DIR="$ROOT_DIR/.gsd/tmp"
SERVER_LOG="$LOG_DIR/verify-s02-historical-repair.${REPAIR_VIDEO_ID}.${RERUN_VIDEO_ID}.server.log"
mkdir -p "$LOG_DIR"

SERVER_PID=""
cleanup() {
  if [[ -n "$SERVER_PID" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

json_get() {
  local file="$1"
  local expr="$2"
  node -e 'const fs=require("fs"); const payload=JSON.parse(fs.readFileSync(process.argv[1], "utf8")); const value=Function("payload", `return (${process.argv[2]});`)(payload); if (typeof value === "object") { console.log(JSON.stringify(value)); } else if (value !== undefined && value !== null) { console.log(String(value)); }' "$file" "$expr"
}

request_json() {
  local method="$1"
  local url="$2"
  local body_file="$3"
  local status
  status=$(curl -sS -o "$body_file" -w '%{http_code}' -X "$method" "$url")
  echo "$status"
}

echo "==> validating catalog snapshot"
if ! npx tsx scripts/rebuild-catalog.ts --check >/tmp/verify-s02-catalog-check.json 2>/tmp/verify-s02-catalog-check.err; then
  cat /tmp/verify-s02-catalog-check.err >&2 || true
  cat /tmp/verify-s02-catalog-check.json >&2 || true
  echo "==> catalog check failed; rebuilding"
  npx tsx scripts/rebuild-catalog.ts
fi

echo "==> preparing representative repairable fixture ${REPAIR_VIDEO_ID}"
REPAIR_VIDEO_ID="$REPAIR_VIDEO_ID" node <<'NODE'
const fs = require('fs');
const path = require('path');
const videoId = process.env.REPAIR_VIDEO_ID;
const dir = path.join(process.cwd(), 'data', 'insights', videoId);
const structured = path.join(dir, 'analysis.json');
const reconciliation = path.join(dir, 'reconciliation.json');
if (!fs.existsSync(path.join(dir, 'analysis.md'))) {
  throw new Error(`missing canonical analysis for ${videoId}`);
}
if (!fs.existsSync(path.join(dir, 'run.json'))) {
  throw new Error(`missing run.json for ${videoId}`);
}
fs.rmSync(structured, { force: true });
fs.rmSync(reconciliation, { force: true });
console.log(JSON.stringify({ ok: true, videoId, cleared: ['analysis.json', 'reconciliation.json'] }, null, 2));
NODE

echo "==> preparing representative rerun-only fixture ${RERUN_VIDEO_ID}"
RERUN_VIDEO_ID="$RERUN_VIDEO_ID" node <<'NODE'
const fs = require('fs');
const path = require('path');
const videoId = process.env.RERUN_VIDEO_ID;
const dir = path.join(process.cwd(), 'data', 'insights', videoId);
const requiredMarkdown = [path.join(dir, 'analysis.md')];
for (const filePath of requiredMarkdown) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`missing required historical artifact ${path.basename(filePath)} for ${videoId}`);
  }
}
const removable = [
  'analysis.json',
  'run.json',
  'reconciliation.json',
  'video-metadata.json',
  'worker-stdout.txt',
  'worker-stderr.txt',
  'claude-stdout.txt',
  'claude-stderr.txt',
];
for (const name of removable) {
  fs.rmSync(path.join(dir, name), { force: true, recursive: true });
}
fs.rmSync(path.join(dir, 'runs'), { force: true, recursive: true });
console.log(JSON.stringify({
  ok: true,
  videoId,
  cleared: [...removable, 'runs/']
}, null, 2));
NODE

echo "==> running historical repair inventory"
REPAIR_REPORT="$(mktemp)"
node --import tsx scripts/repair-historical-artifacts.ts --video-id "$REPAIR_VIDEO_ID" --video-id "$RERUN_VIDEO_ID" >"$REPAIR_REPORT"
cat "$REPAIR_REPORT"
printf '\n'

REPAIR_VIDEO_ID="$REPAIR_VIDEO_ID" RERUN_VIDEO_ID="$RERUN_VIDEO_ID" REPORT_PATH="$REPAIR_REPORT" node <<'NODE'
const fs = require('fs');
const report = JSON.parse(fs.readFileSync(process.env.REPORT_PATH, 'utf8'));
const repairId = process.env.REPAIR_VIDEO_ID;
const rerunId = process.env.RERUN_VIDEO_ID;
const repair = report.results.find((entry) => entry.videoId === repairId);
const rerun = report.results.find((entry) => entry.videoId === rerunId);
function assert(cond, message) {
  if (!cond) throw new Error(message);
}
assert(repair, `missing repair report entry for ${repairId}`);
assert(rerun, `missing rerun report entry for ${rerunId}`);
assert(repair.action === 'repaired', `expected ${repairId} action repaired, got ${repair.action}`);
assert(JSON.stringify(repair.reasonCodes) === JSON.stringify(['missing-structured-analysis']), `unexpected ${repairId} reason codes ${JSON.stringify(repair.reasonCodes)}`);
assert(repair.operatorEvidence?.analyzeOutcome === 'resolved', `expected ${repairId} analyzeOutcome resolved`);
assert(repair.operatorEvidence?.retryable === false, `expected ${repairId} retryable false`);
assert(rerun.action === 'rerun-needed', `expected ${rerunId} action rerun-needed, got ${rerun.action}`);
assert(JSON.stringify(rerun.reasonCodes) === JSON.stringify(['artifacts-without-run']), `unexpected ${rerunId} reason codes ${JSON.stringify(rerun.reasonCodes)}`);
assert(rerun.runId === null, `expected ${rerunId} runId null before rerun`);
assert(rerun.operatorEvidence?.analyzeOutcome === 'retry-needed', `expected ${rerunId} analyzeOutcome retry-needed`);
assert(rerun.operatorEvidence?.retryable === true, `expected ${rerunId} retryable true`);
console.log(JSON.stringify({
  ok: true,
  repaired: { videoId: repairId, action: repair.action, operatorEvidence: repair.operatorEvidence },
  rerunNeeded: { videoId: rerunId, action: rerun.action, operatorEvidence: rerun.operatorEvidence }
}, null, 2));
NODE

echo "==> asserting no synthetic run was created for ${RERUN_VIDEO_ID}"
RERUN_VIDEO_ID="$RERUN_VIDEO_ID" node <<'NODE'
const fs = require('fs');
const path = require('path');
const videoId = process.env.RERUN_VIDEO_ID;
const dir = path.join(process.cwd(), 'data', 'insights', videoId);
if (fs.existsSync(path.join(dir, 'run.json'))) {
  throw new Error(`unexpected run.json created for ${videoId} before rerun`);
}
console.log(JSON.stringify({ ok: true, videoId, runJsonPresent: false }, null, 2));
NODE

echo "==> starting local app server on ${BASE_URL} with provider ${ANALYSIS_PROVIDER}"
NEXT_TELEMETRY_DISABLED=1 npx next dev --hostname 127.0.0.1 --port "$PORT" >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!

READY=0
for _ in $(seq 1 90); do
  if curl -fsS "$BASE_URL/api/insight?videoId=$RERUN_VIDEO_ID" >/tmp/verify-s02-ready.json 2>/dev/null; then
    READY=1
    break
  fi
  sleep 2
done

if [[ "$READY" != "1" ]]; then
  echo "server did not become ready; recent log tail:" >&2
  tail -n 80 "$SERVER_LOG" >&2 || true
  exit 1
fi

echo "==> verifying pre-rerun operator surfaces for ${RERUN_VIDEO_ID}"
PRE_INSIGHT_BODY="$(mktemp)"
PRE_INSIGHT_STATUS=$(request_json GET "$BASE_URL/api/insight?videoId=$RERUN_VIDEO_ID" "$PRE_INSIGHT_BODY")
if [[ "$PRE_INSIGHT_STATUS" != "200" ]]; then
  echo "pre-rerun insight read failed with HTTP ${PRE_INSIGHT_STATUS}" >&2
  cat "$PRE_INSIGHT_BODY" >&2 || true
  exit 1
fi
cat "$PRE_INSIGHT_BODY"
printf '\n'

PRE_STATUS_BODY="$(mktemp)"
PRE_STATUS_CODE=$(request_json GET "$BASE_URL/api/analyze/status?videoId=$RERUN_VIDEO_ID" "$PRE_STATUS_BODY")
if [[ "$PRE_STATUS_CODE" != "200" ]]; then
  echo "pre-rerun analyze status failed with HTTP ${PRE_STATUS_CODE}" >&2
  cat "$PRE_STATUS_BODY" >&2 || true
  exit 1
fi
cat "$PRE_STATUS_BODY"
printf '\n'

PRE_INSIGHT_BODY="$PRE_INSIGHT_BODY" PRE_STATUS_BODY="$PRE_STATUS_BODY" RERUN_VIDEO_ID="$RERUN_VIDEO_ID" node <<'NODE'
const fs = require('fs');
const insight = JSON.parse(fs.readFileSync(process.env.PRE_INSIGHT_BODY, 'utf8'));
const status = JSON.parse(fs.readFileSync(process.env.PRE_STATUS_BODY, 'utf8'));
const videoId = process.env.RERUN_VIDEO_ID;
function assert(cond, message) {
  if (!cond) throw new Error(message);
}
assert(insight.status === 'failed', `expected ${videoId} insight status failed, got ${insight.status}`);
assert(insight.lifecycle === 'reconciled', `expected ${videoId} lifecycle reconciled, got ${insight.lifecycle}`);
assert(insight.retryable === true, `expected ${videoId} retryable true`);
assert(insight.analyzeOutcome === 'retry-needed', `expected ${videoId} analyzeOutcome retry-needed, got ${insight.analyzeOutcome}`);
assert(insight.run === null, `expected ${videoId} run null before rerun`);
assert(insight.retryGuidance?.nextAction === 'rerun-analysis', `expected rerun guidance for ${videoId}`);
assert(Array.isArray(insight.reconciliation?.reasons) && insight.reconciliation.reasons[0]?.code === 'artifacts-without-run', `expected artifacts-without-run reason for ${videoId}`);
assert(status.outcome === 'retry-needed', `expected analyze status outcome retry-needed, got ${status.outcome}`);
assert(status.retryable === true, `expected analyze status retryable true for ${videoId}`);
console.log(JSON.stringify({
  ok: true,
  videoId,
  insightStatus: insight.status,
  analyzeOutcome: insight.analyzeOutcome,
  retryGuidance: insight.retryGuidance,
  reconciliation: insight.reconciliation,
  statusRoute: status
}, null, 2));
NODE

echo "==> triggering normal analyze flow for ${RERUN_VIDEO_ID}"
START_BODY="$(mktemp)"
START_STATUS=$(request_json POST "$BASE_URL/api/analyze?videoId=$RERUN_VIDEO_ID" "$START_BODY")
cat "$START_BODY"
printf '\n'
if [[ "$START_STATUS" != "200" ]]; then
  echo "analyze start failed with HTTP ${START_STATUS}" >&2
  exit 1
fi

echo "==> polling terminal runtime state"
STATUS_BODY="$(mktemp)"
TERMINAL=0
for _ in $(seq 1 180); do
  STATUS_CODE=$(request_json GET "$BASE_URL/api/analyze/status?videoId=$RERUN_VIDEO_ID" "$STATUS_BODY")
  if [[ "$STATUS_CODE" != "200" ]]; then
    echo "status route failed with HTTP ${STATUS_CODE}" >&2
    cat "$STATUS_BODY" >&2 || true
    exit 1
  fi

  STATUS_VALUE=$(json_get "$STATUS_BODY" 'payload.status')
  LIFECYCLE_VALUE=$(json_get "$STATUS_BODY" 'payload.lifecycle ?? ""')
  ERROR_VALUE=$(json_get "$STATUS_BODY" 'payload.error ?? ""')
  RUN_ID_VALUE=$(json_get "$STATUS_BODY" 'payload.runId ?? ""')
  echo "status=${STATUS_VALUE} lifecycle=${LIFECYCLE_VALUE} runId=${RUN_ID_VALUE} error=${ERROR_VALUE}"

  if [[ "$STATUS_VALUE" == "complete" || "$STATUS_VALUE" == "failed" ]]; then
    TERMINAL=1
    break
  fi
  sleep 5
done

if [[ "$TERMINAL" != "1" ]]; then
  echo "analysis did not reach terminal state in time" >&2
  tail -n 80 "$SERVER_LOG" >&2 || true
  exit 1
fi

if [[ "$(json_get "$STATUS_BODY" 'payload.status')" != "complete" ]]; then
  echo "analysis finished in failure state" >&2
  cat "$STATUS_BODY" >&2
  if [[ -f "data/insights/$RERUN_VIDEO_ID/run.json" ]]; then
    echo "--- run.json ---" >&2
    cat "data/insights/$RERUN_VIDEO_ID/run.json" >&2
  fi
  if [[ -f "data/insights/$RERUN_VIDEO_ID/status.json" ]]; then
    echo "--- status.json ---" >&2
    cat "data/insights/$RERUN_VIDEO_ID/status.json" >&2
  fi
  if [[ -f "data/insights/$RERUN_VIDEO_ID/worker-stdout.txt" ]]; then
    echo "--- worker-stdout.txt ---" >&2
    tail -n 80 "data/insights/$RERUN_VIDEO_ID/worker-stdout.txt" >&2 || true
  fi
  if [[ -f "data/insights/$RERUN_VIDEO_ID/worker-stderr.txt" ]]; then
    echo "--- worker-stderr.txt ---" >&2
    tail -n 80 "data/insights/$RERUN_VIDEO_ID/worker-stderr.txt" >&2 || true
  fi
  exit 1
fi

echo "==> verifying post-rerun operator read"
POST_INSIGHT_BODY="$(mktemp)"
POST_INSIGHT_STATUS=$(request_json GET "$BASE_URL/api/insight?videoId=$RERUN_VIDEO_ID" "$POST_INSIGHT_BODY")
if [[ "$POST_INSIGHT_STATUS" != "200" ]]; then
  echo "post-rerun insight read failed with HTTP ${POST_INSIGHT_STATUS}" >&2
  cat "$POST_INSIGHT_BODY" >&2 || true
  exit 1
fi
cat "$POST_INSIGHT_BODY"
printf '\n'

POST_INSIGHT_BODY="$POST_INSIGHT_BODY" RERUN_VIDEO_ID="$RERUN_VIDEO_ID" node <<'NODE'
const fs = require('fs');
const body = JSON.parse(fs.readFileSync(process.env.POST_INSIGHT_BODY, 'utf8'));
const videoId = process.env.RERUN_VIDEO_ID;
function assert(cond, message) {
  if (!cond) throw new Error(message);
}
assert(body.status === 'complete', `expected ${videoId} insight status complete, got ${body.status}`);
assert(body.retryable === false, `expected ${videoId} retryable false after rerun`);
assert(body.reconciliation?.status === 'resolved', `expected ${videoId} reconciliation resolved`);
assert(body.run?.runId, `expected ${videoId} run metadata after rerun`);
console.log(JSON.stringify({
  ok: true,
  videoId,
  status: body.status,
  runId: body.run.runId,
  reconciliation: body.reconciliation
}, null, 2));
NODE

echo "==> validating canonical post-rerun artifacts"
RERUN_VIDEO_ID="$RERUN_VIDEO_ID" node <<'NODE'
const fs = require('fs');
const path = require('path');
const videoId = process.env.RERUN_VIDEO_ID;
const dir = path.join(process.cwd(), 'data', 'insights', videoId);
function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
}
function assert(cond, message) {
  if (!cond) throw new Error(message);
}
const run = readJson('run.json');
const status = readJson('status.json');
const reconciliation = readJson('reconciliation.json');
const analysis = readJson('analysis.json');
const analysisMarkdown = fs.readFileSync(path.join(dir, 'analysis.md'), 'utf8');
const displayPath = path.join(dir, run.artifacts.displayFileName);
const attemptDir = path.join(dir, run.artifacts.attemptDirectory);
assert(run.provider === 'codex-cli', `expected codex-cli provider, got ${run.provider}`);
assert(run.status === 'complete', `expected run.json status complete, got ${run.status}`);
assert(run.lifecycle === 'completed', `expected lifecycle completed, got ${run.lifecycle}`);
assert(typeof run.runId === 'string' && run.runId.length > 0, 'runId missing after rerun');
assert(status.runId === run.runId, `expected status runId ${run.runId}, got ${status.runId}`);
assert(status.status === 'complete', `expected status.json status complete, got ${status.status}`);
assert(status.lifecycle === 'completed', `expected status.json lifecycle completed, got ${status.lifecycle}`);
assert(reconciliation.status === 'resolved', `expected reconciliation resolved, got ${reconciliation.status}`);
assert(reconciliation.resolution === 'resolved', `expected reconciliation resolution resolved, got ${reconciliation.resolution}`);
assert(reconciliation.retryable === false, `expected reconciliation retryable false`);
assert(Array.isArray(reconciliation.reasons) && reconciliation.reasons.length === 0, 'expected no reconciliation reasons after rerun');
assert(analysis.schemaVersion === 1, `expected analysis schemaVersion 1, got ${analysis.schemaVersion}`);
assert(Array.isArray(analysis.takeaways) && analysis.takeaways.length > 0, 'analysis takeaways missing');
assert(Array.isArray(analysis.actionItems) && analysis.actionItems.length > 0, 'analysis actionItems missing');
assert(Array.isArray(analysis.notablePoints) && analysis.notablePoints.length > 0, 'analysis notablePoints missing');
assert(typeof analysis.reportMarkdown === 'string' && analysis.reportMarkdown.trim().length > 0, 'reportMarkdown missing');
assert(analysisMarkdown.trim().length > 0, 'analysis.md empty');
assert(fs.existsSync(displayPath), `missing display markdown artifact ${run.artifacts.displayFileName}`);
assert(fs.readFileSync(displayPath, 'utf8').trim().length > 0, 'display markdown artifact empty');
assert(fs.existsSync(attemptDir), `missing attempt directory ${run.artifacts.attemptDirectory}`);
assert(fs.existsSync(path.join(attemptDir, run.artifacts.attemptRunFileName)), 'missing attempt run.json');
assert(fs.existsSync(path.join(attemptDir, run.artifacts.attemptStdoutFileName)), 'missing attempt stdout log');
assert(fs.existsSync(path.join(attemptDir, run.artifacts.attemptStderrFileName)), 'missing attempt stderr log');
console.log(JSON.stringify({
  ok: true,
  videoId,
  provider: run.provider,
  runId: run.runId,
  lifecycle: run.lifecycle,
  displayArtifact: run.artifacts.displayFileName,
  reconciliation: {
    status: reconciliation.status,
    resolution: reconciliation.resolution,
    retryable: reconciliation.retryable
  },
  summaryPreview: String(analysis.summary || '').slice(0, 160)
}, null, 2));
NODE

echo "==> historical repair verification passed"

#!/usr/bin/env bash
# =============================================================================
# Transcript Library — Release Deploy Script
# =============================================================================
# Creates a timestamped release from a git ref, builds, repoints the current
# symlink atomically, and restarts pm2. Exits non-zero on any failure,
# preserving the previous release.
#
# Usage:
#   ./deploy.sh [GIT_REF] [REPO_URL]
#
# Defaults:
#   GIT_REF  = main
#   REPO_URL = https://github.com/aojdevstudio/transcript-library.git
# =============================================================================
set -euo pipefail

# --- Configuration -----------------------------------------------------------
readonly GIT_REF="${1:-main}"
readonly REPO_URL="${2:-https://github.com/aojdevstudio/transcript-library.git}"
readonly RELEASES_DIR="/opt/transcript-library/releases"
readonly CURRENT_LINK="/opt/transcript-library/current"
readonly ENV_FILE="/srv/transcript-library/.env.local"
readonly PM2_APP_NAME="transcript-library"
readonly KEEP_RELEASES=3

# --- Helpers -----------------------------------------------------------------
log() { printf '[deploy] %s — %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
die() { log "FATAL: $*"; exit 1; }

# --- Pre-checks --------------------------------------------------------------
command -v git  >/dev/null 2>&1 || die "git is not installed"
command -v node >/dev/null 2>&1 || die "node is not installed"
command -v npm  >/dev/null 2>&1 || die "npm is not installed"
command -v pm2  >/dev/null 2>&1 || die "pm2 is not installed"
[[ -f "$ENV_FILE" ]] || die ".env.local not found at $ENV_FILE"

# --- Create release directory ------------------------------------------------
TIMESTAMP="$(date -u +%Y-%m-%dT%H%M%SZ)"
readonly TIMESTAMP
readonly RELEASE_DIR="${RELEASES_DIR}/${TIMESTAMP}"

log "Starting deploy: ref=${GIT_REF} repo=${REPO_URL}"
log "Release directory: ${RELEASE_DIR}"

mkdir -p "$RELEASE_DIR"

# --- Clone -------------------------------------------------------------------
log "Cloning ${REPO_URL} at ref ${GIT_REF}..."
git clone --depth 1 --branch "$GIT_REF" "$REPO_URL" "$RELEASE_DIR" \
  || die "git clone failed"

# --- Capture git SHA ---------------------------------------------------------
GIT_SHA="$(git -C "$RELEASE_DIR" rev-parse HEAD)"
readonly GIT_SHA
log "Git SHA: ${GIT_SHA}"

# --- Install dependencies ----------------------------------------------------
log "Installing dependencies (npm ci)..."
(cd "$RELEASE_DIR" && npm ci --production=false) \
  || die "npm ci failed"

# --- Build -------------------------------------------------------------------
log "Building (next build --webpack)..."
(cd "$RELEASE_DIR" && npx next build --webpack) \
  || die "next build failed"

# --- Symlink .env.local ------------------------------------------------------
log "Symlinking .env.local into release..."
ln -sf "$ENV_FILE" "${RELEASE_DIR}/.env.local"

# --- Write deploy manifest ---------------------------------------------------
NODE_VERSION="$(node --version)"
readonly NODE_VERSION
cat > "${RELEASE_DIR}/deploy-manifest.json" <<EOF
{
  "timestamp": "${TIMESTAMP}",
  "gitSha": "${GIT_SHA}",
  "gitRef": "${GIT_REF}",
  "nodeVersion": "${NODE_VERSION}",
  "buildStatus": "success"
}
EOF
log "Wrote deploy-manifest.json"

# --- Atomically repoint current symlink --------------------------------------
log "Repointing ${CURRENT_LINK} -> ${RELEASE_DIR}"
ln -sfn "$RELEASE_DIR" "${CURRENT_LINK}"

# --- Restart pm2 -------------------------------------------------------------
log "Restarting pm2 process..."
# Delete first to avoid cached symlink resolution in pm2
pm2 delete "$PM2_APP_NAME" 2>/dev/null || true
pm2 start "${CURRENT_LINK}/deploy/ecosystem.config.cjs"
pm2 save
log "pm2 restarted and saved"

# --- Clean up old releases ---------------------------------------------------
log "Cleaning up old releases (keeping ${KEEP_RELEASES} most recent)..."
# shellcheck disable=SC2012
RELEASE_COUNT=$(ls -1d "${RELEASES_DIR}"/*/ 2>/dev/null | wc -l)
if (( RELEASE_COUNT > KEEP_RELEASES )); then
  # shellcheck disable=SC2012
  ls -1dt "${RELEASES_DIR}"/*/ \
    | tail -n +"$(( KEEP_RELEASES + 1 ))" \
    | while IFS= read -r old_release; do
        log "Removing old release: ${old_release}"
        rm -rf "$old_release"
      done
fi

log "Deploy complete: ${GIT_SHA} (${GIT_REF}) -> ${RELEASE_DIR}"

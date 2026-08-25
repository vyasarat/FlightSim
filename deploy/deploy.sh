#!/usr/bin/env bash
# Deploy Little Pilot. Run ON the droplet: bash /root/flightsim/deploy/deploy.sh
#
#   bash deploy/deploy.sh             # fetch origin/main and publish it
#   bash deploy/deploy.sh --no-pull   # publish the checkout exactly as it is
#   bash deploy/deploy.sh --rollback  # check out the last published rev and publish it
#
# The whole script is a function so that the file being replaced on disk by
# `git reset` mid-run cannot change what bash executes.
set -euo pipefail

main() {
  cd "$(dirname "$0")/.."

  local WEB_ROOT=/var/www/flightsim
  local STATE_DIR=/var/lib/flightsim          # survives reboots, unlike /tmp
  local DEPLOYED_FILE="$STATE_DIR/deployed-rev"   # rev currently in WEB_ROOT
  local PREV_FILE="$STATE_DIR/previous-rev"       # rev published before that
  mkdir -p "$STATE_DIR"

  local MODE=pull
  case "${1:-}" in
    --no-pull)  MODE=nopull ;;
    --rollback) MODE=rollback ;;
    "")         ;;
    *) echo "usage: deploy.sh [--no-pull|--rollback]" >&2; exit 2 ;;
  esac

  if [[ -n "$(git status --porcelain)" ]]; then
    echo "✗ Working tree is dirty; refusing to deploy. (git status)" >&2
    exit 1
  fi

  local DEPLOYED="" NEW_REV
  [[ -f "$DEPLOYED_FILE" ]] && DEPLOYED=$(cat "$DEPLOYED_FILE")

  if [[ $MODE == rollback ]]; then
    if [[ ! -f "$PREV_FILE" ]]; then
      echo "✗ No previous rev recorded in $PREV_FILE; nothing to roll back to." >&2
      exit 1
    fi
    local TARGET; TARGET=$(cat "$PREV_FILE")
    echo "→ Rolling back to $TARGET"
    git checkout -q "$TARGET"
  elif [[ $MODE == pull ]]; then
    echo "→ Fetching origin/main"
    git fetch -q origin main
    git checkout -q main
    git reset -q --hard origin/main
  else
    echo "→ --no-pull: publishing checkout as-is"
  fi
  NEW_REV=$(git rev-parse HEAD)

  # Cache-bump guard, measured against what is actually PUBLISHED (not HEAD, so
  # re-running after a refusal cannot slip the same commit through).
  if [[ $MODE != rollback && -n "$DEPLOYED" && "$DEPLOYED" != "$NEW_REV" ]] && git cat-file -e "$DEPLOYED" 2>/dev/null; then
    if ! git diff --quiet "$DEPLOYED" "$NEW_REV" -- cockpit/index.html cockpit/js cockpit/three.min.js cockpit/manifest.json cockpit/icons \
       && ! git diff "$DEPLOYED" "$NEW_REV" -- cockpit/sw.js | grep -q '^[-+]const CACHE_NAME'; then
      echo "✗ cockpit/ changed since the published rev but cockpit/sw.js CACHE_NAME was not bumped; refusing to deploy." >&2
      echo "  (published: $DEPLOYED  candidate: $NEW_REV)" >&2
      exit 1
    fi
    if ! git diff --quiet "$DEPLOYED" "$NEW_REV" -- index.html manifest.json icons \
       && ! git diff "$DEPLOYED" "$NEW_REV" -- sw.js | grep -q '^[-+]const CACHE_NAME'; then
      echo "✗ root build changed since the published rev but sw.js CACHE_NAME was not bumped; refusing to deploy." >&2
      exit 1
    fi
  fi

  echo "→ Deploying $NEW_REV"
  # Allowlist: only what the browser needs. README, scripts, screenshots and
  # anything untracked never reach the public docroot; --delete-excluded also
  # removes files a previous deploy left behind.
  rsync -a --delete --delete-excluded \
    --include='/index.html' --include='/manifest.json' --include='/sw.js' \
    --include='/icons/' --include='/icons/**' \
    --include='/cockpit/' --include='/cockpit/**' \
    --exclude='*' \
    ./ "$WEB_ROOT"/

  if [[ -n "$DEPLOYED" && "$DEPLOYED" != "$NEW_REV" ]]; then
    echo "$DEPLOYED" > "$PREV_FILE"
  fi
  echo "$NEW_REV" > "$DEPLOYED_FILE"

  echo "✅ Deployed $NEW_REV at $(date)"
  [[ -f "$PREV_FILE" ]] && echo "   Rollback: bash deploy/deploy.sh --rollback  (-> $(cat "$PREV_FILE"))"
  return 0
}

main "$@"
exit $?

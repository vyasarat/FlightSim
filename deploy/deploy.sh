#!/usr/bin/env bash
# Deploy Little Pilot. Run ON the droplet: bash /root/flightsim/deploy/deploy.sh
#
#   bash deploy/deploy.sh            # fetch origin/main and publish it
#   bash deploy/deploy.sh --no-pull  # publish the checkout exactly as it is (rollback)
#
# Rollback:
#   git checkout $(cat /tmp/flightsim-previous-rev) && bash deploy/deploy.sh --no-pull
set -euo pipefail
cd "$(dirname "$0")/.."

WEB_ROOT=/var/www/flightsim
PREV_FILE=/tmp/flightsim-previous-rev
PULL=1
[[ "${1:-}" == "--no-pull" ]] && PULL=0

CURRENT_REV=$(git rev-parse HEAD)

if [[ $PULL -eq 1 ]]; then
  if [[ -n "$(git status --porcelain)" ]]; then
    echo "✗ Working tree is dirty; refusing to deploy. (git status)" >&2
    exit 1
  fi
  echo "→ Fetching origin/main"
  git fetch -q origin main
  git checkout -q main
  git reset -q --hard origin/main
  NEW_REV=$(git rev-parse HEAD)
  if [[ "$NEW_REV" != "$CURRENT_REV" ]]; then
    # Only remember a previous rev when HEAD actually moved, so a re-run or a
    # rollback never overwrites the pointer we would want to return to.
    echo "$CURRENT_REV" > "$PREV_FILE"
    # Game code changed without a service-worker cache bump = iPad keeps old code.
    if ! git diff --quiet "$CURRENT_REV" "$NEW_REV" -- cockpit/index.html cockpit/three.min.js \
       && git diff --quiet "$CURRENT_REV" "$NEW_REV" -- cockpit/sw.js; then
      echo "✗ cockpit/ changed but cockpit/sw.js CACHE_NAME was not bumped; refusing to deploy." >&2
      echo "  (git checkout $CURRENT_REV to return the checkout, bump CACHE_NAME, push, retry)" >&2
      exit 1
    fi
    if ! git diff --quiet "$CURRENT_REV" "$NEW_REV" -- index.html \
       && git diff --quiet "$CURRENT_REV" "$NEW_REV" -- sw.js; then
      echo "✗ index.html changed but sw.js CACHE_NAME was not bumped; refusing to deploy." >&2
      exit 1
    fi
  fi
else
  NEW_REV=$CURRENT_REV
  echo "→ --no-pull: publishing checkout as-is"
fi

echo "→ Deploying $NEW_REV"
# Allowlist: only what the browser needs. README, scripts, screenshots and
# anything untracked never reach the public docroot.
rsync -a --delete \
  --include='/index.html' --include='/manifest.json' --include='/sw.js' \
  --include='/icons/' --include='/icons/**' \
  --include='/cockpit/' --include='/cockpit/**' \
  --exclude='*' \
  ./ "$WEB_ROOT"/

echo "✅ Deployed $NEW_REV at $(date)"
if [[ -f "$PREV_FILE" ]]; then
  echo "   Rollback: git checkout \$(cat $PREV_FILE) && bash deploy/deploy.sh --no-pull"
fi

#!/usr/bin/env bash
# Deploy Little Pilot. Run ON the droplet: bash /root/flightsim/deploy/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."

PREVIOUS_REV=$(git rev-parse HEAD)
echo "$PREVIOUS_REV" > /tmp/flightsim-previous-rev

echo "→ Pulling latest"
git pull origin main
NEW_REV=$(git rev-parse HEAD)
echo "→ Deploying $PREVIOUS_REV → $NEW_REV"

rsync -a --delete --exclude '.git' --exclude 'deploy' ./ /var/www/flightsim/

echo "✅ Deployed $NEW_REV at $(date)"
echo "   Rollback: git checkout \$(cat /tmp/flightsim-previous-rev) && bash deploy/deploy.sh"

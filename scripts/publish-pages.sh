#!/usr/bin/env bash
# scripts/publish-pages.sh — build the static site and publish it to the gh-pages branch
# (GitHub Pages: https://justinyang13.github.io/sdca/). Usage: scripts/publish-pages.sh
set -euo pipefail
cd "$(dirname "$0")/.."
REMOTE=$(git remote get-url origin)
node --max-old-space-size=2500 scripts/build-static.js --base=/sdca
node scripts/check-static.js
cd dist
rm -rf .git
git init -q -b gh-pages
git add -A
git -c user.name="sdca-bot" -c user.email="noreply@users.noreply.github.com" commit -q -m "Static snapshot $(date -u +%Y-%m-%dT%H:%MZ)"
git push -q -f "$REMOTE" gh-pages:gh-pages
echo "published → https://justinyang13.github.io/sdca/"

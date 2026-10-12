#!/usr/bin/env bash
# Run from the ROOT of your repo (the folder that contains index.html and .github)
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
[ -d .github ] && [ -f sw.js ] || { echo "Run this from the repo root (where .github and sw.js are)."; exit 1; }
echo "1) removing stray files that were flattened into the root..."
while read -r f; do [ -n "$f" ] && [ -f "$f" ] && rm -f "$f"; done < "$HERE/delete.txt"
echo "2) restoring correct files..."
cp -r "$HERE/files/." .
chmod +x tools/sync-dist.sh 2>/dev/null || true
echo "3) checking the app..."
node tools/verify.js
echo "DONE. Now run:  git add -A && git commit -m 'Repair + RankForge fix-pack v1' && git push"

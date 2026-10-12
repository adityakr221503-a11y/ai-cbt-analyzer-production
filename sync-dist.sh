#!/usr/bin/env bash
# wrangler.jsonc serves ./.cloudflare-dist, which had drifted from the root files
# (so fixes in the root never reached Cloudflare). Run this before `wrangler deploy`.
set -euo pipefail
cd "$(dirname "$0")/.."
rsync -a --delete ./ .cloudflare-dist/ \
  --exclude='.git*' --exclude='.github' --exclude='.cloudflare-dist' --exclude='node_modules' \
  --exclude='tools' --exclude='server' --exclude='android' --exclude='rankforge-ai-worker' \
  --exclude='rankforge-local-ai' --exclude='rankforge-lecture-security/server' \
  --exclude='*.md' --exclude='*.sh' --exclude='*.py' --exclude='*.txt' \
  --exclude='package*.json' --exclude='wrangler.jsonc' --exclude='capacitor.config.json'
echo "synced root -> .cloudflare-dist"

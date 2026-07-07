#!/bin/bash
# Deploy script for construction-cost
# Usage: bash scripts/deploy.sh "commit message"

set -e

MSG="${1:-update: auto-deploy}"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

cd "$PROJECT_DIR"

git add index.html serve.js package.json .gitignore scripts/ docs/ tests/ playwright.config.js
git commit -m "$MSG" || { echo "Nothing to commit"; exit 0; }
git push origin master
echo "Deployed successfully"

#!/bin/bash
set -euo pipefail

# Only run in remote (Claude Code on the web) environments
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

echo '{"async": true, "asyncTimeout": 300000}'

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$(dirname "$(dirname "$0")")")}"

# Install dependencies (legacy-peer-deps needed due to msal-react/react version mismatch)
npm install --legacy-peer-deps

# Start dev server in background on port 5173 so it's available for preview
pkill -f "vite" 2>/dev/null || true
nohup npx vite --host 0.0.0.0 --port 5173 > /tmp/vite-dev.log 2>&1 &
echo "Dev server starting on port 5173..."

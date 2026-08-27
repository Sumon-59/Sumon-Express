#!/usr/bin/env bash
# Codified boot check (spec: "verify the artifact Render will actually run").
# Builds, boots the compiled entry, asserts /healthz answers, cleans up.
set -e
npm run build
node dist/server.js &
PID=$!
trap "kill $PID 2>/dev/null || true" EXIT
sleep 3
STATUS=$(curl -s -m 5 "http://localhost:${PORT:-5000}/healthz")
echo "healthz: $STATUS"
if [ "$STATUS" = '{"status":"ok"}' ]; then
  echo "SMOKE PASS"
else
  echo "SMOKE FAIL"
  exit 1
fi

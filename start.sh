#!/usr/bin/env bash
set -e

echo "Starting CommentPulse Threat Engine on port 8000..."
cd threat-engine
python -m uvicorn main:app --host 0.0.0.0 --port 8000 &
THREAT_PID=$!
cd ..

echo "Starting CommentPulse Orchestrator on port $PORT..."
cd orchestrator
export THREAT_ENGINE_URL="http://127.0.0.1:8000"
export PORT=${PORT:-10000}
node src/index.js &
NODE_PID=$!

wait $THREAT_PID $NODE_PID

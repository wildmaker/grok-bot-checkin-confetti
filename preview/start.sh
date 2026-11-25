#!/bin/sh
# Starts the synthetic preview on http://127.0.0.1:8765/ (override: ./start.sh 8766).
cd "$(dirname "$0")" || exit 1
command -v python3 >/dev/null 2>&1 || { echo "python3 not found"; exit 1; }
exec python3 serve.py "${1:-8765}"

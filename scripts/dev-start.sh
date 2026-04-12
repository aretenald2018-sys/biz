#!/usr/bin/env bash
# scripts/dev-start.sh — Kill stale dev servers, start fresh, health-check.
# Git Bash on Windows. Codex calls this after code changes.
# Safe: only kills this project's own processes (node/tsx), never other projects.

set -euo pipefail
cd "$(dirname "$0")/.."

VITE_PORT=5173
API_PORT=3001

# --- Get PID listening on a port ---
get_listening_pid() {
  local port=$1
  netstat -ano 2>/dev/null | grep ":${port} " | grep LISTENING | awk '{print $5}' | sort -u | head -1 || true
}

# --- Check if a PID is a node/tsx process (our project) ---
is_node_process() {
  local pid=$1
  tasklist //FI "PID eq $pid" 2>/dev/null | grep -iqE "node|tsx" && return 0
  return 1
}

# --- Kill only our own processes on a port ---
safe_kill_port() {
  local port=$1
  local pids
  pids=$(netstat -ano 2>/dev/null | grep ":${port} " | grep LISTENING | awk '{print $5}' | sort -u || true)
  for pid in $pids; do
    if [ "$pid" != "0" ] && [ -n "$pid" ]; then
      if is_node_process "$pid"; then
        echo "[dev-start] Killing old node process (PID $pid) on port $port..."
        taskkill //F //PID "$pid" 2>/dev/null || true
      else
        echo "[dev-start] Port $port occupied by non-node process (PID $pid) — skipping (another project?)"
      fi
    fi
  done
}

# --- Check if a port is available ---
is_port_free() {
  local port=$1
  local pid
  pid=$(get_listening_pid $port)
  [ -z "$pid" ]
}

# --- Find available port starting from base ---
find_free_port() {
  local base=$1
  local max=$((base + 10))
  local port=$base
  while [ $port -le $max ]; do
    if is_port_free $port; then
      echo $port
      return 0
    fi
    port=$((port + 1))
  done
  echo "[dev-start] ERROR: No free port in range $base-$max" >&2
  return 1
}

echo "[dev-start] Checking ports $VITE_PORT and $API_PORT..."
safe_kill_port $VITE_PORT
safe_kill_port $API_PORT
sleep 1

# --- Resolve actual ports (fallback if still occupied) ---
if is_port_free $VITE_PORT; then
  ACTUAL_VITE_PORT=$VITE_PORT
else
  ACTUAL_VITE_PORT=$(find_free_port $((VITE_PORT + 1)))
  echo "[dev-start] Vite port $VITE_PORT still occupied, using $ACTUAL_VITE_PORT"
fi

if is_port_free $API_PORT; then
  ACTUAL_API_PORT=$API_PORT
else
  ACTUAL_API_PORT=$(find_free_port $((API_PORT + 1)))
  echo "[dev-start] API port $API_PORT still occupied, using $ACTUAL_API_PORT"
fi

# --- Start dev server in background ---
echo "[dev-start] Starting npm run dev..."
VITE_PORT_OVERRIDE=$ACTUAL_VITE_PORT PORT=$ACTUAL_API_PORT npm run dev &
DEV_PID=$!

# --- Wait for both servers to be ready ---
wait_for_port() {
  local port=$1
  local name=$2
  local attempts=0
  local max=30
  while ! curl -s -o /dev/null -w '' "http://localhost:${port}" 2>/dev/null; do
    attempts=$((attempts + 1))
    if [ $attempts -ge $max ]; then
      echo "[dev-start] ERROR: ${name} on port ${port} did not start within ${max}s"
      exit 1
    fi
    sleep 1
  done
  echo "[dev-start] ${name} is ready on port ${port}."
}

wait_for_port $ACTUAL_API_PORT "Hono API server"
wait_for_port $ACTUAL_VITE_PORT "Vite dev server"

echo ""
echo "=== Dev servers running ==="
echo "Frontend: http://localhost:${ACTUAL_VITE_PORT}"
echo "API:      http://localhost:${ACTUAL_API_PORT}"
echo "Open http://localhost:${ACTUAL_VITE_PORT} in your browser (Ctrl+Shift+R to hard refresh)."
echo "Background PID: $DEV_PID"

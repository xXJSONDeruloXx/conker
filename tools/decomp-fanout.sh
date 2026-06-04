#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
# Conker Decomp Fanout — Multi-Lane Parallel Decompilation
# ═══════════════════════════════════════════════════════════════════════
#
# Starts N parallel Pi sessions, each in its own git worktree,
# coordinated by a central server for non-overlapping work assignment.
#
# Usage: tools/decomp-fanout.sh [--lanes N] [--port PORT]
#
# Requires: bun, pi, git, docker
# ═══════════════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKTREE_DIR="$PROJECT_ROOT/.worktrees"
COORDINATOR_PORT="${DECOMP_COORDINATOR_PORT:-7700}"
NUM_LANES=4
MERGE_INTERVAL=300  # 5 minutes

# Parse args
while [[ $# -gt 0 ]]; do
  case $1 in
    --lanes) NUM_LANES="$2"; shift 2 ;;
    --port) COORDINATOR_PORT="$2"; shift 2 ;;
    --help) echo "Usage: $0 [--lanes N] [--port PORT]"; exit 0 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

COORDINATOR_URL="http://127.0.0.1:${COORDINATOR_PORT}"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Conker Decomp Fanout — ${NUM_LANES} lanes on port ${COORDINATOR_PORT}            ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# ─── Step 1: Start Coordinator ────────────────────────────────────────
echo "[1/4] Starting coordinator..."
cd "$PROJECT_ROOT"
bun .pi/coordinator/src/index.ts --port "$COORDINATOR_PORT" --max-lanes "$NUM_LANES" &
COORDINATOR_PID=$!
sleep 2

# Verify coordinator is running
if ! curl -s "${COORDINATOR_URL}/status" > /dev/null 2>&1; then
  echo "ERROR: Coordinator failed to start"
  kill $COORDINATOR_PID 2>/dev/null || true
  exit 1
fi
echo "  ✓ Coordinator running (PID $COORDINATOR_PID)"

# ─── Step 2: Create Worktrees ─────────────────────────────────────────
echo ""
echo "[2/4] Setting up worktrees..."
mkdir -p "$WORKTREE_DIR"

for i in $(seq 1 "$NUM_LANES"); do
  LANE_ID="lane-$i"
  LANE_DIR="$WORKTREE_DIR/$LANE_ID"
  LANE_BRANCH="decomp-$LANE_ID"

  if [ -d "$LANE_DIR" ]; then
    echo "  ✓ $LANE_ID already exists"
  else
    # Create worktree on a new branch from current HEAD
    git worktree add -b "$LANE_BRANCH" "$LANE_DIR" HEAD 2>/dev/null || \
      git worktree add "$LANE_DIR" "$LANE_BRANCH" 2>/dev/null || \
      { echo "  ✗ Failed to create worktree for $LANE_ID"; continue; }
    echo "  ✓ Created $LANE_ID"
  fi

  # Symlink baserom (save ~32MB per lane)
  if [ ! -f "$LANE_DIR/baserom.us.z64" ]; then
    ln -sf "$PROJECT_ROOT/baserom.us.z64" "$LANE_DIR/baserom.us.z64"
  fi

  # Symlink ido directory
  if [ ! -d "$LANE_DIR/ido" ]; then
    ln -sf "$PROJECT_ROOT/ido" "$LANE_DIR/ido"
  fi

  # Symlink tools/ido-native
  if [ ! -d "$LANE_DIR/tools/ido-native" ]; then
    mkdir -p "$LANE_DIR/tools"
    ln -sf "$PROJECT_ROOT/tools/ido-native" "$LANE_DIR/tools/ido-native"
  fi

  # Symlink tools/transmuter
  if [ ! -d "$LANE_DIR/tools/transmuter" ]; then
    ln -sf "$PROJECT_ROOT/tools/transmuter" "$LANE_DIR/tools/transmuter"
  fi

  # Copy .pi directory (extension + config — each lane needs its own)
  if [ ! -d "$LANE_DIR/.pi" ]; then
    cp -r "$PROJECT_ROOT/.pi" "$LANE_DIR/.pi"
  fi

  # Register lane with coordinator
  curl -s -X POST "${COORDINATOR_URL}/lanes/register" \
    -H "Content-Type: application/json" \
    -d "{\"laneId\": \"$LANE_ID\"}" > /dev/null 2>&1 || true
done

# ─── Step 3: Launch Pi Sessions ───────────────────────────────────────
echo ""
echo "[3/4] Launching Pi sessions..."

LANE_PIDS=()
for i in $(seq 1 "$NUM_LANES"); do
  LANE_ID="lane-$i"
  LANE_DIR="$WORKTREE_DIR/$LANE_ID"

  if [ ! -d "$LANE_DIR" ]; then
    echo "  ✗ $LANE_ID: worktree missing, skipping"
    continue
  fi

  # Launch Pi in the background with coordinator URL set
  (
    cd "$LANE_DIR"
    export DECOMP_COORDINATOR_URL="$COORDINATOR_URL"
    export DECOMP_LANE_ID="$LANE_ID"
    # Start Pi with the decomp-start command
    pi --no-tui --session-name "decomp-$LANE_ID" -m "Run /decomp-start to begin the decompilation loop." 2>/dev/null
  ) &
  LANE_PIDS+=($!)
  echo "  ✓ $LANE_ID launched (PID ${LANE_PIDS[-1]})"
  sleep 1
done

# ─── Step 4: Merge Daemon ─────────────────────────────────────────────
echo ""
echo "[4/4] Starting merge daemon (every ${MERGE_INTERVAL}s)..."

merge_lanes() {
  cd "$PROJECT_ROOT"
  for i in $(seq 1 "$NUM_LANES"); do
    LANE_BRANCH="decomp-lane-$i"
    # Check if branch has commits ahead of master
    AHEAD=$(git rev-list master.."$LANE_BRANCH" --count 2>/dev/null || echo 0)
    if [ "$AHEAD" -gt 0 ]; then
      echo "  [merge] $LANE_BRANCH: $AHEAD commits ahead, merging..."
      git merge "$LANE_BRANCH" --no-edit --strategy-option=theirs 2>/dev/null || \
        echo "  [merge] CONFLICT in $LANE_BRANCH — needs manual resolution"
    fi
  done
}

(
  while true; do
    sleep "$MERGE_INTERVAL"
    merge_lanes
  done
) &
MERGE_PID=$!

# ─── Cleanup on exit ──────────────────────────────────────────────────
cleanup() {
  echo ""
  echo "Shutting down..."
  kill $COORDINATOR_PID 2>/dev/null || true
  kill $MERGE_PID 2>/dev/null || true
  for pid in "${LANE_PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  echo "Done."
}
trap cleanup EXIT INT TERM

# ─── Status Loop ──────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Fanout running: ${NUM_LANES} lanes on ${COORDINATOR_URL}"
echo "  Coordinator PID: $COORDINATOR_PID"
echo "  Merge daemon PID: $MERGE_PID"
echo ""
echo "  Monitor: curl ${COORDINATOR_URL}/status"
echo "  Stop: Ctrl+C"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Wait for all children
wait

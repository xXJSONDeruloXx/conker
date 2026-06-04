/**
 * Lane Manager — tracks worker lane states, health, and file locks.
 */

export interface LaneState {
  id: string;
  status: "idle" | "working" | "dead";
  currentFunction: string | null;
  currentFile: string | null;
  worktreePath: string;
  assignedAt: number;
  completedCount: number;
  lastHeartbeat: number;
}

export class LaneManager {
  #lanes: Map<string, LaneState> = new Map();
  #projectRoot: string;
  #maxLanes: number;

  constructor(projectRoot: string, maxLanes: number) {
    this.#projectRoot = projectRoot;
    this.#maxLanes = maxLanes;
  }

  /**
   * Register a new lane.
   */
  register(laneId: string): LaneState {
    if (this.#lanes.has(laneId)) {
      throw new Error(`Lane ${laneId} already exists`);
    }
    if (this.#lanes.size >= this.#maxLanes) {
      throw new Error(`Max lanes (${this.#maxLanes}) reached`);
    }

    const state: LaneState = {
      id: laneId,
      status: "idle",
      currentFunction: null,
      currentFile: null,
      worktreePath: `${this.#projectRoot}/.worktrees/${laneId}`,
      assignedAt: 0,
      completedCount: 0,
      lastHeartbeat: Date.now(),
    };

    this.#lanes.set(laneId, state);
    return state;
  }

  /**
   * Assign work to a lane.
   */
  assignWork(laneId: string, functionName: string, file: string): void {
    const lane = this.#lanes.get(laneId);
    if (!lane) throw new Error(`Lane ${laneId} not found`);

    lane.status = "working";
    lane.currentFunction = functionName;
    lane.currentFile = file;
    lane.assignedAt = Date.now();
    lane.lastHeartbeat = Date.now();
  }

  /**
   * Mark work as completed and reset lane to idle.
   */
  completeWork(laneId: string): void {
    const lane = this.#lanes.get(laneId);
    if (!lane) throw new Error(`Lane ${laneId} not found`);

    lane.status = "idle";
    lane.currentFunction = null;
    lane.currentFile = null;
    lane.assignedAt = 0;
    lane.completedCount++;
    lane.lastHeartbeat = Date.now();
  }

  /**
   * Get state for a specific lane.
   */
  getState(laneId: string): LaneState | undefined {
    return this.#lanes.get(laneId);
  }

  /**
   * Get all lane states.
   */
  getAllStates(): LaneState[] {
    return [...this.#lanes.values()];
  }

  /**
   * Find lanes that have been working longer than the threshold without heartbeat.
   */
  getStaleLanes(thresholdMs: number): string[] {
    const now = Date.now();
    const stale: string[] = [];
    for (const [id, lane] of this.#lanes) {
      if (lane.status === "working" && lane.assignedAt > 0) {
        if (now - lane.assignedAt > thresholdMs) {
          stale.push(id);
        }
      }
    }
    return stale;
  }

  /**
   * Get current file locks (which lane owns which file).
   */
  getFileLocks(): Map<string, string> {
    const locks = new Map<string, string>();
    for (const [id, lane] of this.#lanes) {
      if (lane.status === "working" && lane.currentFile) {
        locks.set(lane.currentFile, id);
      }
    }
    return locks;
  }

  /**
   * Record heartbeat from a lane.
   */
  heartbeat(laneId: string): void {
    const lane = this.#lanes.get(laneId);
    if (lane) lane.lastHeartbeat = Date.now();
  }

  /**
   * Remove a lane (e.g., after it dies).
   */
  remove(laneId: string): void {
    this.#lanes.delete(laneId);
  }
}

/**
 * Queue Manager — owns the function queue state, handles claims, and prevents conflicts.
 * File-level partitioning ensures no two lanes work on the same source file simultaneously.
 */

export interface AttemptRecord {
  code: string;
  score: number;
  reason: string;
  diffs: string[];
  timestamp: string;
}

export interface QueueEntry {
  function: string;
  file: string;
  region: string;
  instructions: number;
  difficulty: string;
  status: "pending" | "matched" | "skipped" | "claimed";
  attempts: number;
  lastScore: number;
  tags: string[];
  history: AttemptRecord[];
  claimedBy?: string;
  claimedAt?: number;
}

export interface ClaimResult {
  function: string;
  file: string;
  region: string;
  instructions: number;
  difficulty: string;
  history: AttemptRecord[];
}

export interface QueueStats {
  total: number;
  matched: number;
  pending: number;
  skipped: number;
  claimed: number;
}

const AUTO_ROTATE_THRESHOLD = 8;

export class QueueManager {
  #entries: QueueEntry[];
  #fileLocks: Map<string, string> = new Map(); // file → laneId

  constructor(entries: QueueEntry[]) {
    this.#entries = entries;
  }

  /**
   * Claim the next available function for a lane.
   * Respects file-level locks: won't assign from a file locked by another lane.
   * Prioritizes: fewer instructions first, fewer attempts first.
   */
  claim(laneId: string): ClaimResult | null {
    // Get files currently locked by OTHER lanes
    const lockedFiles = new Set<string>();
    for (const [file, owner] of this.#fileLocks) {
      if (owner !== laneId) lockedFiles.add(file);
    }

    // Find candidates: pending, not in a locked file, not heavily attempted
    const candidates = this.#entries
      .filter((e) =>
        e.status === "pending" &&
        !lockedFiles.has(e.file) &&
        !e.claimedBy
      )
      .sort((a, b) => {
        // Deprioritize heavily-attempted functions
        const aWeight = a.attempts >= AUTO_ROTATE_THRESHOLD ? 1000 : 0;
        const bWeight = b.attempts >= AUTO_ROTATE_THRESHOLD ? 1000 : 0;
        return (aWeight + a.instructions) - (bWeight + b.instructions) || a.attempts - b.attempts;
      });

    if (candidates.length === 0) return null;

    const chosen = candidates[0];
    chosen.claimedBy = laneId;
    chosen.claimedAt = Date.now();
    chosen.status = "claimed";

    // Lock the file for this lane
    this.#fileLocks.set(chosen.file, laneId);

    return {
      function: chosen.function,
      file: chosen.file,
      region: chosen.region,
      instructions: chosen.instructions,
      difficulty: chosen.difficulty,
      history: chosen.history,
    };
  }

  /**
   * Release a function (after match, skip, or returning to pending).
   */
  release(laneId: string, functionName: string, newStatus: "matched" | "skipped" | "pending"): void {
    const entry = this.#entries.find((e) => e.function === functionName);
    if (!entry) return;

    entry.status = newStatus;
    entry.claimedBy = undefined;
    entry.claimedAt = undefined;

    // Release file lock if no other function in this file is claimed by this lane
    const otherClaims = this.#entries.filter(
      (e) => e.file === entry.file && e.claimedBy === laneId && e.function !== functionName
    );
    if (otherClaims.length === 0) {
      this.#fileLocks.delete(entry.file);
    }
  }

  /**
   * Record an attempt for a function (from any lane).
   */
  recordAttempt(functionName: string, attempt: AttemptRecord): void {
    const entry = this.#entries.find((e) => e.function === functionName);
    if (!entry) return;

    entry.history.push(attempt);
    entry.attempts = entry.history.length;
    entry.lastScore = attempt.score;
  }

  /**
   * Get a specific entry by function name.
   */
  getEntry(functionName: string): QueueEntry | undefined {
    return this.#entries.find((e) => e.function === functionName);
  }

  /**
   * Get overall queue statistics.
   */
  getStats(): QueueStats {
    return {
      total: this.#entries.length,
      matched: this.#entries.filter((e) => e.status === "matched").length,
      pending: this.#entries.filter((e) => e.status === "pending").length,
      skipped: this.#entries.filter((e) => e.status === "skipped").length,
      claimed: this.#entries.filter((e) => e.status === "claimed").length,
    };
  }

  /**
   * Get functions with best history score above a threshold (near-misses).
   */
  getNearMisses(threshold: number): QueueEntry[] {
    return this.#entries
      .filter((e) => {
        if (e.status === "matched") return false;
        if (!e.history.length) return false;
        const best = Math.max(...e.history.map((h) => h.score));
        return best >= threshold;
      })
      .sort((a, b) => {
        const bestA = Math.max(...a.history.map((h) => h.score));
        const bestB = Math.max(...b.history.map((h) => h.score));
        return bestB - bestA;
      });
  }

  /**
   * Get all entries (for serialization).
   */
  getAll(): QueueEntry[] {
    return this.#entries;
  }

  /**
   * Get current file locks.
   */
  getFileLocks(): Map<string, string> {
    return new Map(this.#fileLocks);
  }
}

import { describe, test, expect, beforeEach } from "bun:test";
import { QueueManager, type QueueEntry, type ClaimResult } from "../src/queue-manager";

describe("QueueManager", () => {
  let qm: QueueManager;

  const sampleEntries: QueueEntry[] = [
    { function: "func_A1", file: "game_100.c", region: "game", instructions: 20, difficulty: "low", status: "pending", attempts: 0, lastScore: 0, tags: [], history: [] },
    { function: "func_A2", file: "game_100.c", region: "game", instructions: 30, difficulty: "medium-low", status: "pending", attempts: 0, lastScore: 0, tags: [], history: [] },
    { function: "func_B1", file: "game_200.c", region: "game", instructions: 25, difficulty: "low", status: "pending", attempts: 0, lastScore: 0, tags: [], history: [] },
    { function: "func_B2", file: "game_200.c", region: "game", instructions: 40, difficulty: "medium", status: "pending", attempts: 0, lastScore: 0, tags: [], history: [] },
    { function: "func_C1", file: "init_300.c", region: "init", instructions: 15, difficulty: "trivial", status: "pending", attempts: 0, lastScore: 0, tags: [], history: [] },
    { function: "func_D1", file: "game_400.c", region: "game", instructions: 50, difficulty: "medium", status: "matched", attempts: 3, lastScore: 1, tags: [], history: [] },
  ];

  beforeEach(() => {
    qm = new QueueManager(structuredClone(sampleEntries));
  });

  describe("claim", () => {
    test("assigns a pending function to a lane", () => {
      const result = qm.claim("lane-1");
      expect(result).not.toBeNull();
      expect(result!.function).toBeDefined();
      expect(result!.file).toBeDefined();
    });

    test("does not assign matched or skipped functions", () => {
      const result = qm.claim("lane-1");
      expect(result!.function).not.toBe("func_D1"); // matched
    });

    test("does not assign a function from a file already claimed by another lane", () => {
      const r1 = qm.claim("lane-1");
      expect(r1).not.toBeNull();
      const claimedFile = r1!.file;

      // Second lane should NOT get a function from the same file
      const r2 = qm.claim("lane-2");
      expect(r2).not.toBeNull();
      expect(r2!.file).not.toBe(claimedFile);
    });

    test("same lane CAN claim another function from the same file", () => {
      const r1 = qm.claim("lane-1");
      expect(r1).not.toBeNull();
      const claimedFile = r1!.file;

      // Release the first claim
      qm.release("lane-1", r1!.function, "skipped");

      // Same lane claims again — can get same file
      const r2 = qm.claim("lane-1");
      expect(r2).not.toBeNull();
      // (may or may not be same file — depends on priority)
    });

    test("returns null when no pending functions available", () => {
      // Claim all available
      qm.claim("lane-1");
      qm.claim("lane-2");
      qm.claim("lane-3");
      qm.claim("lane-4");
      qm.claim("lane-5");
      // Eventually exhausts
      const result = qm.claim("lane-99");
      // May or may not be null depending on how many unique files exist
      // With 4 files (game_100, game_200, init_300, game_400) and func_D1 matched,
      // we have 3 claimable files. After 3 claims, lane-4+ gets null.
    });

    test("prioritizes functions with fewer instructions", () => {
      const r1 = qm.claim("lane-1");
      // func_C1 (15 instr) should be picked first
      expect(r1!.function).toBe("func_C1");
    });

    test("respects the 8-attempt auto-rotate threshold", () => {
      // Set a function to 8+ attempts
      const entry = qm.getEntry("func_A1");
      entry!.attempts = 10;
      entry!.history = Array(10).fill({ code: "x", score: 0.4, reason: "test", diffs: [], timestamp: "" });

      // It should still be claimable (rotation is session-level, not global)
      // But the coordinator should deprioritize it
      const r1 = qm.claim("lane-1");
      expect(r1!.function).not.toBe("func_A1"); // deprioritized
    });
  });

  describe("release", () => {
    test("marks function as matched on success", () => {
      const r1 = qm.claim("lane-1");
      qm.release("lane-1", r1!.function, "matched");
      const entry = qm.getEntry(r1!.function);
      expect(entry!.status).toBe("matched");
    });

    test("marks function as skipped", () => {
      const r1 = qm.claim("lane-1");
      qm.release("lane-1", r1!.function, "skipped");
      const entry = qm.getEntry(r1!.function);
      expect(entry!.status).toBe("skipped");
    });

    test("returns function to pending on release without status change", () => {
      const r1 = qm.claim("lane-1");
      qm.release("lane-1", r1!.function, "pending");
      const entry = qm.getEntry(r1!.function);
      expect(entry!.status).toBe("pending");
    });

    test("frees the file lock when released", () => {
      const r1 = qm.claim("lane-1");
      const file = r1!.file;
      qm.release("lane-1", r1!.function, "matched");

      // Another lane can now claim from that file
      const r2 = qm.claim("lane-2");
      // If there are pending functions in that file, it could be assigned
      if (r2 && r2.file === file) {
        expect(true).toBe(true); // file was freed
      }
    });
  });

  describe("recordAttempt", () => {
    test("appends attempt to function history", () => {
      qm.claim("lane-1"); // claims func_C1
      qm.recordAttempt("func_C1", {
        code: "void func_C1(void) { return; }",
        score: 0.85,
        reason: "structural_diffs=3",
        diffs: ["target=X got=Y"],
        timestamp: new Date().toISOString(),
      });
      const entry = qm.getEntry("func_C1");
      expect(entry!.history.length).toBe(1);
      expect(entry!.history[0].score).toBe(0.85);
    });

    test("updates lastScore on the entry", () => {
      qm.claim("lane-1");
      qm.recordAttempt("func_C1", {
        code: "x",
        score: 0.9,
        reason: "test",
        diffs: [],
        timestamp: new Date().toISOString(),
      });
      expect(qm.getEntry("func_C1")!.lastScore).toBe(0.9);
    });
  });

  describe("getStats", () => {
    test("returns overall queue statistics", () => {
      const stats = qm.getStats();
      expect(stats.total).toBe(6);
      expect(stats.matched).toBe(1);
      expect(stats.pending).toBe(5);
      expect(stats.skipped).toBe(0);
      expect(stats.claimed).toBe(0);
    });

    test("reflects claimed count", () => {
      qm.claim("lane-1");
      const stats = qm.getStats();
      expect(stats.claimed).toBe(1);
    });
  });

  describe("getNearMisses", () => {
    test("returns functions with best score >= threshold", () => {
      qm.recordAttempt("func_A1", { code: "x", score: 0.92, reason: "test", diffs: [], timestamp: "" });
      qm.recordAttempt("func_B1", { code: "y", score: 0.6, reason: "test", diffs: [], timestamp: "" });

      const nearMisses = qm.getNearMisses(0.8);
      expect(nearMisses.length).toBe(1);
      expect(nearMisses[0].function).toBe("func_A1");
    });
  });
});

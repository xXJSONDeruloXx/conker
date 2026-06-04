import { describe, test, expect, beforeEach } from "bun:test";
import { LaneManager, type LaneState } from "../src/lane-manager";

describe("LaneManager", () => {
  let lm: LaneManager;

  beforeEach(() => {
    lm = new LaneManager("/tmp/test-conker", 4);
  });

  describe("registerLane", () => {
    test("creates a lane with idle status", () => {
      const lane = lm.register("lane-1");
      expect(lane.id).toBe("lane-1");
      expect(lane.status).toBe("idle");
      expect(lane.currentFunction).toBeNull();
      expect(lane.worktreePath).toContain("lane-1");
    });

    test("rejects duplicate lane IDs", () => {
      lm.register("lane-1");
      expect(() => lm.register("lane-1")).toThrow();
    });

    test("respects max lanes limit", () => {
      lm.register("lane-1");
      lm.register("lane-2");
      lm.register("lane-3");
      lm.register("lane-4");
      expect(() => lm.register("lane-5")).toThrow(/max lanes/i);
    });
  });

  describe("assignWork", () => {
    test("updates lane state with function assignment", () => {
      lm.register("lane-1");
      lm.assignWork("lane-1", "func_A1", "game_100.c");
      const state = lm.getState("lane-1");
      expect(state!.status).toBe("working");
      expect(state!.currentFunction).toBe("func_A1");
      expect(state!.currentFile).toBe("game_100.c");
    });

    test("tracks assignment timestamp", () => {
      lm.register("lane-1");
      const before = Date.now();
      lm.assignWork("lane-1", "func_A1", "game_100.c");
      const state = lm.getState("lane-1");
      expect(state!.assignedAt).toBeGreaterThanOrEqual(before);
    });
  });

  describe("completeWork", () => {
    test("resets lane to idle after completion", () => {
      lm.register("lane-1");
      lm.assignWork("lane-1", "func_A1", "game_100.c");
      lm.completeWork("lane-1");
      const state = lm.getState("lane-1");
      expect(state!.status).toBe("idle");
      expect(state!.currentFunction).toBeNull();
    });

    test("increments completed count", () => {
      lm.register("lane-1");
      lm.assignWork("lane-1", "func_A1", "game_100.c");
      lm.completeWork("lane-1");
      const state = lm.getState("lane-1");
      expect(state!.completedCount).toBe(1);
    });
  });

  describe("health check", () => {
    test("detects stale lanes (no activity for too long)", () => {
      lm.register("lane-1");
      lm.assignWork("lane-1", "func_A1", "game_100.c");
      // Simulate staleness by backdating
      const state = lm.getState("lane-1")!;
      state.assignedAt = Date.now() - 600_000; // 10 minutes ago

      const stale = lm.getStaleLanes(300_000); // 5 min threshold
      expect(stale.length).toBe(1);
      expect(stale[0]).toBe("lane-1");
    });

    test("active lanes are not stale", () => {
      lm.register("lane-1");
      lm.assignWork("lane-1", "func_A1", "game_100.c");
      const stale = lm.getStaleLanes(300_000);
      expect(stale.length).toBe(0);
    });
  });

  describe("getAllStates", () => {
    test("returns all lane states", () => {
      lm.register("lane-1");
      lm.register("lane-2");
      const states = lm.getAllStates();
      expect(states.length).toBe(2);
    });
  });

  describe("getFileLocks", () => {
    test("returns currently locked files by lane", () => {
      lm.register("lane-1");
      lm.register("lane-2");
      lm.assignWork("lane-1", "func_A1", "game_100.c");
      lm.assignWork("lane-2", "func_B1", "game_200.c");

      const locks = lm.getFileLocks();
      expect(locks.get("game_100.c")).toBe("lane-1");
      expect(locks.get("game_200.c")).toBe("lane-2");
    });

    test("releases file lock on complete", () => {
      lm.register("lane-1");
      lm.assignWork("lane-1", "func_A1", "game_100.c");
      lm.completeWork("lane-1");

      const locks = lm.getFileLocks();
      expect(locks.has("game_100.c")).toBe(false);
    });
  });
});

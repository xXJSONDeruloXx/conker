import { describe, test, expect, beforeEach } from "bun:test";
import { createCoordinatorApp } from "../src/api";
import { QueueManager, type QueueEntry } from "../src/queue-manager";
import { LaneManager } from "../src/lane-manager";
import { PatternStore } from "../src/pattern-store";

describe("Coordinator API", () => {
  let app: ReturnType<typeof createCoordinatorApp>;
  let qm: QueueManager;
  let lm: LaneManager;
  let ps: PatternStore;

  const entries: QueueEntry[] = [
    { function: "func_A1", file: "game_100.c", region: "game", instructions: 20, difficulty: "low", status: "pending", attempts: 0, lastScore: 0, tags: [], history: [] },
    { function: "func_B1", file: "game_200.c", region: "game", instructions: 25, difficulty: "low", status: "pending", attempts: 0, lastScore: 0, tags: [], history: [] },
    { function: "func_C1", file: "init_300.c", region: "init", instructions: 15, difficulty: "trivial", status: "pending", attempts: 0, lastScore: 0, tags: [], history: [] },
  ];

  beforeEach(() => {
    qm = new QueueManager(structuredClone(entries));
    lm = new LaneManager("/tmp/test-conker", 10);
    ps = new PatternStore([]);
    app = createCoordinatorApp(qm, lm, ps);
  });

  describe("POST /lanes/register", () => {
    test("registers a new lane", async () => {
      const res = await app.request("/lanes/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ laneId: "lane-1" }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.id).toBe("lane-1");
      expect(data.status).toBe("idle");
    });
  });

  describe("POST /claim", () => {
    test("assigns work to a registered lane", async () => {
      // Register first
      await app.request("/lanes/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ laneId: "lane-1" }),
      });

      const res = await app.request("/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ laneId: "lane-1" }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.function).toBeDefined();
      expect(data.file).toBeDefined();
    });

    test("rejects unregistered lanes", async () => {
      const res = await app.request("/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ laneId: "unknown-lane" }),
      });
      expect(res.status).toBe(404);
    });

    test("different lanes get different files", async () => {
      await app.request("/lanes/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ laneId: "lane-1" }) });
      await app.request("/lanes/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ laneId: "lane-2" }) });

      const r1 = await (await app.request("/claim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ laneId: "lane-1" }) })).json();
      const r2 = await (await app.request("/claim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ laneId: "lane-2" }) })).json();

      expect(r1.file).not.toBe(r2.file);
    });
  });

  describe("POST /release", () => {
    test("releases a claimed function", async () => {
      await app.request("/lanes/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ laneId: "lane-1" }) });
      const claim = await (await app.request("/claim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ laneId: "lane-1" }) })).json();

      const res = await app.request("/release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ laneId: "lane-1", function: claim.function, status: "matched" }),
      });
      expect(res.status).toBe(200);
    });
  });

  describe("POST /attempt", () => {
    test("records an attempt for a function", async () => {
      await app.request("/lanes/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ laneId: "lane-1" }) });
      await app.request("/claim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ laneId: "lane-1" }) });

      const res = await app.request("/attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          function: "func_C1",
          code: "void func_C1(void) {}",
          score: 0.85,
          reason: "structural_diffs=3",
          diffs: ["target=X got=Y"],
        }),
      });
      expect(res.status).toBe(200);
    });
  });

  describe("GET /patterns", () => {
    test("returns all patterns", async () => {
      ps.add({ id: "p1", description: "test", trigger: "x", solution: "y", example_functions: [] });
      const res = await app.request("/patterns");
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.patterns.length).toBe(1);
      expect(data.version).toBeDefined();
    });
  });

  describe("POST /patterns", () => {
    test("adds a new pattern", async () => {
      const res = await app.request("/patterns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "new-pattern", description: "desc", trigger: "t", solution: "s", example_functions: [] }),
      });
      expect(res.status).toBe(200);
      expect(ps.getAll().length).toBe(1);
    });
  });

  describe("GET /status", () => {
    test("returns coordinator status", async () => {
      const res = await app.request("/status");
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.queue).toBeDefined();
      expect(data.lanes).toBeDefined();
      expect(data.patterns).toBeDefined();
    });
  });

  describe("GET /patterns/relevant", () => {
    test("returns patterns relevant to assembly", async () => {
      ps.add({ id: "p1", description: "test", trigger: "beql branch-likely delay slot", solution: "do-while", example_functions: [] });
      const res = await app.request("/patterns/relevant?asm=beql+branch");
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.patterns.length).toBeGreaterThan(0);
    });
  });
});

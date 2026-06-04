/**
 * Coordinator HTTP API — Hono-based server for multi-lane coordination.
 */
import { Hono } from "hono";
import { QueueManager } from "./queue-manager";
import { LaneManager } from "./lane-manager";
import { PatternStore } from "./pattern-store";

export function createCoordinatorApp(
  qm: QueueManager,
  lm: LaneManager,
  ps: PatternStore,
) {
  const app = new Hono();

  // ─── Lane Registration ─────────────────────────────────────────
  app.post("/lanes/register", async (c) => {
    const { laneId } = await c.req.json<{ laneId: string }>();
    try {
      const state = lm.register(laneId);
      return c.json(state);
    } catch (e: any) {
      return c.json({ error: e.message }, 409);
    }
  });

  app.get("/lanes", (c) => {
    return c.json({ lanes: lm.getAllStates() });
  });

  app.post("/lanes/:id/heartbeat", (c) => {
    const laneId = c.req.param("id");
    lm.heartbeat(laneId);
    return c.json({ ok: true });
  });

  // ─── Work Claiming ─────────────────────────────────────────────
  app.post("/claim", async (c) => {
    const { laneId } = await c.req.json<{ laneId: string }>();

    // Verify lane exists
    const laneState = lm.getState(laneId);
    if (!laneState) {
      return c.json({ error: `Lane ${laneId} not registered` }, 404);
    }

    // Claim from queue
    const claim = qm.claim(laneId);
    if (!claim) {
      return c.json({ error: "No functions available" }, 204);
    }

    // Update lane state
    lm.assignWork(laneId, claim.function, claim.file);

    // Include relevant patterns for this function's context
    const entry = qm.getEntry(claim.function);
    // We'd need the target ASM here for full relevance, but for now return the claim
    return c.json(claim);
  });

  // ─── Work Release ──────────────────────────────────────────────
  app.post("/release", async (c) => {
    const { laneId, function: funcName, status } = await c.req.json<{
      laneId: string;
      function: string;
      status: "matched" | "skipped" | "pending";
    }>();

    qm.release(laneId, funcName, status);
    lm.completeWork(laneId);
    return c.json({ ok: true });
  });

  // ─── Attempt Recording ─────────────────────────────────────────
  app.post("/attempt", async (c) => {
    const body = await c.req.json<{
      function: string;
      code: string;
      score: number;
      reason: string;
      diffs: string[];
    }>();

    qm.recordAttempt(body.function, {
      code: body.code,
      score: body.score,
      reason: body.reason,
      diffs: body.diffs,
      timestamp: new Date().toISOString(),
    });

    return c.json({ ok: true });
  });

  // ─── Patterns ──────────────────────────────────────────────────
  app.get("/patterns", (c) => {
    return c.json({
      patterns: ps.getAll(),
      version: ps.getVersion(),
    });
  });

  app.post("/patterns", async (c) => {
    const pattern = await c.req.json();
    try {
      ps.add(pattern);
      return c.json({ ok: true, version: ps.getVersion() });
    } catch (e: any) {
      return c.json({ error: e.message }, 409);
    }
  });

  app.get("/patterns/relevant", (c) => {
    const asm = c.req.query("asm") || "";
    const limit = parseInt(c.req.query("limit") || "5");
    const patterns = ps.getRelevantForAsm(asm, limit);
    return c.json({ patterns, version: ps.getVersion() });
  });

  // ─── Status ────────────────────────────────────────────────────
  app.get("/status", (c) => {
    return c.json({
      queue: qm.getStats(),
      lanes: lm.getAllStates(),
      patterns: { count: ps.getAll().length, version: ps.getVersion() },
    });
  });

  // ─── Near Misses ───────────────────────────────────────────────
  app.get("/near-misses", (c) => {
    const threshold = parseFloat(c.req.query("threshold") || "0.8");
    const entries = qm.getNearMisses(threshold);
    return c.json({
      entries: entries.map((e) => ({
        function: e.function,
        file: e.file,
        bestScore: Math.max(...e.history.map((h) => h.score)),
        attempts: e.history.length,
      })),
    });
  });

  return app;
}

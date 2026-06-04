/**
 * Conker Decomp Coordinator
 * 
 * Multi-lane coordination server for parallel decompilation.
 * Manages: queue state, lane assignments, pattern sharing, file locks.
 * 
 * Usage: bun .pi/coordinator/src/index.ts [--port 7700] [--max-lanes 10]
 */
import { serve } from "bun";
import fs from "fs";
import path from "path";
import { createCoordinatorApp } from "./api";
import { QueueManager } from "./queue-manager";
import { LaneManager } from "./lane-manager";
import { PatternStore } from "./pattern-store";

// Parse CLI args
const args = process.argv.slice(2);
const portIdx = args.indexOf("--port");
const port = portIdx >= 0 ? parseInt(args[portIdx + 1]) : 7700;
const maxIdx = args.indexOf("--max-lanes");
const maxLanes = maxIdx >= 0 ? parseInt(args[maxIdx + 1]) : 10;

// Resolve project root
const projectRoot = path.resolve(process.cwd());
const queuePath = path.join(projectRoot, ".pi/decomp/queue.json");
const patternsPath = path.join(projectRoot, ".pi/decomp/patterns.json");

// Load state
console.log(`[coordinator] Loading queue from ${queuePath}`);
const queueData = JSON.parse(fs.readFileSync(queuePath, "utf-8"));
const patternsData = fs.existsSync(patternsPath) ? JSON.parse(fs.readFileSync(patternsPath, "utf-8")) : [];

const qm = new QueueManager(queueData);
const lm = new LaneManager(projectRoot, maxLanes);
const ps = new PatternStore(patternsData);

const app = createCoordinatorApp(qm, lm, ps);

// Periodic save (every 30s)
const SAVE_INTERVAL = 30_000;
setInterval(() => {
  fs.writeFileSync(queuePath, JSON.stringify(qm.getAll(), null, 2));
  fs.writeFileSync(patternsPath, JSON.stringify(ps.getAll(), null, 2));
}, SAVE_INTERVAL);

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n[coordinator] Saving state and shutting down...");
  fs.writeFileSync(queuePath, JSON.stringify(qm.getAll(), null, 2));
  fs.writeFileSync(patternsPath, JSON.stringify(ps.getAll(), null, 2));
  process.exit(0);
});

// Start server
console.log(`[coordinator] Starting on port ${port} (max ${maxLanes} lanes)`);
console.log(`[coordinator] Queue: ${qm.getStats().pending} pending, ${qm.getStats().matched} matched`);
console.log(`[coordinator] Patterns: ${ps.getAll().length}`);

export default {
  port,
  fetch: app.fetch,
};

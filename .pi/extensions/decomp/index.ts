/**
 * Conker Matching Decompilation Harness
 *
 * Registers tools for automated function decompilation:
 * - decomp_queue: manage candidate queue
 * - decomp_attempt: patch, compile TU, diff, score
 * - decomp_diff: re-examine last diff with focused analysis
 * - decomp_accept: full ROM SHA gate + commit
 * - decomp_status: progress stats
 *
 * Plus a persistent widget showing decomp progress.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { StringEnum } from "@earendil-works/pi-ai";

interface AttemptRecord {
	code: string;
	score: number;
	reason: string;
	diffs: string[];
	timestamp: string;
}

interface QueueEntry {
	function: string;
	file: string;
	region: string;
	instructions: number;
	difficulty: string;
	tags: string[];
	attempts: number;
	lastScore: number;
	status: "pending" | "matched" | "skipped";
	history?: AttemptRecord[];
}

interface Pattern {
	id: string;
	description: string;
	trigger: string;
	solution: string;
	example_functions: string[];
}

interface DecompState {
	queue: QueueEntry[];
	patterns: Pattern[];
	matched: number;
	totalAsm: number;
}

const COMMIT_HISTORY_EVERY = 3; // commit queue.json every N failed attempts to preserve findings
const LOOP_POLL_MS = 5000; // fallback timer interval for loop advancement
const LOOP_STATE_FILE = ".pi/decomp/loop-state.json";
const AUTO_PROMOTE_THRESHOLD = 20; // auto-promote segments when pending drops below this
const AUTO_PROMOTE_BATCH = 5; // promote this many segments at a time

interface LoopState {
	enabled: boolean;
	chunk: number;
	status: "idle" | "running" | "advancing" | "compacting" | "stopped";
	lastChunkSummary: string;
	consecutiveNoProgress: number;
	updatedAt: string;
}

let state: DecompState = {
	queue: [],
	patterns: [],
	matched: 0,
	totalAsm: 0,
};

let loopState: LoopState = {
	enabled: false,
	chunk: 0,
	status: "idle",
	lastChunkSummary: "",
	consecutiveNoProgress: 0,
	updatedAt: new Date().toISOString(),
};

function loadState(cwd: string): void {
	const fs = require("node:fs");
	const path = require("node:path");

	const queuePath = path.join(cwd, ".pi/decomp/queue.json");
	const patternsPath = path.join(cwd, ".pi/decomp/patterns.json");
	const loopPath = path.join(cwd, LOOP_STATE_FILE);

	try {
		if (fs.existsSync(queuePath)) {
			state.queue = JSON.parse(fs.readFileSync(queuePath, "utf-8"));
		}
	} catch {}

	try {
		if (fs.existsSync(patternsPath)) {
			state.patterns = JSON.parse(fs.readFileSync(patternsPath, "utf-8"));
		}
	} catch {}

	try {
		if (fs.existsSync(loopPath)) {
			loopState = { ...loopState, ...JSON.parse(fs.readFileSync(loopPath, "utf-8")) };
		}
	} catch {}

	state.matched = state.queue.filter((e) => e.status === "matched").length;
	state.totalAsm = state.queue.length;
}

function saveLoopState(cwd: string): void {
	const fs = require("node:fs");
	const path = require("node:path");
	loopState.updatedAt = new Date().toISOString();
	fs.writeFileSync(path.join(cwd, LOOP_STATE_FILE), JSON.stringify(loopState, null, 2));
}

async function autoPromoteIfNeeded(pi: any, cwd: string): Promise<string | null> {
	const fs = require("node:fs");
	const path = require("node:path");
	const re = require;

	const pending = state.queue.filter((e) => e.status === "pending").length;
	if (pending >= AUTO_PROMOTE_THRESHOLD) return null;

	// Find promotable segments from yaml
	const yamlPath = path.join(cwd, "conker/conker.us.yaml");
	if (!fs.existsSync(yamlPath)) return null;
	let yaml = fs.readFileSync(yamlPath, "utf-8");

	const segmentRegex = /^(\s*-\s*\[0x([0-9A-Fa-f]+),\s*asm\])\s*$/gm;
	const segments: { offset: string; line: string; funcs: number }[] = [];
	let match;
	while ((match = segmentRegex.exec(yaml)) !== null) {
		const offset = match[2];
		const asmFile = path.join(cwd, `conker/asm/${offset}.s`);
		let funcCount = 0;
		if (fs.existsSync(asmFile)) {
			const content = fs.readFileSync(asmFile, "utf-8");
			funcCount = (content.match(/^glabel\s+/gm) || []).length;
		}
		if (funcCount > 0) {
			segments.push({ offset, line: match[1], funcs: funcCount });
		}
	}

	if (segments.length === 0) return null;

	// Sort by function count (smallest first for quick wins)
	segments.sort((a, b) => a.funcs - b.funcs);

	// Promote a batch
	const toPromote = segments.slice(0, AUTO_PROMOTE_BATCH);
	let totalPromoted = 0;
	const promoted: string[] = [];

	for (const seg of toPromote) {
		const offsetNum = parseInt(seg.offset, 16);
		const prefix = offsetNum < 0x10000 ? "init" : offsetNum >= 0x250000 ? "debugger" : "game";
		const newName = `${prefix}_${seg.offset}`;
		const oldLine = seg.line;
		const newLine = oldLine.replace(
			`[0x${seg.offset}, asm]`,
			`[0x${seg.offset}, c, ${newName}]`,
		);

		yaml = yaml.replace(oldLine, newLine);
		promoted.push(`0x${seg.offset} → ${newName} (${seg.funcs} funcs)`);
		totalPromoted += seg.funcs;
	}

	// Write updated yaml
	fs.writeFileSync(yamlPath, yaml);

	// Run extraction
	const extractResult = await pi.exec("docker", [
		"run", "--rm", "--platform", "linux/amd64",
		"-v", `${cwd}:/conker`, "-w", "/conker",
		"conker-build-min-amd64",
		"bash", "-lc", "cd conker && make extract 2>&1 | tail -5",
	], { timeout: 180000 });

	// Strip metadata
	await pi.exec("python3", ["tools/strip_splat_metadata.py"], { timeout: 30000 });

	// Verify build
	const buildResult = await pi.exec("docker", [
		"run", "--rm", "--platform", "linux/amd64",
		"-v", `${cwd}:/conker`, "-w", "/conker",
		"conker-build-min-amd64",
		"bash", "-lc", "make -C conker -j$(nproc) 2>&1 | tail -5",
	], { timeout: 180000 });

	if (!buildResult.stdout.includes("conker.us.bin: OK")) {
		// Revert yaml
		const origYaml = fs.readFileSync(yamlPath, "utf-8");
		// Can't easily revert splits, so just report failure
		return `Auto-promote failed: build broken. Manual intervention needed.`;
	}

	// Add new functions to queue
	for (const seg of toPromote) {
		const offsetNum = parseInt(seg.offset, 16);
		const prefix = offsetNum < 0x10000 ? "init" : offsetNum >= 0x250000 ? "debugger" : "game";
		const newName = `${prefix}_${seg.offset}`;
		const srcPath = path.join(cwd, `conker/src/${newName}.c`);
		if (fs.existsSync(srcPath)) {
			const src = fs.readFileSync(srcPath, "utf-8");
			const funcMatches = [...src.matchAll(/#pragma\s+GLOBAL_ASM\("asm\/nonmatchings\/[^/]+\/([^"]+)\.s"\)/g)];
			for (const fm of funcMatches) {
				const funcName = fm[1];
				if (!state.queue.find((e) => e.function === funcName)) {
					state.queue.push({
						function: funcName,
						file: `${newName}.c`,
						region: prefix,
						instructions: 0,
						difficulty: "unknown",
						tags: ["promoted"],
						attempts: 0,
						lastScore: 0,
						status: "pending",
					});
				}
			}
		}
	}
	saveQueue(cwd);

	// Commit promotion
	await pi.exec("git", ["add", "-A"]);
	await pi.exec("git", ["commit", "-m",
		`chore(decomp): auto-promote ${toPromote.length} segments (${totalPromoted} new functions)\n\n${promoted.join("\n")}`
	]);
	await pi.exec("git", ["push"]);

	return `Auto-promoted ${toPromote.length} segments (${totalPromoted} functions). Queue now: ${state.queue.filter(e => e.status === "pending").length} pending.`;
}

function buildChunkPrompt(chunkNum: number): string {
	const matched = state.queue.filter((e) => e.status === "matched").length;
	const pending = state.queue.filter((e) => e.status === "pending").length;
	const patterns = state.patterns.length;

	const strategyNudge = loopState.consecutiveNoProgress >= 3
		? [
			"",
			"## Strategy adjustment required",
			`The last ${loopState.consecutiveNoProgress} chunks made no progress.`,
			"Switch to a different difficulty tier, region, or function family.",
			"Try: decomp_queue next with a different filter (region, difficulty).",
			"",
		  ].join("\n")
		: "";

	return [
		`# Conker Decomp — Chunk ${chunkNum}`,
		`Progress: ${matched}/${state.queue.length} matched (${pending} pending, ${patterns} patterns)`,
		strategyNudge,
		"",
		"## Instructions",
		"",
		"1. Call `decomp_queue next` to get the next candidate (includes target asm, context, and any prior failed attempts)",
		"2. Study the target assembly carefully. Check prior attempts if shown — do NOT repeat them.",
		"3. Write C and call `decomp_attempt` to test it.",
		"4. If non-match: read the diff, call `decomp_diff` for focused analysis, then retry with a different approach.",
		"5. If match: call `decomp_accept` to verify full ROM SHA and commit.",
		"6. When done with this function (matched or decided to move on), call `decomp_chunk_done` with a summary.",
		"",
		"## Rules",
		"- ONE function per chunk. Match it or move on.",
		"- Always call `decomp_chunk_done` when finished — this triggers context reset for the next chunk.",
		"- Use the pattern library (/skill:n64-decomp) for IDO codegen rules.",
		"- If score ≥ 0.9, you're close — try declaration reordering, type changes, or expression reshaping.",
		"- If score < 0.3 after 3 attempts, skip this candidate and try the next one.",
		"- Read `decomp_diff` output before every retry.",
		"- Never provide code that includes multiple functions, struct definitions, or header content.",
		"- The full ROM SHA-1 match is the ONLY acceptance criterion.",
		"- If decomp_queue next says it auto-promoted segments, new candidates are already in the queue.",
	].join("\n");
}

function saveQueue(cwd: string): void {
	const fs = require("node:fs");
	const path = require("node:path");
	const queuePath = path.join(cwd, ".pi/decomp/queue.json");
	fs.writeFileSync(queuePath, JSON.stringify(state.queue, null, 2));
}

function savePatterns(cwd: string): void {
	const fs = require("node:fs");
	const path = require("node:path");
	const patternsPath = path.join(cwd, ".pi/decomp/patterns.json");
	fs.writeFileSync(patternsPath, JSON.stringify(state.patterns, null, 2));
}

export default function (pi: ExtensionAPI) {
	let latestCtx: any = undefined;

	function readProjectProgress(cwd: string): { cFuncs: number; asmFuncs: number; cBytes: number; asmBytes: number } {
		const fs = require("node:fs");
		const path = require("node:path");
		const csvPath = path.join(cwd, "conker/progress.csv");
		let cFuncs = 0, asmFuncs = 0, cBytes = 0, asmBytes = 0;
		try {
			if (!fs.existsSync(csvPath)) return { cFuncs, asmFuncs, cBytes, asmBytes };
			const lines = fs.readFileSync(csvPath, "utf-8").split("\n");
			for (const line of lines) {
				const parts = line.split(",");
				if (parts.length < 7) continue;
				const func = parts[3];
				if (!func || func === "function" || func.startsWith(".") || func.startsWith("D_")) continue;
				const lang = parts[6]?.trim();
				const length = parseInt(parts[5]);
				if (isNaN(length)) continue;
				if (lang === "c") { cFuncs++; cBytes += length; }
				else if (lang === "asm") { asmFuncs++; asmBytes += length; }
			}
		} catch {}
		return { cFuncs, asmFuncs, cBytes, asmBytes };
	}

	function refreshWidget() {
		const ctx = latestCtx;
		if (!ctx?.hasUI) return;

		const pending = state.queue.filter((e) => e.status === "pending").length;
		const queueMatched = state.queue.filter((e) => e.status === "matched").length;
		const progress = readProjectProgress(ctx.cwd);
		const totalFuncs = progress.cFuncs + progress.asmFuncs;
		const totalBytes = progress.cBytes + progress.asmBytes;
		const bytePct = totalBytes > 0 ? (progress.cBytes / totalBytes) * 100 : 0;

		const loopLabel = loopState.enabled
			? `loop ON  chunk ${loopState.chunk}`
			: "loop OFF";

		ctx.ui.setWidget("decomp-progress", (_tui: any, theme: any) => ({
			render(width: number) {
				const bar = (percent: number, w: number) => {
					const filled = Math.round((percent / 100) * w);
					return theme.fg("success", "█".repeat(filled)) + theme.fg("dim", "░".repeat(w - filled));
				};
				const divider = theme.fg("dim", "─".repeat(Math.min(width, 65)));
				const line1 = theme.fg("accent", theme.bold("◆ Conker Decomp")) + " " + divider;
				const line2 = [
					theme.fg("muted", "  progress"),
					theme.fg("success", `${bytePct.toFixed(1)}%`),
					bar(bytePct, 14),
					theme.fg("success", `${progress.cFuncs}`),
					theme.fg("dim", "C /"),
					theme.fg("warning", `${progress.asmFuncs}`),
					theme.fg("dim", "ASM /"),
					theme.fg("muted", `${totalFuncs} total`),
				].join(" ");
				const line3 = [
					theme.fg(loopState.enabled ? "success" : "dim", `  ${loopLabel}`),
					theme.fg("dim", "│"),
					theme.fg("accent", `+${queueMatched} matched`),
					theme.fg("dim", "│"),
					theme.fg("muted", `${pending} pending`),
					theme.fg("dim", "│"),
					theme.fg("muted", `${state.patterns.length} patterns`),
				].join(" ");
				return [line1, line2, line3];
			},
			invalidate() {},
		}));
	}

	let loopTimer: any = undefined;

	function ensureTimer() {
		if (loopTimer) return;
		loopTimer = setInterval(() => {
			const ctx = latestCtx;
			if (!ctx) return;
			if (!loopState.enabled) return;
			if (loopState.status === "compacting" || loopState.status === "advancing") return;
			if (!ctx.isIdle()) return;
			if (ctx.hasPendingMessages()) return;

			// Agent is idle but didn't call decomp_chunk_done — advance anyway
			loopState.status = "advancing";
			loopState.chunk++;
			loopState.consecutiveNoProgress++;
			saveLoopState(ctx.cwd);
			refreshWidget();

			try {
				pi.sendUserMessage(buildChunkPrompt(loopState.chunk));
				loopState.status = "running";
				saveLoopState(ctx.cwd);
			} catch {
				try {
					pi.sendUserMessage(buildChunkPrompt(loopState.chunk), { deliverAs: "followUp" });
					loopState.status = "running";
					saveLoopState(ctx.cwd);
				} catch {
					loopState.status = "idle";
					loopState.chunk--;
					saveLoopState(ctx.cwd);
				}
			}
		}, LOOP_POLL_MS);
	}

	// Static compaction — bypass LLM summary. Queue history IS the memory.
	pi.on("session_before_compact", (event: any) => {
		if (!loopState.enabled) return undefined;
		return {
			compaction: {
				summary: `[Conker decomp loop chunk ${loopState.chunk} complete. Progress: ${state.matched}/${state.queue.length} matched. Queue history in .pi/decomp/queue.json is the persistent memory — re-read via decomp_queue next.]`,
				firstKeptEntryId: event.preparation.firstKeptEntryId,
				tokensBefore: event.preparation.tokensBefore,
			},
		};
	});

	// Load state on session start
	// Guard: block direct git commits to conker/src/ via bash (must use decomp_accept)
	// Only blocks actual git add/commit commands, not greps/reads that mention them
	pi.on("tool_call", async (event: any, ctx: any) => {
		if (event.toolName === "bash") {
			const cmd = event.input?.command || "";
			// Only match commands that START with git (or cd ... && git)
			// Don't match grep/find/cat/read that happen to contain "git commit" in patterns
			const isGitCmd = /^\s*(cd\s+[^;&&]+\s*&&\s*)?git\s+(add|commit)/.test(cmd)
				|| /&&\s*git\s+(add|commit)/.test(cmd);
			const touchesSrc = /conker\/src/.test(cmd);
			const isAllowed = /cherry-pick|revert|recover/.test(cmd);
			if (isGitCmd && touchesSrc && !isAllowed) {
				if (ctx?.hasUI) ctx.ui.notify("\u26d4 Blocked: use decomp_accept to commit source changes (ROM SHA gate required)", "warning");
				return { block: true, reason: "Direct git commits to conker/src/ are blocked. Use decomp_accept which verifies the full ROM SHA-1 before committing." };
			}
		}
		return undefined;
	});

	pi.on("session_start", async (_event, ctx) => {
		latestCtx = ctx;
		loadState(ctx.cwd);
		ensureTimer();
		refreshWidget();
	});

	// Refresh widget after every agent turn completes
	pi.on("agent_end", async (_event, ctx) => {
		latestCtx = ctx;
		refreshWidget();
	});

	pi.on("session_shutdown", async () => {
		if (loopTimer) {
			clearInterval(loopTimer);
			loopTimer = undefined;
		}
	});

	// ═══════════════════════════════════════════════════════════════
	// TOOL: decomp_queue
	// ═══════════════════════════════════════════════════════════════
	pi.registerTool({
		name: "decomp_queue",
		label: "Decomp Queue",
		description:
			"Manage the decompilation candidate queue. Actions: next (get next candidate with context), list (show queue stats), skip (skip current), stats (overall progress), promote (promote .s segments to C files to unlock more functions), retry-skipped (reset skipped back to pending).",
		promptSnippet: "Query and manage the matching-decompilation candidate queue",
		promptGuidelines: [
			"Use decomp_queue with action 'next' to get the next function to decompile, including its target assembly and surrounding context.",
			"Use decomp_queue with action 'stats' for an overview of decomp progress.",
		],
		parameters: Type.Object({
			action: StringEnum(["next", "list", "skip", "stats", "refresh", "retry-skipped", "promote"] as const),
			filter: Type.Optional(
				Type.Object({
					maxInstructions: Type.Optional(Type.Number({ description: "Max instruction count" })),
					region: Type.Optional(StringEnum(["init", "game", "debugger"] as const)),
					difficulty: Type.Optional(
						StringEnum(["trivial", "low", "medium-low", "medium", "hard"] as const),
					),
				}),
			),
			function: Type.Optional(Type.String({ description: "Function name for skip action" })),
		}),

		async execute(_toolCallId, params, signal, _onUpdate, ctx) {
			const fs = require("node:fs");
			const path = require("node:path");

			if (params.action === "promote") {
				// Promote pure .s segments to C files via splat yaml edit + re-extract
				const yamlPath = path.join(ctx.cwd, "conker/conker.us.yaml");
				let yaml: string;
				try {
					yaml = fs.readFileSync(yamlPath, "utf-8");
				} catch {
					return { content: [{ type: "text", text: "Cannot read conker/conker.us.yaml" }], details: {} };
				}

				// Find all `[0xOFFSET, asm]` entries (no name = pure segment)
				const asmSegments: { offset: string; line: string }[] = [];
				for (const line of yaml.split("\n")) {
					const m = line.match(/^(\s*-\s*\[0x([0-9A-Fa-f]+),\s*asm\])\s*$/);
					if (m) {
						asmSegments.push({ offset: m[2], line: m[1] });
					}
				}

				if (asmSegments.length === 0) {
					return { content: [{ type: "text", text: "No promotable segments found (all already have names or are C)." }], details: {} };
				}

				// Count functions in each segment
				const segmentInfo: { offset: string; functions: number; line: string }[] = [];
				for (const seg of asmSegments) {
					const asmFile = path.join(ctx.cwd, `conker/asm/${seg.offset}.s`);
					let funcCount = 0;
					try {
						const content = fs.readFileSync(asmFile, "utf-8");
						funcCount = (content.match(/^glabel\s+/gm) || []).length;
					} catch {}
					segmentInfo.push({ offset: seg.offset, functions: funcCount, line: seg.line });
				}

				// If a specific segment was requested via filter, promote just that one
				const targetOffset = params.function; // reuse function param as segment offset
				if (targetOffset) {
					const seg = segmentInfo.find((s) => s.offset.toLowerCase() === targetOffset.toLowerCase());
					if (!seg) {
						return { content: [{ type: "text", text: `Segment 0x${targetOffset} not found in promotable list.` }], details: {} };
					}

					// Determine region from VRAM
					const offsetNum = parseInt(seg.offset, 16);
					const prefix = offsetNum < 0x10000 ? "init" : offsetNum >= 0x250000 ? "debugger" : "game";
					const newName = `${prefix}_${seg.offset}`;
					const oldLine = seg.line;
					const newLine = oldLine.replace(
						`[0x${seg.offset}, asm]`,
						`[0x${seg.offset}, c, ${newName}]`,
					);

					yaml = yaml.replace(oldLine, newLine);
					fs.writeFileSync(yamlPath, yaml);

					// Re-run extraction
					const extractResult = await pi.exec("docker", [
						"run", "--rm", "--platform", "linux/amd64",
						"-v", `${ctx.cwd}:/conker`, "-w", "/conker",
						"conker-build-min-amd64",
						"bash", "-lc", "cd conker && make extract 2>&1 | tail -20",
					], { timeout: 120000 });

					// Verify build still passes
					const buildResult = await pi.exec("docker", [
						"run", "--rm", "--platform", "linux/amd64",
						"-v", `${ctx.cwd}:/conker`, "-w", "/conker",
						"conker-build-min-amd64",
						"bash", "-lc", "make -C conker -j$(nproc) 2>&1 | tail -10",
					], { timeout: 180000 });

					if (!buildResult.stdout.includes("conker.us.bin: OK")) {
						// Revert yaml
						yaml = yaml.replace(newLine, oldLine);
						fs.writeFileSync(yamlPath, yaml);
						return {
							content: [{ type: "text", text: `Promote failed (reverted): build broken after promoting 0x${seg.offset}\n${buildResult.stdout}` }],
							details: { error: "build_failed" },
						};
					}

					// Re-run strip_splat_metadata if needed
					await pi.exec("python3", ["tools/strip_splat_metadata.py"], { timeout: 30000 });

					// Refresh queue with new candidates
					const newSrcPath = path.join(ctx.cwd, `conker/src/${newName}.c`);
					let newFunctions = 0;
					if (fs.existsSync(newSrcPath)) {
						const src = fs.readFileSync(newSrcPath, "utf-8");
						const pragmas = src.match(/#pragma\s+GLOBAL_ASM/g) || [];
						newFunctions = pragmas.length;

						// Add new entries to queue
						const funcNames = [...src.matchAll(/#pragma\s+GLOBAL_ASM\("asm\/nonmatchings\/[^/]+\/([^"]+)\.s"\)/g)];
						for (const match of funcNames) {
							const funcName = match[1];
							if (!state.queue.find((e) => e.function === funcName)) {
								state.queue.push({
									function: funcName,
									file: `${newName}.c`,
									region: prefix,
									instructions: 0, // will be filled on first attempt
									difficulty: "unknown",
									tags: ["promoted"],
									attempts: 0,
									lastScore: 0,
									status: "pending",
								});
							}
						}
						saveQueue(ctx.cwd);
					}

					// Commit promotion
					await pi.exec("git", ["add", "-A"]);
					await pi.exec("git", ["commit", "-m", `chore(decomp): promote segment 0x${seg.offset} to C (${newFunctions} functions)`]);
					await pi.exec("git", ["push"]);

					return {
						content: [{
							type: "text",
							text: `✓ Promoted 0x${seg.offset} → ${newName}.c (${newFunctions} new functions added to queue)\nTotal queue: ${state.queue.length}`,
						}],
						details: { promoted: seg.offset, newName, newFunctions },
					};
				}

				// No specific target — list promotable segments
				segmentInfo.sort((a, b) => a.functions - b.functions);
				const totalFuncs = segmentInfo.reduce((sum, s) => sum + s.functions, 0);
				const listing = segmentInfo.slice(0, 30).map((s) => `  0x${s.offset}: ${s.functions} functions`).join("\n");

				return {
					content: [{
						type: "text",
						text: `${segmentInfo.length} promotable segments (${totalFuncs} total functions):\n\n${listing}\n\nTo promote one: decomp_queue promote with function="OFFSET" (e.g. "100810")`,
					}],
					details: { count: segmentInfo.length, totalFunctions: totalFuncs },
				};
			}

			if (params.action === "retry-skipped") {
				const skipped = state.queue.filter((e) => e.status === "skipped");
				if (skipped.length === 0) {
					return { content: [{ type: "text", text: "No skipped functions to retry." }], details: {} };
				}

				// Reset all skipped back to pending (history stays)
				for (const entry of skipped) {
					entry.status = "pending";
					entry.attempts = 0; // reset attempt counter so it gets another 5 tries
					// history is preserved! the LLM will see prior failed attempts
				}
				saveQueue(ctx.cwd);

				const summary = skipped.slice(0, 10).map((e) =>
					`${e.function} (${e.history?.length ?? 0} prior attempts, best: ${e.lastScore.toFixed(2)})`
				);
				return {
					content: [{
						type: "text",
						text: `Reset ${skipped.length} skipped functions to pending (history preserved):\n${summary.join("\n")}`,
					}],
					details: { count: skipped.length },
				};
			}

			if (params.action === "refresh") {
				// Regenerate queue from analyze_decomp_candidates.py
				const result = await pi.exec(
					"python3",
					["tools/analyze_decomp_candidates.py", "--top", "944", "--json"],
					{ timeout: 30000 },
				);
				if (result.code === 0 && result.stdout) {
					try {
						const candidates = JSON.parse(result.stdout);
						state.queue = candidates.map((c: any) => ({
							function: c.function,
							file: c.file,
							region: c.region,
							instructions: c.instructions,
							difficulty: c.difficulty || "medium",
							tags: c.tags || [],
							attempts: 0,
							lastScore: 0,
							status: "pending",
						}));
						saveQueue(ctx.cwd);
						return {
							content: [{ type: "text", text: `Queue refreshed: ${state.queue.length} candidates` }],
							details: { count: state.queue.length },
						};
					} catch {
						return {
							content: [{ type: "text", text: `Failed to parse candidates: ${result.stdout.slice(0, 200)}` }],
							details: {},
						};
					}
				}
				return {
					content: [{ type: "text", text: `analyze_decomp_candidates.py failed: ${result.stderr}` }],
					details: {},
				};
			}

			if (params.action === "stats") {
				const pending = state.queue.filter((e) => e.status === "pending").length;
				const matched = state.queue.filter((e) => e.status === "matched").length;
				const skipped = state.queue.filter((e) => e.status === "skipped").length;
				return {
					content: [
						{
							type: "text",
							text: `Queue: ${state.queue.length} total\n  Matched: ${matched}\n  Pending: ${pending}\n  Skipped: ${skipped}\n  Patterns: ${state.patterns.length}`,
						},
					],
					details: { matched, pending, skipped, patterns: state.patterns.length },
				};
			}

			if (params.action === "skip") {
				const funcName = params.function;
				if (!funcName) {
					return { content: [{ type: "text", text: "skip requires a function name" }], details: {} };
				}
				const entry = state.queue.find((e) => e.function === funcName);
				if (entry) {
					entry.status = "skipped";
					saveQueue(ctx.cwd);
					latestCtx = ctx;
					refreshWidget();
				}
				return { content: [{ type: "text", text: `Skipped ${funcName}` }], details: {} };
			}

			if (params.action === "list") {
				let filtered = state.queue.filter((e) => e.status === "pending");
				if (params.filter?.region) filtered = filtered.filter((e) => e.region === params.filter!.region);
				if (params.filter?.maxInstructions)
					filtered = filtered.filter((e) => e.instructions <= params.filter!.maxInstructions!);
				if (params.filter?.difficulty)
					filtered = filtered.filter((e) => e.difficulty === params.filter!.difficulty);

				const summary = filtered.slice(0, 20).map((e) => `${e.function} (${e.file}, ${e.instructions} instr, ${e.difficulty})`);
				return {
					content: [
						{
							type: "text",
							text: `${filtered.length} pending candidates${params.filter ? " (filtered)" : ""}:\n${summary.join("\n")}`,
						},
					],
					details: { count: filtered.length },
				};
			}

			// action === "next"
			// Step 0: Verify ROM is in a known-good state before serving candidates
			const verifyResult = await pi.exec("docker", [
				"run", "--rm", "--platform", "linux/amd64",
				"-v", `${ctx.cwd}:/conker`, "-w", "/conker",
				"conker-build-min-amd64",
				"bash", "-lc",
				"rm -f conker/build/conker.us.ok conker/build/conker.us.bin && make -C conker -j$(nproc) 2>&1 | tail -5",
			], { signal, timeout: 180000 });

			if (!verifyResult.stdout.includes("conker.us.bin: OK")) {
				return {
					content: [{
						type: "text",
						text: `⛔ ROM BASELINE BROKEN — cannot serve candidates until fixed.\n\nBuild output:\n${verifyResult.stdout}\n\nFix: git checkout -- conker/src/ conker/include/ to restore known-good state, then retry.`,
					}],
					details: { error: "rom_broken" },
				};
			}

			// Auto-promote segments if queue is running low
			const pendingCount = state.queue.filter((e) => e.status === "pending").length;
			if (pendingCount < AUTO_PROMOTE_THRESHOLD) {
				const promoteResult = await autoPromoteIfNeeded(pi, ctx.cwd);
				if (promoteResult) {
					if (ctx.hasUI) ctx.ui.notify(promoteResult, "info");
				}
			}

			let candidates = state.queue.filter((e) => e.status === "pending");
			if (params.filter?.region) candidates = candidates.filter((e) => e.region === params.filter!.region);
			if (params.filter?.maxInstructions)
				candidates = candidates.filter((e) => e.instructions <= params.filter!.maxInstructions!);
			if (params.filter?.difficulty)
				candidates = candidates.filter((e) => e.difficulty === params.filter!.difficulty);

			// Sort: fewer instructions first, fewer attempts first
			candidates.sort((a, b) => a.instructions - b.instructions || a.attempts - b.attempts);

			if (candidates.length === 0) {
				return { content: [{ type: "text", text: "No pending candidates matching filter." }], details: {} };
			}

			const next = candidates[0];

			// Load target assembly
			const targetPath = path.join(ctx.cwd, "conker/asm/nonmatchings", next.file.replace(".c", ""), `${next.function}.s`);
			let targetAsm = "(target not found)";
			try {
				targetAsm = fs.readFileSync(targetPath, "utf-8");
			} catch {}

			// Load surrounding C context
			const srcPath = path.join(ctx.cwd, "conker/src", next.file);
			let srcContext = "";
			try {
				const src = fs.readFileSync(srcPath, "utf-8");
				const pragmaLine = `#pragma GLOBAL_ASM("asm/nonmatchings/${next.file.replace(".c", "")}/${next.function}.s")`;
				const idx = src.indexOf(pragmaLine);
				if (idx >= 0) {
					const start = Math.max(0, src.lastIndexOf("\n", Math.max(0, idx - 500)));
					const end = Math.min(src.length, src.indexOf("\n", idx + pragmaLine.length + 500));
					srcContext = src.slice(start, end);
				}
			} catch {}

			// ── Context enrichment: auto-resolve types, symbols, callees ──
			const enrichment: string[] = [];

			// 1. Extract referenced symbols (D_*) from target asm
			const symbolRefs = [...new Set(
				(targetAsm.match(/%(?:hi|lo)\(([^)]+)\)/g) || [])
					.map((m: string) => m.replace(/%(?:hi|lo)\(/, "").replace(")", ""))
			)];

			// Look up symbol types from variables.h and undefined_syms
			if (symbolRefs.length > 0) {
				const varsPath = path.join(ctx.cwd, "conker/include/variables.h");
				const undefPath = path.join(ctx.cwd, "conker/undefined_syms_auto.txt");
				let varsContent = "";
				let undefContent = "";
				try { varsContent = fs.readFileSync(varsPath, "utf-8"); } catch {}
				try { undefContent = fs.readFileSync(undefPath, "utf-8"); } catch {}

				const symbolDecls: string[] = [];
				for (const sym of symbolRefs) {
					// Check variables.h
					const varMatch = varsContent.match(new RegExp(`^.*\\b${sym}\\b.*$`, "m"));
					if (varMatch) {
						symbolDecls.push(varMatch[0].trim());
					} else {
						// Check undefined_syms_auto.txt
						const undefMatch = undefContent.match(new RegExp(`^.*\\b${sym}\\b.*$`, "m"));
						if (undefMatch) {
							symbolDecls.push(`// ${undefMatch[0].trim()} (undefined_syms_auto)`);
						}
					}
				}
				if (symbolDecls.length > 0) {
					enrichment.push("### Symbol Declarations", "```c", ...symbolDecls, "```", "");
				}
			}

			// 2. Extract callee prototypes (jal targets)
			const jalTargets = [...new Set(
				(targetAsm.match(/jal\s+(\w+)/g) || [])
					.map((m: string) => m.replace("jal", "").trim())
					.filter((f: string) => f.startsWith("func_") || !f.startsWith("0"))
			)];

			if (jalTargets.length > 0) {
				const funcsPath = path.join(ctx.cwd, "conker/include/functions.h");
				let funcsContent = "";
				try { funcsContent = fs.readFileSync(funcsPath, "utf-8"); } catch {}

				const calleeProtos: string[] = [];
				for (const target of jalTargets) {
					const protoMatch = funcsContent.match(new RegExp(`^.*\\b${target}\\b.*$`, "m"));
					if (protoMatch) {
						calleeProtos.push(protoMatch[0].trim());
					}
				}
				if (calleeProtos.length > 0) {
					enrichment.push("### Callee Prototypes", "```c", ...calleeProtos, "```", "");
				}
			}

			// 3. Detect struct types from symbol declarations and include relevant struct defs
			const structsPath = path.join(ctx.cwd, "conker/include/structs.h");
			let structsContent = "";
			try { structsContent = fs.readFileSync(structsPath, "utf-8"); } catch {}

			const referencedStructs = new Set<string>();
			// From symbol declarations (e.g. "extern struct127 *D_800D154C")
			for (const line of enrichment) {
				const structMatch = line.match(/\b(struct\d+)\b/g);
				if (structMatch) structMatch.forEach((s: string) => referencedStructs.add(s));
			}
			// From surrounding C context
			const ctxStructs = srcContext.match(/\b(struct\d+)\b/g);
			if (ctxStructs) ctxStructs.forEach((s: string) => referencedStructs.add(s));

			if (referencedStructs.size > 0 && structsContent) {
				const structDefs: string[] = [];
				for (const structName of referencedStructs) {
					// Find the struct definition
					const defPatterns = [
						new RegExp(`^struct ${structName} \\{`, "m"),
						new RegExp(`^typedef struct \\{[\\s\\S]*?\\} ${structName};`, "m"),
						new RegExp(`^typedef struct ${structName}`, "m"),
					];
					for (const pat of defPatterns) {
						const match = structsContent.match(pat);
						if (match) {
							const startIdx = match.index!;
							// Find the closing brace
							let braceDepth = 0;
							let endIdx = startIdx;
							for (let i = startIdx; i < structsContent.length; i++) {
								if (structsContent[i] === "{") braceDepth++;
								if (structsContent[i] === "}") {
									braceDepth--;
									if (braceDepth === 0) {
										// Include up to the semicolon after closing brace
										endIdx = structsContent.indexOf(";", i) + 1;
										break;
									}
								}
							}
							if (endIdx > startIdx) {
								structDefs.push(structsContent.slice(startIdx, endIdx));
							}
							break;
						}
					}
				}
				if (structDefs.length > 0) {
					enrichment.push("### Struct Definitions", "```c", ...structDefs, "```", "");
				}
			}

			// 4. Include recently matched functions from same file (for type/pattern reference)
			const sameFileMatched = state.queue.filter(
				(e) => e.file === next.file && e.status === "matched" && e.history?.length
			).slice(-2);
			if (sameFileMatched.length > 0) {
				enrichment.push("### Recently Matched in Same File (reference)");
				for (const m of sameFileMatched) {
					const bestAttempt = m.history!.reduce((a: AttemptRecord, b: AttemptRecord) => a.score > b.score ? a : b);
					enrichment.push(`**${m.function}** (matched):`, "```c", bestAttempt.code, "```", "");
				}
			}

			// Find relevant patterns
			const relevantPatterns = state.patterns.filter(
				(p) =>
					next.tags.some((t) => p.trigger.toLowerCase().includes(t.toLowerCase())) ||
					p.example_functions.some((f) => f === next.function),
			);

			const output = [
				`## Next candidate: ${next.function}`,
				`File: ${next.file} | Region: ${next.region} | Instructions: ${next.instructions} | Difficulty: ${next.difficulty}`,
				`Attempts so far: ${next.attempts} | Last score: ${next.lastScore}`,
				"",
				"### Target Assembly",
				"```mips",
				targetAsm,
				"```",
				"",
				"### Surrounding C Context",
				"```c",
				srcContext || "(none found)",
				"```",
				"",
				...enrichment,
			];

			if (relevantPatterns.length > 0) {
				output.push("", "### Relevant Patterns");
				for (const p of relevantPatterns) {
					output.push(`- **${p.id}**: ${p.description}`);
					output.push(`  Trigger: ${p.trigger}`);
					output.push(`  Solution: ${p.solution}`);
				}
			}

			// Surface prior attempt history so the LLM doesn't repeat mistakes
			if (next.history && next.history.length > 0) {
				output.push("", "### ⚠️ Prior Failed Attempts (DO NOT REPEAT THESE)");
				for (let i = 0; i < next.history.length; i++) {
					const h = next.history[i];
					output.push(`\n**Attempt ${i + 1}** (score: ${h.score.toFixed(3)}, reason: ${h.reason})`);
					output.push("```c");
					output.push(h.code);
					output.push("```");
					if (h.diffs.length > 0) {
						output.push("Diffs:");
						for (const d of h.diffs) {
							output.push(`  - ${d}`);
						}
					}
				}
				output.push("", "**You must try a DIFFERENT approach.** Study the diffs above and change your strategy.");
			}

			return {
				content: [{ type: "text", text: output.join("\n") }],
				details: { function: next.function, file: next.file, hasHistory: (next.history?.length ?? 0) > 0 },
			};
		},
	});

	// ═══════════════════════════════════════════════════════════════
	// TOOL: decomp_attempt
	// ═══════════════════════════════════════════════════════════════
	pi.registerTool({
		name: "decomp_attempt",
		label: "Decomp Attempt",
		description:
			"Apply a C replacement for a GLOBAL_ASM pragma, compile the translation unit, extract generated assembly, diff against target, and score. Auto-reverts if non-matching.",
		promptSnippet: "Try a C implementation for a GLOBAL_ASM function — compiles, diffs, scores, auto-reverts on mismatch",
		promptGuidelines: [
			"Use decomp_attempt to test a C function body against the original assembly. It compiles only the owning TU (~3s), not the full ROM.",
			"decomp_attempt always auto-reverts on non-match. The full raw generated ASM is included in every non-match response — no need to inspect separately.",
		],
		parameters: Type.Object({
			function: Type.String({ description: "Function name, e.g. func_15169668" }),
			file: Type.String({ description: "Source file basename, e.g. game_1944C0.c" }),
			code: Type.String({ description: "Complete C function body to replace the pragma" }),
			externs: Type.Optional(
				Type.Array(Type.String(), { description: "Additional extern declarations to add at top of file" }),
			),
		}),

		async execute(_toolCallId, params, signal, onUpdate, ctx) {
			const fs = require("node:fs");
			const path = require("node:path");

			const srcPath = path.join(ctx.cwd, "conker/src", params.file);
			const pragma = `#pragma GLOBAL_ASM("asm/nonmatchings/${params.file.replace(".c", "")}/${params.function}.s")`;

			// Read original source
			let original: string;
			try {
				original = fs.readFileSync(srcPath, "utf-8");
			} catch (e: any) {
				return { content: [{ type: "text", text: `Cannot read ${srcPath}: ${e.message}` }], details: {} };
			}

			if (!original.includes(pragma)) {
				return {
					content: [{ type: "text", text: `Pragma not found in ${params.file}:\n${pragma}` }],
					details: {},
				};
			}

			// Apply patch
			let patched = original;

			// Add externs if needed
			if (params.externs && params.externs.length > 0) {
				const externsBlock = params.externs.join("\n") + "\n";
				// Add after last #include or existing extern
				const includeEnd = patched.lastIndexOf("#include");
				if (includeEnd >= 0) {
					const lineEnd = patched.indexOf("\n", includeEnd);
					patched = patched.slice(0, lineEnd + 1) + "\n" + externsBlock + patched.slice(lineEnd + 1);
				}
			}

			// Replace pragma with code
			patched = patched.replace(pragma, params.code);
			fs.writeFileSync(srcPath, patched);

			onUpdate?.({
				content: [{ type: "text", text: "Compiling translation unit..." }],
				details: {},
			});

			// Compile TU
			const buildResult = await pi.exec("bash", ["tools/conker-build-tu.sh", params.file], {
				signal,
				timeout: 60000,
			});

			if (buildResult.code !== 0) {
				// Revert
				fs.writeFileSync(srcPath, original);
				return {
					content: [
						{
							type: "text",
							text: `Compile failed (reverted):\n${buildResult.stdout}\n${buildResult.stderr}`,
						},
					],
					details: { match: false, score: 0, reason: "compile_error" },
				};
			}

			onUpdate?.({
				content: [{ type: "text", text: "Diffing against target..." }],
				details: {},
			});

			// Extract raw generated asm before diff (for inclusion in response)
			const rawAsmResult = await pi.exec("docker", [
				"run", "--rm", "--platform", "linux/amd64",
				"-v", `${ctx.cwd}:/conker`, "-w", "/conker",
				"conker-build-min-amd64",
				"bash", "-lc",
				`mips-linux-gnu-objdump -dr conker/build/src/${params.file.replace(".c", ".c.o")} | sed -n '/<${params.function}>/,/^$/p' | sed '\$d'`,
			], { signal, timeout: 30000 });
			const rawGeneratedAsm = rawAsmResult.stdout?.trim() || "(could not extract)";

			// Diff (normalized scoring)
			const diffResult = await pi.exec("bash", ["tools/conker-diff.sh", params.function, params.file], {
				signal,
				timeout: 30000,
			});

			// Early reject: if generated is wildly oversized, the code probably includes
			// multiple functions or struct definitions that shouldn't be there
			let scoreData: any = { match: false, score: 0, reason: "diff_failed" };
			try {
				scoreData = JSON.parse(diffResult.stdout);
			} catch {}

			if (scoreData.generated_instructions && scoreData.target_instructions) {
				const ratio = scoreData.generated_instructions / scoreData.target_instructions;
				if (ratio > 3) {
					fs.writeFileSync(srcPath, original);
					const entry = state.queue.find((e: QueueEntry) => e.function === params.function);
					if (entry) {
						entry.attempts++;
						entry.lastScore = 0;
						if (!entry.history) entry.history = [];
						entry.history.push({
							code: params.code,
							score: 0,
							reason: `generated ${scoreData.generated_instructions} instr for ${scoreData.target_instructions} target (${ratio.toFixed(1)}x oversized)`,
							diffs: [],
							timestamp: new Date().toISOString(),
						});

					}
					saveQueue(ctx.cwd);
					return {
						content: [{
							type: "text",
							text: `✗ REJECTED: Generated ${scoreData.generated_instructions} instructions for a ${scoreData.target_instructions}-instruction target (${ratio.toFixed(1)}x oversized).\n\nYour code likely includes extra functions, struct definitions, or headers that shouldn't be in the function body. Provide ONLY the single function.`,
						}],
						details: { ...scoreData, rejected: "oversized" },
					};
				}
			}

			// Update queue entry (scoreData already parsed above)
			const entry = state.queue.find((e) => e.function === params.function);
			if (entry) {
				entry.attempts++;
				entry.lastScore = scoreData.score || 0;
			}

			if (scoreData.match) {
				// Leave the patch in place — user should call decomp_accept
				return {
					content: [
						{
							type: "text",
							text: `✓ MATCH! Score: ${scoreData.score}\n\nCall decomp_accept to run the full ROM SHA gate and commit.`,
						},
					],
					details: scoreData,
				};
			}

			// Non-match: save attempt to history
			const diffSummary = scoreData.diffs
				? scoreData.diffs
						.slice(0, 10)
						.map((d: any) => `  L${d.line}: ${d.type} | target: ${d.target} | got: ${d.generated}`)
						.join("\n")
				: "(no diff detail)";

			if (entry) {
				if (!entry.history) entry.history = [];
				entry.history.push({
					code: params.code,
					score: scoreData.score || 0,
					reason: scoreData.reason || "unknown",
					diffs: (scoreData.diffs || []).map((d: any) => `${d.type}: target=${d.target} got=${d.generated}`),
					timestamp: new Date().toISOString(),
				});
				// Keep only last N attempts

			}

			// Revert source
			fs.writeFileSync(srcPath, original);
			saveQueue(ctx.cwd);
			latestCtx = ctx;
			refreshWidget();

			// Periodically commit queue history to repo so findings persist
			if (entry && entry.attempts > 0 && entry.attempts % COMMIT_HISTORY_EVERY === 0) {
				await pi.exec("git", ["add", ".pi/decomp/queue.json"]);
				await pi.exec("git", ["commit", "-m", `chore(decomp): save attempt history for ${params.function} (${entry.attempts} attempts, best: ${entry.lastScore.toFixed(2)})`]);
				await pi.exec("git", ["push"]);
			}

			// Detect plateau: last 5+ attempts all within ±0.05 of each other
			let plateauWarning = "";
			if (entry?.history && entry.history.length >= 5) {
				const tail = entry.history.slice(-5);
				const scores = tail.map((h: AttemptRecord) => h.score);
				const min = Math.min(...scores);
				const max = Math.max(...scores);
				if (max - min <= 0.05 && max < 0.9) {
					plateauWarning = `\n\n⚠️ PLATEAU: Last ${tail.length} attempts scored [${scores.map((s: number) => s.toFixed(2)).join(", ")}]`
						+ `\n   No improvement trend (range: ${min.toFixed(2)}-${max.toFixed(2)}). This approach may be fundamentally misaligned.`
						+ `\n   Consider: decomp_chunk_done to move on, or try a completely different type/struct assumption.`;
				}
			}

			// Build response with prior attempt context
			const priorHint = (entry?.history?.length ?? 0) > 1
				? `\n\nPrior attempts (${entry!.history!.length}): scores=[${entry!.history!.map((h: AttemptRecord) => h.score.toFixed(2)).join(", ")}]`
				: "";

			return {
				content: [
					{
						type: "text",
						text: `✗ Non-match (reverted). Score: ${scoreData.score}\nReason: ${scoreData.reason}\n\nDiff:\n${diffSummary}\n\nGenerated ASM:\n\`\`\`\n${rawGeneratedAsm}\n\`\`\`${plateauWarning}${priorHint}`,
					},
				],
				details: scoreData,
			};
		},
	});

	// ═══════════════════════════════════════════════════════════════
	// TOOL: decomp_accept
	// ═══════════════════════════════════════════════════════════════
	pi.registerTool({
		name: "decomp_accept",
		label: "Decomp Accept",
		description:
			"Run the full ROM SHA-1 gate on a matched function and commit it. Only call after decomp_attempt reports match=true.",
		promptSnippet: "Validate full ROM SHA and commit a matched decompilation",
		promptGuidelines: [
			"Only call decomp_accept after decomp_attempt confirms match=true.",
			"decomp_accept runs the full ROM build, checks SHA-1, commits on success, reverts on failure.",
		],
		parameters: Type.Object({
			function: Type.String({ description: "Function name that was matched" }),
			file: Type.String({ description: "Source file basename" }),
			description: Type.Optional(Type.String({ description: "Commit description" })),
			pattern: Type.Optional(
				Type.Object({
					id: Type.String(),
					description: Type.String(),
					trigger: Type.String(),
					solution: Type.String(),
				}),
			),
		}),

		async execute(_toolCallId, params, signal, _onUpdate, ctx) {
			const fs = require("node:fs");
			const path = require("node:path");

			// Full ROM build
			const buildResult = await pi.exec(
				"docker",
				[
					"run",
					"--rm",
					"--platform",
					"linux/amd64",
					"-v",
					`${ctx.cwd}:/conker`,
					"-w",
					"/conker",
					"conker-build-min-amd64",
					"bash",
					"-lc",
					"rm -f conker/build/conker.us.ok conker/build/conker.us.bin && make -C conker -j$(nproc) 2>&1 | tail -20",
				],
				{ signal, timeout: 120000 },
			);

			if (!buildResult.stdout.includes("build/conker.us.bin: OK")) {
				// Revert
				await pi.exec("git", ["checkout", "--", `conker/src/${params.file}`]);
				return {
					content: [
						{
							type: "text",
							text: `✗ Full ROM SHA failed (reverted).\n${buildResult.stdout}`,
						},
					],
					details: { accepted: false },
				};
			}

			// Regenerate progress.csv so widget shows accurate numbers
			await pi.exec("docker", [
				"run", "--rm", "--platform", "linux/amd64",
				"-v", `${ctx.cwd}:/conker`, "-w", "/conker",
				"conker-build-min-amd64",
				"bash", "-lc", "make -C conker progress",
			], { timeout: 30000 });

			// Commit source + queue state + fresh progress (preserves history of what was tried) and push
			const desc = params.description || `match ${params.function}`;
			await pi.exec("git", ["add", `conker/src/${params.file}`, ".pi/decomp/queue.json", ".pi/decomp/patterns.json"]);
			await pi.exec("git", ["commit", "-m", `feat(decomp): ${desc}`]);
			await pi.exec("git", ["push"], { timeout: 30000 });

			// Update queue
			const entry = state.queue.find((e) => e.function === params.function);
			if (entry) {
				entry.status = "matched";
				saveQueue(ctx.cwd);
			}

			// Add pattern if provided
			if (params.pattern) {
				const newPattern: Pattern = {
					...params.pattern,
					example_functions: [params.function],
				};
				state.patterns.push(newPattern);
				savePatterns(ctx.cwd);
			}

			// Refresh widget
			latestCtx = ctx;
			refreshWidget();

			const matched = state.queue.filter((e) => e.status === "matched").length;
			const total = state.queue.length;
			const pct = total > 0 ? ((matched / total) * 100).toFixed(1) : "0.0";

			return {
				content: [
					{
						type: "text",
						text: `✓ Accepted and committed: ${params.function}\nProgress: ${matched}/${total} (${pct}%)`,
					},
				],
				details: { accepted: true, matched, total },
			};
		},
	});

	// ═══════════════════════════════════════════════════════════════
	// TOOL: decomp_diff
	// ═══════════════════════════════════════════════════════════════
	pi.registerTool({
		name: "decomp_diff",
		label: "Decomp Diff",
		description:
			"Re-examine a previous attempt diff with focused analysis. Useful for multi-iteration refinement on hard functions.",
		promptSnippet: "Analyze a decomp diff focusing on registers, scheduling, or branch shape",
		parameters: Type.Object({
			function: Type.String(),
			file: Type.String(),
			focus: Type.Optional(
				StringEnum(["registers", "scheduling", "branches", "stack", "all"] as const),
			),
		}),

		async execute(_toolCallId, params, signal, _onUpdate, ctx) {
			// Run diff on the current compiled state
			const diffResult = await pi.exec("bash", ["tools/conker-diff.sh", params.function, params.file], {
				signal,
				timeout: 30000,
			});

			let scoreData: any;
			try {
				scoreData = JSON.parse(diffResult.stdout);
			} catch {
				return {
					content: [{ type: "text", text: `Diff failed: ${diffResult.stdout}\n${diffResult.stderr}` }],
					details: {},
				};
			}

			// Build focused analysis
			const analysis: string[] = [`## Diff Analysis: ${params.function}`, `Score: ${scoreData.score}`];

			if (scoreData.diffs && scoreData.diffs.length > 0) {
				const focus = params.focus || "all";

				const regDiffs = scoreData.diffs.filter((d: any) => d.type === "register");
				const structDiffs = scoreData.diffs.filter((d: any) => d.type === "structural");

				if (focus === "all" || focus === "registers") {
					analysis.push("", `### Register differences (${regDiffs.length}):`);
					for (const d of regDiffs.slice(0, 15)) {
						analysis.push(`  L${d.line}: target=${d.target} → got=${d.generated}`);
					}
				}

				if (focus === "all" || focus === "scheduling" || focus === "branches") {
					analysis.push("", `### Structural differences (${structDiffs.length}):`);
					for (const d of structDiffs.slice(0, 15)) {
						analysis.push(`  L${d.line}: target=${d.target} → got=${d.generated}`);
					}
				}

				// Suggest tactics from pattern library
				const suggestions: string[] = [];
				if (regDiffs.length > 0 && structDiffs.length === 0) {
					suggestions.push("- Register-only diff: try reordering local variable declarations");
					suggestions.push("- Try changing argument types (u8 vs s32, signed vs unsigned)");
				}
				if (structDiffs.some((d: any) => d.target?.includes("beqzl") || d.target?.includes("bnezl"))) {
					suggestions.push("- Branch-likely mismatch: try if() with assignment in condition");
				}
				if (structDiffs.some((d: any) => d.target?.includes("sll") || d.target?.includes("addu"))) {
					suggestions.push("- Address math mismatch: check extern declaration (u8[] vs pointer[])");
				}

				if (suggestions.length > 0) {
					analysis.push("", "### Suggested tactics:", ...suggestions);
				}
			}

			return {
				content: [{ type: "text", text: analysis.join("\n") }],
				details: scoreData,
			};
		},
	});

	// ═══════════════════════════════════════════════════════════════
	// TOOL: decomp_inspect
	// ═══════════════════════════════════════════════════════════════
	pi.registerTool({
		name: "decomp_inspect",
		label: "Decomp Inspect",
		description:
			"Show the raw generated assembly for a function from the current compiled .o file. Use only when you need to re-examine a previously compiled state (e.g. after a manual edit). Note: decomp_attempt already includes raw generated ASM in every response.",
		promptSnippet: "View raw generated assembly from the compiled object file (rarely needed — decomp_attempt already shows this)",
		promptGuidelines: [
			"decomp_inspect is rarely needed since decomp_attempt already includes the full raw generated ASM in every non-match response.",
			"Only use decomp_inspect if you manually edited a file and compiled via bash, not for the normal attempt loop.",
		],
		parameters: Type.Object({
			function: Type.String({ description: "Function name to inspect" }),
			file: Type.String({ description: "Source file basename, e.g. game_1944C0.c" }),
			showTarget: Type.Optional(Type.Boolean({ description: "Also show the target assembly side-by-side (default: true)" })),
		}),

		async execute(_toolCallId, params, signal, _onUpdate, ctx) {
			const fs = require("node:fs");
			const path = require("node:path");
			const showTarget = params.showTarget !== false;

			// Extract generated asm from compiled .o
			const objResult = await pi.exec("docker", [
				"run", "--rm", "--platform", "linux/amd64",
				"-v", `${ctx.cwd}:/conker`, "-w", "/conker",
				"conker-build-min-amd64",
				"bash", "-lc",
				`mips-linux-gnu-objdump -dr conker/build/src/${params.file.replace(".c", ".c.o")} | sed -n '/<${params.function}>/,/^$/p' | sed '\$d'`,
			], { signal, timeout: 30000 });

			if (!objResult.stdout.trim()) {
				return {
					content: [{ type: "text", text: `Function ${params.function} not found in compiled object. Is the source patched and compiled?` }],
					details: { error: "not_found" },
				};
			}

			const output: string[] = [
				`## Generated Assembly: ${params.function}`,
				"```",
				objResult.stdout.trim(),
				"```",
			];

			// Optionally show target for side-by-side comparison
			if (showTarget) {
				const targetPath = path.join(ctx.cwd, "conker/asm/nonmatchings", params.file.replace(".c", ""), `${params.function}.s`);
				try {
					const targetAsm = fs.readFileSync(targetPath, "utf-8");
					output.push("", "## Target Assembly", "```", targetAsm.trim(), "```");
				} catch {
					output.push("", "(target assembly file not found)");
				}
			}

			// Count instructions for quick comparison
			const genLines = objResult.stdout.split("\n").filter((l: string) => /^\s*[0-9a-f]+:/.test(l) && !l.includes("R_MIPS")).length;
			output.push("", `Generated: ${genLines} instructions`);

			return {
				content: [{ type: "text", text: output.join("\n") }],
				details: { generatedInstructions: genLines },
			};
		},
	});

	// ═══════════════════════════════════════════════════════════════
	// TOOL: decomp_permute
	// ═══════════════════════════════════════════════════════════════
	pi.registerTool({
		name: "decomp_permute",
		label: "Decomp Permute",
		description:
			"Run decomp-permuter on a near-miss function. Takes the best C attempt from history (or provided code), assembles a target .o, and brute-force permutes statement order, expression shapes, and variable types to find an exact match. Best for functions scoring 0.8+ where the LLM can't converge on exact codegen.",
		promptSnippet: "Brute-force permute a near-miss C function to find an exact match",
		promptGuidelines: [
			"Use decomp_permute on functions with score ≥ 0.8 where decomp_attempt has plateaued. It runs thousands of random permutations to find the exact match.",
			"decomp_permute uses the best attempt from history by default. Provide code= to override with a specific starting point.",
		],
		parameters: Type.Object({
			function: Type.String({ description: "Function name to permute" }),
			file: Type.String({ description: "Source file basename, e.g. game_1944C0.c" }),
			code: Type.Optional(Type.String({ description: "Starting C code (default: best attempt from history)" })),
			iterations: Type.Optional(Type.Number({ description: "Number of permutation iterations (default: 2000)" })),
		}),

		async execute(_toolCallId, params, signal, onUpdate, ctx) {
			const fs = require("node:fs");
			const path = require("node:path");
			const iterations = params.iterations || 2000;

			// Get the best C attempt from history (or use provided code)
			let baseCode = params.code;
			if (!baseCode) {
				const entry = state.queue.find((e) => e.function === params.function);
				if (!entry?.history?.length) {
					return {
						content: [{ type: "text", text: `No attempt history for ${params.function}. Run decomp_attempt first to establish a baseline.` }],
						details: { error: "no_history" },
					};
				}
				// Pick the highest-scoring attempt
				const best = entry.history.reduce((a: AttemptRecord, b: AttemptRecord) => a.score > b.score ? a : b);
				baseCode = best.code;
				onUpdate?.({
					content: [{ type: "text", text: `Using best attempt (score: ${best.score.toFixed(3)}) as permuter base.` }],
					details: {},
				});
			}

			// Set up permuter working directory
			const workDir = path.join(ctx.cwd, `.pi/decomp/permuter/${params.function}`);
			fs.mkdirSync(workDir, { recursive: true });

			// 1. Write base.c — the single function with includes
			const baseC = [
				'#include <ultra64.h>',
				'#include "functions.h"',
				'#include "variables.h"',
				'',
				baseCode,
				'',
			].join('\n');
			fs.writeFileSync(path.join(workDir, "base.c"), baseC);

			// 2. Create target.o by assembling the target .s
			const targetS = path.join(ctx.cwd, "conker/asm/nonmatchings", params.file.replace(".c", ""), `${params.function}.s`);
			if (!fs.existsSync(targetS)) {
				return {
					content: [{ type: "text", text: `Target assembly not found: ${targetS}` }],
					details: { error: "no_target" },
				};
			}

			// Need to wrap the target .s with a proper prelude for the assembler
			const targetAsmContent = fs.readFileSync(targetS, "utf-8");
			const wrappedAsm = `.set noat\n.set noreorder\n.set gp=64\n\n${targetAsmContent}\n`;
			fs.writeFileSync(path.join(workDir, "target.s"), wrappedAsm);

			// Assemble target.o inside Docker
			const asmResult = await pi.exec("docker", [
				"run", "--rm", "--platform", "linux/amd64",
				"-v", `${ctx.cwd}:/conker`, "-w", `/conker/.pi/decomp/permuter/${params.function}`,
				"conker-build-min-amd64",
				"bash", "-lc",
				"mips-linux-gnu-as -EB -march=vr4300 -mabi=32 -o target.o target.s",
			], { signal, timeout: 30000 });

			if (asmResult.code !== 0) {
				return {
					content: [{ type: "text", text: `Failed to assemble target.o:\n${asmResult.stderr}\n${asmResult.stdout}` }],
					details: { error: "asm_failed" },
				};
			}

			// 3. Write compile.sh (wrapper that calls our permuter-compile.sh)
			const compileScript = [
				'#!/bin/bash',
				'/conker/tools/permuter-compile.sh "$@"',
			].join('\n');
			fs.writeFileSync(path.join(workDir, "compile.sh"), compileScript, { mode: 0o755 });

			// 4. Write settings.toml
			const settings = [
				'[compiler]',
				'arch = "mips"',
				'',
				'[scorer]',
				'algorithm = "levenshtein"',
			].join('\n');
			fs.writeFileSync(path.join(workDir, "settings.toml"), settings);

			onUpdate?.({
				content: [{ type: "text", text: `Permuter set up. Running ${iterations} iterations...` }],
				details: {},
			});

			// 5. Run the permuter inside Docker
			const permResult = await pi.exec("docker", [
				"run", "--rm", "--platform", "linux/amd64",
				"-v", `${ctx.cwd}:/conker`, "-w", "/conker",
				"conker-build-min-amd64",
				"bash", "-lc",
				`cd .pi/decomp/permuter/${params.function} && python3 /conker/tools/decomp-permuter/permuter.py . --iterations ${iterations} --best-only 2>&1 | tail -30`,
			], { signal, timeout: 600000 }); // 10 min max

			const output = permResult.stdout || "";
			const stderr = permResult.stderr || "";

			// Check if a score-0 match was found
			const scoreMatch = output.match(/score\s+0\b|\bscore:\s*0\b|\[0\]/i);
			const bestScoreMatch = output.match(/best.*?score[:\s]+(\d+)/i);
			const bestScore = bestScoreMatch ? parseInt(bestScoreMatch[1]) : null;

			if (scoreMatch || bestScore === 0) {
				// Perfect match found! Read the winning source
				let winningCode = "(check .pi/decomp/permuter/" + params.function + "/)";
				const outputDir = path.join(workDir, "output");
				if (fs.existsSync(outputDir)) {
					const outputs = fs.readdirSync(outputDir).filter((f: string) => f.endsWith(".c")).sort();
					if (outputs.length > 0) {
						winningCode = fs.readFileSync(path.join(outputDir, outputs[0]), "utf-8");
					}
				}

				return {
					content: [{
						type: "text",
						text: `✅ PERMUTER FOUND A MATCH (score 0)!\n\nWinning code:\n\`\`\`c\n${winningCode}\n\`\`\`\n\nRun decomp_attempt with this code, then decomp_accept to commit.`,
					}],
					details: { matched: true, bestScore: 0, code: winningCode },
				};
			}

			// No perfect match — report best result
			return {
				content: [{
					type: "text",
					text: `Permuter completed ${iterations} iterations. Best score: ${bestScore ?? "unknown"}\n\nOutput:\n${output.slice(-500)}\n${stderr ? `\nErrors:\n${stderr.slice(-200)}` : ""}\n\nPermuter working dir: .pi/decomp/permuter/${params.function}/\nYou can add PERM_* macros to base.c and rerun for targeted permutations.`,
				}],
				details: { matched: false, bestScore, iterations },
			};
		},
	});

	// ═══════════════════════════════════════════════════════════════
	// TOOL: decomp_status
	// ═══════════════════════════════════════════════════════════════
	pi.registerTool({
		name: "decomp_status",
		label: "Decomp Status",
		description: "Show overall decompilation progress, recent matches, failure patterns, or the IDO pattern library.",
		promptSnippet: "Show decomp progress stats, recent matches, or IDO pattern library",
		parameters: Type.Object({
			detail: Type.Optional(StringEnum(["summary", "recent", "failures", "patterns"] as const)),
		}),

		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const detail = params.detail || "summary";

			if (detail === "patterns") {
				if (state.patterns.length === 0) {
					return { content: [{ type: "text", text: "No patterns recorded yet." }], details: {} };
				}
				const text = state.patterns
					.map((p) => `**${p.id}**: ${p.description}\n  Trigger: ${p.trigger}\n  Solution: ${p.solution}\n  Examples: ${p.example_functions.join(", ")}`)
					.join("\n\n");
				return { content: [{ type: "text", text: text }], details: { count: state.patterns.length } };
			}

			if (detail === "failures") {
				const failed = state.queue.filter((e) => e.attempts > 0 && e.status === "pending");
				failed.sort((a, b) => b.lastScore - a.lastScore); // highest score first (closest to match)
				const text = failed
					.slice(0, 20)
					.map((e) => `${e.function} (${e.file}) — ${e.attempts} attempts, best score: ${e.lastScore}`)
					.join("\n");
				return {
					content: [{ type: "text", text: text || "No failed attempts yet." }],
					details: { count: failed.length },
				};
			}

			if (detail === "recent") {
				const matched = state.queue.filter((e) => e.status === "matched");
				const text = matched
					.slice(-10)
					.map((e) => `✓ ${e.function} (${e.file}, ${e.instructions} instr)`)
					.join("\n");
				return {
					content: [{ type: "text", text: text || "No matches yet." }],
					details: { count: matched.length },
				};
			}

			// summary
			const pending = state.queue.filter((e) => e.status === "pending").length;
			const matched = state.queue.filter((e) => e.status === "matched").length;
			const skipped = state.queue.filter((e) => e.status === "skipped").length;
			const attempted = state.queue.filter((e) => e.attempts > 0).length;

			const byDifficulty = state.queue.reduce(
				(acc, e) => {
					if (e.status === "pending") {
						acc[e.difficulty] = (acc[e.difficulty] || 0) + 1;
					}
					return acc;
				},
				{} as Record<string, number>,
			);

			const diffBreakdown = Object.entries(byDifficulty)
				.map(([k, v]) => `  ${k}: ${v}`)
				.join("\n");

			return {
				content: [
					{
						type: "text",
						text: [
							`## Decomp Status`,
							`Total candidates: ${state.queue.length}`,
							`Matched: ${matched}`,
							`Pending: ${pending}`,
							`Skipped: ${skipped}`,
							`Attempted (any): ${attempted}`,
							`Patterns: ${state.patterns.length}`,
							"",
							"Pending by difficulty:",
							diffBreakdown,
						].join("\n"),
					},
				],
				details: { matched, pending, skipped, attempted },
			};
		},
	});

	// ═══════════════════════════════════════════════════════════════
	// TOOL: decomp_chunk_done
	// ═══════════════════════════════════════════════════════════════
	pi.registerTool({
		name: "decomp_chunk_done",
		label: "Decomp Chunk Done",
		description:
			"Signal that this decomp chunk is complete. If the loop is enabled, context is compacted and the next chunk starts immediately with fresh context. Always call this when done with a function (matched or moving on).",
		promptSnippet: "Signal chunk complete — triggers context reset and next function",
		promptGuidelines: [
			"Always call decomp_chunk_done when finished with a function (matched, moved on, or stuck). Do not send any other response after calling it.",
		],
		parameters: Type.Object({
			summary: Type.String({ description: "1-3 sentence summary: what was tried, outcome, any patterns discovered" }),
			matched: Type.Optional(Type.Boolean({ description: "Whether a function was successfully matched this chunk" })),
			patternDiscovered: Type.Optional(Type.String({ description: "New IDO pattern discovered (will be added to library)" })),
		}),

		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			loopState.lastChunkSummary = params.summary;

			if (params.matched) {
				loopState.consecutiveNoProgress = 0;
			} else {
				loopState.consecutiveNoProgress++;
			}

			if (!loopState.enabled) {
				// Single-shot mode — just acknowledge
				loopState.status = "idle";
				saveLoopState(ctx.cwd);
				refreshWidget();
				return {
					content: [{ type: "text", text: `Chunk ${loopState.chunk} done (loop off). ${params.summary}` }],
					details: { done: true, loopEnabled: false },
				};
			}

			// Loop enabled — compact then advance
			const nextChunk = loopState.chunk + 1;
			loopState.status = "compacting";
			saveLoopState(ctx.cwd);
			refreshWidget();

			const doAdvance = () => {
				loopState.chunk = nextChunk;
				loopState.status = "running";
				saveLoopState(ctx.cwd);
				refreshWidget();
				try {
					pi.sendUserMessage(buildChunkPrompt(nextChunk));
				} catch {
					try {
						pi.sendUserMessage(buildChunkPrompt(nextChunk), { deliverAs: "followUp" });
					} catch {
						loopState.status = "idle";
						saveLoopState(ctx.cwd);
					}
				}
			};

			ctx.compact({
				onComplete: doAdvance,
				onError: doAdvance, // advance even if compaction fails
			});

			return {
				content: [{
					type: "text",
					text: `Chunk ${loopState.chunk} complete. Compacting → starting chunk ${nextChunk}.\n${params.summary}`,
				}],
				details: { done: true, loopEnabled: true, nextChunk },
			};
		},
	});

	// ═══════════════════════════════════════════════════════════════
	// COMMAND: /decomp-loop
	// ═══════════════════════════════════════════════════════════════
	pi.registerCommand("decomp-loop", {
		description: "Manage the autonomous decomp loop [start|stop|status|reset]",
		handler: async (args, ctx) => {
			const sub = (args || "").trim().toLowerCase();

			if (sub === "start") {
				await ctx.waitForIdle();
				loopState.enabled = true;
				loopState.chunk++;
				loopState.status = "running";
				loopState.consecutiveNoProgress = 0;
				saveLoopState(ctx.cwd);
				ensureTimer();
				refreshWidget();
				ctx.ui.notify(`Decomp loop started at chunk ${loopState.chunk}`, "info");
				pi.sendUserMessage(buildChunkPrompt(loopState.chunk));
				return;
			}

			if (sub === "stop") {
				loopState.enabled = false;
				loopState.status = "stopped";
				saveLoopState(ctx.cwd);
				refreshWidget();
				ctx.ui.notify("Decomp loop stopped", "info");
				return;
			}

			if (sub === "status" || !sub) {
				const msg = [
					`Loop: ${loopState.enabled ? "ON" : "OFF"}`,
					`Chunk: ${loopState.chunk}`,
					`Status: ${loopState.status}`,
					`No-progress streak: ${loopState.consecutiveNoProgress}`,
					`Last: ${loopState.lastChunkSummary || "(none)"}`,
				].join(" | ");
				ctx.ui.notify(msg, "info");
				return;
			}

			if (sub === "reset") {
				loopState = {
					enabled: false,
					chunk: 0,
					status: "idle",
					lastChunkSummary: "",
					consecutiveNoProgress: 0,
					updatedAt: new Date().toISOString(),
				};
				saveLoopState(ctx.cwd);
				refreshWidget();
				ctx.ui.notify("Decomp loop state reset", "info");
				return;
			}

			ctx.ui.notify("Usage: /decomp-loop [start|stop|status|reset]", "warning");
		},
	});
}

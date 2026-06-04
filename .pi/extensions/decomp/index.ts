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
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
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
const SESSION_ROTATE_THRESHOLD = 8; // auto-rotate away from a function after this many attempts without improvement

// Session-level tracking: functions to skip because we ground on them this session
const sessionRotatedFunctions = new Set<string>();
const sessionAttemptCounts = new Map<string, { count: number; bestScore: number }>();

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
	await gitPushWithRetry(pi);

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
		"3. Write C and call `decomp_attempt` to test it. Every attempt is recorded for learning.",
		"4. If non-match: read the diff, call `decomp_diff` for focused analysis, then retry with a different approach.",
		"5. If match: call `decomp_accept` to verify full ROM SHA and commit.",
		"6. When done with this function (matched or decided to move on), call `decomp_chunk_done` with a summary.",
		"",
		"## Rules",
		"- You can work on MULTIPLE functions per chunk. If stuck, call `decomp_queue next` to try a different one — no need to call `decomp_chunk_done`.",
		"- Call `decomp_chunk_done` when you’ve made good progress or exhausted reasonable options for this chunk.",
		"- Functions with 8+ failed attempts are auto-rotated: `decomp_queue next` will skip them this session.",
		"- Relevant patterns from the library (122+) are auto-shown with each candidate. For more, call `decomp_status` with detail=\"patterns\".",
		"- The /skill:n64-decomp file has core IDO 5.3 codegen rules (declaration order, branch shapes, addressing).",
		"- If score ≥ 0.9, you're close — try declaration reordering, type changes, or expression reshaping.",
		"- If plateaued (3+ attempts, no improvement), use decomp_permute regardless of score — Transmuter can fix codegen issues at ANY score level.",
		"- Every few chunks, try: decomp_queue next with filter={nearMiss: true} to revisit near-misses with the permuter.",
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

async function gitPushWithRetry(pi: any): Promise<void> {
	const result = await pi.exec("git", ["push"], { timeout: 30000 });
	if (result.code !== 0) {
		// Push failed (likely non-fast-forward) — pull rebase and retry
		await pi.exec("git", ["pull", "--rebase"], { timeout: 30000 });
		await pi.exec("git", ["push"], { timeout: 30000 });
	}
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
				const safeWidth = Math.max(0, width);
				const fit = (line: string) => truncateToWidth(line, safeWidth, "");
				const bar = (percent: number, w: number) => {
					const filled = Math.round((percent / 100) * w);
					return theme.fg("success", "█".repeat(filled)) + theme.fg("dim", "░".repeat(w - filled));
				};
				const title = theme.fg("accent", theme.bold("◆ Conker Decomp"));
				const dividerWidth = Math.max(0, safeWidth - visibleWidth(title) - 1);
				const divider = theme.fg("dim", "─".repeat(Math.min(dividerWidth, 65)));
				const line1 = dividerWidth > 0 ? `${title} ${divider}` : title;
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
				return [line1, line2, line3].map(fit);
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
	// Guard: block ALL direct mutations to conker/src/ and conker/include/
	pi.on("tool_call", async (event: any, ctx: any) => {
		const toolName = event.toolName;

		// Block Pi's write/edit tools on protected paths
		if (toolName === "write" || toolName === "edit") {
			const targetPath = event.input?.path || "";
			if (/conker\/src|conker\/include/.test(targetPath)) {
				if (ctx?.hasUI) ctx.ui.notify("\u26d4 Blocked: use decomp_attempt for source changes", "warning");
				return { block: true, reason: "Direct write/edit to conker/src/ and conker/include/ is blocked. Use decomp_attempt (which auto-reverts) or decomp_accept (which verifies ROM SHA-1)." };
			}
		}

		// Block bash mutations
		if (toolName === "bash") {
			const cmd = event.input?.command || "";
			const touchesSrc = /conker\/src|conker\/include/.test(cmd);
			if (!touchesSrc) return undefined;

			// Allow read-only operations
			const isReadOnly = /grep|cat|find|ls|head|tail|sed -n|wc|diff|log|show|status|blame/.test(cmd);
			if (isReadOnly) return undefined;

			// Allow recovery operations
			const isRecovery = /cherry-pick|revert|recover/.test(cmd);
			if (isRecovery) return undefined;

			// Block --no-verify (hook bypass)
			if (/--no-verify|-n/.test(cmd) && /git\s+commit/.test(cmd)) {
				if (ctx?.hasUI) ctx.ui.notify("\u26d4 Blocked: --no-verify is not allowed", "warning");
				return { block: true, reason: "git commit --no-verify is blocked. The pre-commit ROM verification hook cannot be bypassed." };
			}

			// Block hook manipulation
			if (/\.githooks|core\.hooksPath|pre-commit/.test(cmd) && /(rm|mv|chmod|sed|echo|cat.*>|config)/.test(cmd)) {
				if (ctx?.hasUI) ctx.ui.notify("\u26d4 Blocked: hook manipulation not allowed", "warning");
				return { block: true, reason: "Modifying or disabling git hooks is blocked. The ROM verification hook is mandatory." };
			}

			// Block git add/commit on protected paths
			const isGitMutation = /&&\s*git\s+(add|commit)|^\s*(cd\s+[^;&]+&&\s*)?git\s+(add|commit)/.test(cmd);
			// Block file mutations (sed -i, python writing, rm, etc)
			const isFileMutation = /(sed\s+-i|perl\s+-pi|python3?\s|node\s|rm\s|mv\s|cp\s|chmod|tee\s|truncate|dd\b)/.test(cmd)
				|| />>?\s*[^|]/.test(cmd);

			if (isGitMutation || isFileMutation) {
				if (ctx?.hasUI) ctx.ui.notify("\u26d4 Blocked: use decomp_attempt/decomp_accept for source changes", "warning");
				return { block: true, reason: "Direct mutations to conker/src/ and conker/include/ are blocked. Use decomp_attempt (which auto-reverts) or decomp_accept (which verifies ROM SHA-1)." };
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
					nearMiss: Type.Optional(Type.Boolean({ description: "Only return functions with prior attempts scoring >= 0.8 (best permuter candidates)" })),
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
					await gitPushWithRetry(pi);

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
				// Notify coordinator
				const coordUrl2 = process.env.DECOMP_COORDINATOR_URL;
				const lane2 = process.env.DECOMP_LANE_ID;
				if (coordUrl2 && lane2 && funcName) {
					fetch(`${coordUrl2}/release`, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ laneId: lane2, function: funcName, status: "skipped" }),
					}).catch(() => {});
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

			// ─── COORDINATOR MODE ─────────────────────────────────────────
			// Detect coordinator from .decomp-coordinator.json or env var
			const coordConfigPath = path.join(ctx.cwd, ".decomp-coordinator.json");
			let coordinatorUrl = process.env.DECOMP_COORDINATOR_URL || "";
			let laneId = process.env.DECOMP_LANE_ID || "";
			if (!coordinatorUrl && fs.existsSync(coordConfigPath)) {
				try {
					const cfg = JSON.parse(fs.readFileSync(coordConfigPath, "utf-8"));
					coordinatorUrl = cfg.url || "";
					laneId = cfg.laneId || "";
				} catch {}
			}
			if (coordinatorUrl && laneId) {
				try {
					// Heartbeat
					fetch(`${coordinatorUrl}/lanes/${laneId}/heartbeat`, { method: "POST" }).catch(() => {});

					// Claim next function from coordinator
					const claimRes = await fetch(`${coordinatorUrl}/claim`, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ laneId }),
					});

					if (claimRes.status === 204) {
						return { content: [{ type: "text", text: "No pending candidates available from coordinator. All functions are claimed or completed." }], details: {} };
					}
					if (!claimRes.ok) {
						const err = await claimRes.text();
						return { content: [{ type: "text", text: `Coordinator error: ${err}` }], details: {} };
					}

					const claim = await claimRes.json() as { function: string; file: string; region: string; instructions: number; difficulty: string; history: any[] };

					// Get patterns from coordinator
					const patternsRes = await fetch(`${coordinatorUrl}/patterns`).catch(() => null);
					if (patternsRes?.ok) {
						const { patterns: coordPatterns } = await patternsRes.json() as { patterns: any[] };
						state.patterns = coordPatterns;
					}

					// FORCE this claimed function as the next candidate
					// Update local queue entry to match coordinator state
					const overrideEntry = state.queue.find((e) => e.function === claim.function);
					if (overrideEntry) {
						overrideEntry.status = "pending";
						overrideEntry.history = claim.history || overrideEntry.history;
					}

					// Set a flag so the normal queue logic ONLY serves this function
					(state as any)._coordinatorClaim = claim.function;
				} catch (e: any) {
					// Coordinator unreachable — fall back to local queue
				}
			}

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

			// If coordinator claimed a specific function, ONLY serve that one
			const coordClaim = (state as any)._coordinatorClaim;
			if (coordClaim) {
				candidates = candidates.filter((e) => e.function === coordClaim);
				delete (state as any)._coordinatorClaim; // consume the claim
			}

			// Auto-rotate: skip functions we ground on this session (unless nearMiss filter explicitly requested)
			if (!params.filter?.nearMiss && sessionRotatedFunctions.size > 0) {
				const beforeCount = candidates.length;
				candidates = candidates.filter((e) => !sessionRotatedFunctions.has(e.function));
				if (candidates.length < beforeCount) {
					// Note: rotated functions are not permanently skipped, just for this session
				}
			}

			if (params.filter?.region) candidates = candidates.filter((e) => e.region === params.filter!.region);
			if (params.filter?.maxInstructions)
				candidates = candidates.filter((e) => e.instructions <= params.filter!.maxInstructions!);
			if (params.filter?.difficulty)
				candidates = candidates.filter((e) => e.difficulty === params.filter!.difficulty);
			if (params.filter?.nearMiss) {
				candidates = candidates.filter((e) => {
					if (!e.history || e.history.length === 0) return false;
					const best = Math.max(...e.history.map((h: AttemptRecord) => h.score));
					return best >= 0.8;
				});
				// Sort near-misses by best score descending (closest to match first)
				candidates.sort((a, b) => {
					const bestA = Math.max(...(a.history || []).map((h: AttemptRecord) => h.score));
					const bestB = Math.max(...(b.history || []).map((h: AttemptRecord) => h.score));
					return bestB - bestA;
				});
			} else {
				// Default sort: fewer instructions first, fewer attempts first
				candidates.sort((a, b) => a.instructions - b.instructions || a.attempts - b.attempts);
			}

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

			// Find relevant patterns by keyword matching against target assembly + function context
			const asmLower = targetAsm.toLowerCase();
			const contextLower = (srcContext || "").toLowerCase();
			const relevantPatterns = state.patterns
				.map((p) => {
					let score = 0;
					// Check if this function is a known example for the pattern
					if (p.example_functions.some((f: string) => f === next.function)) score += 10;
					// Extract keywords from trigger and check against target asm
					const triggerWords = p.trigger.toLowerCase().match(/[a-z_][a-z0-9_]+/g) || [];
					const asmKeywords = triggerWords.filter((w: string) => w.length > 3 && (asmLower.includes(w) || contextLower.includes(w)));
					score += asmKeywords.length;
					// Check solution keywords against assembly patterns
					const solWords = p.solution.toLowerCase().match(/[a-z_][a-z0-9_]+/g) || [];
					const solMatches = solWords.filter((w: string) => w.length > 4 && asmLower.includes(w));
					score += solMatches.length * 0.5;
					return { pattern: p, score };
				})
				.filter((r) => r.score > 0)
				.sort((a, b) => b.score - a.score)
				.slice(0, 5)
				.map((r) => r.pattern);

			const output = [
				`✅ ROM baseline verified (conker.us.bin: OK)`,
				"",
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
				output.push("", "### Relevant Patterns (auto-matched from library of " + state.patterns.length + ")");
				for (const p of relevantPatterns) {
					output.push(`- **${p.id}**: ${p.description}`);
					output.push(`  Trigger: ${p.trigger}`);
					output.push(`  Solution: ${p.solution}`);
				}
				output.push("", "_For the full pattern library, call `decomp_status` with detail=\"patterns\"._");
			} else if (state.patterns.length > 0) {
				output.push("", `_${state.patterns.length} patterns in library (none matched this target). Search with \`decomp_status\` detail=\"patterns\" if stuck._`);
			}

			// Surface prior attempt history so the LLM doesn't repeat mistakes
			if (next.history && next.history.length > 0) {
				// Separate regular attempts from permuter runs
				const regularAttempts = next.history.filter((h: AttemptRecord) => !h.reason?.startsWith("transmuter"));
				const permuterRuns = next.history.filter((h: AttemptRecord) => h.reason?.startsWith("transmuter"));

				if (regularAttempts.length > 0) {
					output.push("", "### ⚠️ Prior Failed Attempts (DO NOT REPEAT THESE)");
					for (let i = 0; i < regularAttempts.length; i++) {
						const h = regularAttempts[i];
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

				if (permuterRuns.length > 0) {
					output.push("", "### 🔧 Prior Transmuter/Permuter Runs");
					for (const h of permuterRuns) {
						output.push(`- ${h.reason} | ${h.diffs.join(" | ")}`);
					}
					output.push("_Transmuter already tried mutation search on this code. Different structural approach needed before re-running._");
				}
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

			// Track session-level attempts for auto-rotate
			const sessionEntry = sessionAttemptCounts.get(params.function) || { count: 0, bestScore: 0 };
			sessionEntry.count++;
			if ((scoreData.score || 0) > sessionEntry.bestScore) {
				sessionEntry.bestScore = scoreData.score || 0;
			}
			sessionAttemptCounts.set(params.function, sessionEntry);

			// Auto-rotate: if we've tried this function many times without improvement, mark it
			if (sessionEntry.count >= SESSION_ROTATE_THRESHOLD && entry?.history) {
				const recentScores = entry.history.slice(-SESSION_ROTATE_THRESHOLD).map((h: AttemptRecord) => h.score);
				const recentBest = Math.max(...recentScores);
				const overallBest = Math.max(...entry.history.map((h: AttemptRecord) => h.score));
				if (recentBest <= overallBest) {
					sessionRotatedFunctions.add(params.function);
				}
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

			// Report attempt to coordinator (for cross-lane learning)
			const coordUrl3 = process.env.DECOMP_COORDINATOR_URL;
			if (coordUrl3 && entry?.history?.length) {
				const lastAttempt = entry.history[entry.history.length - 1];
				fetch(`${coordUrl3}/attempt`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						function: params.function,
						code: lastAttempt.code,
						score: lastAttempt.score,
						reason: lastAttempt.reason,
						diffs: lastAttempt.diffs,
					}),
				}).catch(() => {});
			}

			// Periodically commit queue history to repo so findings persist
			if (entry && entry.attempts > 0 && entry.attempts % COMMIT_HISTORY_EVERY === 0) {
				await pi.exec("git", ["add", ".pi/decomp/queue.json"]);
				await pi.exec("git", ["commit", "-m", `chore(decomp): save attempt history for ${params.function} (${entry.attempts} attempts, best: ${entry.lastScore.toFixed(2)})`]);
				await gitPushWithRetry(pi);
			}

			// Detect stall: multiple patterns (flat, alternating, no improvement)
			let plateauWarning = "";
			if (entry?.history && entry.history.length >= 5) {
				const tail = entry.history.slice(-5);
				const scores = tail.map((h: AttemptRecord) => h.score);
				const min = Math.min(...scores);
				const max = Math.max(...scores);
				const best = Math.max(...entry.history.map((h: AttemptRecord) => h.score));
				const recentBest = Math.max(...scores);

				// Pattern 1: flat (all within ±0.05)
				const isFlat = max - min <= 0.05 && max < 0.9;
				// Pattern 2: alternating (high variance but no improvement, e.g. 0.9, 0.4, 0.9, 0.4)
				const isAlternating = max - min > 0.3 && recentBest <= best;
				// Pattern 3: no improvement in last 8 attempts
				const isStagnant = entry.history.length >= 8 && Math.max(...entry.history.slice(-8).map((h: AttemptRecord) => h.score)) <= best;

				if (isFlat || isAlternating || (isStagnant && entry.history.length >= 8)) {
					const pattern = isFlat ? "flat" : isAlternating ? "alternating" : "stagnant";
					plateauWarning = `\n\n⚠️ STUCK (${pattern}): Last ${tail.length} attempts scored [${scores.map((s: number) => s.toFixed(2)).join(", ")}]`
						+ `\n   Best ever: ${best.toFixed(2)}. You are NOT making progress with this approach.`
						+ `\n   → Call decomp_queue next to try a different function (this one’s history is saved for later).`
						+ `\n   → Or try a FUNDAMENTALLY different strategy: different struct type, different control flow, rewrite from scratch.`;
					if (best >= 0.8) {
						plateauWarning += `\n   → Score ${best.toFixed(2)} is a permuter candidate: try decomp_permute ${params.function}`;
					}
				}
			}

			// Auto-permuter suggestion: if this attempt scored high, strongly suggest permuter
			// Suggest Transmuter when: score > 0 AND (high score OR plateaued after 3+ attempts)
			let permuterHint = "";
			const sessionCount = sessionAttemptCounts.get(params.function)?.count || 0;
			const shouldSuggestPermuter = (scoreData.score || 0) > 0 && (
				(scoreData.score || 0) >= 0.8 || // High score — always suggest
				(sessionCount >= 3 && !plateauWarning) // 3+ attempts this session without plateau warning already covering it
			);
			if (shouldSuggestPermuter && !plateauWarning.includes("permuter")) {
				const instrDiff = scoreData.target_instructions && scoreData.generated_instructions
					? Math.abs(scoreData.target_instructions - scoreData.generated_instructions)
					: null;
				const instrHint = instrDiff !== null ? ` (${instrDiff} instruction${instrDiff === 1 ? "" : "s"} off)` : "";
				permuterHint = `\n\n🎯 TRANSMUTER CANDIDATE${instrHint} — code compiles, structure looks right, codegen doesn’t match.`
					+ `\n   Transmuter’s 49 AST-aware mutation rules (sameline, pad-var-decl, reorder-stmts, etc.) can brute-force this.`
					+ `\n   → Call \`decomp_permute\` with function="${params.function}" file="${params.file}"`
					+ `\n   Note: Verify the result with decomp_attempt after (IDO codegen is context-sensitive).`;
			}

			// Build response with prior attempt context
			const priorHint = (entry?.history?.length ?? 0) > 1
				? `\n\nPrior attempts (${entry!.history!.length}): scores=[${entry!.history!.map((h: AttemptRecord) => h.score.toFixed(2)).join(", ")}]`
				: "";

			return {
				content: [
					{
						type: "text",
						text: `✗ Non-match (reverted). Score: ${scoreData.score}\nReason: ${scoreData.reason}\n\nDiff:\n${diffSummary}\n\nGenerated ASM:\n\`\`\`\n${rawGeneratedAsm}\n\`\`\`${permuterHint}${plateauWarning}${priorHint}`,
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

			// Commit source + queue state + fresh progress
			// The pre-commit hook will run the full ROM build again as a safety check.
			// Since we already verified above, it will pass — but it's the hard gate.
			const desc = params.description || `match ${params.function}`;
			await pi.exec("git", ["add", `conker/src/${params.file}`, ".pi/decomp/queue.json", ".pi/decomp/patterns.json"]);
			const commitResult = await pi.exec("git", ["commit", "-m", `feat(decomp): ${desc}`]);
			if (commitResult.code !== 0) {
				// Pre-commit hook blocked it — ROM verification failed
				await pi.exec("git", ["checkout", "--", `conker/src/${params.file}`]);
				return {
					content: [{ type: "text", text: `⛔ Pre-commit hook blocked: ROM SHA failed on final verification.\n${commitResult.stdout}\n${commitResult.stderr}` }],
					details: { accepted: false, reason: "hook_blocked" },
				};
			}
			await gitPushWithRetry(pi);

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

			// Notify coordinator of successful match
			const coordUrl = process.env.DECOMP_COORDINATOR_URL;
			const lane = process.env.DECOMP_LANE_ID;
			if (coordUrl && lane) {
				fetch(`${coordUrl}/release`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ laneId: lane, function: params.function, status: "matched" }),
				}).catch(() => {});
			}

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
		label: "Decomp Permute (Transmuter)",
		description:
			"Run Transmuter mutation search on a near-miss function. Uses 49 AST-aware rules with Thompson Sampling, IDO profile, and multi-branch search to brute-force the last few instructions. Runs natively (~40 compiles/sec). Best for functions scoring 0.8+ where the LLM can't converge on exact codegen.",
		promptSnippet: "Brute-force mutate a near-miss C function using Transmuter (49 rules, adaptive sampling, IDO profile)",
		promptGuidelines: [
			"Use decomp_permute whenever you've plateaued (3+ attempts without improvement) at ANY score level. Transmuter's mutations can fix 1-instruction differences that LLMs can't.",
			"Common wins: 'sameline' (combining statements), 'pad-var-decl' (unused variable for stack), 'reorder-stmts' (swap adjacent lines), 'temp-for-expr' (extract into temp).",
			"decomp_permute uses the best attempt from history by default. Provide code= to override with a specific starting point.",
			"Transmuter typically finds matches in 3-60 seconds. Near-misses (1-3 instructions off) are fastest.",
			"IMPORTANT: Transmuter compiles in isolation (not the full TU). After it finds a match, MUST verify with decomp_attempt (IDO codegen is context-sensitive).",
			"If the Transmuter match includes externs not in the source file, pass them via decomp_attempt's externs parameter.",
		],
		parameters: Type.Object({
			function: Type.String({ description: "Function name to permute" }),
			file: Type.Optional(Type.String({ description: "Source file basename, e.g. game_1944C0.c (auto-resolved from queue if omitted)" })),
			code: Type.Optional(Type.String({ description: "Starting C code (default: best attempt from history)" })),
			timeout: Type.Optional(Type.Number({ description: "Timeout in seconds (default: 60)" })),
			maxCompiles: Type.Optional(Type.Number({ description: "Max compile attempts (default: 2000)" })),
		}),

		async execute(_toolCallId, params, signal, onUpdate, ctx) {
			const fs = require("node:fs");
			const path = require("node:path");
			const timeoutMs = (params.timeout || 60) * 1000;
			const maxCompiles = params.maxCompiles || 2000;

			// Auto-resolve file from queue if not provided
			let file = params.file;
			if (!file) {
				const qEntry = state.queue.find((e) => e.function === params.function);
				if (qEntry) {
					file = qEntry.file;
				} else {
					return {
						content: [{ type: "text", text: `Cannot resolve file for ${params.function}. Provide file= parameter.` }],
						details: { error: "no_file" },
					};
				}
			}

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
				const best = entry.history.reduce((a: AttemptRecord, b: AttemptRecord) => a.score > b.score ? a : b);
				baseCode = best.code;
				onUpdate?.({
					content: [{ type: "text", text: `Using best attempt (score: ${best.score.toFixed(3)}) as Transmuter base.` }],
					details: {},
				});
			}

			// Create target .o by assembling the target .s file natively
			const targetS = path.join(ctx.cwd, "conker/asm/nonmatchings", file.replace(".c", ""), `${params.function}.s`);
			if (!fs.existsSync(targetS)) {
				return {
					content: [{ type: "text", text: `Target assembly not found: ${targetS}` }],
					details: { error: "no_target" },
				};
			}

			// Convert glabel → proper asm directives and assemble natively
			const workDir = path.join(ctx.cwd, `build/transmuter`);
			fs.mkdirSync(workDir, { recursive: true });

			let targetAsmContent = fs.readFileSync(targetS, "utf-8");
			targetAsmContent = targetAsmContent
				.replace(/^glabel\s+(\w+)/gm, ".global $1\n$1:")
				.replace(/^\.L(\w+):/gm, ".L$1:")
				.replace(/^\s*\/\*.*?\*\/\s*/gm, "")
				.replace(/^\s*#.*$/gm, "");
			const wrappedAsm = `.set noat\n.set noreorder\n.set gp=64\n.section .text\n\n${targetAsmContent}\n`;
			const targetSPath = path.join(workDir, `${params.function}_target.s`);
			const targetOPath = path.join(workDir, `${params.function}_target.o`);
			fs.writeFileSync(targetSPath, wrappedAsm);

			// Assemble with native mips-linux-gnu-as
			const asmResult = await pi.exec("mips-linux-gnu-as", [
				"-EB", "-march=vr4300", "-mabi=32", "-o", targetOPath, targetSPath,
			], { signal, timeout: 10000 });

			if (asmResult.code !== 0) {
				return {
					content: [{ type: "text", text: `Failed to assemble target.o:\n${asmResult.stderr}\n${asmResult.stdout}` }],
					details: { error: "asm_failed" },
				};
			}

			// Write the base source file for Transmuter
			// Include standard headers + extract undefined_syms referenced in the code
			// Filter out symbols already declared in variables.h/functions.h to avoid redeclaration errors
			const undefSymsPath = path.join(ctx.cwd, "conker/undefined_syms_auto.txt");
			const undefSyms2 = path.join(ctx.cwd, "conker/undefined_syms.us.txt");
			let extraExterns = "";
			try {
				const allSyms = (fs.readFileSync(undefSymsPath, "utf-8") + "\n" + fs.readFileSync(undefSyms2, "utf-8"))
					.split("\n").map((l: string) => l.match(/^([A-Za-z_]\w*)/)?.[1]).filter(Boolean);
				// Get symbols already in headers (to avoid redeclaration)
				const headersContent = fs.readFileSync(path.join(ctx.cwd, "conker/include/variables.h"), "utf-8")
					+ fs.readFileSync(path.join(ctx.cwd, "conker/include/functions.h"), "utf-8");
				const headerSyms = new Set(headersContent.match(/\b[A-Z_][A-Za-z0-9_]+\b/g) || []);
				// Only include externs for symbols referenced in code AND not already in headers
				const neededSyms = allSyms.filter((s: string) => baseCode.includes(s) && !headerSyms.has(s));
				if (neededSyms.length > 0) {
					extraExterns = neededSyms.map((s: string) => `extern s32 ${s};`).join("\n") + "\n";
				}
			} catch {}

			const baseC = [
				'#include <ultra64.h>',
				'#include "functions.h"',
				'#include "variables.h"',
				'',
				extraExterns,
				baseCode,
				'',
			].join('\n');
			const baseCPath = path.join(workDir, `${params.function}_base.c`);
			fs.writeFileSync(baseCPath, baseC);

			onUpdate?.({
				content: [{ type: "text", text: `Transmuter: pre-flight compile check...` }],
				details: {},
			});

			// Iterative pre-flight compile-fix loop (up to 3 retries)
			let preflightPassed = false;
			for (let attempt = 0; attempt < 4; attempt++) {
				const pfResult = await pi.exec("bash", [
					path.join(ctx.cwd, "tools/transmuter-compile.sh"),
					baseCPath, path.join(workDir, "preflight.o"), params.function,
				], { signal, timeout: 15000 });

				if (pfResult.code === 0) {
					preflightPassed = true;
					try { fs.unlinkSync(path.join(workDir, "preflight.o")); } catch {}
					break;
				}

				const errMsg = (pfResult.stderr || pfResult.stdout || "").trim();

				// Auto-fix: redeclaration → remove the offending extern
				const redeclMatch = errMsg.match(/redeclaration of '(\w+)'/);
				if (redeclMatch) {
					const sym = redeclMatch[1];
					let src = fs.readFileSync(baseCPath, "utf-8");
					src = src.replace(new RegExp(`^extern\\s+\\w+\\s+${sym}\\s*;\\n?`, "m"), "");
					fs.writeFileSync(baseCPath, src);
					continue;
				}

				// Auto-fix: undefined symbol → add extern s32
				const undefMatch = errMsg.match(/'(\w+)' undefined/);
				if (undefMatch) {
					const sym = undefMatch[1];
					let src = fs.readFileSync(baseCPath, "utf-8");
					// Insert after the last #include line
					const lastInclude = src.lastIndexOf("#include");
					if (lastInclude >= 0) {
						const lineEnd = src.indexOf("\n", lastInclude);
						src = src.slice(0, lineEnd + 1) + `extern s32 ${sym};\n` + src.slice(lineEnd + 1);
					}
					fs.writeFileSync(baseCPath, src);
					continue;
				}

				// Auto-fix: Subscripting non-array → remove the extern (let header handle it)
				const subscriptMatch = errMsg.match(/Subscripting a non-array/);
				if (subscriptMatch) {
					// Find which extern is causing it by checking the error line
					const lineMatch = errMsg.match(/line (\d+)/);
					if (lineMatch) {
						const src = fs.readFileSync(baseCPath, "utf-8");
						const lines = src.split("\n");
						const errLine = lines[parseInt(lineMatch[1]) - 1] || "";
						// Find the array symbol being subscripted
						const arrMatch = errLine.match(/(\w+)\s*\[/);
						if (arrMatch) {
							const arrSym = arrMatch[1];
							let fixed = src.replace(new RegExp(`^extern\\s+\\w+\\s+${arrSym}\\s*;\\n?`, "m"), "");
							fs.writeFileSync(baseCPath, fixed);
							continue;
						}
					}
				}

				// Can't auto-fix — report the error
				const qEntry = state.queue.find((e) => e.function === params.function);
				if (qEntry) {
					if (!qEntry.history) qEntry.history = [];
					qEntry.history.push({
						code: baseCode,
						score: 0,
						reason: "transmuter_compile_fail",
						diffs: [`compile_error: ${errMsg.slice(0, 200)}`],
						timestamp: new Date().toISOString(),
					});
					saveQueue(ctx.cwd);
				}
				return {
					content: [{
						type: "text",
						text: `❌ Transmuter pre-flight compile failed (after ${attempt} auto-fix attempts).\n\nError:\n${errMsg}\n\nThe code doesn’t compile in isolation. Common causes:\n- Type mismatch (symbol declared as struct* in header but used as array)\n- Missing macro or typedef only available in full TU\n\nContinue iterating with decomp_attempt (full TU build) instead.`,
					}],
					details: { error: "preflight_compile_fail", message: errMsg },
				};
			}

			if (!preflightPassed) {
				return {
					content: [{ type: "text", text: `❌ Pre-flight loop exhausted without successful compile.` }],
					details: { error: "preflight_exhausted" },
				};
			}

			// Build focus constraints from prior diff data (if available)
			let constraintsArgs: string[] = [];
			const qEntryForConstraints = state.queue.find((e) => e.function === params.function);
			if (qEntryForConstraints?.history) {
				// Find the best attempt's diff lines to focus mutations there
				const bestAttempt = qEntryForConstraints.history
					.filter((h: AttemptRecord) => !h.reason?.startsWith("transmuter") && h.score > 0.5)
					.sort((a: AttemptRecord, b: AttemptRecord) => b.score - a.score)[0];
				if (bestAttempt?.diffs?.length > 0 && bestAttempt.diffs.length <= 5) {
					// Extract line numbers from diffs like "structural: target=X got=Y" at lines
					// These are assembly line numbers, not C — but we can use them to estimate focus region
					// For now, focus on the last third of the function (where most diffs occur)
					const codeLines = baseCode.split("\n").length;
					if (codeLines > 5) {
						const focusStart = Math.max(1, Math.floor(codeLines * 0.6));
						const constraintsJson = JSON.stringify({
							focusConstraints: [{
								type: "focus-region",
								id: "diff-region",
								description: `Focus mutations on the bottom of the function where diffs occur`,
								lines: { start: focusStart, end: codeLines },
								strength: 0.7,
							}],
						});
						const constraintsPath = path.join(workDir, "constraints.json");
						fs.writeFileSync(constraintsPath, constraintsJson);
						constraintsArgs = ["--constraints", constraintsPath];
					}
				}
			}

			onUpdate?.({
				content: [{ type: "text", text: `Transmuter running (IDO profile, max ${maxCompiles} compiles, ${params.timeout || 60}s timeout${constraintsArgs.length ? ", with focus constraints" : ""})...` }],
				details: {},
			});

			// Run Transmuter natively
			const transmuterCli = path.join(ctx.cwd, "tools/transmuter/packages/cli/dist/index.js");
			const compilerCmd = `${path.join(ctx.cwd, "tools/transmuter-compile.sh")} {{inputPath}} {{outputPath}} {{functionName}}`;

			const result = await pi.exec("bun", [
				transmuterCli, "match", baseCPath,
				"--target", targetOPath,
				"--function", params.function,
				"--compiler", compilerCmd,
				"--cwd", ctx.cwd,
				"--profile", "ido",
				"--max-compiles", String(maxCompiles),
				"--timeout", String(timeoutMs),
				"--no-reduce",
				"--concurrency", "4",
				...constraintsArgs,
			], { signal, timeout: timeoutMs + 15000 });

			const output = result.stdout || "";

			// Check for the output file: <function>-0.c means perfect match
			const matchFile = path.join(workDir, `${params.function}-0.c`);
			// Transmuter writes next to the SOURCE file, not workdir:
			const matchFileAlt = baseCPath.replace("_base.c", "-0.c");
			// Also check in cwd (Transmuter output location depends on version)
			const matchFileCwd = path.join(ctx.cwd, `${params.function}-0.c`);

			let winningCode = "";
			for (const mf of [matchFileCwd, matchFileAlt, matchFile]) {
				if (fs.existsSync(mf)) {
					winningCode = fs.readFileSync(mf, "utf-8");
					fs.unlinkSync(mf); // cleanup
					break;
				}
			}

			// Also check stdout for "Perfect match" indicator
			const perfectMatch = output.includes("Perfect match") || winningCode.length > 0;

			// Read session report before cleanup (contains best candidate, rule stats)
			let sessionReport: any = null;
			let bestCandidateCode = "";
			const sessionFiles = fs.readdirSync(ctx.cwd).filter((f: string) => f.startsWith("session-") && f.endsWith(".json"));
			if (sessionFiles.length > 0) {
				try {
					sessionReport = JSON.parse(fs.readFileSync(path.join(ctx.cwd, sessionFiles[0]), "utf-8"));
					// Extract best candidate source from report
					if (sessionReport?.candidates) {
						const sortedCandidates = sessionReport.candidates.sort((a: any, b: any) => a.score - b.score);
						if (sortedCandidates[0]?.source) {
							bestCandidateCode = sortedCandidates[0].source;
						}
					}
				} catch {}
			}
			for (const sf of sessionFiles) {
				try { fs.unlinkSync(path.join(ctx.cwd, sf)); } catch {}
			}

			// Parse output for score info
			const scoreFromOutput = output.match(/Score\s+\d+\s*→\s*(\d+)/);
			const initialScoreMatch = output.match(/Score\s+(\d+)\s*→/);
			const bestScore = scoreFromOutput ? parseInt(scoreFromOutput[1]) : null;
			const initialScore = initialScoreMatch ? parseInt(initialScoreMatch[1]) : null;
			const iterMatch = output.match(/Iteration[s:]?\s*(\d+)/i);
			const iters = iterMatch ? parseInt(iterMatch[1]) : null;
			const forkMatch = output.match(/(\d+)\s*forks?/i);
			const forks = forkMatch ? parseInt(forkMatch[1]) : 0;
			const compiledMatch = output.match(/(\d+)\s*compiled/i);
			const compiled = compiledMatch ? parseInt(compiledMatch[1]) : null;
			const errorsMatch = output.match(/(\d+)\s*errors/i);
			const compileErrors = errorsMatch ? parseInt(errorsMatch[1]) : null;
			const ruleMatch = output.match(/Last fork:.*?via\s+(\S+)/);
			const winningRule = ruleMatch ? ruleMatch[1] : null;
			// Extract all fork rules from output
			const allForkRules = [...(output.matchAll(/fork:\s*\d+\s*→\s*\d+\s*via\s+(\S+)/g) || [])].map(m => m[1]);

			// Log permuter result to queue.json history — FULL DETAIL like decomp_attempt
			const queueEntry = state.queue.find((e) => e.function === params.function);
			if (queueEntry) {
				if (!queueEntry.history) queueEntry.history = [];
				// Save the BEST code Transmuter found (or input if no improvement)
				const codeToLog = bestCandidateCode || (perfectMatch && winningCode ? winningCode : baseCode);
				queueEntry.history.push({
					code: codeToLog,
					score: perfectMatch ? 1.0 : (bestScore !== null ? 1 - (bestScore / 30) : 0),
					reason: perfectMatch ? "transmuter_match" : `transmuter_best=${bestScore ?? "?"}`,
					diffs: [
						`transmuter: initial=${initialScore ?? "?"}→best=${bestScore ?? "?"}, iters=${iters ?? "?"}, compiled=${compiled ?? "?"}, errors=${compileErrors ?? "?"}, forks=${forks}`,
						...(allForkRules.length > 0 ? [`fork_rules: ${[...new Set(allForkRules)].join(", ")}`] : []),
						...(winningRule ? [`last_fork_rule: ${winningRule}`] : []),
						`config: timeout=${params.timeout || 60}s, maxCompiles=${maxCompiles}, concurrency=4, profile=ido`,
						...(compiled === 0 ? ["NOTE: 0 compiled = all mutations hit compile errors. Source may have constructs incompatible with isolated compilation."] : []),
						...(compileErrors && compiled && compileErrors > compiled * 5 ? [`NOTE: high error rate (${compileErrors} errors vs ${compiled} compiled). Many mutations produce invalid code for this function.`] : []),
					],
					timestamp: new Date().toISOString(),
				});
				if (perfectMatch) queueEntry.lastScore = 1.0;
				saveQueue(ctx.cwd);
			}

			// AUTO-VERIFY: If Transmuter improved the code (or matched), try it in the full TU
			const codeToVerify = perfectMatch && winningCode
				? winningCode.replace(/^#include.*\n/gm, "").replace(/^extern.*\n/gm, "").trim()
				: (forks > 0 && bestCandidateCode)
					? bestCandidateCode.replace(/^#include.*\n/gm, "").replace(/^extern.*\n/gm, "").trim()
					: null;

			if (codeToVerify && file) {
				onUpdate?.({
					content: [{ type: "text", text: `Transmuter ${perfectMatch ? "matched" : "improved"} (score ${bestScore}). Auto-verifying in full TU...` }],
					details: {},
				});

				// Inline full-TU verification (same logic as decomp_attempt)
				const srcPath = path.join(ctx.cwd, "conker/src", file);
				const pragma = `#pragma GLOBAL_ASM("asm/nonmatchings/${file.replace(".c", "")}/${params.function}.s")`;
				let original = "";
				let tuVerified = false;

				try {
					original = fs.readFileSync(srcPath, "utf-8");
					if (original.includes(pragma)) {
						const patched = original.replace(pragma, codeToVerify);
						fs.writeFileSync(srcPath, patched);

						// Compile full TU via Docker
						const tuBuild = await pi.exec("bash", ["tools/conker-build-tu.sh", file], { signal, timeout: 60000 });

						if (tuBuild.code === 0) {
							// Diff against target
							const tuDiff = await pi.exec("bash", ["tools/conker-diff.sh", params.function, file], { signal, timeout: 30000 });
							let tuScore: any = {};
							try { tuScore = JSON.parse(tuDiff.stdout); } catch {}

							if (tuScore.match) {
								// FULL TU MATCH! Leave the patch in place for decomp_accept
								tuVerified = true;
								if (queueEntry) {
									queueEntry.lastScore = 1.0;
									saveQueue(ctx.cwd);
								}
								return {
									content: [{
										type: "text",
										text: `✅ TRANSMUTER + FULL TU VERIFIED! Score: 1.0 (match)\n\nTransmuter found code that also matches in the full translation unit!\n\`\`\`c\n${codeToVerify}\n\`\`\`\n\nCall decomp_accept to run ROM SHA gate and commit.`,
									}],
									details: { matched: true, bestScore: 0, code: codeToVerify, tuVerified: true },
								};
							}
						}
						// Full TU didn't match — revert
						fs.writeFileSync(srcPath, original);
					}
				} catch {
					// Revert on any error
					if (original) try { fs.writeFileSync(srcPath, original); } catch {}
				}
			}

			if (perfectMatch && winningCode && !codeToVerify) {
				// Fallback: Transmuter matched but we couldn't auto-verify (no file info)
				const funcCode = winningCode.replace(/^#include.*\n/gm, "").replace(/^extern.*\n/gm, "").trim();
				return {
					content: [{
						type: "text",
						text: `✅ TRANSMUTER FOUND A MATCH (score 0 in isolation)!\n\nWinning code:\n\`\`\`c\n${funcCode}\n\`\`\`\n\nRun decomp_attempt with this code to verify in full TU, then decomp_accept to commit.`,
					}],
					details: { matched: true, bestScore: 0, code: funcCode },
				};
			}

			// Build actionable diagnostic based on what happened
			const autoVerifyNote = (codeToVerify && forks > 0) ? "\n(Auto-verified in full TU: did NOT match — context-sensitivity confirmed.)" : "";
			let diagnostic = "";
			if (compiled === 0 && (iters ?? 0) > 1000) {
				diagnostic = `\n\n⚠️ DIAGNOSTIC: ${iters?.toLocaleString()} iterations but 0 successful compiles.`
					+ `\nAll mutations were deduplicated (identical source after transform). The code is too \"rigid\" for random AST mutation.`
					+ `\n→ Use decomp_attempt with a rewritten expression — Transmuter can’t help here.`
					+ `\n→ If diff is 'addu a0, X, Y' vs 'addu a0, Y, X': swap operand order in the C expression (a+b → b+a).`
					+ `\n→ If diff is register-only: reorder variable declarations or add an intermediate temp in decomp_attempt.`;
			} else if (bestScore === 1) {
				diagnostic = `\n\n🎯 SO CLOSE (score 1 = one instruction off)!`
					+ `\nTransmuter couldn’t bridge the last instruction. Likely causes:`
					+ `\n  1. Context-sensitivity (IDO allocates differently in isolation vs full TU)`
					+ `\n  2. Commutative operand order (a+b vs b+a produces different addu operand order)`
					+ `\n→ Call decomp_attempt with the operands swapped in the expression (a+b → b+a)`
					+ `\n→ Or call decomp_attempt adding a temp: \`s32 temp = offset; ptr = base + temp;\``;
			} else if (forks > 0 && bestScore !== null && bestScore > 0) {
				diagnostic = `\n\nTransmuter improved from ${initialScore} to ${bestScore} (${forks} forks).`
					+ `\nRules that helped: ${[...new Set(allForkRules)].join(", ") || "unknown"}`
					+ `\nRemaining ${bestScore} instruction differences may be context-sensitive (IDO full-TU vs isolation).`
					+ `\n→ Continue with decomp_attempt for the remaining differences.`;
			} else {
				diagnostic = `\n\nNo improvement found. Try a different structural approach before re-running.`;
			}

			return {
				content: [{
					type: "text",
					text: `Transmuter completed. Best score: ${bestScore ?? "unknown"} (iters: ${iters?.toLocaleString() ?? "?"}, compiled: ${compiled ?? "?"}, forks: ${forks})${autoVerifyNote}${diagnostic}`,
				}],
				details: { matched: false, bestScore, iterations: iters, compiled, forks },
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
	pi.registerCommand("decomp-start", {
		description: "Start the autonomous decomp loop",
		handler: async (_args, ctx) => {
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
		},
	});

	pi.registerCommand("decomp-stop", {
		description: "Stop the autonomous decomp loop after current chunk",
		handler: async (_args, ctx) => {
			loopState.enabled = false;
			loopState.status = "stopped";
			saveLoopState(ctx.cwd);
			refreshWidget();
			ctx.ui.notify("Decomp loop stopped", "info");
		},
	});

	pi.registerCommand("decomp-status", {
		description: "Show decomp loop status",
		handler: async (_args, ctx) => {
			const msg = [
				`Loop: ${loopState.enabled ? "ON" : "OFF"}`,
				`Chunk: ${loopState.chunk}`,
				`Status: ${loopState.status}`,
				`No-progress streak: ${loopState.consecutiveNoProgress}`,
				`Last: ${loopState.lastChunkSummary || "(none)"}`,
			].join(" | ");
			ctx.ui.notify(msg, "info");
		},
	});

	pi.registerCommand("decomp-reset", {
		description: "Reset decomp loop state",
		handler: async (_args, ctx) => {
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
		},
	});

	// ═══════════════════════════════════════════════════════════════
	// COMMANDS: Multi-lane coordination
	// ═══════════════════════════════════════════════════════════════
	let coordinatorProcess: any = null;

	pi.registerCommand("decomp-coord-start", {
		description: "Start the multi-lane coordinator server",
		handler: async (args, ctx) => {
			const fs = require("node:fs");
			const path = require("node:path");
			if (coordinatorProcess) {
				ctx.ui.notify("Coordinator already running", "warn");
				return;
			}
			const port = (args || "").trim() || "7700";
			const coordScript = path.join(ctx.cwd, ".pi/coordinator/src/index.ts");
			if (!fs.existsSync(coordScript)) {
				ctx.ui.notify("Coordinator not found at .pi/coordinator/", "error");
				return;
			}
			const { spawn } = require("node:child_process");
			coordinatorProcess = spawn("bun", [coordScript, "--port", port], {
				cwd: ctx.cwd,
				stdio: ["ignore", "pipe", "pipe"],
				detached: false,
			});
			coordinatorProcess.on("exit", () => { coordinatorProcess = null; });
			await new Promise((r) => setTimeout(r, 2000));
			ctx.ui.notify(`Coordinator started on port ${port}`, "info");
		},
	});

	pi.registerCommand("decomp-coord-stop", {
		description: "Stop the coordinator server",
		handler: async (_args, ctx) => {
			if (!coordinatorProcess) {
				ctx.ui.notify("No coordinator running", "warn");
				return;
			}
			coordinatorProcess.kill();
			coordinatorProcess = null;
			ctx.ui.notify("Coordinator stopped", "info");
		},
	});

	pi.registerCommand("decomp-coord-setup", {
		description: "Create N worktrees for multi-lane decomp (e.g. /decomp-coord-setup 4)",
		handler: async (args, ctx) => {
			const fs = require("node:fs");
			const path = require("node:path");
			const numLanes = parseInt((args || "").trim() || "4");
			const port = "7700";
			const worktreeDir = path.join(ctx.cwd, ".worktrees");
			fs.mkdirSync(worktreeDir, { recursive: true });

			const results: string[] = [];
			for (let i = 1; i <= numLanes; i++) {
				const laneId = `lane-${i}`;
				const laneDir = path.join(worktreeDir, laneId);
				const laneBranch = `decomp-${laneId}`;

				if (!fs.existsSync(laneDir)) {
					const wtResult = await pi.exec("git", ["worktree", "add", "-b", laneBranch, laneDir, "HEAD"]);
					if (wtResult.code !== 0) {
						await pi.exec("git", ["worktree", "add", laneDir, laneBranch]);
					}
				}

				// Symlinks (shared read-only resources)
				const symlinks: [string, string][] = [
					[path.join(ctx.cwd, "baserom.us.z64"), path.join(laneDir, "baserom.us.z64")],
					[path.join(ctx.cwd, "ido"), path.join(laneDir, "ido")],
					[path.join(ctx.cwd, "tools/ido-native"), path.join(laneDir, "tools/ido-native")],
					[path.join(ctx.cwd, "tools/transmuter"), path.join(laneDir, "tools/transmuter")],
					[path.join(ctx.cwd, "assets"), path.join(laneDir, "assets")],
				];
				fs.mkdirSync(path.join(laneDir, "tools"), { recursive: true });
				for (const [src, dest] of symlinks) {
					if (!fs.existsSync(dest) && fs.existsSync(src)) {
						fs.symlinkSync(src, dest);
					}
				}

				// Copy-on-write clone of build dir (each lane needs its own for compilation)
				const buildSrc = path.join(ctx.cwd, "conker/build");
				const buildDest = path.join(laneDir, "conker/build");
				if (!fs.existsSync(buildDest) && fs.existsSync(buildSrc)) {
					await pi.exec("cp", ["-cR", buildSrc, buildDest], { timeout: 30000 });
				}

				// Copy gitignored files needed for build
				const copyFiles: [string, string][] = [
					[path.join(ctx.cwd, "conker/conker.ld"), path.join(laneDir, "conker/conker.ld")],
					[path.join(ctx.cwd, ".baserom.us.ok"), path.join(laneDir, ".baserom.us.ok")],
					[path.join(ctx.cwd, "conker/undefined_syms_auto.txt"), path.join(laneDir, "conker/undefined_syms_auto.txt")],
				];
				for (const [src, dest] of copyFiles) {
					if (!fs.existsSync(dest) && fs.existsSync(src)) {
						fs.copyFileSync(src, dest);
					}
				}

				// Write .decomp-coordinator.json
				fs.writeFileSync(path.join(laneDir, ".decomp-coordinator.json"), JSON.stringify({
					url: `http://127.0.0.1:${port}`,
					laneId,
					masterRoot: ctx.cwd,
				}, null, 2));

				// Register with coordinator if running
				try {
					await fetch(`http://127.0.0.1:${port}/lanes/register`, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ laneId }),
					});
				} catch {}

				results.push(`✓ ${laneId}: ${laneDir}`);
			}

			ctx.ui.notify(
				`Set up ${numLanes} lanes:\n${results.join("\n")}\n\n` +
				`cd .worktrees/lane-N && pi && /decomp-start`,
				"info"
			);
		},
	});

	pi.registerCommand("decomp-coord-status", {
		description: "Show coordinator + lane status (does NOT trigger agent)",
		handler: async (_args, ctx) => {
			const port = "7700";
			try {
				const res = await fetch(`http://127.0.0.1:${port}/status`);
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				const data = await res.json() as any;
				const lanes = data.lanes || [];
				const queue = data.queue || {};

				const laneLines = lanes.map((l: any) =>
					`  ${l.id}: ${l.status}${l.currentFunction ? ` → ${l.currentFunction} (${l.currentFile})` : ""} [${l.completedCount} done]`
				).join("\n");

				// Use notify — does NOT trigger an agent turn
				ctx.ui.notify(
					`Queue: ${queue.matched} matched | ${queue.pending} pending | ${queue.claimed} claimed | ${queue.skipped} skipped\n` +
					`Patterns: ${data.patterns?.count || 0} (v${data.patterns?.version || 0})\n` +
					`Lanes:\n${laneLines || "  (none)"}`,
					"info"
				);
			} catch (e: any) {
				ctx.ui.notify(`Coordinator not reachable: ${e.message}`, "error");
			}
		},
	});

	pi.registerCommand("decomp-coord-teardown", {
		description: "Remove all lane worktrees, branches, and stop coordinator",
		handler: async (_args, ctx) => {
			const fs = require("node:fs");
			const path = require("node:path");

			// Stop coordinator if running
			if (coordinatorProcess) {
				coordinatorProcess.kill();
				coordinatorProcess = null;
			}

			const worktreeDir = path.join(ctx.cwd, ".worktrees");
			if (!fs.existsSync(worktreeDir)) {
				ctx.ui.notify("No worktrees to clean up", "info");
				return;
			}

			// Remove each worktree and its branch
			const lanes = fs.readdirSync(worktreeDir).filter((d: string) => d.startsWith("lane-"));
			for (const lane of lanes) {
				const laneDir = path.join(worktreeDir, lane);
				const branch = `decomp-${lane}`;
				await pi.exec("git", ["worktree", "remove", laneDir, "--force"]);
				await pi.exec("git", ["branch", "-D", branch]);
			}

			// Remove the .worktrees directory
			fs.rmSync(worktreeDir, { recursive: true, force: true });

			ctx.ui.notify(`Torn down ${lanes.length} lanes + coordinator`, "info");
		},
	});
}

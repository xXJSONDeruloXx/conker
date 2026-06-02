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

const MAX_HISTORY_PER_FUNC = 5;
const MAX_CODE_IN_HISTORY = 1500; // chars of C code to keep per attempt
const AUTO_SKIP_AFTER = 5; // auto-skip after this many consecutive failures

let state: DecompState = {
	queue: [],
	patterns: [],
	matched: 0,
	totalAsm: 0,
};

function loadState(cwd: string): void {
	const fs = require("node:fs");
	const path = require("node:path");

	const queuePath = path.join(cwd, ".pi/decomp/queue.json");
	const patternsPath = path.join(cwd, ".pi/decomp/patterns.json");

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

	state.matched = state.queue.filter((e) => e.status === "matched").length;
	state.totalAsm = state.queue.length;
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

	function refreshWidget() {
		const ctx = latestCtx;
		if (!ctx?.hasUI) return;

		const pending = state.queue.filter((e) => e.status === "pending").length;
		const matched = state.queue.filter((e) => e.status === "matched").length;
		const skipped = state.queue.filter((e) => e.status === "skipped").length;
		const total = state.queue.length;
		const pct = total > 0 ? ((matched / total) * 100).toFixed(1) : "0.0";

		ctx.ui.setWidget("decomp-progress", (_tui: any, theme: any) => ({
			render(width: number) {
				const bar = (percent: number, w: number) => {
					const filled = Math.round((percent / 100) * w);
					return theme.fg("success", "█".repeat(filled)) + theme.fg("dim", "░".repeat(w - filled));
				};
				const pctNum = total > 0 ? (matched / total) * 100 : 0;
				const line1 = [
					theme.fg("accent", theme.bold("◆ Conker Decomp")),
					theme.fg("success", `${matched}`),
					theme.fg("dim", "/"),
					theme.fg("muted", `${total}`),
					theme.fg("success", `(${pct}%)`),
					bar(pctNum, 12),
					theme.fg("dim", "│"),
					theme.fg("muted", `pending: ${pending}`),
					theme.fg("dim", "│"),
					theme.fg("muted", `patterns: ${state.patterns.length}`),
				].join(" ");
				return [line1];
			},
			invalidate() {},
		}));
	}

	// Load state on session start
	pi.on("session_start", async (_event, ctx) => {
		latestCtx = ctx;
		loadState(ctx.cwd);
		refreshWidget();
	});

	// Refresh widget after every agent turn completes
	pi.on("agent_end", async (_event, ctx) => {
		latestCtx = ctx;
		refreshWidget();
	});

	// ═══════════════════════════════════════════════════════════════
	// TOOL: decomp_queue
	// ═══════════════════════════════════════════════════════════════
	pi.registerTool({
		name: "decomp_queue",
		label: "Decomp Queue",
		description:
			"Manage the decompilation candidate queue. Actions: next (get next candidate with context), list (show queue stats), skip (skip current), stats (overall progress).",
		promptSnippet: "Query and manage the matching-decompilation candidate queue",
		promptGuidelines: [
			"Use decomp_queue with action 'next' to get the next function to decompile, including its target assembly and surrounding context.",
			"Use decomp_queue with action 'stats' for an overview of decomp progress.",
		],
		parameters: Type.Object({
			action: StringEnum(["next", "list", "skip", "stats", "refresh", "retry-skipped"] as const),
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

		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const fs = require("node:fs");
			const path = require("node:path");

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
			"decomp_attempt auto-reverts non-matching attempts. Only call decomp_accept after it reports match=true.",
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

			// Diff
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
							code: params.code.slice(0, MAX_CODE_IN_HISTORY),
							score: 0,
							reason: `generated ${scoreData.generated_instructions} instr for ${scoreData.target_instructions} target (${ratio.toFixed(1)}x oversized)`,
							diffs: [],
							timestamp: new Date().toISOString(),
						});
						if (entry.history.length > MAX_HISTORY_PER_FUNC) entry.history = entry.history.slice(-MAX_HISTORY_PER_FUNC);
						if (entry.attempts >= AUTO_SKIP_AFTER) entry.status = "skipped";
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
					code: params.code.slice(0, MAX_CODE_IN_HISTORY),
					score: scoreData.score || 0,
					reason: scoreData.reason || "unknown",
					diffs: (scoreData.diffs || []).slice(0, 5).map((d: any) => `${d.type}: target=${d.target} got=${d.generated}`),
					timestamp: new Date().toISOString(),
				});
				// Keep only last N attempts
				if (entry.history.length > MAX_HISTORY_PER_FUNC) {
					entry.history = entry.history.slice(-MAX_HISTORY_PER_FUNC);
				}

				// Auto-skip after too many failures
				if (entry.attempts >= AUTO_SKIP_AFTER && entry.status === "pending") {
					entry.status = "skipped";
				}
			}

			// Revert source
			fs.writeFileSync(srcPath, original);
			saveQueue(ctx.cwd);
			latestCtx = ctx;
			refreshWidget();

			// Commit the queue with history on skip (findings for future work)
			if (entry?.status === "skipped") {
				await pi.exec("git", ["add", ".pi/decomp/queue.json"]);
				await pi.exec("git", ["commit", "-m", `chore(decomp): skip ${params.function} after ${entry.attempts} attempts (best: ${entry.lastScore.toFixed(2)})`]);
				await pi.exec("git", ["push"]);
			}

			// Build response with prior attempt context
			const autoSkipped = entry?.status === "skipped" ? "\n\n⚠️ AUTO-SKIPPED after 5 failures. Moving to next candidate." : "";
			const priorHint = (entry?.history?.length ?? 0) > 1
				? `\n\nPrior attempts (${entry!.history!.length}): scores=[${entry!.history!.map((h: AttemptRecord) => h.score.toFixed(2)).join(", ")}]`
				: "";

			return {
				content: [
					{
						type: "text",
						text: `✗ Non-match (reverted). Score: ${scoreData.score}\nReason: ${scoreData.reason}\n\nDiff:\n${diffSummary}${priorHint}${autoSkipped}`,
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

			// Commit source + queue state (preserves history of what was tried) and push
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
}

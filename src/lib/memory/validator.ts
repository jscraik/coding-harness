/**
 * Memory policy validator
 *
 * Validates memory summaries against schema and workflow discipline.
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { validatePath } from "../input/validator.js";
import { enforceCodexBranch } from "./branch-enforcer.js";
import {
	calculateTrends,
	loadMetrics,
	saveMetrics,
	updateMetrics,
} from "./metrics-tracker.js";
import {
	EXIT_CODES,
	type MemoryEntry,
	type MemoryGateOptions,
	type MemoryGateResult,
	type MemorySummary,
	type ReliabilityMetrics,
	type ViolationsResult,
	isValidMemoryEntry,
	validateMemorySummary,
} from "./types.js";

/**
 * Read and parse memory.json file
 */
const MAX_MEMORY_FILE_SIZE_BYTES = 1024 * 1024; // 1 MiB

function readMemoryFile(memoryPath: string): MemorySummary | null {
	try {
		if (!existsSync(memoryPath)) {
			return null;
		}

		// Reject non-regular files (FIFOs, devices, sockets) and oversized files
		// to prevent synchronous readFileSync from hanging or exhausting memory.
		const stats = statSync(memoryPath);
		if (!stats.isFile() || stats.size > MAX_MEMORY_FILE_SIZE_BYTES) {
			return null;
		}

		const content = readFileSync(memoryPath, "utf-8");
		return JSON.parse(content) as MemorySummary;
	} catch {
		return null;
	}
}

/**
 * Validate individual memory entries with detailed errors
 */
function validateEntries(entries: unknown[]): {
	valid: boolean;
	errors: string[];
} {
	const errors: string[] = [];

	for (let i = 0; i < entries.length; i++) {
		const entry = entries[i];
		if (!isValidMemoryEntry(entry)) {
			errors.push(`entries[${i}]: Invalid memory entry structure`);
			continue;
		}

		// Additional validation beyond type guard
		const e = entry as MemoryEntry;
		if (e.content.length > 2000) {
			errors.push(
				`entries[${i}].content: Exceeds maximum length of 2000 characters`,
			);
		}
	}

	return { valid: errors.length === 0, errors };
}

/**
 * Check read-first preamble compliance
 */
function validatePreamble(summary: MemorySummary): ViolationsResult {
	const violations: string[] = [];

	if (!summary.preamble.bootstrap) {
		violations.push("Missing required bootstrap() call before memory capture");
	}
	if (!summary.preamble.search) {
		violations.push("Missing required search() call before memory capture");
	}

	return {
		valid: violations.length === 0,
		violations,
	};
}

/**
 * Check write-discipline (no raw dumps, no speculative content)
 */
function validateWriteDiscipline(summary: MemorySummary): ViolationsResult {
	const violations: string[] = [];

	for (const entry of summary.entries) {
		// Check for raw command dumps (indicated by long content with command patterns)
		if (entry.content.length > 500 && /^(\$ |>|\[.*\])/.test(entry.content)) {
			violations.push(
				`Entry appears to be raw command dump: "${entry.content.slice(0, 50)}..."`,
			);
		}

		// Check for speculative content (keywords indicating uncertainty)
		const speculativeWords = [
			"maybe",
			"perhaps",
			"might be",
			"could be",
			"possibly",
		];
		const lowerContent = entry.content.toLowerCase();
		if (
			speculativeWords.some((w) => lowerContent.includes(w)) &&
			entry.level === "learning"
		) {
			violations.push(
				`Learning entry contains speculative language: "${entry.content.slice(0, 50)}..."`,
			);
		}

		// Check for session-specific noise
		if (
			entry.content.includes("debugging") &&
			entry.content.includes("session")
		) {
			violations.push(
				`Entry appears to be session debugging noise: "${entry.content.slice(0, 50)}..."`,
			);
		}
	}

	return { valid: violations.length === 0, violations };
}

/**
 * Check closeout completeness via FORJAMIE.md
 */
function validateCloseout(
	summary: MemorySummary,
	forjamiePath: string,
): ViolationsResult {
	const violations: string[] = [];

	if (!summary.closeout.forjamie_updated) {
		violations.push("FORJAMIE.md update flag not set in closeout");
	}

	// Validate closeout date is a valid ISO date
	const closeoutTime = new Date(summary.closeout.date);
	if (Number.isNaN(closeoutTime.getTime())) {
		violations.push("Closeout date is invalid (not a valid ISO date)");
		return { valid: false, violations };
	}

	// Verify FORJAMIE.md exists and is recent
	try {
		if (!existsSync(forjamiePath)) {
			violations.push(`FORJAMIE.md not found at ${forjamiePath}`);
		} else {
			const stats = statSync(forjamiePath);
			const modifiedTime = stats.mtime;

			// FORJAMIE.md should be modified at or after closeout date
			if (modifiedTime < closeoutTime) {
				violations.push(
					"FORJAMIE.md not updated since closeout (stale closeout)",
				);
			}
		}
	} catch (error: unknown) {
		violations.push(`Cannot read FORJAMIE.md: ${(error as Error).message}`);
	}

	return { valid: violations.length === 0, violations };
}

/**
 * Calculate reliability metrics from memory summary
 */
function calculateMetrics(summary: MemorySummary): ReliabilityMetrics {
	const toolErrors: Record<string, number> = {};
	let duplicateMemoryCount = 0;
	const contentSet = new Set<string>();

	for (const entry of summary.entries) {
		// Detect duplicate content
		if (contentSet.has(entry.content)) {
			duplicateMemoryCount++;
		} else {
			contentSet.add(entry.content);
		}

		// Count tool errors mentioned in content
		if (entry.content.toLowerCase().includes("error")) {
			const match = entry.content.match(/(\w+)\s+error/i);
			if (match?.[1]) {
				const tool = match[1].toLowerCase();
				toolErrors[tool] = (toolErrors[tool] || 0) + 1;
			}
		}
	}

	// Calculate pass^k (consecutive successful operations)
	const passK = summary.entries.filter(
		(e) => e.level === "learning" && !e.content.toLowerCase().includes("fail"),
	).length;

	return {
		pass_k: passK,
		total_ops: summary.entries.length,
		successful_ops: passK,
		tool_errors: toolErrors,
		duplicate_memory_count: duplicateMemoryCount,
		unresolved_questions: [], // Would need external tracking
	};
}

/**
 * Collect memory validation violations across all checks.
 *
 * @returns Object with violations array and parsed summary (null if schema validation fails)
 */
function collectMemoryViolations(
	data: unknown,
	forjamiePath: string,
): {
	violations: MemoryGateResult["violations"];
	summary: MemorySummary | null;
} {
	const violations: MemoryGateResult["violations"] = [];

	// 1. Schema validation
	const schemaResult = validateMemorySummary(data);
	if (!schemaResult.valid) {
		for (const error of schemaResult.errors) {
			violations.push({
				type: "schema",
				message: `${error.path}: ${error.message}`,
			});
		}
		return { violations, summary: null };
	}

	const summary = schemaResult.data as MemorySummary;

	// 2. Validate individual entries
	const entriesResult = validateEntries(summary.entries);
	if (!entriesResult.valid) {
		for (const error of entriesResult.errors) {
			violations.push({ type: "schema", message: error });
		}
	}

	// 3. Read-first preamble check
	const preambleResult = validatePreamble(summary);
	if (!preambleResult.valid) {
		for (const v of preambleResult.violations) {
			violations.push({ type: "preamble", message: v });
		}
	}

	// 4. Write-discipline check
	const disciplineResult = validateWriteDiscipline(summary);
	if (!disciplineResult.valid) {
		for (const v of disciplineResult.violations) {
			violations.push({ type: "discipline", message: v });
		}
	}

	// 5. Codex branch enforcement (if applicable)
	const codexOptions: { forjamiePath?: string } = {};
	if (forjamiePath) codexOptions.forjamiePath = forjamiePath;
	const codexResult = enforceCodexBranch(codexOptions);
	if (codexResult.isCodexBranch && !codexResult.valid) {
		for (const v of codexResult.violations) {
			violations.push({ type: "discipline", message: `[codex] ${v.message}` });
		}
	}

	// 6. Closeout validation
	const closeoutResult = validateCloseout(summary, forjamiePath);
	if (!closeoutResult.valid) {
		for (const v of closeoutResult.violations) {
			violations.push({ type: "closeout", message: v });
		}
	}

	return { violations, summary };
}

function determineMemoryExitCode(
	violations: MemoryGateResult["violations"],
): number {
	if (violations.length === 0) {
		return EXIT_CODES.SUCCESS;
	}
	if (violations.some((v) => v.type === "schema")) {
		return EXIT_CODES.SCHEMA_VIOLATION;
	}
	if (violations.some((v) => v.type === "preamble")) {
		return EXIT_CODES.MISSING_PREAMBLE;
	}
	if (violations.some((v) => v.type === "discipline")) {
		return EXIT_CODES.WRITE_DISCIPLINE_ERROR;
	}
	if (violations.some((v) => v.type === "closeout")) {
		return EXIT_CODES.CLOSEOUT_INCOMPLETE;
	}
	return EXIT_CODES.SUCCESS;
}

/**
 * Validate a repository memory file and produce a pass/fail result with metrics and violations.
 *
 * Performs path resolution for the memory and FORJAMIE files, reads and validates the memory
 * data against schema and workflow rules, and computes reliability metrics.
 *
 * @param options - Validation options. `memoryPath` defaults to `"memory.json"` and `forjamiePath` defaults to `"FORJAMIE.md"`.
 * @returns The validation result containing:
 *  - `ok`: whether no violations were found,
 *  - `code`: an exit code categorizing the outcome,
 *  - `message`: a short human-readable summary,
 *  - `violations`: an array of detected validation issues,
 *  - `metrics` (when available): aggregated reliability metrics computed from the memory summary.
 */
export function runMemoryGate(options: MemoryGateOptions): MemoryGateResult {
	const baseDir = process.cwd();
	let memoryPath: string;
	let forjamiePath: string;

	try {
		const memoryCandidate = options.memoryPath ?? "memory.json";
		const forjamieCandidate = options.forjamiePath ?? "FORJAMIE.md";

		// Absolute paths are resolved as-is (direct invocation); relative paths
		// are validated to stay within the repository working directory.
		memoryPath = isAbsolute(memoryCandidate)
			? resolve(memoryCandidate)
			: validatePath(baseDir, memoryCandidate);
		forjamiePath = isAbsolute(forjamieCandidate)
			? resolve(forjamieCandidate)
			: validatePath(baseDir, forjamieCandidate);
	} catch {
		return {
			ok: false,
			code: EXIT_CODES.SYSTEM_ERROR,
			message: "Invalid file path: path escapes repository",
			violations: [
				{ type: "schema", message: "Invalid file path: outside repository" },
			],
		};
	}

	// Read memory file
	const data = readMemoryFile(memoryPath);
	if (!data) {
		return {
			ok: false,
			code: EXIT_CODES.SYSTEM_ERROR,
			message: `Cannot read memory file: ${memoryPath}`,
			violations: [
				{ type: "schema", message: "Memory file not found or unreadable" },
			],
		};
	}

	const { violations, summary } = collectMemoryViolations(data, forjamiePath);

	if (!summary) {
		return {
			ok: false,
			code: EXIT_CODES.SCHEMA_VIOLATION,
			message: "Schema validation failed",
			violations,
		};
	}

	const code = determineMemoryExitCode(violations);
	const metrics = calculateMetrics(summary);

	return {
		ok: violations.length === 0,
		code,
		message:
			violations.length === 0
				? "Memory artifacts valid and compliant"
				: `Validation failed: ${violations.length} violations`,
		violations,
		metrics,
	};
}

/**
 * Run the memory gate in CLI mode and emit formatted output for humans or JSON.
 *
 * Loads historical metrics, executes validation, updates and persists
 * metrics/history when possible, computes trends, detects Codex branch status,
 * and prints either a structured JSON object or human-readable output.
 *
 * Human success output prints entry totals and duplicate counts; reliability
 * score and trend details are printed when validation fails.
 *
 * @param options - Configuration for paths and output flags.
 * @returns The process exit code for the validation result.
 */
export function runMemoryGateCLI(options: MemoryGateOptions): number {
	// Load historical metrics
	const { metrics: previousMetrics, history } = loadMetrics(
		options.metricsPath,
	);

	const result = runMemoryGate(options);

	// Update and save metrics
	const updatedMetrics = updateMetrics(previousMetrics, {
		success: result.ok,
		entryCount: result.metrics?.total_ops ?? 0,
		...(result.metrics?.tool_errors && {
			toolErrors: result.metrics.tool_errors,
		}),
		...(result.metrics?.duplicate_memory_count !== undefined && {
			duplicates: result.metrics.duplicate_memory_count,
		}),
	});

	// Save metrics with error handling (e.g., EISDIR if path is a directory)
	let updatedHistory = history;
	try {
		saveMetrics(updatedMetrics, history, options.metricsPath);
		// After saving, create updated history for trend calculation
		updatedHistory = [
			...history.slice(-99),
			{
				date: new Date().toISOString(),
				metrics: { ...updatedMetrics },
			},
		];
	} catch {
		// Continue even if metrics persistence fails
	}

	// Calculate trends from updated history
	const trends = calculateTrends(updatedHistory);

	// Detect codex branch for display
	const codexResult = enforceCodexBranch({
		...(options.forjamiePath && { forjamiePath: options.forjamiePath }),
	});

	if (options.json) {
		const jsonOutput = {
			...result,
			metrics: updatedMetrics,
			trends,
			codex: codexResult.isCodexBranch
				? { branch: codexResult.branch, taskId: codexResult.taskId }
				: undefined,
		};
		console.log(JSON.stringify(jsonOutput, null, 2));
	} else {
		// Show branch info for codex branches
		if (codexResult.isCodexBranch) {
			console.log(`🔷 Codex branch detected: ${codexResult.branch}`);
			if (codexResult.taskId) {
				console.log(`   Task: ${codexResult.taskId}`);
			}
			console.log();
		}

		if (result.ok) {
			console.log("✓ Memory artifacts valid and compliant");
			if (updatedMetrics) {
				console.log("\n📊 Metrics:");
				console.log(`  Pass^k: ${updatedMetrics.pass_k}`);
				console.log(`  Total entries: ${updatedMetrics.total_ops}`);
				if (updatedMetrics.duplicate_memory_count > 0) {
					console.log(
						`  ⚠ Duplicates: ${updatedMetrics.duplicate_memory_count}`,
					);
				}
			}
		} else {
			console.error(`✗ ${result.message}`);
			if (result.violations.length > 0) {
				console.error("\nViolations:");
				for (const v of result.violations) {
					console.error(`  [${v.type}] ${v.message}`);
				}
			}
			console.log(`  Reliability: ${trends.reliability_score.toFixed(1)}%`);
			if (trends.pass_k_trend !== "stable") {
				const trendIcon = trends.pass_k_trend === "improving" ? "📈" : "📉";
				console.log(`  ${trendIcon} Pass^k trend: ${trends.pass_k_trend}`);
			}
		}
	}

	return result.code;
}

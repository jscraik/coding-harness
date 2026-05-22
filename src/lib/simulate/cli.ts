/**
 * Simulate command
 *
 * Runs deterministic counterfactual analysis for policy changes
 * against historical telemetry and replay traces.
 *
 * V1 output is advisory only:
 * - Machine-readable simulation report
 * - Human-readable markdown summary
 * - Policy edit suggestions as non-binding hints
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { loadContract } from "../contract/loader.js";
import type { HarnessContract } from "../contract/types.js";
import { PathTraversalError, validatePath } from "../input/validator.js";
import {
	type CounterfactualSimulationReport,
	SIMULATE_EXIT_CODES,
	SIMULATION_SCHEMA_VERSION,
	type SimulateOptions,
	type SimulateResult,
	type SimulationInputs,
	type SimulationWindow,
} from "./types.js";
import {
	assessDataQuality,
	computeConfidence,
	computeContractHash,
	computeDeltas,
	computeMetrics,
	readArtifactManifests,
	readTraceFiles,
} from "./analysis.js";
import { buildSimulateOptionsFromCliArgs } from "./cli-args.js";
import { determineFlags, generateRecommendations } from "./recommendations.js";

// ============================================================================
// HELP TEXT
// ============================================================================

/**
 * Print usage information for simulate command.
 */
export function printSimulateUsage(): void {
	console.info(
		"Usage: harness simulate --contract-a <path> --contract-b <path> [options]",
	);
	console.info("");
	console.info(
		"Compare two policy contracts and simulate outcomes against historical data.",
	);
	console.info("");
	console.info("Required:");
	console.info("  --contract-a <path>   Path to baseline contract file");
	console.info("  --contract-b <path>   Path to candidate contract file");
	console.info("");
	console.info("Options:");
	console.info(
		"  --artifacts <path>    Directory containing pilot artifacts (default: ./artifacts/pilot)",
	);
	console.info(
		"  --traces <path>       Directory containing replay traces (default: ./.traces)",
	);
	console.info(
		"  --output <path>       Output file for JSON report (default: stdout)",
	);
	console.info(
		"  --json                Output as JSON (suppresses human-readable output)",
	);
	console.info(
		"  --ci-soft             CI soft mode (non-blocking exit codes)",
	);
	console.info("  --verbose             Show detailed analysis");
	console.info("  -h, --help            Show this help message");
	console.info("");
	console.info("Exit Codes:");
	console.info("  0   Success");
	console.info("  1   Validation error");
	console.info("  2   Input not found");
	console.info("  3   Input too large");
	console.info("  10  System error");
	console.info("");
	console.info("Examples:");
	console.info("  # Compare two contracts");
	console.info(
		"  harness simulate --contract-a baseline.json --contract-b candidate.json",
	);
	console.info("");
	console.info("  # CI integration with JSON output");
	console.info(
		"  harness simulate --contract-a baseline.json --contract-b candidate.json --json > report.json",
	);
	console.info("");
	console.info("  # Non-blocking CI mode");
	console.info(
		"  harness simulate --contract-a baseline.json --contract-b candidate.json --ci-soft",
	);
}

/** Run simulate from raw command-line arguments. */
export function runSimulateFromCliArgs(args: string[]): number {
	if (args.includes("--help") || args.includes("-h")) {
		printSimulateUsage();
		return 0;
	}

	const parsed = buildSimulateOptionsFromCliArgs(args);
	if (!parsed.ok) {
		console.error(parsed.message);
		return 2;
	}

	return runSimulateCLI(parsed.options);
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate simulation options.
 */
type SimulateValidationResult =
	| { ok: true }
	| { ok: false; error: { code: string; message: string }; exitCode: number };

/**
 * Validates CLI options for the `harness simulate` command and enforces filesystem safety.
 *
 * Performs presence checks for required contract paths, verifies that specified paths (contracts,
 * artifacts, traces, output) do not escape the current working directory (symlink-aware), and
 * confirms existence of required files/directories. Validation failures are returned as structured
 * errors with a machine-readable `code`, human `message`, and a numeric `exitCode`.
 *
 * @param options - Simulation CLI options to validate (contracts, optional artifacts/traces/output paths)
 * @returns `{ ok: true }` when all checks pass. On failure returns `{ ok: false, error: { code, message }, exitCode }`
 * where `code` is one of the validation error codes (e.g. `E_MISSING_CONTRACT_A`, `E_PATH_TRAVERSAL`,
 * `E_INVALID_PATH`, `E_CONTRACT_A_NOT_FOUND`, `E_ARTIFACTS_NOT_FOUND`, `E_TRACES_NOT_FOUND`) and
 * `exitCode` is either `SIMULATE_EXIT_CODES.VALIDATION_ERROR` or `SIMULATE_EXIT_CODES.INPUT_NOT_FOUND` depending on the failure.
 */

/**
 * Validate a required contract file path.
 */
function validateContractFile(
	path: string | undefined,
	missingCode: string,
	missingMessage: string,
	notFoundCode: string,
	label: string,
	cwd: string,
): SimulateValidationResult {
	if (!path) {
		return {
			ok: false,
			error: { code: missingCode, message: missingMessage },
			exitCode: SIMULATE_EXIT_CODES.VALIDATION_ERROR,
		};
	}
	try {
		validatePath(cwd, path);
	} catch (e) {
		if (e instanceof PathTraversalError) {
			return {
				ok: false,
				error: {
					code: "E_PATH_TRAVERSAL",
					message: `${label} path escapes working directory: ${path}`,
				},
				exitCode: SIMULATE_EXIT_CODES.VALIDATION_ERROR,
			};
		}
		return {
			ok: false,
			error: {
				code: "E_INVALID_PATH",
				message: `Invalid ${label.toLowerCase()} path: ${e instanceof Error ? e.message : "Unknown error"}`,
			},
			exitCode: SIMULATE_EXIT_CODES.VALIDATION_ERROR,
		};
	}
	if (!existsSync(resolve(path))) {
		return {
			ok: false,
			error: {
				code: notFoundCode,
				message: `${label} file not found: ${resolve(path)}`,
			},
			exitCode: SIMULATE_EXIT_CODES.INPUT_NOT_FOUND,
		};
	}
	return { ok: true };
}

/**
 * Validate an optional directory path.
 */
function validateOptionalDir(
	dir: string | undefined,
	notFoundCode: string,
	label: string,
	cwd: string,
): SimulateValidationResult {
	if (!dir) return { ok: true };
	try {
		validatePath(cwd, dir);
	} catch (e) {
		return {
			ok: false,
			error: {
				code: "E_INVALID_PATH",
				message: `Invalid ${label.toLowerCase()} directory: ${e instanceof Error ? e.message : "Unknown error"}`,
			},
			exitCode: SIMULATE_EXIT_CODES.VALIDATION_ERROR,
		};
	}
	if (!existsSync(resolve(dir))) {
		return {
			ok: false,
			error: {
				code: notFoundCode,
				message: `${label} directory not found: ${resolve(dir)}`,
			},
			exitCode: SIMULATE_EXIT_CODES.INPUT_NOT_FOUND,
		};
	}
	return { ok: true };
}

/**
 * Validate an optional output file path.
 */
function validateOutputPath(
	outputPath: string | undefined,
	cwd: string,
): SimulateValidationResult {
	if (!outputPath) return { ok: true };
	try {
		validatePath(cwd, outputPath);
	} catch (e) {
		if (e instanceof PathTraversalError) {
			return {
				ok: false,
				error: {
					code: "E_PATH_TRAVERSAL",
					message: `Output path escapes working directory: ${outputPath}`,
				},
				exitCode: SIMULATE_EXIT_CODES.VALIDATION_ERROR,
			};
		}
		return {
			ok: false,
			error: {
				code: "E_INVALID_PATH",
				message: `Invalid output path: ${e instanceof Error ? e.message : "Unknown error"}`,
			},
			exitCode: SIMULATE_EXIT_CODES.VALIDATION_ERROR,
		};
	}
	return { ok: true };
}
function validateOptions(options: SimulateOptions): SimulateValidationResult {
	const cwd = process.cwd();

	const contractA = validateContractFile(
		options.contractA,
		"E_MISSING_CONTRACT_A",
		"Contract A path required (--contract-a)",
		"E_CONTRACT_A_NOT_FOUND",
		"Contract A",
		cwd,
	);
	if (!contractA.ok) return contractA;

	const contractB = validateContractFile(
		options.contractB,
		"E_MISSING_CONTRACT_B",
		"Contract B path required (--contract-b)",
		"E_CONTRACT_B_NOT_FOUND",
		"Contract B",
		cwd,
	);
	if (!contractB.ok) return contractB;

	const artifacts = validateOptionalDir(
		options.artifactsDir,
		"E_ARTIFACTS_NOT_FOUND",
		"Artifacts",
		cwd,
	);
	if (!artifacts.ok) return artifacts;

	const traces = validateOptionalDir(
		options.tracesDir,
		"E_TRACES_NOT_FOUND",
		"Traces",
		cwd,
	);
	if (!traces.ok) return traces;

	const output = validateOutputPath(options.outputPath, cwd);
	if (!output.ok) return output;

	return { ok: true };
}

// ============================================================================
// MAIN SIMULATION RUNNER
// ============================================================================

/**
 * Run counterfactual policy simulation.
 */

/**
 * Load both contracts safely, returning a structured error on failure.
 */
function loadContractsSafely(
	options: SimulateOptions,
):
	| { ok: true; contractA: HarnessContract; contractB: HarnessContract }
	| { ok: false; result: SimulateResult } {
	let contractA: HarnessContract;
	let contractB: HarnessContract;
	try {
		contractA = loadContract(options.contractA);
	} catch (e) {
		return {
			ok: false,
			result: {
				ok: false,
				error: {
					code: "E_CONTRACT_A_LOAD_FAILED",
					message: `Failed to load contract A: ${e instanceof Error ? e.message : "Unknown error"}`,
				},
				exitCode: SIMULATE_EXIT_CODES.VALIDATION_ERROR,
			},
		};
	}
	try {
		contractB = loadContract(options.contractB);
	} catch (e) {
		return {
			ok: false,
			result: {
				ok: false,
				error: {
					code: "E_CONTRACT_B_LOAD_FAILED",
					message: `Failed to load contract B: ${e instanceof Error ? e.message : "Unknown error"}`,
				},
				exitCode: SIMULATE_EXIT_CODES.VALIDATION_ERROR,
			},
		};
	}
	return { ok: true, contractA, contractB };
}

/**
 * Run deterministic counterfactual policy simulation between two contracts.
 *
 * @param options - CLI options including baseline/candidate contract paths and optional artifact/trace/output controls
 * @returns A structured simulation result with report payload on success, or a typed validation/runtime error on failure
 */
export function runSimulate(options: SimulateOptions): SimulateResult {
	const startTime = Date.now();

	const validation = validateOptions(options);
	if (!validation.ok) {
		return validation;
	}

	const contracts = loadContractsSafely(options);
	if (!contracts.ok) {
		return contracts.result;
	}
	const { contractA, contractB } = contracts;

	const artifactsDir = options.artifactsDir
		? resolve(options.artifactsDir)
		: resolve("./artifacts/pilot");
	const tracesDir = options.tracesDir
		? resolve(options.tracesDir)
		: resolve("./.traces");

	const contractAHash = computeContractHash(contractA);
	const contractBHash = computeContractHash(contractB);

	const inputs: SimulationInputs = {
		contractBaseline: resolve(options.contractA),
		contractCandidate: resolve(options.contractB),
		artifactsDir,
		tracesDir,
		contractBaselineHash: contractAHash,
		contractCandidateHash: contractBHash,
	};

	const now = new Date();
	const windowStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
	const window: SimulationWindow = {
		start: windowStart.toISOString(),
		end: now.toISOString(),
	};

	const dataQuality = assessDataQuality(
		contractA,
		contractB,
		options.artifactsDir,
		options.tracesDir,
	);
	const metrics = computeMetrics(contractA, contractB, dataQuality);
	const deltas = computeDeltas(contractA, contractB);
	const confidence = computeConfidence(dataQuality);
	const recommendations = generateRecommendations(metrics, deltas, confidence);
	const flags = determineFlags(dataQuality, metrics);

	const report: CounterfactualSimulationReport = {
		schemaVersion: SIMULATION_SCHEMA_VERSION,
		generatedAt: new Date().toISOString(),
		durationMs: Date.now() - startTime,
		inputs,
		window,
		summary: {
			scenariosEvaluated: deltas.summary.total,
			sufficientDataCount: dataQuality.effectiveSampleSize,
			tracesProcessed: readTraceFiles(
				options.tracesDir ? resolve(options.tracesDir) : resolve("./.traces"),
			).traceCount,
			artifactsProcessed: readArtifactManifests(
				options.artifactsDir
					? resolve(options.artifactsDir)
					: resolve("./artifacts/agent-runs"),
			).fileCount,
		},
		dataQuality,
		metrics,
		deltas,
		recommendations,
		confidence,
		flags,
	};

	if (options.outputPath) {
		const outputPath = resolve(options.outputPath);
		const dir = dirname(outputPath);
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true });
		}
		writeFileSync(outputPath, JSON.stringify(report, null, 2), "utf-8");
	}

	return {
		ok: true,
		report,
		exitCode: SIMULATE_EXIT_CODES.SUCCESS,
	};
}

// ============================================================================
// CLI ENTRY POINT
// ============================================================================

/**
 * CLI entry point for simulate command.
 */
export function runSimulateCLI(options: SimulateOptions): number {
	const result = runSimulate(options);

	if (!result.ok) {
		if (options.json) {
			console.error(JSON.stringify({ error: result.error }, null, 2));
		} else {
			console.error(`✗ ${result.error?.message ?? "Unknown error"}`);
		}
		return result.exitCode;
	}

	// TypeScript knows result.report exists here because ok is true
	const report = result.report;

	if (options.json) {
		console.info(JSON.stringify(report, null, 2));
	} else {
		// Human-readable output
		printHumanReadableSummary(report, options.verbose ?? false);
	}

	// In CI soft mode, always return success
	if (options.ciSoft) {
		return SIMULATE_EXIT_CODES.SUCCESS;
	}

	return result.exitCode;
}

/**
 * Print human-readable summary of simulation report.
 */
function printHumanReadableSummary(
	report: CounterfactualSimulationReport,
	verbose: boolean,
): void {
	const confidenceIcon =
		report.confidence.level === "high"
			? "✓"
			: report.confidence.level === "medium"
				? "⚠"
				: report.confidence.level === "low"
					? "?"
					: "✗";

	const confidenceColor =
		report.confidence.level === "high"
			? "\x1b[32m"
			: report.confidence.level === "medium"
				? "\x1b[33m"
				: "\x1b[31m";

	console.info(
		`${confidenceColor}${confidenceIcon} Simulation: ${report.confidence.level.toUpperCase()} (${report.confidence.score}/5)\x1b[0m`,
	);
	console.info("");
	console.info("📄 Contracts:");
	console.info(
		`  A: ${report.inputs.contractBaseline} (${report.inputs.contractBaselineHash})`,
	);
	console.info(
		`  B: ${report.inputs.contractCandidate} (${report.inputs.contractCandidateHash})`,
	);
	console.info("");
	console.info("📊 Metrics:");
	console.info(
		`  Prevented Risk: ${report.metrics.preventedRisk.delta >= 0 ? "+" : ""}${report.metrics.preventedRisk.delta.toFixed(2)}`,
	);
	console.info(
		`  False Block Rate: ${report.metrics.falseBlockRate.delta >= 0 ? "+" : ""}${(report.metrics.falseBlockRate.delta * 100).toFixed(1)}%`,
	);
	console.info(
		`  Lead Time Delta: ${report.metrics.leadTimeDelta.delta >= 0 ? "+" : ""}${report.metrics.leadTimeDelta.delta.toFixed(1)}h`,
	);
	console.info("");

	if (report.recommendations.length > 0) {
		console.info("💡 Recommendations:");
		for (const rec of report.recommendations) {
			console.info(`  [${rec.severity.toUpperCase()}] ${rec.title}`);
			if (verbose) {
				console.info(`    ${rec.rationale}`);
			}
		}
		console.info("");
	}

	if (report.flags.length > 0) {
		console.info("🚩 Flags:");
		for (const flag of report.flags) {
			console.info(`  - ${flag}`);
		}
		console.info("");
	}

	console.info(`⏱ Duration: ${report.durationMs}ms`);
}

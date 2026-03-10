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

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { loadContract } from "../lib/contract/loader.js";
import type { HarnessContract } from "../lib/contract/types.js";
import { PathTraversalError, validatePath } from "../lib/input/validator.js";
import {
	CONFIDENCE_SCORES,
	type ConfidenceAssessment,
	type CounterfactualSimulationReport,
	type DataQualityAssessment,
	type DecisionDelta,
	type DeltaSummary,
	SIMULATE_EXIT_CODES,
	SIMULATION_SCHEMA_VERSION,
	type SimulateOptions,
	type SimulateResult,
	type SimulationFlag,
	type SimulationInputs,
	type SimulationMetrics,
	type SimulationRecommendation,
	type SimulationWindow,
} from "../lib/simulate/types.js";

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

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate simulation options.
 */
function validateOptions(options: SimulateOptions): SimulateResult {
	const cwd = process.cwd();

	// Validate contract A
	if (!options.contractA) {
		return {
			ok: false,
			error: {
				code: "E_MISSING_CONTRACT_A",
				message: "Contract A path required (--contract-a)",
			},
			exitCode: SIMULATE_EXIT_CODES.VALIDATION_ERROR,
		};
	}

	// Validate contract B
	if (!options.contractB) {
		return {
			ok: false,
			error: {
				code: "E_MISSING_CONTRACT_B",
				message: "Contract B path required (--contract-b)",
			},
			exitCode: SIMULATE_EXIT_CODES.VALIDATION_ERROR,
		};
	}

	// Validate paths stay within cwd (symlink-aware)
	try {
		validatePath(cwd, options.contractA);
	} catch (e) {
		if (e instanceof PathTraversalError) {
			return {
				ok: false,
				error: {
					code: "E_PATH_TRAVERSAL",
					message: `Contract A path escapes working directory: ${options.contractA}`,
				},
				exitCode: SIMULATE_EXIT_CODES.VALIDATION_ERROR,
			};
		}
		return {
			ok: false,
			error: {
				code: "E_INVALID_PATH",
				message: `Invalid contract A path: ${e instanceof Error ? e.message : "Unknown error"}`,
			},
			exitCode: SIMULATE_EXIT_CODES.VALIDATION_ERROR,
		};
	}

	try {
		validatePath(cwd, options.contractB);
	} catch (e) {
		if (e instanceof PathTraversalError) {
			return {
				ok: false,
				error: {
					code: "E_PATH_TRAVERSAL",
					message: `Contract B path escapes working directory: ${options.contractB}`,
				},
				exitCode: SIMULATE_EXIT_CODES.VALIDATION_ERROR,
			};
		}
		return {
			ok: false,
			error: {
				code: "E_INVALID_PATH",
				message: `Invalid contract B path: ${e instanceof Error ? e.message : "Unknown error"}`,
			},
			exitCode: SIMULATE_EXIT_CODES.VALIDATION_ERROR,
		};
	}

	// Check contract files exist
	if (!existsSync(resolve(options.contractA))) {
		return {
			ok: false,
			error: {
				code: "E_CONTRACT_A_NOT_FOUND",
				message: `Contract A file not found: ${resolve(options.contractA)}`,
			},
			exitCode: SIMULATE_EXIT_CODES.INPUT_NOT_FOUND,
		};
	}

	if (!existsSync(resolve(options.contractB))) {
		return {
			ok: false,
			error: {
				code: "E_CONTRACT_B_NOT_FOUND",
				message: `Contract B file not found: ${resolve(options.contractB)}`,
			},
			exitCode: SIMULATE_EXIT_CODES.INPUT_NOT_FOUND,
		};
	}

	// Validate artifacts directory if specified
	if (options.artifactsDir) {
		try {
			validatePath(cwd, options.artifactsDir);
		} catch (e) {
			return {
				ok: false,
				error: {
					code: "E_INVALID_PATH",
					message: `Invalid artifacts directory: ${e instanceof Error ? e.message : "Unknown error"}`,
				},
				exitCode: SIMULATE_EXIT_CODES.VALIDATION_ERROR,
			};
		}

		if (!existsSync(resolve(options.artifactsDir))) {
			return {
				ok: false,
				error: {
					code: "E_ARTIFACTS_NOT_FOUND",
					message: `Artifacts directory not found: ${resolve(options.artifactsDir)}`,
				},
				exitCode: SIMULATE_EXIT_CODES.INPUT_NOT_FOUND,
			};
		}
	}

	// Validate traces directory if specified
	if (options.tracesDir) {
		try {
			validatePath(cwd, options.tracesDir);
		} catch (e) {
			return {
				ok: false,
				error: {
					code: "E_INVALID_PATH",
					message: `Invalid traces directory: ${e instanceof Error ? e.message : "Unknown error"}`,
				},
				exitCode: SIMULATE_EXIT_CODES.VALIDATION_ERROR,
			};
		}

		if (!existsSync(resolve(options.tracesDir))) {
			return {
				ok: false,
				error: {
					code: "E_TRACES_NOT_FOUND",
					message: `Traces directory not found: ${resolve(options.tracesDir)}`,
				},
				exitCode: SIMULATE_EXIT_CODES.INPUT_NOT_FOUND,
			};
		}
	}

	// Validate output path if specified
	if (options.outputPath) {
		try {
			validatePath(cwd, options.outputPath);
		} catch (e) {
			if (e instanceof PathTraversalError) {
				return {
					ok: false,
					error: {
						code: "E_PATH_TRAVERSAL",
						message: `Output path escapes working directory: ${options.outputPath}`,
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
	}

	// Validation passed - return placeholder to indicate success
	// The actual report will be built in runSimulate
	return {
		ok: true,
		report: {} as CounterfactualSimulationReport,
		exitCode: SIMULATE_EXIT_CODES.SUCCESS,
	};
}

// ============================================================================
// HASH UTILITIES
// ============================================================================

/**
 * Compute deterministic hash of a contract.
 */
function computeContractHash(contract: HarnessContract): string {
	const content = JSON.stringify(contract, Object.keys(contract).sort());
	return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

// ============================================================================
// PLACEHOLDER IMPLEMENTATIONS (Phase 2+)
// ============================================================================

/**
 * Assess data quality from available inputs.
 * TODO: Phase 2 - Implement actual data quality assessment.
 */
function assessDataQuality(
	_contractA: HarnessContract,
	_contractB: HarnessContract,
	_artifactsDir: string | undefined,
	_tracesDir: string | undefined,
): DataQualityAssessment {
	// V1 placeholder - returns default assessment
	return {
		sampleSize: "marginal",
		traceCoverage: 50,
		artifactCompleteness: 50,
		effectiveSampleSize: 10,
	};
}

/**
 * Compute simulation metrics comparing baseline vs candidate.
 * TODO: Phase 3 - Implement actual metric computation.
 */
function computeMetrics(
	_contractA: HarnessContract,
	_contractB: HarnessContract,
	_dataQuality: DataQualityAssessment,
): SimulationMetrics {
	// V1 placeholder - returns zero deltas
	const zeroDelta = {
		baseline: 0,
		candidate: 0,
		delta: 0,
		percentChange: 0,
	};

	return {
		preventedRisk: zeroDelta,
		falseBlockRate: zeroDelta,
		leadTimeDelta: zeroDelta,
		rollbackPressureDelta: zeroDelta,
	};
}

/**
 * Compute decision deltas between baseline and candidate.
 * TODO: Phase 3 - Implement actual delta computation.
 */
function computeDeltas(
	_contractA: HarnessContract,
	_contractB: HarnessContract,
): { summary: DeltaSummary; topDeltas: DecisionDelta[] } {
	// V1 placeholder - no deltas
	return {
		summary: {
			total: 0,
			blockedToAllowed: 0,
			allowedToBlocked: 0,
			confidenceChanges: 0,
			unchanged: 0,
		},
		topDeltas: [],
	};
}

/**
 * Generate recommendations from simulation results.
 * TODO: Phase 4 - Implement actual recommendation generation.
 */
function generateRecommendations(
	_metrics: SimulationMetrics,
	_deltas: { summary: DeltaSummary; topDeltas: DecisionDelta[] },
	_confidence: ConfidenceAssessment,
): SimulationRecommendation[] {
	// V1 placeholder - no recommendations
	return [];
}

/**
 * Determine simulation flags from results.
 */
function determineFlags(
	dataQuality: DataQualityAssessment,
	metrics: SimulationMetrics,
): SimulationFlag[] {
	const flags: SimulationFlag[] = [];

	if (dataQuality.sampleSize === "insufficient") {
		flags.push("insufficient_data");
	}

	if (dataQuality.traceCoverage < 50) {
		flags.push("partial_coverage");
	}

	if (metrics.falseBlockRate.delta > 0.1) {
		flags.push("high_false_block_risk");
	}

	if (Math.abs(metrics.leadTimeDelta.delta) > 2) {
		flags.push("significant_lead_time_impact");
	}

	return flags;
}

/**
 * Compute confidence assessment from data quality.
 */
function computeConfidence(
	dataQuality: DataQualityAssessment,
): ConfidenceAssessment {
	let level: ConfidenceAssessment["level"] = "insufficient-data";
	const rationale: string[] = [];

	if (
		dataQuality.effectiveSampleSize >= 20 &&
		dataQuality.traceCoverage >= 80
	) {
		level = "high";
		rationale.push("Adequate sample size with good trace coverage");
	} else if (
		dataQuality.effectiveSampleSize >= 10 &&
		dataQuality.traceCoverage >= 50
	) {
		level = "medium";
		rationale.push("Marginal sample size or partial trace coverage");
	} else if (dataQuality.effectiveSampleSize >= 5) {
		level = "low";
		rationale.push("Limited sample size or poor trace coverage");
	} else {
		level = "insufficient-data";
		rationale.push("Insufficient data for reliable simulation");
	}

	return {
		level,
		score: CONFIDENCE_SCORES[level],
		rationale,
		dataQuality,
	};
}

// ============================================================================
// MAIN SIMULATION RUNNER
// ============================================================================

/**
 * Run counterfactual policy simulation.
 */
export function runSimulate(options: SimulateOptions): SimulateResult {
	const startTime = Date.now();

	// Validate options
	const validation = validateOptions(options);
	if (!validation.ok) {
		return validation;
	}

	// Load contracts
	let contractA: HarnessContract;
	let contractB: HarnessContract;

	try {
		contractA = loadContract(options.contractA);
	} catch (e) {
		return {
			ok: false,
			error: {
				code: "E_CONTRACT_A_LOAD_FAILED",
				message: `Failed to load contract A: ${e instanceof Error ? e.message : "Unknown error"}`,
			},
			exitCode: SIMULATE_EXIT_CODES.VALIDATION_ERROR,
		};
	}

	try {
		contractB = loadContract(options.contractB);
	} catch (e) {
		return {
			ok: false,
			error: {
				code: "E_CONTRACT_B_LOAD_FAILED",
				message: `Failed to load contract B: ${e instanceof Error ? e.message : "Unknown error"}`,
			},
			exitCode: SIMULATE_EXIT_CODES.VALIDATION_ERROR,
		};
	}

	// Determine paths
	const artifactsDir = options.artifactsDir
		? resolve(options.artifactsDir)
		: resolve("./artifacts/pilot");
	const tracesDir = options.tracesDir
		? resolve(options.tracesDir)
		: resolve("./.traces");

	// Compute contract hashes
	const contractAHash = computeContractHash(contractA);
	const contractBHash = computeContractHash(contractB);

	// Build simulation inputs
	const inputs: SimulationInputs = {
		contractBaseline: resolve(options.contractA),
		contractCandidate: resolve(options.contractB),
		artifactsDir,
		tracesDir,
		contractBaselineHash: contractAHash,
		contractCandidateHash: contractBHash,
	};

	// Determine simulation window
	const now = new Date();
	const windowStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
	const window: SimulationWindow = {
		start: windowStart.toISOString(),
		end: now.toISOString(),
	};

	// Assess data quality
	const dataQuality = assessDataQuality(
		contractA,
		contractB,
		options.artifactsDir,
		options.tracesDir,
	);

	// Compute metrics
	const metrics = computeMetrics(contractA, contractB, dataQuality);

	// Compute deltas
	const deltas = computeDeltas(contractA, contractB);

	// Compute confidence
	const confidence = computeConfidence(dataQuality);

	// Generate recommendations
	const recommendations = generateRecommendations(metrics, deltas, confidence);

	// Determine flags
	const flags = determineFlags(dataQuality, metrics);

	// Build report
	const report: CounterfactualSimulationReport = {
		schemaVersion: SIMULATION_SCHEMA_VERSION,
		generatedAt: new Date().toISOString(),
		durationMs: Date.now() - startTime,
		inputs,
		window,
		summary: {
			scenariosEvaluated: 0, // TODO: Phase 3
			sufficientDataCount: dataQuality.effectiveSampleSize,
			tracesProcessed: 0, // TODO: Phase 3
			artifactsProcessed: 0, // TODO: Phase 3
		},
		dataQuality,
		metrics,
		deltas,
		recommendations,
		confidence,
		flags,
	};

	// Write output file if specified
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

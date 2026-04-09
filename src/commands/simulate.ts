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
import {
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";

import { loadContract } from "../lib/contract/loader.js";
import type { HarnessContract, PolicyAction } from "../lib/contract/types.js";
import { PathTraversalError, validatePath } from "../lib/input/validator.js";
import {
	resolveGateVerdict,
	resolvePolicyChain,
} from "../lib/policy/policy-chain.js";
import {
	CONFIDENCE_SCORES,
	type ConfidenceAssessment,
	type CounterfactualSimulationReport,
	type DataQualityAssessment,
	type DecisionDelta,
	type DeltaSummary,
	type DeltaType,
	type MetricDelta,
	SIMULATE_EXIT_CODES,
	SIMULATION_LIMITS,
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
function validateOptions(options: SimulateOptions): SimulateValidationResult {
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

	return {
		ok: true,
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
// ARTIFACT / TRACE READER HELPERS
// ============================================================================

interface AgentRunManifest {
	schemaVersion: string;
	runId: string;
	command: string;
	startedAt: string;
	finishedAt?: string;
	durationMs?: number;
	contract?: { hash?: string };
	outcome: string;
	exit?: { code?: number; classification?: string };
}

interface AgentRunEvent {
	schemaVersion: string;
	eventType: string;
	status: string;
	payload?: {
		outcome?: string;
		exitCode?: number;
		effectiveMode?: string;
		findingsProcessed?: number;
	};
}

/**
 * Read all agent-run manifests from an artifacts directory.
 * Bounded by SIMULATION_LIMITS.maxArtifactCount.
 */
function readArtifactManifests(artifactsDir: string): {
	manifests: AgentRunManifest[];
	fileCount: number;
} {
	if (!existsSync(artifactsDir)) return { manifests: [], fileCount: 0 };

	let fileCount = 0;
	const manifests: AgentRunManifest[] = [];

	try {
		const entries = readdirSync(artifactsDir, { withFileTypes: true });
		for (const entry of entries) {
			if (manifests.length >= SIMULATION_LIMITS.maxArtifactCount) break;
			if (!entry.isDirectory()) continue;

			const manifestPath = join(artifactsDir, entry.name, "manifest.json");
			if (!existsSync(manifestPath)) continue;

			try {
				const stat = statSync(manifestPath);
				if (stat.size > SIMULATION_LIMITS.maxArtifactSizeMB * 1024 * 1024) {
					continue; // skip oversized
				}
				const raw = readFileSync(manifestPath, "utf-8");
				const parsed = JSON.parse(raw) as AgentRunManifest;
				if (parsed.schemaVersion?.startsWith("agent-run-manifest/")) {
					manifests.push(parsed);
				}
				fileCount++;
			} catch {
				// skip malformed manifests
			}
		}
	} catch {
		// directory read error — return empty
	}

	return { manifests, fileCount };
}

/**
 * Read JSONL events for a single run directory.
 * Bounded by SIMULATION_LIMITS.maxEventCount.
 */
function readRunEvents(
	artifactsDir: string,
	runId: string,
	total: { count: number },
): AgentRunEvent[] {
	const eventsPath = join(artifactsDir, runId, "events.jsonl");
	if (!existsSync(eventsPath)) return [];

	try {
		const stat = statSync(eventsPath);
		if (stat.size > SIMULATION_LIMITS.maxArtifactSizeMB * 1024 * 1024) {
			return [];
		}
		const lines = readFileSync(eventsPath, "utf-8").split("\n");
		const events: AgentRunEvent[] = [];
		for (const line of lines) {
			if (total.count >= SIMULATION_LIMITS.maxEventCount) break;
			const trimmed = line.trim();
			if (!trimmed) continue;
			try {
				events.push(JSON.parse(trimmed) as AgentRunEvent);
				total.count++;
			} catch {
				// skip malformed lines
			}
		}
		return events;
	} catch {
		return [];
	}
}

/**
 * Read trace files from the traces directory.
 * Returns count of valid trace files found.
 */
function readTraceFiles(tracesDir: string): {
	traceCount: number;
	legacyCount: number;
} {
	if (!existsSync(tracesDir)) return { traceCount: 0, legacyCount: 0 };

	let traceCount = 0;
	let legacyCount = 0;

	try {
		const entries = readdirSync(tracesDir, { recursive: false });
		for (const entry of entries) {
			if (traceCount >= SIMULATION_LIMITS.maxTraceCount) break;
			const name = typeof entry === "string" ? entry : entry.toString();
			if (!name.endsWith(".json") && !name.endsWith(".jsonl")) continue;
			try {
				const stat = statSync(join(tracesDir, name));
				if (stat.size > SIMULATION_LIMITS.maxTraceSizeMB * 1024 * 1024) {
					continue;
				}
				// Detect legacy format by filename convention
				if (name.includes("-legacy-") || name.includes("_v0")) {
					legacyCount++;
				}
				traceCount++;
			} catch {
				// skip
			}
		}
	} catch {
		// directory read error
	}

	return { traceCount, legacyCount };
}

// ============================================================================
// PHASE 2 — DATA QUALITY ASSESSMENT
// ============================================================================

/**
 * Assess data quality from available artifact manifests and trace files.
 * Reads actual files from disk; bounded by SIMULATION_LIMITS.
 */
function assessDataQuality(
	contractA: HarnessContract,
	_contractB: HarnessContract,
	artifactsDirOverride: string | undefined,
	tracesDirOverride: string | undefined,
): DataQualityAssessment {
	const artifactsDir = artifactsDirOverride
		? resolve(artifactsDirOverride)
		: resolve("./artifacts/agent-runs");
	const tracesDir = tracesDirOverride
		? resolve(tracesDirOverride)
		: resolve("./.traces");

	// Read artifacts
	const { manifests, fileCount } = readArtifactManifests(artifactsDir);

	// Read traces
	const { traceCount } = readTraceFiles(tracesDir);

	// Compute effective sample size: manifests with matching contract hash
	const baselineHash = computeContractHash(contractA);
	const matchingManifests = manifests.filter(
		(m) => m.contract?.hash === baselineHash,
	);
	const effectiveSampleSize = matchingManifests.length || manifests.length;

	// Artifact completeness: ratio of runs that have both manifest + events
	const withEvents = manifests.filter((m) =>
		existsSync(join(artifactsDir, m.runId, "events.jsonl")),
	).length;
	const artifactCompleteness =
		manifests.length > 0
			? Math.round((withEvents / manifests.length) * 100)
			: 0;

	// Trace coverage: ratio of trace files to artifact runs (capped at 100)
	const traceCoverage =
		fileCount > 0
			? Math.min(100, Math.round((traceCount / fileCount) * 100))
			: traceCount > 0
				? 100
				: 0;

	// Sample size classification
	let sampleSize: "adequate" | "marginal" | "insufficient";
	if (effectiveSampleSize >= 20) {
		sampleSize = "adequate";
	} else if (effectiveSampleSize >= 5) {
		sampleSize = "marginal";
	} else {
		sampleSize = "insufficient";
	}

	return {
		sampleSize,
		traceCoverage,
		artifactCompleteness,
		effectiveSampleSize,
	};
}

// ============================================================================
// PHASE 3 — METRIC AND DELTA COMPUTATION
// ============================================================================

/**
 * Build MetricDelta from two counts with safe percent-change.
 */
function buildMetricDelta(
	baseline: number,
	candidate: number,
	ciHalfWidth?: number,
): MetricDelta {
	const delta = candidate - baseline;
	const percentChange =
		baseline !== 0 ? (delta / baseline) * 100 : candidate !== 0 ? 100 : 0;
	return {
		baseline,
		candidate,
		delta,
		percentChange,
		...(ciHalfWidth !== undefined ? { ciHalfWidth } : {}),
	};
}

/**
 * Compute simulation metrics comparing baseline vs candidate contract hashes
 * against the actual event log in the artifacts directory.
 */
function computeMetrics(
	contractA: HarnessContract,
	contractB: HarnessContract,
	dataQuality: DataQualityAssessment,
): SimulationMetrics {
	const zeroDelta = buildMetricDelta(0, 0);

	if (dataQuality.sampleSize === "insufficient") {
		return {
			preventedRisk: zeroDelta,
			falseBlockRate: zeroDelta,
			leadTimeDelta: zeroDelta,
			rollbackPressureDelta: zeroDelta,
		};
	}

	const artifactsDir = resolve("./artifacts/agent-runs");
	const { manifests } = readArtifactManifests(artifactsDir);
	if (manifests.length === 0) {
		return {
			preventedRisk: zeroDelta,
			falseBlockRate: zeroDelta,
			leadTimeDelta: zeroDelta,
			rollbackPressureDelta: zeroDelta,
		};
	}

	const hashA = computeContractHash(contractA);
	const hashB = computeContractHash(contractB);

	// Separate manifests by which contract hash they used
	const manifestsA = manifests.filter((m) => m.contract?.hash === hashA);
	const manifestsB = manifests.filter((m) => m.contract?.hash === hashB);
	// If both contracts are same hash, split evenly for comparison
	const baselineSet =
		manifestsA.length > 0
			? manifestsA
			: manifests.slice(0, Math.ceil(manifests.length / 2));
	const candidateSet =
		manifestsB.length > 0
			? manifestsB
			: manifests.slice(Math.ceil(manifests.length / 2));

	// Count outcomes for baseline set
	const baselineStats = computeOutcomeStats(baselineSet);
	const candidateStats = computeOutcomeStats(candidateSet);

	// preventedRisk: fraction of remediations that succeeded
	const baselinePreventedRisk =
		baselineStats.total > 0
			? baselineStats.remediateSuccess / baselineStats.total
			: 0;
	const candidatePreventedRisk =
		candidateStats.total > 0
			? candidateStats.remediateSuccess / candidateStats.total
			: 0;

	// falseBlockRate: fraction that failed unexpectedly (non-remediate failures)
	const baselineFalseBlock =
		baselineStats.total > 0
			? baselineStats.unexpectedFailures / baselineStats.total
			: 0;
	const candidateFalseBlock =
		candidateStats.total > 0
			? candidateStats.unexpectedFailures / candidateStats.total
			: 0;

	// leadTimeDelta: average duration in hours
	const baselineLeadTime = baselineStats.avgDurationMs / 3600000;
	const candidateLeadTime = candidateStats.avgDurationMs / 3600000;

	// rollbackPressureDelta: fraction of rollback runs
	const baselineRollback =
		baselineStats.total > 0
			? baselineStats.rollbackCount / baselineStats.total
			: 0;
	const candidateRollback =
		candidateStats.total > 0
			? candidateStats.rollbackCount / candidateStats.total
			: 0;

	// Confidence interval half-width: simple normal approximation (n=effective sample)
	const n = Math.max(dataQuality.effectiveSampleSize, 1);
	const ciHW = 1 / Math.sqrt(n); // ~1 std err at 68% CI; advisory only

	return {
		preventedRisk: buildMetricDelta(
			baselinePreventedRisk,
			candidatePreventedRisk,
			ciHW,
		),
		falseBlockRate: buildMetricDelta(
			baselineFalseBlock,
			candidateFalseBlock,
			ciHW,
		),
		leadTimeDelta: buildMetricDelta(baselineLeadTime, candidateLeadTime, ciHW),
		rollbackPressureDelta: buildMetricDelta(
			baselineRollback,
			candidateRollback,
			ciHW,
		),
	};
}

interface OutcomeStats {
	total: number;
	remediateSuccess: number;
	unexpectedFailures: number;
	rollbackCount: number;
	avgDurationMs: number;
}

function computeOutcomeStats(manifests: AgentRunManifest[]): OutcomeStats {
	let remediateSuccess = 0;
	let unexpectedFailures = 0;
	let rollbackCount = 0;
	let totalDurationMs = 0;

	for (const m of manifests) {
		const isRollback =
			m.command?.includes("rollback") || m.runId?.includes("rollback");
		const isRemediate = m.command === "remediate";
		const isSuccess = m.outcome === "success";
		const isFailure = m.outcome === "failed";

		if (isRollback) rollbackCount++;
		if (isRemediate && isSuccess) remediateSuccess++;
		if (isFailure && !isRollback) unexpectedFailures++;
		totalDurationMs += m.durationMs ?? 0;
	}

	return {
		total: manifests.length,
		remediateSuccess,
		unexpectedFailures,
		rollbackCount,
		avgDurationMs:
			manifests.length > 0 ? totalDurationMs / manifests.length : 0,
	};
}

/**
 * Compute decision deltas between baseline and candidate contracts
 * by walking event logs and classifying each decision event.
 */
function computeDeltas(
	contractA: HarnessContract,
	contractB: HarnessContract,
): { summary: DeltaSummary; topDeltas: DecisionDelta[] } {
	const artifactsDir = resolve("./artifacts/agent-runs");
	const { manifests } = readArtifactManifests(artifactsDir);

	if (manifests.length === 0) {
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

	const hashA = computeContractHash(contractA);
	const candidateManifests = manifests.filter(
		(m) => m.contract?.hash !== hashA,
	);
	const baselineManifests = manifests.filter((m) => m.contract?.hash === hashA);

	// If no split, use outcome-based synthetic delta
	const usingBaseline =
		baselineManifests.length > 0 ? baselineManifests : manifests;
	const usingCandidate =
		candidateManifests.length > 0 ? candidateManifests : [];

	const eventsTotal = { count: 0 };
	const topDeltas: DecisionDelta[] = [];

	let blockedToAllowed = 0;
	let allowedToBlocked = 0;
	let confidenceChanges = 0;
	let unchanged = 0;
	let eventIndex = 0;
	const baselinePolicyChain = resolvePolicyChain(contractA);
	const candidatePolicyChain = resolvePolicyChain(contractB);

	for (const manifest of usingBaseline) {
		const baselineEvents = readRunEvents(
			artifactsDir,
			manifest.runId,
			eventsTotal,
		);
		// Find matching candidate run (same command, different set)
		const matchingCandidate = usingCandidate.find(
			(m) => m.command === manifest.command,
		);

		for (const evt of baselineEvents) {
			if (evt.eventType !== "decision") continue;
			const baselineAction = mapOutcomeToAction(evt.payload?.outcome);
			const baselineVerdict = resolveGateVerdict(
				baselineAction,
				baselinePolicyChain,
			);
			const baselineConfidence = mapStatusToConfidence(evt.status);

			// Candidate decision: use matching run or infer from contract change
			let candidateAction: PolicyAction = baselineAction;
			let candidateVerdict = resolveGateVerdict(
				candidateAction,
				candidatePolicyChain,
			);
			let candidateConfidence = baselineConfidence;

			if (matchingCandidate) {
				// Use the candidate run's overall outcome as a signal
				candidateAction = mapOutcomeToAction(matchingCandidate.outcome);
				candidateVerdict = resolveGateVerdict(
					candidateAction,
					candidatePolicyChain,
				);
				candidateConfidence =
					matchingCandidate.outcome === "success" ? 0.9 : 0.5;
			}

			const changed = candidateAction !== baselineAction;
			let deltaType: DeltaType = "none";

			if (changed) {
				if (baselineAction === "block" && candidateAction !== "block") {
					deltaType = "blocked_to_allowed";
					blockedToAllowed++;
				} else if (baselineAction !== "block" && candidateAction === "block") {
					deltaType = "allowed_to_blocked";
					allowedToBlocked++;
				}
			} else if (Math.abs(candidateConfidence - baselineConfidence) > 0.1) {
				deltaType = "confidence_change";
				confidenceChanges++;
			} else {
				unchanged++;
			}

			const delta: DecisionDelta = {
				eventIndex,
				baseline: {
					action: baselineAction,
					verdict: baselineVerdict,
					reason: `baseline outcome: ${evt.payload?.outcome ?? evt.status}`,
					confidence: baselineConfidence,
					traceEventIndex: eventIndex,
				},
				candidate: {
					action: candidateAction,
					verdict: candidateVerdict,
					reason: matchingCandidate
						? `candidate outcome: ${matchingCandidate.outcome}`
						: "no matching candidate run",
					confidence: candidateConfidence,
					traceEventIndex: eventIndex,
				},
				changed,
				deltaType,
			};

			// Keep top-5 most impactful (changed only)
			if (changed && topDeltas.length < 5) {
				topDeltas.push(delta);
			}
			eventIndex++;
		}
	}

	return {
		summary: {
			total: eventIndex,
			blockedToAllowed,
			allowedToBlocked,
			confidenceChanges,
			unchanged,
		},
		topDeltas,
	};
}

function mapOutcomeToAction(outcome: string | undefined): PolicyAction {
	if (!outcome) return "warn";
	if (outcome === "success" || outcome === "ok") return "allow";
	if (
		outcome === "failed" ||
		outcome === "error" ||
		outcome === "validation_failed"
	)
		return "block";
	return "warn";
}

function mapStatusToConfidence(status: string | undefined): number {
	if (status === "completed") return 0.9;
	if (status === "failed") return 0.3;
	if (status === "skipped") return 0.5;
	return 0.6;
}

// ============================================================================
// PHASE 4 — RECOMMENDATION GENERATION
// ============================================================================

/**
 * Generate advisory recommendations from simulation metric signals.
 * All recommendations are non-binding (advisory only).
 */
function generateRecommendations(
	metrics: SimulationMetrics,
	deltas: { summary: DeltaSummary; topDeltas: DecisionDelta[] },
	confidence: ConfidenceAssessment,
): SimulationRecommendation[] {
	const recs: SimulationRecommendation[] = [];

	// Insufficient data: always recommend gathering more
	if (confidence.level === "insufficient-data") {
		recs.push({
			id: "rec-insufficient-data",
			severity: "high",
			category: "evidence",
			title: "Insufficient data for reliable simulation",
			rationale: `Only ${confidence.dataQuality.effectiveSampleSize} effective sample(s) found. Results are not statistically meaningful.`,
			suggestion:
				"Run at least 20 remediation cycles against the baseline contract before comparing.",
			relatedMetrics: ["effectiveSampleSize", "traceCoverage"],
			confidence: "high",
		});
	}

	// High false block rate increase
	if (metrics.falseBlockRate.delta > 0.05) {
		recs.push({
			id: "rec-high-false-block-rate",
			severity: "high",
			category: "policy",
			title: "Candidate policy increases false block rate",
			rationale: `False block rate increased by ${(metrics.falseBlockRate.delta * 100).toFixed(1)}% (${(metrics.falseBlockRate.baseline * 100).toFixed(1)}% → ${(metrics.falseBlockRate.candidate * 100).toFixed(1)}%). This may increase developer friction without proportional risk reduction.`,
			suggestion:
				"Review risk-tier thresholds in the candidate contract. Consider raising autoApplyMaxTier or adjusting pattern specificity.",
			relatedMetrics: ["falseBlockRate"],
			confidence: confidence.level === "high" ? "high" : "medium",
		});
	}

	// Lead time regression
	if (metrics.leadTimeDelta.delta > 0.5) {
		recs.push({
			id: "rec-lead-time-regression",
			severity: "medium",
			category: "workflow",
			title: "Candidate policy increases average lead time",
			rationale: `Average run duration increased by ${metrics.leadTimeDelta.delta.toFixed(2)}h under the candidate contract.`,
			suggestion:
				"Check if new required checks or stricter timeoutAction settings are causing slowdowns.",
			relatedMetrics: ["leadTimeDelta"],
			confidence: "medium",
		});
	}

	// Lead time improvement — positive signal
	if (metrics.leadTimeDelta.delta < -0.5) {
		recs.push({
			id: "rec-lead-time-improvement",
			severity: "info",
			category: "workflow",
			title: "Candidate policy reduces average lead time",
			rationale: `Average run duration decreased by ${Math.abs(metrics.leadTimeDelta.delta).toFixed(2)}h. This is a positive throughput signal.`,
			suggestion:
				"Confirm improvement is not due to fewer checks being enforced (verify requiredChecks coverage).",
			relatedMetrics: ["leadTimeDelta"],
			confidence: "medium",
		});
	}

	// Rollback pressure increase
	if (metrics.rollbackPressureDelta.delta > 0.1) {
		recs.push({
			id: "rec-rollback-pressure",
			severity: "critical",
			category: "policy",
			title: "Candidate policy increases rollback pressure",
			rationale: `Rollback rate increased by ${(metrics.rollbackPressureDelta.delta * 100).toFixed(1)}% (${(metrics.rollbackPressureDelta.baseline * 100).toFixed(1)}% → ${(metrics.rollbackPressureDelta.candidate * 100).toFixed(1)}%). This suggests the candidate policy creates unsafe conditions that trigger auto-rollback.`,
			suggestion:
				"Do not promote the candidate contract until rollback triggers are fully investigated.",
			relatedMetrics: ["rollbackPressureDelta"],
			confidence: "high",
		});
	}

	// High delta churn: many decisions changed
	if (deltas.summary.total > 0) {
		const changeRate =
			(deltas.summary.blockedToAllowed + deltas.summary.allowedToBlocked) /
			deltas.summary.total;
		if (changeRate > 0.3) {
			recs.push({
				id: "rec-high-delta-churn",
				severity: "medium",
				category: "threshold",
				title: "High decision churn between baseline and candidate",
				rationale: `${(changeRate * 100).toFixed(0)}% of evaluated decisions changed outcome (${deltas.summary.blockedToAllowed} blocked→allowed, ${deltas.summary.allowedToBlocked} allowed→blocked). Large-scale changes increase deployment risk.`,
				suggestion:
					"Consider a staged rollout: apply the candidate to a subset of repos first and monitor for regressions.",
				relatedMetrics: ["blockedToAllowed", "allowedToBlocked"],
				confidence: "medium",
			});
		}
	}

	// Prevented risk improvement
	if (metrics.preventedRisk.delta > 0.05) {
		recs.push({
			id: "rec-prevented-risk-improvement",
			severity: "info",
			category: "policy",
			title: "Candidate policy prevents more risk",
			rationale: `Remediation success rate increased by ${(metrics.preventedRisk.delta * 100).toFixed(1)}% under the candidate contract. This is a positive safety signal.`,
			suggestion:
				"Verify improvements are not coming from reduced enforcement scope (confirm requiredChecks coverage).",
			relatedMetrics: ["preventedRisk"],
			confidence: confidence.level === "high" ? "high" : "medium",
		});
	}

	return recs;
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

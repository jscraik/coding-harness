/**
 * Pilot evaluate command
 *
 * Evaluates pilot metrics and determines promotion outcome (promote/hold/rollback).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
	emitTerminalRunRecord,
	hashRunRecordValue,
} from "../lib/contract/run-record-emitter.js";
import { PathTraversalError, validatePath } from "../lib/input/validator.js";

import { buildControlPlaneArtifacts } from "../lib/pilot-evaluation/control-plane.js";
import { capturePilotMetrics } from "../lib/pilot-evaluation/metrics-capture.js";
import {
	getAdapterRegistryEntry,
	getMetricRegistryEntry,
	loadAdapterRegistry,
	loadMetricRegistry,
} from "../lib/pilot-evaluation/registries.js";
import {
	PILOT_EVALUATE_EXIT_CODES,
	PILOT_THRESHOLDS,
	type PilotEvaluateOptions,
	type PilotEvaluationIngestion,
	type PilotEvaluationResult,
	type PilotMetrics,
	type PilotOutcome,
} from "../lib/pilot-evaluation/types.js";

interface ParityHistoryEntry {
	windowStart: string;
	windowEnd: string;
	generatedAt: string;
	lane: "advisory" | "health";
	canonicalCoverageRatio: number;
	criticalDriftCount: number;
	sensitiveFieldLeakCount: number;
	runIdCollisionCount: number;
	passing: boolean;
}

interface ParityHistoryArtifact {
	schemaVersion: "pilot-adapter-parity-history/v1";
	windows: ParityHistoryEntry[];
}

function shouldBuildControlPlane(options: PilotEvaluateOptions): boolean {
	return Boolean(
		options.docsGateReportPath ||
			options.evaluationMode ||
			options.rolloutStage ||
			options.prTemplateStatus ||
			options.prTemplateRef ||
			options.actorId ||
			options.clientFamily ||
			options.providerId ||
			options.modelDescriptor ||
			options.executionMode ||
			options.operatorType ||
			options.overrideAuthorizedPrincipal ||
			options.overrideScope ||
			options.overrideReason ||
			options.overrideTicketRef ||
			(options.overrideApprovedBy?.length ?? 0) > 0 ||
			options.overrideCreatedAt ||
			options.overrideExpiresAt,
	);
}

/**
 * Evaluate pilot metrics against thresholds
 */
function evaluateMetrics(
	metrics: PilotMetrics,
	options?: {
		metricRegistryPath?: string;
		lane?: "advisory" | "health";
	},
): {
	outcome: PilotOutcome;
	holdReasons: string[];
	warnings: string[];
} {
	const holdReasons: string[] = [];
	const warnings: string[] = [];
	const metricRegistry = loadMetricRegistry(options?.metricRegistryPath);
	const rollbackReliabilityMetric = getMetricRegistryEntry(
		metricRegistry,
		"rollbackReliability",
	);
	const evidenceCompletenessMetric = getMetricRegistryEntry(
		metricRegistry,
		"evidenceCompleteness",
	);
	const interventionRateMetric = getMetricRegistryEntry(
		metricRegistry,
		"interventionRate",
	);
	const thrashRateMetric = getMetricRegistryEntry(metricRegistry, "thrashRate");

	// Hard gate: high-risk automation incidents
	if (
		metrics.highRiskAutomationIncidents >
		PILOT_THRESHOLDS.highRiskAutomationIncidents
	) {
		return {
			outcome: "rollback",
			holdReasons: [
				`High-risk automation incidents (${metrics.highRiskAutomationIncidents}) exceed threshold (${PILOT_THRESHOLDS.highRiskAutomationIncidents})`,
			],
			warnings,
		};
	}

	// Sample size check
	if (metrics.sampleSize < PILOT_THRESHOLDS.minTotalSampleSize) {
		holdReasons.push(
			`Sample size (${metrics.sampleSize}) below minimum (${PILOT_THRESHOLDS.minTotalSampleSize})`,
		);
	}

	// Per-repo sample size check
	for (const [repo, size] of Object.entries(metrics.repoSampleSizes)) {
		if (size < PILOT_THRESHOLDS.minPerRepoSampleSize) {
			holdReasons.push(
				`Repo ${repo} sample size (${size}) below minimum (${PILOT_THRESHOLDS.minPerRepoSampleSize})`,
			);
		}
	}

	// Lead time p50 improvement check
	if (
		metrics.leadTimeP50Improvement > PILOT_THRESHOLDS.leadTimeP50Improvement
	) {
		holdReasons.push(
			`Lead time p50 improvement (${(metrics.leadTimeP50Improvement * 100).toFixed(1)}%) below target (${(PILOT_THRESHOLDS.leadTimeP50Improvement * 100).toFixed(0)}%)`,
		);
	}

	// Lead time p75 improvement check (tail guardrail)
	if (
		metrics.leadTimeP75Improvement > PILOT_THRESHOLDS.leadTimeP75Improvement
	) {
		holdReasons.push(
			`Lead time p75 improvement (${(metrics.leadTimeP75Improvement * 100).toFixed(1)}%) below tail guardrail (${(PILOT_THRESHOLDS.leadTimeP75Improvement * 100).toFixed(0)}%)`,
		);
	}

	// Confidence interval check
	if (metrics.leadTimeP50CiHalfWidth > PILOT_THRESHOLDS.leadTimeCiHalfWidth) {
		holdReasons.push(
			`Lead time CI half-width (${metrics.leadTimeP50CiHalfWidth.toFixed(2)}) exceeds maximum (${PILOT_THRESHOLDS.leadTimeCiHalfWidth})`,
		);
	}

	// Rollback reliability denominator guard + threshold
	if (
		rollbackReliabilityMetric?.minimumDenominator !== undefined &&
		metrics.rollbackTriggerCount < rollbackReliabilityMetric.minimumDenominator
	) {
		const message = `Rollback reliability has insufficient evidence (${metrics.rollbackTriggerCount}/${rollbackReliabilityMetric.minimumDenominator} required rollback triggers)`;
		if ((options?.lane ?? "health") === "health") {
			holdReasons.push(message);
		} else {
			warnings.push(`${message}; advisory lane records this as a warning only`);
		}
	} else if (
		metrics.rollbackReliability <
		(rollbackReliabilityMetric?.threshold?.value ??
			PILOT_THRESHOLDS.rollbackReliability)
	) {
		holdReasons.push(
			`Rollback reliability (${(metrics.rollbackReliability * 100).toFixed(0)}%) below required (${(PILOT_THRESHOLDS.rollbackReliability * 100).toFixed(0)}%)`,
		);
	}

	// Unresolved critical incidents check
	if (
		metrics.unresolvedCriticalIncidents >
		PILOT_THRESHOLDS.unresolvedCriticalIncidents
	) {
		holdReasons.push(
			`Unresolved critical incidents (${metrics.unresolvedCriticalIncidents}) must be cleared`,
		);
	}

	// Classification latency check
	if (
		metrics.incidentClassificationP95Hours > 0 &&
		metrics.incidentClassificationP95Hours >
			PILOT_THRESHOLDS.incidentClassificationP95Hours
	) {
		holdReasons.push(
			`Incident classification p95 latency (${metrics.incidentClassificationP95Hours.toFixed(1)}h) exceeds maximum (${PILOT_THRESHOLDS.incidentClassificationP95Hours}h)`,
		);
	}

	// Evidence completeness check
	if (
		metrics.evidenceCompletenessRatio <
		(evidenceCompletenessMetric?.threshold?.value ??
			PILOT_THRESHOLDS.evidenceCompletenessRatio)
	) {
		holdReasons.push(
			`Evidence completeness (${(metrics.evidenceCompletenessRatio * 100).toFixed(1)}%) below minimum (${(PILOT_THRESHOLDS.evidenceCompletenessRatio * 100).toFixed(0)}%)`,
		);
	}

	if (metrics.sensitiveFieldLeakCount > 0) {
		holdReasons.push(
			`Sensitive field leak count (${metrics.sensitiveFieldLeakCount}) must be zero`,
		);
	}

	if (metrics.runIdCollisionCount > 0) {
		holdReasons.push(
			`RunId collision count (${metrics.runIdCollisionCount}) must be zero`,
		);
	}

	if (
		interventionRateMetric?.threshold?.operator === "max" &&
		metrics.interventionRate > interventionRateMetric.threshold.value
	) {
		warnings.push(
			`Intervention rate (${(metrics.interventionRate * 100).toFixed(1)}%) exceeds advisory threshold (${(interventionRateMetric.threshold.value * 100).toFixed(0)}%)`,
		);
	}

	if (
		thrashRateMetric?.threshold?.operator === "max" &&
		metrics.thrashRate > thrashRateMetric.threshold.value
	) {
		warnings.push(
			`Thrash rate (${(metrics.thrashRate * 100).toFixed(1)}%) exceeds advisory threshold (${(thrashRateMetric.threshold.value * 100).toFixed(0)}%)`,
		);
	}

	// Add warnings for near-threshold values
	if (
		metrics.leadTimeP50Improvement <=
		PILOT_THRESHOLDS.leadTimeP50Improvement * 0.9
	) {
		warnings.push("Lead time improvement approaching threshold");
	}
	if (metrics.evidenceCompletenessRatio < 0.98) {
		warnings.push("Evidence completeness below 98%");
	}

	const outcome: PilotOutcome = holdReasons.length > 0 ? "hold" : "promote";

	return { outcome, holdReasons, warnings };
}

function calculateCanonicalCoverageRatio(
	ingestion: PilotEvaluationIngestion,
): number {
	const sources = [
		ingestion.remediationEvents.source,
		ingestion.rollbackEvents.source,
	];
	const canonicalCount = sources.filter(
		(source) => source === "canonical",
	).length;
	return canonicalCount / sources.length;
}

function loadParityHistory(historyPath: string): ParityHistoryArtifact {
	if (!existsSync(historyPath)) {
		return {
			schemaVersion: "pilot-adapter-parity-history/v1",
			windows: [],
		};
	}

	try {
		const parsed = JSON.parse(
			readFileSync(historyPath, "utf-8"),
		) as Partial<ParityHistoryArtifact>;
		if (
			parsed.schemaVersion !== "pilot-adapter-parity-history/v1" ||
			!Array.isArray(parsed.windows)
		) {
			throw new Error("Unsupported parity history schema");
		}
		return {
			schemaVersion: "pilot-adapter-parity-history/v1",
			windows: parsed.windows.filter(
				(entry): entry is ParityHistoryEntry =>
					typeof entry?.windowStart === "string" &&
					typeof entry.windowEnd === "string" &&
					typeof entry.generatedAt === "string" &&
					(entry.lane === "advisory" || entry.lane === "health") &&
					typeof entry.canonicalCoverageRatio === "number" &&
					typeof entry.criticalDriftCount === "number" &&
					typeof entry.sensitiveFieldLeakCount === "number" &&
					typeof entry.runIdCollisionCount === "number" &&
					typeof entry.passing === "boolean",
			),
		};
	} catch (error) {
		throw new Error(
			`Failed to load parity history at ${historyPath}: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
	}
}

function countConsecutivePassingWindows(entries: ParityHistoryEntry[]): number {
	const sorted = [...entries].sort((left, right) =>
		right.generatedAt.localeCompare(left.generatedAt),
	);
	let count = 0;
	for (const entry of sorted) {
		if (!entry.passing) {
			break;
		}
		count++;
	}
	return count;
}

/**
 * Run pilot evaluation
 */
export function runPilotEvaluate(options: PilotEvaluateOptions): {
	ok: boolean;
	result?: PilotEvaluationResult;
	error?: { code: string; message: string };
	exitCode: number;
} {
	const startedAt = new Date().toISOString();
	const writeRunRecord = (params: {
		outcome: "success" | "hold" | "rollback" | "failed";
		classification:
			| "ok"
			| "validation_failed"
			| "runtime_failed"
			| "manual_intervention_required"
			| "rollback_required";
		exitCode: number;
		payload: Record<string, unknown>;
		artifacts?: Array<{ type: string; path: string; checksum?: string }>;
	}): string | null => {
		try {
			emitTerminalRunRecord({
				command: "pilot-evaluate",
				startedAt,
				outcome:
					params.outcome === "failed"
						? "failed"
						: params.outcome === "success"
							? "success"
							: params.outcome,
				classification: params.classification,
				exitCode: params.exitCode,
				...(options.runRecordsDir ? { baseDir: options.runRecordsDir } : {}),
				contract: {
					path: options.contractPath ?? "harness.contract.json",
				},
				policyContext: {
					mode: "evaluation",
					safetyPosture: "strict",
					effectivePolicySource: "pilot-evaluate-thresholds",
					hash: hashRunRecordValue({
						policy: "pilot-evaluate-thresholds",
						thresholds: PILOT_THRESHOLDS,
					}),
				},
				preconditions: {
					artifactsDirExists: existsSync(resolve(options.artifactsDir)),
				},
				...(params.artifacts ? { artifacts: params.artifacts } : {}),
				event: {
					eventType: "decision",
					status:
						params.classification === "ok"
							? "completed"
							: params.classification === "manual_intervention_required"
								? "blocked"
								: "failed",
					severity:
						params.classification === "ok"
							? "info"
							: params.classification === "manual_intervention_required"
								? "warn"
								: "error",
					payload: params.payload,
				},
			});
			return null;
		} catch (error) {
			return String(error);
		}
	};

	const artifactsDir = resolve(options.artifactsDir);
	const lane = options.lane ?? "advisory";

	// Check artifacts directory exists
	if (!existsSync(artifactsDir)) {
		const runRecordError = writeRunRecord({
			outcome: "failed",
			classification: "validation_failed",
			exitCode: PILOT_EVALUATE_EXIT_CODES.VALIDATION_ERROR,
			payload: {
				error: "artifacts_not_found",
				artifactsDir,
			},
		});
		if (runRecordError) {
			return {
				ok: false,
				error: {
					code: "E_RUN_RECORD",
					message: `Failed to emit canonical run record: ${runRecordError}`,
				},
				exitCode: PILOT_EVALUATE_EXIT_CODES.VALIDATION_ERROR,
			};
		}
		return {
			ok: false,
			error: {
				code: "E_ARTIFACTS_NOT_FOUND",
				message: `Artifacts directory not found: ${artifactsDir}`,
			},
			exitCode: PILOT_EVALUATE_EXIT_CODES.VALIDATION_ERROR,
		};
	}

	// Capture metrics from artifacts
	let metricRegistryError: string | null = null;
	try {
		loadMetricRegistry(options.metricRegistryPath);
	} catch (error) {
		metricRegistryError =
			error instanceof Error ? error.message : String(error);
	}
	let adapterRegistryError: string | null = null;
	let adapterRegistry = null;
	try {
		adapterRegistry = loadAdapterRegistry(options.adapterRegistryPath);
	} catch (error) {
		adapterRegistryError =
			error instanceof Error ? error.message : String(error);
	}
	const { metrics, errors, ingestion, driftWarnings } = capturePilotMetrics(
		artifactsDir,
		{
			...(options.runRecordsDir
				? { runRecordsDir: options.runRecordsDir }
				: {}),
			...(options.adapterRegistryPath
				? { adapterRegistryPath: options.adapterRegistryPath }
				: {}),
		},
	);
	if (metricRegistryError) {
		errors.push(metricRegistryError);
	}
	if (adapterRegistryError) {
		errors.push(adapterRegistryError);
	}

	if (errors.length > 0 && !metrics) {
		const runRecordError = writeRunRecord({
			outcome: "failed",
			classification: "validation_failed",
			exitCode: PILOT_EVALUATE_EXIT_CODES.VALIDATION_ERROR,
			payload: {
				error: "schema_validation_failed",
				errors,
			},
			artifacts: [
				{
					type: "pr-lead-time",
					path: resolve(artifactsDir, "pr-lead-time.json"),
				},
			],
		});
		if (runRecordError) {
			return {
				ok: false,
				error: {
					code: "E_RUN_RECORD",
					message: `Failed to emit canonical run record: ${runRecordError}`,
				},
				exitCode: PILOT_EVALUATE_EXIT_CODES.VALIDATION_ERROR,
			};
		}
		return {
			ok: false,
			error: {
				code: "E_SCHEMA_VALIDATION",
				message: `Artifact validation failed: ${errors.join("; ")}`,
			},
			exitCode: PILOT_EVALUATE_EXIT_CODES.VALIDATION_ERROR,
		};
	}

	if (!metrics) {
		const runRecordError = writeRunRecord({
			outcome: "failed",
			classification: "validation_failed",
			exitCode: PILOT_EVALUATE_EXIT_CODES.VALIDATION_ERROR,
			payload: {
				error: "no_metrics",
			},
		});
		if (runRecordError) {
			return {
				ok: false,
				error: {
					code: "E_RUN_RECORD",
					message: `Failed to emit canonical run record: ${runRecordError}`,
				},
				exitCode: PILOT_EVALUATE_EXIT_CODES.VALIDATION_ERROR,
			};
		}
		return {
			ok: false,
			error: {
				code: "E_NO_METRICS",
				message: "No valid metrics captured from artifacts",
			},
			exitCode: PILOT_EVALUATE_EXIT_CODES.VALIDATION_ERROR,
		};
	}

	if (
		errors.some(
			(error) =>
				error.includes("metric registry") || error.includes("adapter registry"),
		)
	) {
		const runRecordError = writeRunRecord({
			outcome: "failed",
			classification: "validation_failed",
			exitCode: PILOT_EVALUATE_EXIT_CODES.VALIDATION_ERROR,
			payload: {
				error: "registry_validation_failed",
				errors,
			},
		});
		if (runRecordError) {
			return {
				ok: false,
				error: {
					code: "E_RUN_RECORD",
					message: `Failed to emit canonical run record: ${runRecordError}`,
				},
				exitCode: PILOT_EVALUATE_EXIT_CODES.VALIDATION_ERROR,
			};
		}
		return {
			ok: false,
			error: {
				code: "E_REGISTRY_VALIDATION",
				message: `Registry validation failed: ${errors.join("; ")}`,
			},
			exitCode: PILOT_EVALUATE_EXIT_CODES.VALIDATION_ERROR,
		};
	}

	// Evaluate against thresholds
	const {
		outcome: computedOutcome,
		holdReasons,
		warnings,
	} = evaluateMetrics(metrics, {
		...(options.metricRegistryPath
			? { metricRegistryPath: options.metricRegistryPath }
			: {}),
		lane,
	});
	const canonicalCoverageRatio = calculateCanonicalCoverageRatio(ingestion);
	const legacyAdapterRegistryEntry =
		adapterRegistry &&
		getAdapterRegistryEntry(adapterRegistry, "legacy-jsonl-v1");
	const legacyAdapterEntries = [
		ingestion.remediationEvents,
		ingestion.rollbackEvents,
	]
		.filter((source) => source.source === "legacy_adapter")
		.map((source) =>
			source.adapterVersion === "none" || !adapterRegistry
				? undefined
				: getAdapterRegistryEntry(adapterRegistry, source.adapterVersion),
		)
		.filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
	const legacyBlockAfterExceeded = legacyAdapterEntries.some((entry) => {
		if (!entry.blockAfter) return false;
		return new Date(entry.blockAfter).getTime() <= Date.now();
	});
	const parityWindow = legacyAdapterRegistryEntry?.parityWindow;
	const parityHistoryPath = resolve(
		options.parityHistoryPath ??
			resolve(artifactsDir, "pilot-evaluation-parity-history.json"),
	);
	let manualSafeMode = options.killSwitch ?? false;
	let outcome: PilotOutcome = computedOutcome;
	let controlPlaneWarnings: string[] = [];
	let controlPlane:
		| NonNullable<PilotEvaluationResult["controlPlane"]>
		| undefined;

	if (lane === "health" && driftWarnings.length > 0) {
		outcome = computedOutcome === "rollback" ? "rollback" : "hold";
		holdReasons.push(
			"Canonical/legacy adapter drift detected; promotion blocked until resolved",
		);
		warnings.push(...driftWarnings);
	} else if (driftWarnings.length > 0) {
		warnings.push(...driftWarnings);
		warnings.push(
			"Advisory lane observed canonical/legacy drift; release gating remains manual-only",
		);
	}

	if (legacyBlockAfterExceeded) {
		manualSafeMode = true;
		if (lane === "health") {
			outcome = "hold";
			holdReasons.push(
				"Legacy adapter blockAfter has passed in health lane; manual safe mode required",
			);
		} else {
			warnings.push(
				"Legacy adapter blockAfter has passed; advisory lane records manual safe mode without promoting health enforcement",
			);
		}
	}

	if (options.killSwitch) {
		outcome = "hold";
		manualSafeMode = true;
		holdReasons.push(
			"Kill switch engaged; promotion frozen until manual safe mode is cleared",
		);
	}
	const currentWindowPassing =
		canonicalCoverageRatio >=
			(parityWindow?.minimumCanonicalCoverage ?? 0.95) &&
		driftWarnings.length <= (parityWindow?.maxCriticalDrifts ?? 0) &&
		metrics.sensitiveFieldLeakCount === 0 &&
		metrics.runIdCollisionCount === 0;
	let legacyRetirementReady =
		!legacyAdapterRegistryEntry && currentWindowPassing;
	let parityWindowStatus:
		| NonNullable<PilotEvaluationResult["controls"]["parityWindow"]>
		| undefined;

	if (parityWindow) {
		try {
			const history = loadParityHistory(parityHistoryPath);
			const historyKey = `${metrics.windowStart}:${metrics.windowEnd}:${lane}`;
			const nextEntry: ParityHistoryEntry = {
				windowStart: metrics.windowStart,
				windowEnd: metrics.windowEnd,
				generatedAt: new Date().toISOString(),
				lane,
				canonicalCoverageRatio,
				criticalDriftCount: driftWarnings.length,
				sensitiveFieldLeakCount: metrics.sensitiveFieldLeakCount,
				runIdCollisionCount: metrics.runIdCollisionCount,
				passing: currentWindowPassing,
			};
			const filtered = history.windows.filter(
				(entry) =>
					`${entry.windowStart}:${entry.windowEnd}:${entry.lane}` !==
					historyKey,
			);
			const nextHistory: ParityHistoryArtifact = {
				schemaVersion: "pilot-adapter-parity-history/v1",
				windows: [...filtered, nextEntry],
			};
			mkdirSync(dirname(parityHistoryPath), { recursive: true });
			writeFileSync(
				parityHistoryPath,
				JSON.stringify(nextHistory, null, 2),
				"utf-8",
			);

			const consecutivePassingWindows = countConsecutivePassingWindows(
				nextHistory.windows,
			);
			legacyRetirementReady =
				currentWindowPassing &&
				consecutivePassingWindows >=
					parityWindow.minimumConsecutivePassingWindows;
			parityWindowStatus = {
				historyPath: parityHistoryPath,
				currentWindowPassing,
				consecutivePassingWindows,
				requiredConsecutivePassingWindows:
					parityWindow.minimumConsecutivePassingWindows,
				criticalDriftCount: driftWarnings.length,
				allowedCriticalDrifts: parityWindow.maxCriticalDrifts,
				requiredCanonicalCoverage: parityWindow.minimumCanonicalCoverage,
			};
		} catch (error) {
			legacyRetirementReady = false;
			warnings.push(
				error instanceof Error
					? error.message
					: `Failed to update parity history at ${parityHistoryPath}`,
			);
		}
	}

	// Build result
	const result: PilotEvaluationResult = {
		schemaVersion: "pilot-evaluation/v1",
		generatedAt: new Date().toISOString(),
		metrics,
		outcome,
		holdReasons,
		warnings,
		ingestion,
		controls: {
			lane,
			killSwitchEngaged: options.killSwitch ?? false,
			manualSafeMode,
			canonicalCoverageRatio,
			legacyRetirementReady,
			...(parityWindowStatus ? { parityWindow: parityWindowStatus } : {}),
		},
	};

	if (shouldBuildControlPlane(options)) {
		const controlPlaneResult = buildControlPlaneArtifacts({
			artifactsDir,
			metrics,
			metricsErrors: errors,
			legacyOutcome: outcome,
			legacyHoldReasons: holdReasons,
			options,
		});
		controlPlaneWarnings = controlPlaneResult.warnings;
		controlPlane = controlPlaneResult.summary;
		result.controlPlane = controlPlane;
		if (controlPlaneWarnings.length > 0) {
			result.warnings.push(...controlPlaneWarnings);
		}
	}

	// Write output file if specified
	if (options.outputPath) {
		const cwd = process.cwd();
		let outputPath: string;
		try {
			outputPath = validatePath(cwd, options.outputPath);
		} catch (error) {
			if (error instanceof PathTraversalError) {
				const runRecordError = writeRunRecord({
					outcome: "failed",
					classification: "validation_failed",
					exitCode: PILOT_EVALUATE_EXIT_CODES.VALIDATION_ERROR,
					payload: {
						error: "path_traversal",
						outputPath: options.outputPath,
					},
				});
				if (runRecordError) {
					return {
						ok: false,
						error: {
							code: "E_RUN_RECORD",
							message: `Failed to emit canonical run record: ${runRecordError}`,
						},
						exitCode: PILOT_EVALUATE_EXIT_CODES.VALIDATION_ERROR,
					};
				}
				return {
					ok: false,
					error: {
						code: "E_PATH_TRAVERSAL",
						message: "Output path escapes working directory",
					},
					exitCode: PILOT_EVALUATE_EXIT_CODES.VALIDATION_ERROR,
				};
			}
			throw error;
		}
		const dir = dirname(outputPath);
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true });
		}
		writeFileSync(outputPath, JSON.stringify(result, null, 2), "utf-8");
	}

	// Determine exit code
	const exitCode =
		outcome === "promote"
			? PILOT_EVALUATE_EXIT_CODES.PROMOTE
			: outcome === "hold"
				? PILOT_EVALUATE_EXIT_CODES.HOLD
				: PILOT_EVALUATE_EXIT_CODES.ROLLBACK;

	const runRecordError = writeRunRecord({
		outcome: outcome === "promote" ? "success" : outcome,
		classification:
			outcome === "promote"
				? "ok"
				: outcome === "hold"
					? "manual_intervention_required"
					: "rollback_required",
		exitCode,
		payload: {
			outcome,
			holdReasons,
			warnings,
			ingestion,
			driftWarningCount: driftWarnings.length,
			controls: result.controls,
			...(controlPlane ? { controlPlane } : {}),
		},
		artifacts: [
			{
				type: "pr-lead-time",
				path: resolve(artifactsDir, "pr-lead-time.json"),
			},
			...ingestion.remediationEvents.mappedArtifactPaths.map((path) => ({
				type: "remediation-events",
				path,
			})),
			...ingestion.rollbackEvents.mappedArtifactPaths.map((path) => ({
				type: "rollback-events",
				path,
			})),
			{
				type: "incidents",
				path: resolve(artifactsDir, "incidents.jsonl"),
			},
			...(controlPlane
				? [
						{
							type: "control-plane-run",
							path: join(controlPlane.artifactRoot, "control-plane-run.json"),
						},
						{
							type: "governance-snapshot",
							path: join(controlPlane.artifactRoot, "governance-snapshot.json"),
						},
						{
							type: "instruction-parity",
							path: join(controlPlane.artifactRoot, "instruction-parity.json"),
						},
						{
							type: "control-plane-scorecard",
							path: join(
								controlPlane.artifactRoot,
								"control-plane-scorecard.json",
							),
						},
					]
				: []),
			...(options.outputPath
				? [
						{
							type: "evaluation-result",
							path: options.outputPath,
						},
					]
				: []),
		],
	});
	if (runRecordError) {
		return {
			ok: false,
			error: {
				code: "E_RUN_RECORD",
				message: `Failed to emit canonical run record: ${runRecordError}`,
			},
			exitCode: PILOT_EVALUATE_EXIT_CODES.VALIDATION_ERROR,
		};
	}

	return {
		ok: true,
		result,
		exitCode,
	};
}

function getRecoveryHint(code: string | undefined): string | undefined {
	switch (code) {
		case "E_ARTIFACTS_NOT_FOUND":
			return "Ensure pilot artifacts have been generated and the artifacts directory is valid";
		case "E_NO_METRICS":
			return "Ensure pilot metrics have been captured and metrics files exist";
		case "E_REGISTRY_VALIDATION":
			return "Check metric/adapter registry files for schema compliance";
		case "E_SCHEMA_VALIDATION":
			return "Verify all required options are provided and paths are valid";
		case "E_PATH_TRAVERSAL":
			return "Use relative paths within the repo or specify a different --harness-dir";
		default:
			return undefined;
	}
}

/**
 * CLI entry point for pilot-evaluate command
 */
export function runPilotEvaluateCLI(options: PilotEvaluateOptions): number {
	const { ok, result, error, exitCode } = runPilotEvaluate(options);

	if (!ok || !result) {
		const errorCode = (error?.code ?? "UNKNOWN_ERROR") as CliErrorCode;
		const recovery = getRecoveryHint(error?.code);
		if (options.json) {
			console.error(
				JSON.stringify(
					createJsonErrorOutput(
						"pilot-evaluate",
						{
							code: errorCode,
							message: error?.message ?? "Unknown error",
							...(recovery ? { recovery } : {}),
						},
						exitCode,
					),
					null,
					2,
				),
			);
		} else {
			console.error(`✗ ${error?.message}`);
			if (recovery) {
				console.error(`   Recovery: ${recovery}`);
			}
		}
		return exitCode;
	}

	if (options.json) {
		console.info(
			JSON.stringify(
				createJsonOutput("pilot-evaluate", result, exitCode),
				null,
				2,
			),
		);
	} else {
		// Human-readable output
		const { metrics, outcome, holdReasons, warnings, controlPlane } = result;

		const outcomeIcon =
			outcome === "promote" ? "✓" : outcome === "hold" ? "⏸" : "↩";
		const outcomeColor = outcome === "promote" ? "\x1b[32m" : "\x1b[33m";

		console.info(
			`${outcomeColor}${outcomeIcon} Pilot Evaluation: ${outcome.toUpperCase()}\x1b[0m`,
		);
		console.info();
		console.info("📊 Metrics Summary:");
		console.info(`  Window: ${metrics.windowStart} to ${metrics.windowEnd}`);
		console.info(`  Sample size: ${metrics.sampleSize} PRs`);
		console.info(
			`  Lead time p50 improvement: ${(metrics.leadTimeP50Improvement * 100).toFixed(1)}%`,
		);
		console.info(
			`  Lead time p75 improvement: ${(metrics.leadTimeP75Improvement * 100).toFixed(1)}%`,
		);
		console.info(
			`  Rollback reliability: ${(metrics.rollbackReliability * 100).toFixed(0)}%`,
		);
		console.info(
			`  High-risk incidents: ${metrics.highRiskAutomationIncidents}`,
		);
		console.info(
			`  Unresolved critical: ${metrics.unresolvedCriticalIncidents}`,
		);
		console.info(
			`  Evidence completeness: ${(metrics.evidenceCompletenessRatio * 100).toFixed(1)}%`,
		);

		if (holdReasons.length > 0) {
			console.info();
			console.info("⚠ Hold Reasons:");
			for (const reason of holdReasons) {
				console.info(`  • ${reason}`);
			}
		}

		if (warnings.length > 0) {
			console.info();
			console.info("⚡ Warnings:");
			for (const warning of warnings) {
				console.info(`  • ${warning}`);
			}
		}

		if (controlPlane) {
			console.info();
			console.info("🛡 Control Plane:");
			console.info(
				`  Evaluation: ${controlPlane.evaluationDecision} (${controlPlane.identityStatus})`,
			);
			console.info(`  Enforcement: ${controlPlane.enforcementDecision}`);
			console.info(`  Governance trust: ${controlPlane.governanceTrustLevel}`);
			console.info(
				`  Instruction parity: ${controlPlane.instructionParityStatus}`,
			);
			console.info(`  Artifacts: ${controlPlane.artifactRoot}`);
		}

		if (options.outputPath) {
			console.info();
			console.info(`📄 Output written to: ${options.outputPath}`);
		}
	}

	return exitCode;
}

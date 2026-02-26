/**
 * Pilot evaluate command
 *
 * Evaluates pilot metrics and determines promotion outcome (promote/hold/rollback).
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { capturePilotMetrics } from "../lib/pilot-evaluation/metrics-capture.js";
import {
	PILOT_EVALUATE_EXIT_CODES,
	PILOT_THRESHOLDS,
	type PilotEvaluateOptions,
	type PilotEvaluationResult,
	type PilotMetrics,
	type PilotOutcome,
} from "../lib/pilot-evaluation/types.js";

/**
 * Evaluate pilot metrics against thresholds
 */
function evaluateMetrics(metrics: PilotMetrics): {
	outcome: PilotOutcome;
	holdReasons: string[];
	warnings: string[];
} {
	const holdReasons: string[] = [];
	const warnings: string[] = [];

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

	// Rollback reliability check
	if (metrics.rollbackReliability < PILOT_THRESHOLDS.rollbackReliability) {
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
		PILOT_THRESHOLDS.evidenceCompletenessRatio
	) {
		holdReasons.push(
			`Evidence completeness (${(metrics.evidenceCompletenessRatio * 100).toFixed(1)}%) below minimum (${(PILOT_THRESHOLDS.evidenceCompletenessRatio * 100).toFixed(0)}%)`,
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

/**
 * Run pilot evaluation
 */
export function runPilotEvaluate(options: PilotEvaluateOptions): {
	ok: boolean;
	result?: PilotEvaluationResult;
	error?: { code: string; message: string };
	exitCode: number;
} {
	const artifactsDir = resolve(options.artifactsDir);

	// Check artifacts directory exists
	if (!existsSync(artifactsDir)) {
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
	const { metrics, errors } = capturePilotMetrics(artifactsDir);

	if (errors.length > 0 && !metrics) {
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
		return {
			ok: false,
			error: {
				code: "E_NO_METRICS",
				message: "No valid metrics captured from artifacts",
			},
			exitCode: PILOT_EVALUATE_EXIT_CODES.VALIDATION_ERROR,
		};
	}

	// Evaluate against thresholds
	const { outcome, holdReasons, warnings } = evaluateMetrics(metrics);

	// Build result
	const result: PilotEvaluationResult = {
		schemaVersion: "pilot-evaluation/v1",
		generatedAt: new Date().toISOString(),
		metrics,
		outcome,
		holdReasons,
		warnings,
	};

	// Write output file if specified
	if (options.outputPath) {
		const outputPath = resolve(options.outputPath);
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
				: PILOT_EVALUATE_EXIT_CODES.HOLD; // rollback also returns HOLD for now

	return {
		ok: true,
		result,
		exitCode,
	};
}

/**
 * CLI entry point for pilot-evaluate command
 */
export function runPilotEvaluateCLI(options: PilotEvaluateOptions): number {
	const { ok, result, error, exitCode } = runPilotEvaluate(options);

	if (!ok || !result) {
		if (options.json) {
			console.error(JSON.stringify({ error }, null, 2));
		} else {
			console.error(`✗ ${error?.message}`);
		}
		return exitCode;
	}

	if (options.json) {
		console.info(JSON.stringify(result, null, 2));
	} else {
		// Human-readable output
		const { metrics, outcome, holdReasons, warnings } = result;

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

		if (options.outputPath) {
			console.info();
			console.info(`📄 Output written to: ${options.outputPath}`);
		}
	}

	return exitCode;
}

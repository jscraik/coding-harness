import { enforceCodexBranch } from "./branch-enforcer.js";
import {
	calculateTrends,
	loadMetrics,
	saveMetrics,
	updateMetrics,
} from "./metrics-tracker.js";
import type { MemoryGateOptions } from "./types.js";
import { runMemoryGate } from "./validator.js";

/**
 * Run the memory gate in CLI mode and emit formatted output for humans or JSON.
 *
 * Loads historical metrics, executes validation, updates and persists
 * metrics/history when possible, computes trends, detects Codex branch status,
 * and prints either a structured JSON object or human-readable output.
 */
export function runMemoryGateCLI(options: MemoryGateOptions): number {
	const { metrics: previousMetrics, history } = loadMetrics(
		options.metricsPath,
	);
	const result = runMemoryGate(options);
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

	let updatedHistory = history;
	try {
		saveMetrics(updatedMetrics, history, options.metricsPath);
		updatedHistory = [
			...history.slice(-99),
			{
				date: new Date().toISOString(),
				metrics: { ...updatedMetrics },
			},
		];
	} catch {
		// Metrics persistence is advisory; validation result remains authoritative.
	}

	const trends = calculateTrends(updatedHistory);
	const codexResult = enforceCodexBranch({
		...(options.forjamiePath && { forjamiePath: options.forjamiePath }),
	});

	if (options.json) {
		console.log(
			JSON.stringify(
				{
					...result,
					metrics: updatedMetrics,
					trends,
					codex: codexResult.isCodexBranch
						? { branch: codexResult.branch, taskId: codexResult.taskId }
						: undefined,
				},
				null,
				2,
			),
		);
	} else {
		renderMemoryGateOutput(result, updatedMetrics, trends, codexResult);
	}

	return result.code;
}

function renderMemoryGateOutput(
	result: ReturnType<typeof runMemoryGate>,
	updatedMetrics: ReturnType<typeof updateMetrics>,
	trends: ReturnType<typeof calculateTrends>,
	codexResult: ReturnType<typeof enforceCodexBranch>,
): void {
	if (codexResult.isCodexBranch) {
		console.log(`🔷 Codex branch detected: ${codexResult.branch}`);
		if (codexResult.taskId) {
			console.log(`   Task: ${codexResult.taskId}`);
		}
		console.log();
	}

	if (result.ok) {
		console.log("✓ Memory artifacts valid and compliant");
		console.log("\n📊 Metrics:");
		console.log(`  Pass^k: ${updatedMetrics.pass_k}`);
		console.log(`  Total entries: ${updatedMetrics.total_ops}`);
		if (updatedMetrics.duplicate_memory_count > 0) {
			console.log(`  ⚠ Duplicates: ${updatedMetrics.duplicate_memory_count}`);
		}
		return;
	}

	console.error(`✗ ${result.message}`);
	if (result.violations.length > 0) {
		console.error("\nViolations:");
		for (const violation of result.violations) {
			console.error(`  [${violation.type}] ${violation.message}`);
		}
	}
	console.log(`  Reliability: ${trends.reliability_score.toFixed(1)}%`);
	if (trends.pass_k_trend !== "stable") {
		const trendIcon = trends.pass_k_trend === "improving" ? "📈" : "📉";
		console.log(`  ${trendIcon} Pass^k trend: ${trends.pass_k_trend}`);
	}
}

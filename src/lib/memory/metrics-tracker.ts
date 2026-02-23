/**
 * Reliability metrics tracker
 *
 * Persists metrics across runs for trend analysis:
 * - pass^k: consecutive successful operations
 * - Tool error rates per command
 * - Duplicate-memory detection rate
 * - Unresolved-question SLA tracking
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ReliabilityMetrics } from "./types.js";

/**
 * Stored metrics with history
 */
export interface MetricsHistory {
	/** Last calculated metrics */
	current: ReliabilityMetrics;
	/** Historical snapshots */
	history: Array<{
		date: string;
		metrics: ReliabilityMetrics;
	}>;
	/** First recorded date */
	started_at: string;
	/** Last update date */
	last_updated: string;
}

const DEFAULT_METRICS_PATH = ".memory-metrics.json";

/**
 * Initialize empty metrics
 */
export function createEmptyMetrics(): ReliabilityMetrics {
	return {
		pass_k: 0,
		total_ops: 0,
		successful_ops: 0,
		tool_errors: {},
		duplicate_memory_count: 0,
		unresolved_questions: [],
	};
}

/**
 * Read metrics from persistent storage
 */
export function loadMetrics(metricsPath?: string): {
	metrics: ReliabilityMetrics;
	history: MetricsHistory["history"];
} {
	const path = resolve(metricsPath ?? DEFAULT_METRICS_PATH);

	if (!existsSync(path)) {
		return { metrics: createEmptyMetrics(), history: [] };
	}

	try {
		const content = readFileSync(path, "utf-8");
		const data = JSON.parse(content) as MetricsHistory;
		return { metrics: data.current, history: data.history ?? [] };
	} catch {
		return { metrics: createEmptyMetrics(), history: [] };
	}
}

/**
 * Save metrics to persistent storage
 */
export function saveMetrics(
	metrics: ReliabilityMetrics,
	history: MetricsHistory["history"],
	metricsPath?: string,
): void {
	const path = resolve(metricsPath ?? DEFAULT_METRICS_PATH);
	const now = new Date().toISOString();

	const data: MetricsHistory = {
		current: metrics,
		history: [
			...history.slice(-99),
			{
				date: now,
				metrics: { ...metrics },
			},
		],
		started_at: history[0]?.date ?? now,
		last_updated: now,
	};

	writeFileSync(path, JSON.stringify(data, null, 2));
}

/**
 * Update metrics after a validation run
 */
export function updateMetrics(
	previous: ReliabilityMetrics,
	currentRun: {
		success: boolean;
		entryCount: number;
		toolErrors?: Record<string, number>;
		duplicates?: number;
	},
): ReliabilityMetrics {
	// Calculate pass^k: increment on success, reset on failure
	const pass_k = currentRun.success ? previous.pass_k + 1 : 0;

	// Merge tool errors
	const tool_errors = { ...previous.tool_errors };
	if (currentRun.toolErrors) {
		for (const [tool, count] of Object.entries(currentRun.toolErrors)) {
			tool_errors[tool] = (tool_errors[tool] ?? 0) + count;
		}
	}

	return {
		pass_k,
		total_ops: previous.total_ops + currentRun.entryCount,
		successful_ops: currentRun.success
			? previous.successful_ops + currentRun.entryCount
			: previous.successful_ops,
		tool_errors,
		duplicate_memory_count:
			previous.duplicate_memory_count + (currentRun.duplicates ?? 0),
		unresolved_questions: previous.unresolved_questions, // Preserved
	};
}

/**
 * Calculate trend indicators
 */
export function calculateTrends(history: MetricsHistory["history"]): {
	pass_k_trend: "improving" | "stable" | "degrading";
	error_rate: number;
	reliability_score: number;
} {
	if (history.length < 2) {
		return {
			pass_k_trend: "stable",
			error_rate: 0,
			reliability_score: 100,
		};
	}

	const recent = history.slice(-5);
	const passKValues = recent.map((h) => h.metrics.pass_k);

	// Pass^k trend
	let pass_k_trend: "improving" | "stable" | "degrading" = "stable";
	if (passKValues.length >= 2) {
		const first = passKValues[0] ?? 0;
		const last = passKValues[passKValues.length - 1] ?? 0;
		if (last > first) pass_k_trend = "improving";
		else if (last < first) pass_k_trend = "degrading";
	}

	// Error rate (errors per operation)
	const totalOps = recent.reduce((sum, h) => sum + h.metrics.total_ops, 0);
	const totalErrors = Object.values(
		recent.reduce(
			(acc, h) => {
				for (const [tool, count] of Object.entries(h.metrics.tool_errors)) {
					acc[tool] = (acc[tool] ?? 0) + count;
				}
				return acc;
			},
			{} as Record<string, number>,
		),
	).reduce((sum, count) => sum + count, 0);

	const error_rate = totalOps > 0 ? totalErrors / totalOps : 0;

	// Reliability score (0-100)
	const reliability_score = Math.max(0, Math.min(100, 100 - error_rate * 100));

	return {
		pass_k_trend,
		error_rate,
		reliability_score,
	};
}

/**
 * Add unresolved question for SLA tracking
 */
export function addUnresolvedQuestion(
	metrics: ReliabilityMetrics,
	question: string,
	slaHours = 24,
): ReliabilityMetrics {
	return {
		...metrics,
		unresolved_questions: [
			...metrics.unresolved_questions,
			{
				question,
				asked_at: new Date().toISOString(),
				sla_hours: slaHours,
			},
		],
	};
}

/**
 * Resolve questions that have exceeded SLA
 */
export function checkQuestionSLA(metrics: ReliabilityMetrics): {
	overdue: string[];
	withinSLA: string[];
} {
	const now = new Date();
	const overdue: string[] = [];
	const withinSLA: string[] = [];

	for (const q of metrics.unresolved_questions) {
		const askedAt = new Date(q.asked_at);
		const hoursElapsed = (now.getTime() - askedAt.getTime()) / (1000 * 60 * 60);

		if (hoursElapsed > q.sla_hours) {
			overdue.push(q.question);
		} else {
			withinSLA.push(q.question);
		}
	}

	return { overdue, withinSLA };
}

/**
 * Reset metrics (for testing or fresh start)
 */
export function resetMetrics(metricsPath?: string): void {
	const path = resolve(metricsPath ?? DEFAULT_METRICS_PATH);
	const empty = createEmptyMetrics();
	saveMetrics(empty, [], path);
}

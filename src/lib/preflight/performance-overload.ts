import os from "node:os";
import { performance } from "node:perf_hooks";
import process from "node:process";

const TRUEISH = new Set(["1", "true", "yes", "on"]);

export const PERFORMANCE_PRECHECK_ENV = {
	forceOverload: "HARNESS_TEST_FORCE_OVERLOAD",
	disablePrecheck: "HARNESS_TEST_DISABLE_OVERLOAD_PRECHECK",
	maxLoadPerCore: "HARNESS_TEST_MAX_LOAD_PER_CORE",
	minFreeMemoryRatio: "HARNESS_TEST_MIN_FREE_MEMORY_RATIO",
	maxEventLoopLagMs: "HARNESS_TEST_MAX_EVENT_LOOP_LAG_MS",
} as const;

export interface PerformanceOverloadThresholds {
	maxLoadPerCore: number;
	minFreeMemoryRatio: number;
	maxEventLoopLagMs: number;
}

export interface PerformanceOverloadObserved {
	cpuCount: number;
	loadPerCore?: number;
	freeMemoryRatio?: number;
	eventLoopLagMs: number;
}

export interface PerformanceOverloadPrecheckResult {
	overloaded: boolean;
	skippedByPolicy: boolean;
	reasons: string[];
	thresholds: PerformanceOverloadThresholds;
	observed: PerformanceOverloadObserved;
	diagnostic: string;
}

export interface PerformanceOverloadPrecheckOptions {
	context?: string;
	sampleWindowMs?: number;
	env?: NodeJS.ProcessEnv;
	thresholds?: Partial<PerformanceOverloadThresholds>;
	observed?: Partial<PerformanceOverloadObserved>;
}

const DEFAULT_THRESHOLDS: PerformanceOverloadThresholds = {
	maxLoadPerCore: 1.5,
	minFreeMemoryRatio: 0.1,
	maxEventLoopLagMs: 75,
};

function isTrueish(value: string | undefined): boolean {
	if (!value) {
		return false;
	}
	return TRUEISH.has(value.trim().toLowerCase());
}

function parseNumeric(value: string | undefined): number | undefined {
	if (!value) {
		return undefined;
	}
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : undefined;
}

function safeCpuCount(): number {
	const cpuCount = os.cpus().length;
	return cpuCount > 0 ? cpuCount : 1;
}

function safeLoadPerCore(cpuCount: number): number | undefined {
	const oneMinute = os.loadavg()[0] ?? 0;
	if (!Number.isFinite(oneMinute) || oneMinute <= 0) {
		return undefined;
	}
	return oneMinute / cpuCount;
}

function safeFreeMemoryRatio(): number | undefined {
	const total = os.totalmem();
	const free = os.freemem();
	if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(free)) {
		return undefined;
	}
	return free / total;
}

async function measureEventLoopLagMs(windowMs: number): Promise<number> {
	const started = performance.now();
	await new Promise<void>((resolve) => {
		setTimeout(resolve, windowMs);
	});
	const elapsed = performance.now() - started;
	return Math.max(0, elapsed - windowMs);
}

function formatMetric(value: number): string {
	return Number.isInteger(value) ? `${value}` : value.toFixed(2);
}

function formatPercent(value: number): string {
	return `${(value * 100).toFixed(1)}%`;
}

function resolveThresholds(
	options: PerformanceOverloadPrecheckOptions,
	env: NodeJS.ProcessEnv,
): PerformanceOverloadThresholds {
	return {
		maxLoadPerCore:
			options.thresholds?.maxLoadPerCore ??
			parseNumeric(env[PERFORMANCE_PRECHECK_ENV.maxLoadPerCore]) ??
			DEFAULT_THRESHOLDS.maxLoadPerCore,
		minFreeMemoryRatio:
			options.thresholds?.minFreeMemoryRatio ??
			parseNumeric(env[PERFORMANCE_PRECHECK_ENV.minFreeMemoryRatio]) ??
			DEFAULT_THRESHOLDS.minFreeMemoryRatio,
		maxEventLoopLagMs:
			options.thresholds?.maxEventLoopLagMs ??
			parseNumeric(env[PERFORMANCE_PRECHECK_ENV.maxEventLoopLagMs]) ??
			DEFAULT_THRESHOLDS.maxEventLoopLagMs,
	};
}

export function formatTimingAssertionSkipDiagnostic(
	result: PerformanceOverloadPrecheckResult,
): string {
	const context = result.diagnostic ? ` (${result.diagnostic})` : "";
	const observed: string[] = [
		`eventLoopLagMs=${formatMetric(result.observed.eventLoopLagMs)}`,
	];

	if (typeof result.observed.loadPerCore === "number") {
		observed.push(`loadPerCore=${formatMetric(result.observed.loadPerCore)}`);
	}
	if (typeof result.observed.freeMemoryRatio === "number") {
		observed.push(
			`freeMemory=${formatPercent(result.observed.freeMemoryRatio)}`,
		);
	}

	const reasonText =
		result.reasons.length > 0
			? result.reasons.join("; ")
			: "no overload reasons";

	return [
		`[perf-precheck] Timing-sensitive assertions skipped${context}.`,
		`Reasons: ${reasonText}.`,
		`Observed: ${observed.join(", ")}.`,
		"Functional assertions continued to run.",
	].join(" ");
}

export async function runPerformanceOverloadPrecheck(
	options: PerformanceOverloadPrecheckOptions = {},
): Promise<PerformanceOverloadPrecheckResult> {
	const env = options.env ?? process.env;
	const context = options.context?.trim() ?? "";
	const thresholds = resolveThresholds(options, env);

	const cpuCount = options.observed?.cpuCount ?? safeCpuCount();
	const loadPerCore =
		options.observed?.loadPerCore ?? safeLoadPerCore(Math.max(1, cpuCount));
	const freeMemoryRatio =
		options.observed?.freeMemoryRatio ?? safeFreeMemoryRatio();
	const eventLoopLagMs =
		options.observed?.eventLoopLagMs ??
		(await measureEventLoopLagMs(options.sampleWindowMs ?? 40));

	const observed: PerformanceOverloadObserved = {
		cpuCount,
		eventLoopLagMs,
		...(typeof loadPerCore === "number" ? { loadPerCore } : {}),
		...(typeof freeMemoryRatio === "number" ? { freeMemoryRatio } : {}),
	};

	if (isTrueish(env[PERFORMANCE_PRECHECK_ENV.disablePrecheck])) {
		return {
			overloaded: false,
			skippedByPolicy: true,
			reasons: [],
			thresholds,
			observed,
			diagnostic: context,
		};
	}

	const reasons: string[] = [];

	if (isTrueish(env[PERFORMANCE_PRECHECK_ENV.forceOverload])) {
		reasons.push(`forced by ${PERFORMANCE_PRECHECK_ENV.forceOverload}=true`);
	}

	if (
		typeof loadPerCore === "number" &&
		loadPerCore > thresholds.maxLoadPerCore
	) {
		reasons.push(
			`load/core ${formatMetric(loadPerCore)} > ${formatMetric(thresholds.maxLoadPerCore)}`,
		);
	}

	if (
		typeof freeMemoryRatio === "number" &&
		freeMemoryRatio < thresholds.minFreeMemoryRatio
	) {
		reasons.push(
			`free memory ${formatPercent(freeMemoryRatio)} < ${formatPercent(thresholds.minFreeMemoryRatio)}`,
		);
	}

	if (eventLoopLagMs > thresholds.maxEventLoopLagMs) {
		reasons.push(
			`event-loop lag ${formatMetric(eventLoopLagMs)}ms > ${formatMetric(thresholds.maxEventLoopLagMs)}ms`,
		);
	}

	const result: PerformanceOverloadPrecheckResult = {
		overloaded: reasons.length > 0,
		skippedByPolicy: false,
		reasons,
		thresholds,
		observed,
		diagnostic: context,
	};

	return result;
}

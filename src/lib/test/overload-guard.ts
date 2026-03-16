import os from "node:os";

const TRUE_FLAG_VALUES = new Set(["1", "true", "yes", "on"]);
const DEFAULT_MAX_LOAD_PER_CPU = 1.5;
const DEFAULT_MIN_FREE_MEMORY_RATIO = 0.08;

export interface TimingAssertionOverloadCheck {
	overloaded: boolean;
	reason: string;
	diagnostics: string[];
}

interface TimingAssertionOptions {
	label: string;
	assertion: () => void;
	reporter?: (message: string) => void;
	check?: TimingAssertionOverloadCheck;
}

function parseBooleanFlag(rawValue: string | undefined): boolean | null {
	if (typeof rawValue !== "string") {
		return null;
	}
	const normalized = rawValue.trim().toLowerCase();
	if (normalized.length === 0) {
		return null;
	}
	return TRUE_FLAG_VALUES.has(normalized);
}

function parseNumberFlag(
	rawValue: string | undefined,
	fallback: number,
): number {
	if (typeof rawValue !== "string" || rawValue.trim().length === 0) {
		return fallback;
	}
	const parsed = Number(rawValue);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function evaluateTimingAssertionOverload(): TimingAssertionOverloadCheck {
	const manualSkip = parseBooleanFlag(
		process.env.HARNESS_TEST_SKIP_TIMING_ASSERTIONS,
	);
	if (manualSkip === true) {
		return {
			overloaded: true,
			reason: "HARNESS_TEST_SKIP_TIMING_ASSERTIONS=1",
			diagnostics: ["manual override requested timing-assertion skip"],
		};
	}
	const manualOverload = parseBooleanFlag(process.env.HARNESS_TEST_OVERLOADED);
	if (manualOverload === true) {
		return {
			overloaded: true,
			reason: "HARNESS_TEST_OVERLOADED=1",
			diagnostics: ["manual overload signal received"],
		};
	}

	const cpuCount = Math.max(1, os.cpus().length);
	const oneMinuteLoad = os.loadavg()[0] ?? 0;
	const loadPerCpu = oneMinuteLoad / cpuCount;
	const maxLoadPerCpu = parseNumberFlag(
		process.env.HARNESS_TEST_MAX_LOAD_PER_CPU,
		DEFAULT_MAX_LOAD_PER_CPU,
	);

	const totalMemoryBytes = os.totalmem();
	const freeMemoryBytes = os.freemem();
	const freeMemoryRatio =
		totalMemoryBytes > 0 ? freeMemoryBytes / totalMemoryBytes : 1;
	const minFreeMemoryRatio = parseNumberFlag(
		process.env.HARNESS_TEST_MIN_FREE_MEMORY_RATIO,
		DEFAULT_MIN_FREE_MEMORY_RATIO,
	);

	const diagnostics = [
		`load1=${oneMinuteLoad.toFixed(2)}`,
		`cpus=${cpuCount}`,
		`loadPerCpu=${loadPerCpu.toFixed(2)}`,
		`maxLoadPerCpu=${maxLoadPerCpu.toFixed(2)}`,
		`freeMemoryRatio=${freeMemoryRatio.toFixed(3)}`,
		`minFreeMemoryRatio=${minFreeMemoryRatio.toFixed(3)}`,
	];
	const overloadReasons: string[] = [];

	// os.loadavg() is unsupported on Windows; skip this signal when all values are zero.
	if (oneMinuteLoad > 0 && loadPerCpu >= maxLoadPerCpu) {
		overloadReasons.push("load-per-cpu threshold exceeded");
	}
	if (freeMemoryRatio <= minFreeMemoryRatio) {
		overloadReasons.push("free-memory threshold exceeded");
	}

	if (overloadReasons.length > 0) {
		return {
			overloaded: true,
			reason: overloadReasons.join("; "),
			diagnostics,
		};
	}

	return {
		overloaded: false,
		reason: "within-threshold",
		diagnostics,
	};
}

export function runTimingAssertionWithOverloadGuard(
	options: TimingAssertionOptions,
): { skipped: boolean; diagnostic: string | null } {
	const check = options.check ?? evaluateTimingAssertionOverload();
	if (check.overloaded) {
		const diagnostic =
			`[timing-assertion-skipped] ${options.label} | reason=${check.reason} | ` +
			`signals=${check.diagnostics.join(", ")}`;
		(options.reporter ?? console.warn)(diagnostic);
		return { skipped: true, diagnostic };
	}

	options.assertion();
	return { skipped: false, diagnostic: null };
}

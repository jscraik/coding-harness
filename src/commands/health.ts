/**
 * harness health — JSC-67
 *
 * Unified gate status scorecard. Runs all applicable harness gates and
 * produces a single human-readable summary with exit-code semantics.
 *
 * Exit codes:
 *   0 — all gates green (or only advisory warnings)
 *   1 — one or more gates returned warnings
 *   2 — one or more gates returned errors / hard failures
 *
 * Usage:
 *   harness health [--dir <path>] [--json] [--gate <gate1,gate2,...>]
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

// ─── Types ────────────────────────────────────────────────────────────────────

export type GateStatus = "ok" | "warning" | "error" | "skipped";

export interface GateResult {
	/** Gate identifier (matches the harness subcommand name) */
	gate: string;
	/** Human-friendly display name */
	displayName: string;
	status: GateStatus;
	/** Short summary line shown in the scorecardoutput */
	summary: string;
	/** Exit code returned by the gate subprocess */
	exitCode: number | null;
	/** Reason gate was skipped (if status === 'skipped') */
	skipReason?: string;
}

export interface HealthReport {
	/** harness version */
	version: string;
	/** Project directory checked */
	dir: string;
	/** ISO timestamp of the health check */
	timestamp: string;
	gates: GateResult[];
	/** Overall health: 'green' | 'warning' | 'error' */
	overall: "green" | "warning" | "error";
	/** Total gate counts */
	counts: {
		ok: number;
		warning: number;
		error: number;
		skipped: number;
	};
}

export interface HealthOptions {
	dir?: string;
	json?: boolean;
	/** Comma-separated list of gate names to include (default: all applicable) */
	gates?: string[];
}

// ─── Gate Definitions ─────────────────────────────────────────────────────────

interface GateSpec {
	gate: string;
	displayName: string;
	/** CLI args to pass after the gate name */
	buildArgs: (dir: string) => string[];
	/** Return true if the gate is applicable to the given dir */
	isApplicable: (dir: string) => boolean;
	/** Map exit code to human-readable status */
	interpretExitCode: (code: number) => { status: GateStatus; summary: string };
}

function hasFile(dir: string, ...parts: string[]): boolean {
	return existsSync(resolve(dir, ...parts));
}

const GATE_SPECS: GateSpec[] = [
	{
		gate: "drift-gate",
		displayName: "Drift Gate",
		buildArgs: (dir) => ["--contract", resolve(dir, "harness.contract.json")],
		isApplicable: (dir) => hasFile(dir, "harness.contract.json"),
		interpretExitCode: (code) => {
			if (code === 0) return { status: "ok", summary: "clean — no new drift" };
			if (code === 1) return { status: "warning", summary: "advisory findings" };
			return { status: "error", summary: "gate hard failure" };
		},
	},
	{
		gate: "context-health",
		displayName: "Context Health",
		buildArgs: (dir) => ["--contract", resolve(dir, "harness.contract.json")],
		isApplicable: (dir) => hasFile(dir, "harness.contract.json"),
		interpretExitCode: (code) => {
			if (code === 0) return { status: "ok", summary: "coverage above threshold" };
			if (code === 1) return { status: "warning", summary: "below coverage target" };
			return { status: "error", summary: "health check failed" };
		},
	},
	{
		gate: "memory-gate",
		displayName: "Memory Gate",
		buildArgs: (dir) => [
			"--memory",
			resolve(dir, "memory.json"),
			"--forjamie",
			resolve(dir, "README.md"),
		],
		isApplicable: (dir) =>
			hasFile(dir, "memory.json") && hasFile(dir, "README.md"),
		interpretExitCode: (code) => {
			if (code === 0) return { status: "ok", summary: "valid, closeout current" };
			if (code === 1) return { status: "warning", summary: "closeout stale or missing" };
			return { status: "error", summary: "memory gate failed" };
		},
	},
	{
		gate: "gardener",
		displayName: "Gardener",
		buildArgs: (dir) => ["--contract", resolve(dir, "harness.contract.json")],
		isApplicable: (dir) => hasFile(dir, "harness.contract.json"),
		interpretExitCode: (code) => {
			if (code === 0) return { status: "ok", summary: "docs healthy" };
			if (code === 1)
				return { status: "warning", summary: "stale docs or broken links" };
			return { status: "error", summary: "gardener failed" };
		},
	},
	{
		gate: "ci-migrate",
		displayName: "CI Migration",
		buildArgs: () => ["verify"],
		isApplicable: (dir) => hasFile(dir, "harness.contract.json"),
		interpretExitCode: (code) => {
			if (code === 0) return { status: "ok", summary: "migration verified" };
			if (code === 1) return { status: "warning", summary: "verify warnings" };
			return { status: "error", summary: "verify failed — config or contract issue" };
		},
	},
	{
		gate: "docs-gate",
		displayName: "Docs Gate",
		buildArgs: (dir) => ["--contract", resolve(dir, "harness.contract.json")],
		isApplicable: (dir) => hasFile(dir, "harness.contract.json"),
		interpretExitCode: (code) => {
			if (code === 0) return { status: "ok", summary: "docs satisfy gate" };
			if (code === 1) return { status: "warning", summary: "docs advisory issues" };
			return { status: "error", summary: "docs gate hard failure" };
		},
	},
	{
		gate: "plan-gate",
		displayName: "Plan Gate",
		buildArgs: (dir) => ["--contract", resolve(dir, "harness.contract.json")],
		isApplicable: (dir) => hasFile(dir, "harness.contract.json"),
		interpretExitCode: (code) => {
			if (code === 0) return { status: "ok", summary: "plan gate satisfied" };
			if (code === 1) return { status: "warning", summary: "plan advisory issues" };
			return { status: "error", summary: "plan gate failed" };
		},
	},
];

// ─── Runner ───────────────────────────────────────────────────────────────────

/** Resolve the harness CLI binary path. */
function findHarnessBin(): string {
	// When running as a built CLI, use the same binary
	const candidates = [
		resolve(process.execPath, "..", "..", "bin", "harness"),
		resolve(process.cwd(), "node_modules", ".bin", "harness"),
		"harness",
	];
	for (const candidate of candidates) {
		if (existsSync(candidate)) {
			return candidate;
		}
	}
	// Fallback: run via node with the CLI entry point
	return "harness";
}

function runGate(
	spec: GateSpec,
	dir: string,
	harnessCliPath: string,
): GateResult {
	if (!spec.isApplicable(dir)) {
		return {
			gate: spec.gate,
			displayName: spec.displayName,
			status: "skipped",
			summary: "prerequisites not found",
			exitCode: null,
			skipReason: "Required config files not present in this directory",
		};
	}

	// P1: review-gate is an async gate excluded from structured-output normalisation v1.
	// Return skipped without spawning, so health --auto-fix can never misinterpret it.
	if (spec.gate === "review-gate") {
		return {
			gate: spec.gate,
			displayName: spec.displayName,
			status: "skipped",
			summary: "async gate — excluded from normalisation v1",
			exitCode: null,
			skipReason: "async-gate-excluded-from-normalisation-v1",
		};
	}

	const args = [spec.gate, ...spec.buildArgs(dir)];
	const result = spawnSync(harnessCliPath, args, {
		cwd: dir,
		encoding: "utf-8",
		// Capture output, don't inherit (to avoid mixing with health output)
		stdio: ["ignore", "pipe", "pipe"],
		// 60s timeout per gate
		timeout: 60_000,
	});

	const exitCode = result.status ?? (result.signal ? 2 : 0);
	const { status, summary } = spec.interpretExitCode(exitCode);

	return {
		gate: spec.gate,
		displayName: spec.displayName,
		status,
		summary,
		exitCode,
	};
}

// ─── Reporting ────────────────────────────────────────────────────────────────

const STATUS_ICONS: Record<GateStatus, string> = {
	ok: "✅",
	warning: "⚠️ ",
	error: "❌",
	skipped: "⏭️ ",
};

function renderScorecard(report: HealthReport): string {
	const lines: string[] = [];

	lines.push(`\nHarness ${report.version} — ${report.dir}`);
	lines.push(`Checked at ${new Date(report.timestamp).toLocaleString()}\n`);

	const colWidth = Math.max(...report.gates.map((g) => g.displayName.length)) + 2;

	for (const gate of report.gates) {
		const icon = STATUS_ICONS[gate.status];
		const name = gate.displayName.padEnd(colWidth);
		lines.push(`  ${icon}  ${name}${gate.summary}`);
	}

	lines.push("");
	const { ok, warning, error, skipped } = report.counts;
	const total = ok + warning + error;
	const skippedNote = skipped > 0 ? `, ${skipped} skipped` : "";
	lines.push(
		`  Overall: ${ok}/${total} green, ${warning} warning${warning !== 1 ? "s" : ""}, ${error} error${error !== 1 ? "s" : ""}${skippedNote}`,
	);

	const overallIcon =
		report.overall === "green"
			? "✅ All gates green"
			: report.overall === "warning"
				? "⚠️  Warnings present"
				: "❌ Errors detected";
	lines.push(`  ${overallIcon}\n`);

	return lines.join("\n");
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * JSC-67: Run all applicable harness gates and return a unified health report.
 */
export function runHealth(options: HealthOptions = {}): HealthReport {
	const dir = resolve(options.dir ?? process.cwd());
	const harnessCliPath = findHarnessBin();

	// Determine which gate specs to run
	let activeSpecs = GATE_SPECS;
	if (options.gates && options.gates.length > 0) {
		const requested = new Set(options.gates);
		activeSpecs = GATE_SPECS.filter((s) => requested.has(s.gate));
	}

	const gates: GateResult[] = activeSpecs.map((spec) =>
		runGate(spec, dir, harnessCliPath),
	);

	// Aggregate counts
	const counts = { ok: 0, warning: 0, error: 0, skipped: 0 };
	for (const g of gates) {
		counts[g.status]++;
	}

	const overall: "green" | "warning" | "error" =
		counts.error > 0 ? "error" : counts.warning > 0 ? "warning" : "green";

	return {
		version: "unknown", // Will be replaced by CLI layer
		dir,
		timestamp: new Date().toISOString(),
		gates,
		overall,
		counts,
	};
}

/**
 * CLI entry point for `harness health`.
 * Returns exit code (0=green, 1=warning, 2=error).
 */
export function runHealthCLI(
	args: string[],
	getVersion: () => string,
): number {
	const jsonFlag = args.includes("--json");
	const dirIndex = args.indexOf("--dir");
	const dir = dirIndex >= 0 ? args[dirIndex + 1] : undefined;
	const gateIndex = args.indexOf("--gate");
	const gateArg = gateIndex >= 0 ? args[gateIndex + 1] : undefined;
	const gates = gateArg ? gateArg.split(",").map((g) => g.trim()) : undefined;

	if (args.includes("--help") || args.includes("-h")) {
		console.log(
			[
				"",
				"harness health — unified gate status scorecard (JSC-67)",
				"",
				"Usage: harness health [options]",
				"",
				"Options:",
				"  --dir <path>       Target directory (default: current directory)",
				"  --gate <g1,g2,...> Run only specific gates (comma-separated)",
				"  --json             Output as JSON",
				"  --help             Show this help",
				"",
				"Gates: drift-gate, context-health, memory-gate, gardener, ci-migrate,",
				"       docs-gate, plan-gate",
				"",
				"Exit codes:",
				"  0  All gates green",
				"  1  One or more gates returned warnings",
				"  2  One or more gates returned errors",
				"",
			].join("\n"),
		);
		return 0;
	}

	const healthOpts: HealthOptions = {};
	if (dir) healthOpts.dir = dir;
	if (gates) healthOpts.gates = gates;
	const report = runHealth(healthOpts);
	report.version = getVersion();

	if (jsonFlag) {
		console.log(JSON.stringify(report, null, 2));
	} else {
		process.stdout.write(renderScorecard(report));
	}

	return report.overall === "green"
		? 0
		: report.overall === "warning"
			? 1
			: 2;
}

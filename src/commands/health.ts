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
 *                 [--auto-fix [--dry-run]]
 *
 * --auto-fix: Collect fixable findings from each gate (--json) and run
 *   their fix.command strings. Safe commands run automatically; excluded
 *   prefixes (branch-protect, contract, ci-migrate commit) are skipped.
 * --dry-run: When combined with --auto-fix, prints the fix plan without
 *   executing any fix commands.
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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
	/** When true, run --auto-fix loop after collection pass */
	autoFix?: boolean;
	/** When true (with autoFix), print plan without executing fix commands */
	dryRun?: boolean;
}

// ─── Auto-fix types ───────────────────────────────────────────────────────────

export interface AutoFixFinding {
	/** Canonical gate finding id */
	id: string;
	/** Gate that produced the finding */
	gate: string;
	/** Human message */
	message: string;
	/** Severity from GateResult */
	severity: "error" | "warning" | "info";
	/** The fix command string (present when fix.command is set on the finding) */
	command: string;
	/** Outcome of attempting the fix (populated after execution or dry-run) */
	outcome: "applied" | "failed" | "skipped" | "dry_run";
	/** Exit code from spawnSync when executed */
	exitCode: number | null;
	/** stdout captured from the fix command */
	stdout?: string;
	/** stderr captured from the fix command */
	stderr?: string;
}

export interface AutoFixResult {
	dir: string;
	timestamp: string;
	dryRun: boolean;
	findings: AutoFixFinding[];
	summary: {
		total: number;
		applied: number;
		failed: number;
		skipped: number;
	};
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
			if (code === 1)
				return { status: "warning", summary: "advisory findings" };
			return { status: "error", summary: "gate hard failure" };
		},
	},
	{
		gate: "context-health",
		displayName: "Context Health",
		buildArgs: (dir) => ["--contract", resolve(dir, "harness.contract.json")],
		isApplicable: (dir) => hasFile(dir, "harness.contract.json"),
		interpretExitCode: (code) => {
			if (code === 0)
				return { status: "ok", summary: "coverage above threshold" };
			if (code === 1)
				return { status: "warning", summary: "below coverage target" };
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
			if (code === 0)
				return { status: "ok", summary: "valid, closeout current" };
			if (code === 1)
				return { status: "warning", summary: "closeout stale or missing" };
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
			return {
				status: "error",
				summary: "verify failed — config or contract issue",
			};
		},
	},
	{
		gate: "docs-gate",
		displayName: "Docs Gate",
		buildArgs: (dir) => ["--contract", resolve(dir, "harness.contract.json")],
		isApplicable: (dir) => hasFile(dir, "harness.contract.json"),
		interpretExitCode: (code) => {
			if (code === 0) return { status: "ok", summary: "docs satisfy gate" };
			if (code === 1)
				return { status: "warning", summary: "docs advisory issues" };
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
			if (code === 1 || code === 2)
				return { status: "warning", summary: "plan advisory issues" };
			return { status: "error", summary: "plan gate failed" };
		},
	},
];

// ─── Runner ───────────────────────────────────────────────────────────────────

interface HarnessInvocation {
	command: string;
	prefixArgs: string[];
}

const require = createRequire(import.meta.url);

function resolveCliRuntimeArgs(cliEntry: string): string[] {
	if (cliEntry.endsWith(".js")) {
		return [cliEntry];
	}

	// Preserve current node runtime flags (for example tsx loader flags) when
	// health is invoked from source.
	if (process.execArgv.length > 0) {
		return [...process.execArgv, cliEntry];
	}

	// Fallback for source mode when no runtime flags are present.
	try {
		require.resolve("tsx");
		return ["--import", "tsx", cliEntry];
	} catch {
		return [cliEntry];
	}
}

/** Resolve a trusted harness CLI invocation from this package only. */
function findHarnessInvocation(): HarnessInvocation {
	const moduleDir = dirname(fileURLToPath(import.meta.url));
	const cliCandidates = [
		resolve(moduleDir, "..", "cli.js"),
		resolve(moduleDir, "..", "cli.ts"),
	];
	for (const cliEntry of cliCandidates) {
		if (existsSync(cliEntry)) {
			return {
				command: process.execPath,
				prefixArgs: resolveCliRuntimeArgs(cliEntry),
			};
		}
	}
	// Fallback to current executable only (never project-local node_modules/.bin or PATH)
	return { command: process.execPath, prefixArgs: [] };
}

function runGate(
	spec: GateSpec,
	dir: string,
	harnessInvocation: HarnessInvocation,
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

	const args = [
		...harnessInvocation.prefixArgs,
		spec.gate,
		...spec.buildArgs(dir),
	];
	const result = spawnSync(harnessInvocation.command, args, {
		cwd: dir,
		encoding: "utf-8",
		// Capture output, don't inherit (to avoid mixing with health output)
		stdio: ["ignore", "pipe", "pipe"],
		// 60s timeout per gate
		timeout: 60_000,
	});

	if (result.status === null && result.signal) {
		return {
			gate: spec.gate,
			displayName: spec.displayName,
			status: "error",
			summary: `gate interrupted (${result.signal})`,
			exitCode: 2,
		};
	}

	if (result.status === null && !result.signal && result.error) {
		return {
			gate: spec.gate,
			displayName: spec.displayName,
			status: "error",
			summary: `gate spawn failed: ${result.error.message}`,
			exitCode: 2,
		};
	}

	const exitCode = result.status ?? 0;
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

	const colWidth =
		Math.max(...report.gates.map((g) => g.displayName.length)) + 2;

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

// ─── Auto-fix runner ─────────────────────────────────────────────────────────

/**
 * Command prefixes that must never be auto-applied without explicit user
 * confirmation — they mutate external services or CI state.
 */
const EXCLUDED_PREFIXES = [
	"harness branch-protect",
	"harness contract",
	"harness ci-migrate commit",
];

function isExcludedCommand(cmd: string): boolean {
	return EXCLUDED_PREFIXES.some((prefix) => cmd.startsWith(prefix));
}

/**
 * Canonical GateFinding shape emitted by each gate's --json path.
 * This is the output type from src/lib/output/types.ts — duplicated here
 * as an inline type so health.ts has zero dependency on the lib/ layer.
 */
interface CanonicalFinding {
	id: string;
	severity: "error" | "warning" | "info";
	gate: string;
	message: string;
	baseline: boolean;
	fix?: {
		command?: string;
		manual?: string;
		suppressible: boolean;
	};
}

interface CanonicalGateResult {
	gate: string;
	status: "pass" | "fail" | "warn" | "skipped";
	findings: CanonicalFinding[];
}

/**
 * JSC-71 P5: Run gates with --json, collect fixable findings, execute safe
 * fix commands. Returns AutoFixResult (dry-run or executed).
 */
export function runAutoFix(
	options: HealthOptions & { dryRun: boolean },
): AutoFixResult {
	const dir = resolve(options.dir ?? process.cwd());
	const harnessInvocation = findHarnessInvocation();
	const timestamp = new Date().toISOString();

	// Determine active gate specs
	let activeSpecs = GATE_SPECS;
	if (options.gates && options.gates.length > 0) {
		const requested = new Set(options.gates);
		activeSpecs = GATE_SPECS.filter((s) => requested.has(s.gate));
	}

	// Collect fixable findings from each gate
	const allFindings: AutoFixFinding[] = [];

	for (const spec of activeSpecs) {
		if (spec.gate === "review-gate") continue; // async-excluded
		if (!spec.isApplicable(dir)) continue;

		const args = [
			...harnessInvocation.prefixArgs,
			spec.gate,
			...spec.buildArgs(dir),
			"--json",
		];
		let gateOut: CanonicalGateResult | null = null;
		try {
			const proc = spawnSync(harnessInvocation.command, args, {
				cwd: dir,
				encoding: "utf-8",
				stdio: ["ignore", "pipe", "pipe"],
				timeout: 60_000,
			});
			gateOut = JSON.parse(proc.stdout ?? "") as CanonicalGateResult;
		} catch {
			// R5: parse failure → treat as no fixable findings for this gate
			process.stderr.write(
				`[auto-fix] Failed to parse JSON from ${spec.gate} — skipping\n`,
			);
			continue;
		}

		if (!gateOut || !Array.isArray(gateOut.findings)) continue;

		for (const finding of gateOut.findings) {
			const cmd = finding.fix?.command;
			if (!cmd) continue; // only fixable findings
			allFindings.push({
				id: finding.id,
				gate: finding.gate,
				message: finding.message,
				severity: finding.severity,
				command: cmd,
				outcome: "dry_run", // will update below unless dry-run
				exitCode: null,
			});
		}
	}

	// Sort: error first, then warning, then info
	const severityOrder = { error: 0, warning: 1, info: 2 } as const;
	allFindings.sort(
		(a, b) => severityOrder[a.severity] - severityOrder[b.severity],
	);

	if (options.dryRun) {
		// Dry run: mark all as dry_run, no command execution
		const summary = {
			total: allFindings.length,
			applied: 0,
			failed: 0,
			skipped: allFindings.filter((f) => isExcludedCommand(f.command)).length,
		};
		return { dir, timestamp, dryRun: true, findings: allFindings, summary };
	}

	// Execution pass
	let applied = 0;
	let failed = 0;
	let skipped = 0;

	for (const finding of allFindings) {
		if (isExcludedCommand(finding.command)) {
			finding.outcome = "skipped";
			skipped++;
			process.stderr.write(
				`[auto-fix] Skipped (excluded): ${finding.id}: ${finding.command}\n`,
			);
			continue;
		}

		process.stderr.write(
			`[auto-fix] Applying [${finding.id}]: ${finding.command}\n`,
		);
		// Parse the command string into argv: split on whitespace
		const [bin, ...fixArgs] = finding.command.split(/\s+/);
		const fixResult = spawnSync(bin ?? finding.command, fixArgs, {
			cwd: dir,
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "pipe"],
			timeout: 60_000,
		});

		finding.exitCode = fixResult.status ?? (fixResult.signal ? 1 : 0);
		finding.stdout = fixResult.stdout ?? undefined;
		finding.stderr = fixResult.stderr ?? undefined;

		if (finding.exitCode === 0) {
			finding.outcome = "applied";
			applied++;
		} else {
			// R5: non-zero exit — record failure, continue remaining fixes
			finding.outcome = "failed";
			failed++;
			process.stderr.write(
				`[auto-fix] Fix failed (exit ${finding.exitCode}): ${finding.id}\n`,
			);
		}
	}

	return {
		dir,
		timestamp,
		dryRun: false,
		findings: allFindings,
		summary: { total: allFindings.length, applied, failed, skipped },
	};
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * JSC-67: Run all applicable harness gates and return a unified health report.
 */
export function runHealth(options: HealthOptions = {}): HealthReport {
	const dir = resolve(options.dir ?? process.cwd());
	const harnessInvocation = findHarnessInvocation();

	// Determine which gate specs to run
	let activeSpecs = GATE_SPECS;
	if (options.gates && options.gates.length > 0) {
		const requested = new Set(options.gates);
		activeSpecs = GATE_SPECS.filter((s) => requested.has(s.gate));
	}

	const gates: GateResult[] = activeSpecs.map((spec) =>
		runGate(spec, dir, harnessInvocation),
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
 * Returns exit code (0=green, 1=warning, 2=error, 2=any auto-fix failure).
 */
export function runHealthCLI(args: string[], getVersion: () => string): number {
	const jsonFlag = args.includes("--json");
	const autoFixFlag = args.includes("--auto-fix");
	const dryRunFlag = args.includes("--dry-run");
	const dirIndex = args.indexOf("--dir");
	const dir = dirIndex >= 0 ? args[dirIndex + 1] : undefined;
	const gateIndex = args.indexOf("--gate");
	const gateArg = gateIndex >= 0 ? args[gateIndex + 1] : undefined;
	const gates = gateArg ? gateArg.split(",").map((g) => g.trim()) : undefined;

	if (args.includes("--help") || args.includes("-h")) {
		return 0;
	}

	// ── auto-fix branch ────────────────────────────────────────────────────────
	if (autoFixFlag) {
		const fixOpts: HealthOptions & { dryRun: boolean } = {
			dryRun: dryRunFlag,
		};
		if (dir) fixOpts.dir = dir;
		if (gates) fixOpts.gates = gates;
		const fixResult = runAutoFix(fixOpts);

		if (jsonFlag) {
			process.stdout.write(`${JSON.stringify(fixResult, null, 2)}
`);
		} else {
			// Human-readable auto-fix summary
			const mode = dryRunFlag ? "[dry-run] " : "";
			const lines: string[] = [
				"",
				`Harness auto-fix ${mode}— ${fixResult.dir}`,
				`Scanned at ${new Date(fixResult.timestamp).toLocaleString()}`,
				"",
			];
			for (const f of fixResult.findings) {
				const icon =
					f.outcome === "applied"
						? "✅"
						: f.outcome === "failed"
							? "❌"
							: f.outcome === "skipped"
								? "⏭️ "
								: "🔍";
				lines.push(`  ${icon}  [${f.gate}] ${f.id}`);
				lines.push(`       ${f.command}`);
			}
			lines.push("");
			const { total, applied, failed, skipped } = fixResult.summary;
			lines.push(
				`  Summary: ${total} fixable finding${total !== 1 ? "s" : ""}, ${applied} applied, ${failed} failed, ${skipped} skipped`,
			);
			lines.push("");
			process.stdout.write(lines.join("\n"));
		}

		// Exit 2 if any fix failed; 0 otherwise (dry-run always 0)
		return fixResult.summary.failed > 0 ? 2 : 0;
	}

	// ── normal health check ────────────────────────────────────────────────────
	const healthOpts: HealthOptions = {};
	if (dir) healthOpts.dir = dir;
	if (gates) healthOpts.gates = gates;
	const report = runHealth(healthOpts);
	report.version = getVersion();

	if (jsonFlag) {
		console.info(JSON.stringify(report));
	} else {
		process.stdout.write(renderScorecard(report));
	}

	return report.overall === "green" ? 0 : report.overall === "warning" ? 1 : 2;
}
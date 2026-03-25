/**
 * Per-gate adapter functions: translate gate-internal result types to the canonical GateResult.
 *
 * All adapters are pure functions — no I/O, no side effects.
 * Implementations are added incrementally per plan phases P1–P3 + P2b.
 *
 * @see docs/plans/2026-03-24-feature-structured-output-auto-fix-plan.md
 */

import type { DocsFinding, DocsGateResult } from "../../commands/docs-gate.js";
import type {
	DriftFinding,
	DriftGateResult,
} from "../../commands/drift-gate.js";
import type { LinearGateResult } from "../../commands/linear-gate.js";
import type { PolicyGateResult } from "../../commands/policy-gate.js";
import type { PrTemplateGateResult } from "../../commands/pr-template-gate.js";
import type { PlanGateResult } from "../plan-gate/types.js";
import { getVersion } from "../version.js";
import type { GateFinding, GateResult } from "./types.js";

// ─── Re-export canonical types for convenience ────────────────────────────────
export type { GateFinding, GateResult, AutoFixResult } from "./types.js";

// ─── P1: drift-gate adapter ───────────────────────────────────────────────────

/** Map a DriftFinding to canonical GateFinding. Pure. */
function adaptDriftFinding(f: DriftFinding): GateFinding {
	const id = `drift-gate.${f.surface}.${f.rule_id}`;

	// DriftSeverity vocab already matches canonical: error | warning | info
	const severity = f.severity as GateFinding["severity"];

	return {
		id,
		severity,
		gate: "drift-gate",
		message: f.message,
		...(f.path !== undefined ? { path: f.path } : {}),
		// baseline_state === "preexisting" means this existed before current run
		baseline: f.baseline_state === "preexisting",
		fix: {
			...(f.fix?.command !== undefined ? { command: f.fix.command } : {}),
			...(f.fix?.manual !== undefined ? { manual: f.fix.manual } : {}),
			suppressible: f.fix?.suppressible ?? false,
		},
	};
}

/**
 * Normalise a DriftGateResult to canonical GateResult.
 * Status mapping:
 *   report.outcome === "error" → "fail"
 *   report.status  === "partial" → "warn"
 *   otherwise → "pass"
 */
export function normaliseDriftGateResult(result: DriftGateResult): GateResult {
	const gate = "drift-gate";
	const version = getVersion();
	const timestamp = result.report.generated_at ?? new Date().toISOString();

	const findings = result.report.findings.map(adaptDriftFinding);

	const errors = findings.filter(
		(f: GateFinding) => f.severity === "error",
	).length;
	const warnings = findings.filter(
		(f: GateFinding) => f.severity === "warning",
	).length;
	const info = findings.filter(
		(f: GateFinding) => f.severity === "info",
	).length;

	let status: GateResult["status"];
	if (result.report.outcome === "error") {
		status = "fail";
	} else if (result.report.status === "partial") {
		status = "warn";
	} else {
		status = "pass";
	}

	return {
		gate,
		version,
		timestamp,
		status,
		findings,
		summary: { errors, warnings, info, total: errors + warnings + info },
	};
}

// ─── P1: docs-gate adapter ────────────────────────────────────────────────────

/** Map a DocsFinding to canonical GateFinding. Pure. */
function adaptDocsFinding(f: DocsFinding): GateFinding {
	const id = `docs-gate.${f.surface}.${f.rule_id}`;

	// DocsSeverity vocab already matches canonical: error | warning | info
	const severity = f.severity as GateFinding["severity"];

	return {
		id,
		severity,
		gate: "docs-gate",
		message: f.message,
		...(f.path !== undefined ? { path: f.path } : {}),
		// docs-gate has no baseline concept
		baseline: false,
		// docs-gate findings have no fix.command — no automatable remediation
		fix: { suppressible: false },
	};
}

/**
 * Normalise a DocsGateResult to canonical GateResult.
 * Status mapping:
 *   report.outcome === "ok" → "pass"
 *   report.status  === "partial" → "warn"
 *   otherwise → "fail"
 */
export function normaliseDocsGateResult(result: DocsGateResult): GateResult {
	const gate = "docs-gate";
	const version = getVersion();
	const timestamp = result.report.generated_at ?? new Date().toISOString();

	const findings = result.report.findings.map(adaptDocsFinding);

	const errors = findings.filter(
		(f: GateFinding) => f.severity === "error",
	).length;
	const warnings = findings.filter(
		(f: GateFinding) => f.severity === "warning",
	).length;
	const info = findings.filter(
		(f: GateFinding) => f.severity === "info",
	).length;

	let status: GateResult["status"];
	if (result.report.outcome === "ok") {
		status = "pass";
	} else if (result.report.status === "partial") {
		status = "warn";
	} else {
		status = "fail";
	}

	return {
		gate,
		version,
		timestamp,
		status,
		findings,
		summary: { errors, warnings, info, total: errors + warnings + info },
	};
}

// ─── P2: policy-gate adapter (binary-result) ─────────────────────────────────

/**
 * Normalise a PolicyGateResult (binary-result class) to canonical GateResult.
 *
 * Synthesis rules (spec §4.2):
 *   ok:false           → one internal finding, status=fail
 *   ok:true, passed    → findings=[], status=pass
 *   ok:true, !passed   → one finding per violating file, status=fail
 *                        (guard: if violatingFiles empty → synthetic unknown finding)
 */
export function normalisePolicyGateResult(
	result: PolicyGateResult,
): GateResult {
	const gate = "policy-gate";
	const version = getVersion();
	const timestamp = new Date().toISOString();

	// ok:false — internal error before gate logic ran
	if (!result.ok) {
		const finding: GateFinding = {
			id: "policy-gate.result.internal",
			severity: "error",
			gate,
			message: result.error.message,
			baseline: false,
			fix: { suppressible: false },
		};
		return {
			gate,
			version,
			timestamp,
			status: "fail",
			findings: [finding],
			summary: { errors: 1, warnings: 0, info: 0, total: 1 },
		};
	}

	// ok:true, passed — clean run
	if (result.output.passed) {
		return {
			gate,
			version,
			timestamp,
			status: "pass",
			findings: [],
			summary: { errors: 0, warnings: 0, info: 0, total: 0 },
		};
	}

	// ok:true, !passed — synthesise one finding per violating file
	// Guard: never emit empty findings when status=fail (spec §7 edge cases)
	const violatingFiles = result.output.violatingFiles;
	const findings: GateFinding[] =
		violatingFiles.length > 0
			? violatingFiles.map(
					(file, index): GateFinding => ({
						id: `policy-gate.result.error.${index}`,
						severity: "error",
						gate,
						message: `File '${file}' exceeds policy tier (actual: ${result.output.tier}, max: ${result.output.maxAllowed ?? "unset"})`,
						...(file ? { path: file } : {}),
						baseline: false,
						fix: { suppressible: false },
					}),
				)
			: [
					{
						id: "policy-gate.result.error.unknown",
						severity: "error" as const,
						gate,
						message: "Gate reported failure without file details",
						baseline: false,
						fix: { suppressible: false },
					},
				];

	return {
		gate,
		version,
		timestamp,
		status: "fail",
		findings,
		summary: {
			errors: findings.length,
			warnings: 0,
			info: 0,
			total: findings.length,
		},
	};
}

// ─── P2: pr-template-gate adapter (binary-result) ────────────────────────────

/**
 * Normalise a PrTemplateGateResult (binary-result class) to canonical GateResult.
 *
 * Synthesis rules (spec §4.2):
 *   ok:false           → one internal finding, status=fail
 *   ok:true, passed    → findings=[], status=pass
 *   ok:true, !passed   → one finding per errors[index], status=fail
 *                        (guard: if errors empty → synthetic unknown finding)
 */
export function normalisePrTemplateGateResult(
	result: PrTemplateGateResult,
): GateResult {
	const gate = "pr-template-gate";
	const version = getVersion();
	const timestamp = new Date().toISOString();

	// ok:false — internal error
	if (!result.ok) {
		const finding: GateFinding = {
			id: "pr-template-gate.result.internal",
			severity: "error",
			gate,
			message: result.error.message,
			baseline: false,
			fix: { suppressible: false },
		};
		return {
			gate,
			version,
			timestamp,
			status: "fail",
			findings: [finding],
			summary: { errors: 1, warnings: 0, info: 0, total: 1 },
		};
	}

	// ok:true, passed — clean run
	if (result.output.passed) {
		return {
			gate,
			version,
			timestamp,
			status: "pass",
			findings: [],
			summary: { errors: 0, warnings: 0, info: 0, total: 0 },
		};
	}

	// ok:true, !passed — synthesise one finding per error string
	// Guard: never emit empty findings when status=fail (spec §7 edge cases)
	const errors = result.output.errors;
	const findings: GateFinding[] =
		errors.length > 0
			? errors.map(
					(msg, index): GateFinding => ({
						id: `pr-template-gate.result.error.${index}`,
						severity: "error",
						gate,
						message: msg,
						baseline: false,
						fix: { suppressible: false },
					}),
				)
			: [
					{
						id: "pr-template-gate.result.error.unknown",
						severity: "error" as const,
						gate,
						message: "Gate reported failure without error details",
						baseline: false,
						fix: { suppressible: false },
					},
				];

	return {
		gate,
		version,
		timestamp,
		status: "fail",
		findings,
		summary: {
			errors: findings.length,
			warnings: 0,
			info: 0,
			total: findings.length,
		},
	};
}

// ─── P2b: plan-gate adapter (coded-error) ────────────────────────────────────

/**
 * Normalise a PlanGateResult (coded-error class) to canonical GateResult.
 *
 * @param result - The PlanGateResult from runPlanGate()
 * @param recoveryHints - Caller-provided map of { code → hint string } to avoid
 *                        a lib→commands import violation. Build in runPlanGateCLI
 *                        by calling getRecoveryHint() per error code before invoking.
 */
export function normalisePlanGateResult(
	result: PlanGateResult,
	recoveryHints: Record<string, string | undefined> = {},
): GateResult {
	const gate = "plan-gate";
	const version = getVersion();
	const timestamp = new Date().toISOString();

	if (result.passed) {
		return {
			gate,
			version,
			timestamp,
			status: "pass",
			findings: [],
			summary: { errors: 0, warnings: 0, info: 0, total: 0 },
		};
	}

	const findings: GateFinding[] = result.errors.map((e) => {
		const hint = recoveryHints[e.code];
		return {
			id: `plan-gate.result.error.${e.code}`,
			severity: "error" as const,
			gate,
			message: e.message,
			...(e.path !== undefined ? { path: e.path } : {}),
			baseline: false,
			fix: {
				...(hint !== undefined ? { manual: hint } : {}),
				suppressible: false,
			},
		};
	});

	return {
		gate,
		version,
		timestamp,
		status: "fail",
		findings,
		summary: {
			errors: findings.length,
			warnings: 0,
			info: 0,
			total: findings.length,
		},
	};
}

// ─── P3: linear-gate adapter (check-list) ────────────────────────────────────

/**
 * Normalise a LinearGateResult (check-list class) to canonical GateResult.
 *
 * Synthesis rules:
 *   ok:false    → one internal finding, status=fail
 *   ok:true     → one finding per failing check (code → id), status=fail|pass
 */
export function normaliseLinearGateResult(
	result: LinearGateResult,
): GateResult {
	const gate = "linear-gate";
	const version = getVersion();
	const timestamp = new Date().toISOString();

	if (!result.ok) {
		const finding: GateFinding = {
			id: "linear-gate.result.internal",
			severity: "error",
			gate,
			message: result.error.message,
			baseline: false,
			fix: { suppressible: false },
		};
		return {
			gate,
			version,
			timestamp,
			status: "fail",
			findings: [finding],
			summary: { errors: 1, warnings: 0, info: 0, total: 1 },
		};
	}

	const failingChecks = result.output.checks.filter((c) => !c.passed);
	const findings: GateFinding[] = failingChecks.map((c) => ({
		id: `linear-gate.check.${c.code}`,
		severity: "error" as const,
		gate,
		message: c.message,
		baseline: false,
		fix: { suppressible: false },
	}));

	const status = findings.length > 0 ? "fail" : "pass";
	return {
		gate,
		version,
		timestamp,
		status,
		findings,
		summary: {
			errors: findings.length,
			warnings: 0,
			info: 0,
			total: findings.length,
		},
	};
}

/**
 * Per-gate adapter functions: translate gate-internal result types to the canonical GateResult.
 *
 * All adapters are pure functions — no I/O, no side effects.
 * Implementations are added incrementally per plan phases P1–P3 + P2b.
 *
 * @see docs/plans/2026-03-24-feature-structured-output-auto-fix-plan.md
 */

import type {
	DriftGateResult,
	DriftFinding,
} from "../../commands/drift-gate.js";
import type {
	DocsGateResult,
	DocsFinding,
} from "../../commands/docs-gate.js";
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

	const errors = findings.filter((f: GateFinding) => f.severity === "error").length;
	const warnings = findings.filter((f: GateFinding) => f.severity === "warning").length;
	const info = findings.filter((f: GateFinding) => f.severity === "info").length;

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

	const errors = findings.filter((f: GateFinding) => f.severity === "error").length;
	const warnings = findings.filter((f: GateFinding) => f.severity === "warning").length;
	const info = findings.filter((f: GateFinding) => f.severity === "info").length;

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

// ─── P2 stub: policy-gate ─────────────────────────────────────────────────────

/**
 * Normalise a policy-gate binary result to canonical GateResult.
 * @throws Not yet implemented (stub — P2 phase)
 */
export function normalisePolicyGateResult(_result: unknown): GateResult {
	throw new Error("not implemented: normalisePolicyGateResult (P2)");
}

// ─── P2 stub: pr-template-gate ───────────────────────────────────────────────

/**
 * Normalise a pr-template-gate binary result to canonical GateResult.
 * @throws Not yet implemented (stub — P2 phase)
 */
export function normalisePrTemplateGateResult(_result: unknown): GateResult {
	throw new Error("not implemented: normalisePrTemplateGateResult (P2)");
}

// ─── P2b stub: plan-gate (coded-error) ───────────────────────────────────────

/**
 * Normalise a PlanGateResult (coded-error class) to canonical GateResult.
 * @param recoveryHints - Caller-provided map of { code → hint string } to avoid
 *                        a lib→commands import violation. Build in runPlanGateCLI
 *                        by calling getRecoveryHint() per error code before invoking.
 * @throws Not yet implemented (stub — P2b phase)
 */
export function normalisePlanGateResult(
	_result: unknown,
	_recoveryHints: Record<string, string | undefined> = {},
): GateResult {
	throw new Error("not implemented: normalisePlanGateResult (P2b)");
}

// ─── P3 stub: linear-gate ────────────────────────────────────────────────────

/**
 * Normalise a linear-gate check-list result to canonical GateResult.
 * @throws Not yet implemented (stub — P3 phase)
 */
export function normaliseLinearGateResult(_result: unknown): GateResult {
	throw new Error("not implemented: normaliseLinearGateResult (P3)");
}

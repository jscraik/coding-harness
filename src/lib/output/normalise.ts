/**
 * Per-gate adapter functions: translate gate-internal result types to the canonical GateResult.
 *
 * All adapters are pure functions — no I/O, no side effects.
 * Implementations are added incrementally per plan phases P1–P3 + P2b.
 *
 * @see docs/plans/2026-03-24-feature-structured-output-auto-fix-plan.md
 */

import type { GateResult } from "./types.js";

// ─── Re-export canonical types for convenience ────────────────────────────────
export type { GateFinding, GateResult, AutoFixResult } from "./types.js";

// ─── P1 stub: drift-gate ──────────────────────────────────────────────────────

/**
 * Normalise a DriftGateResult to canonical GateResult.
 * @throws Not yet implemented (stub — P1 phase)
 */
export function normaliseDriftGateResult(_result: unknown): GateResult {
	throw new Error("not implemented: normaliseDriftGateResult (P1)");
}

// ─── P1 stub: docs-gate ───────────────────────────────────────────────────────

/**
 * Normalise a DocsGateResult to canonical GateResult.
 * @throws Not yet implemented (stub — P1 phase)
 */
export function normaliseDocsGateResult(_result: unknown): GateResult {
	throw new Error("not implemented: normaliseDocsGateResult (P1)");
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

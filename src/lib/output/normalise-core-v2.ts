/**
 * Per-gate adapter functions: translate gate-internal result types to the canonical GateResult.
 *
 * All adapters are pure functions — no I/O, no side effects.
 * Implementations are added incrementally per plan phases P1–P3 + P2b.
 *
 * @see docs/plans/2026-03-24-feature-structured-output-auto-fix-plan.md
 */

import type {
	DriftFinding,
	DriftGateResult,
} from "../../commands/drift-gate.js";
import { buildGateResult, uniqueStrings } from "./normalise-core.js";
import type { GateFinding, GateResult } from "./types.js";

// ─── Re-export canonical types for convenience ────────────────────────────────
export type { GateFinding, GateResult, AutoFixResult } from "./types.js";
export {
	classifyLinearGateFailure,
	normaliseLinearGateResult,
} from "./normalise-linear-gate.js";
export { normaliseDocsGateResult } from "./normalise-docs-gate.js";
export { normaliseHePhaseExitResult } from "./normalise-he-phase-exit.js";
export { normalisePlanGateResult } from "./normalise-plan-gate.js";
export { normalisePrTemplateGateResult } from "./normalise-pr-template-gate.js";
export { normalisePolicyGateResult } from "./normalise-policy-gate.js";
export type { LinearGateFailureClassification } from "./normalise-linear-gate.js";
export { renderGateDecision } from "./normalise-renderer.js";

function defaultEvidenceRef(gate: string, findings: GateFinding[]): string[] {
	const refs = uniqueStrings(
		findings.flatMap((finding) => [
			finding.path ? `path:${finding.path}` : undefined,
			`finding:${finding.id}`,
		]),
	);
	return refs.length > 0 ? refs : [`gate:${gate}`];
}

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
		...(f.failureClass !== undefined ? { failureClass: f.failureClass } : {}),
		fix: {
			...(f.fix?.command !== undefined ? { command: f.fix.command } : {}),
			...(f.fix?.manual !== undefined ? { manual: f.fix.manual } : {}),
			suppressible: f.fix?.suppressible ?? false,
		},
	};
}

/**
 * Convert a DriftGateResult into a canonical GateResult for the drift-gate.
 *
 * The returned GateResult contains findings mapped from the drift report, a
 * timestamp taken from the report (or now), and a status derived from the
 * report outcome/status:
 * - `report.outcome === "error"` or `report.status === "blocked"` → `fail`
 * - `report.status === "partial"` → `warn`
 * - otherwise → `pass`
 *
 * When the drift report provides artifact references, those paths are included
 * in `meta.artifactRefs` and are merged into the result `decision.evidenceRef`.
 *
 * @param result - The raw DriftGateResult produced by the drift gate
 * @returns A canonical GateResult representing the normalized drift-gate output
 */
export function normaliseDriftGateResult(result: DriftGateResult): GateResult {
	const gate = "drift-gate";
	const timestamp = result.report.generated_at ?? new Date().toISOString();

	const findings = result.report.findings.map(adaptDriftFinding);
	const artifactRefs = result.report.artifact_refs ?? [];
	const artifactEvidenceRefs = artifactRefs.map(
		(artifact) => `artifact:${artifact.path}`,
	);
	const evidenceRef = uniqueStrings([
		...defaultEvidenceRef(gate, findings),
		...artifactEvidenceRefs,
	]);

	let status: GateResult["status"];
	if (result.report.outcome === "error" || result.report.status === "blocked") {
		status = "fail";
	} else if (result.report.status === "partial") {
		status = "warn";
	} else {
		status = "pass";
	}

	return buildGateResult({
		gate,
		timestamp,
		status,
		findings,
		...(artifactRefs.length > 0
			? {
					meta: { artifactRefs },
					decision: { evidenceRef },
				}
			: {}),
	});
}

export {
	normalisePreflightGateResult,
	normaliseReviewGateResult,
} from "./normalise-review-preflight.js";

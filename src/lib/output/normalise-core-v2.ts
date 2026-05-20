/** Compatibility export surface for output normalisation modules. */

// ─── Re-export canonical types for convenience ────────────────────────────────
export type { GateFinding, GateResult, AutoFixResult } from "./types.js";
export {
	classifyLinearGateFailure,
	normaliseLinearGateResult,
} from "./normalise-linear-gate.js";
export { normaliseDocsGateResult } from "./normalise-docs-gate.js";
export { normaliseDriftGateResult } from "./normalise-drift-gate.js";
export { normaliseHePhaseExitResult } from "./normalise-he-phase-exit.js";
export { normalisePlanGateResult } from "./normalise-plan-gate.js";
export { normalisePrTemplateGateResult } from "./normalise-pr-template-gate.js";
export { normalisePolicyGateResult } from "./normalise-policy-gate.js";
export type { LinearGateFailureClassification } from "./normalise-linear-gate.js";
export { renderGateDecision } from "./normalise-renderer.js";

export {
	normalisePreflightGateResult,
	normaliseReviewGateResult,
} from "./normalise-review-preflight.js";

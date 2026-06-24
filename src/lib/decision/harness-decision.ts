export { buildHarnessDecision } from "./harness-decision-builder.js";
import type { HarnessDecision } from "./harness-decision-types.js";
import { validateHarnessDecision } from "./harness-decision-validation.js";

export type {
	HarnessDecision,
	HarnessDecisionCockpitLane,
	HarnessDecisionDelayClass,
	HarnessDecisionExecutionMetadata,
	HarnessDecisionExecutionProfile,
	HarnessDecisionFrictionClass,
	HarnessDecisionInput,
	HarnessDecisionOperationalMeta,
	HarnessDecisionPermissionPlan,
	HarnessDecisionPhase,
	HarnessDecisionProducer,
	HarnessDecisionRetry,
	HarnessDecisionRiskTier,
	HarnessDecisionStartupCost,
	HarnessDecisionStatus,
	HarnessDecisionValidationResult,
} from "./harness-decision-types.js";
export { HARNESS_DECISION_SCHEMA_VERSION } from "./harness-decision-types.js";
export {
	validateHarnessDecision,
	validateHarnessDecisionOperationalMeta,
} from "./harness-decision-validation.js";

/** Return whether a value satisfies harness-decision/v1. */
export function isHarnessDecision(value: unknown): value is HarnessDecision {
	return validateHarnessDecision(value).valid;
}

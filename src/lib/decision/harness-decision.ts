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
	HarnessDecisionMeta,
	HarnessDecisionOperationalMeta,
	HarnessDecisionPermissionPlan,
	HarnessDecisionPhase,
	HarnessDecisionProducer,
	HarnessDecisionRecommendationAuthority,
	HarnessDecisionRecommendationEffects,
	HarnessDecisionRetry,
	HarnessDecisionRiskTier,
	HarnessDecisionStartupCost,
	HarnessDecisionStatus,
	HarnessDecisionValidationResult,
} from "./harness-decision-types.js";
export {
	HARNESS_DECISION_RECOMMENDATION_EFFECTS_SCHEMA_VERSION,
	HARNESS_DECISION_SCHEMA_VERSION,
} from "./harness-decision-types.js";
export {
	validateHarnessDecision,
	validateHarnessDecisionOperationalMeta,
} from "./harness-decision-validation.js";

/** Return whether a value satisfies harness-decision/v1. */
export function isHarnessDecision(value: unknown): value is HarnessDecision {
	return validateHarnessDecision(value).valid;
}

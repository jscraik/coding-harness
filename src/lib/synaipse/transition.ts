import { isRfc3339DateTime } from "./date-time.js";
import {
	BLOCKERS,
	type STAGES,
	type Blocker,
	type SynaipseTransitionInput,
} from "./transition-contract.js";
import { validateSynaipseTransition } from "./transition-validation.js";

export {
	SYNAIPSE_TRANSITION_SCHEMA_VERSION,
	type SynaipseTransitionInput,
	type SynaipseTransitionValidationResult,
} from "./transition-contract.js";
export { validateSynaipseTransition } from "./transition-validation.js";

/** Result returned by the lifecycle authority gate. */
export interface SynaipseTransitionDecision {
	status: "admitted" | "blocked" | "interrupted";
	blockers: string[];
	recovery: string | null;
}

const ALLOWED_TRANSITIONS: Readonly<
	Record<(typeof STAGES)[number], readonly (typeof STAGES)[number][]>
> = {
	orient: ["verify"],
	verify: ["review"],
	review: ["repair", "handoff"],
	repair: ["verify", "review"],
	handoff: [],
};

/** Decide whether a transition can proceed without a new operator decision. */
export function decideSynaipseTransition(
	input: SynaipseTransitionInput,
	options: { expectedSha: string; now: string },
): SynaipseTransitionDecision {
	const validation = validateSynaipseTransition(input);
	if (!validation.valid)
		return blocked("invalid_transition_contract", "repair_transition_contract");
	if (hasStaleSha(input, options.expectedSha))
		return blocked("stale_sha", "refresh_evidence");
	if (!isAllowedTransition(input))
		return blocked("stage_transition_not_allowed", "return_to_previous_stage");
	if (input.vitalDecision.required)
		return {
			status: "interrupted",
			blockers: ["vital_decision_required"],
			recovery: "request_operator_decision",
		};
	const authorityBlocker = evaluateAuthorityGuards(input, options.now);
	if (authorityBlocker) return authorityBlocker;
	return { status: "admitted", blockers: [], recovery: null };
}

/** Build a deterministic blocked decision. */
function blocked(
	blocker: string,
	recovery: string,
): SynaipseTransitionDecision {
	return { status: "blocked", blockers: [blocker], recovery };
}

/** Return whether all SHA observations match the independently supplied SHA. */
function hasStaleSha(
	input: SynaipseTransitionInput,
	expectedSha: string,
): boolean {
	return (
		input.repositorySha !== expectedSha ||
		input.evidence.currentSha !== expectedSha ||
		input.evidence.hostedMain.sha !== expectedSha ||
		(input.recovery?.refreshedSha !== undefined &&
			input.recovery.refreshedSha !== expectedSha)
	);
}

/** Return whether the lifecycle graph permits this stage transition. */
function isAllowedTransition(input: SynaipseTransitionInput): boolean {
	return ALLOWED_TRANSITIONS[input.fromStage].includes(input.toStage);
}

/** Return the operation-scoped capability required for this transition. */
function hasRequiredCapability(input: SynaipseTransitionInput): boolean {
	return input.authority.capabilities.includes(
		`transition:${input.fromStage}->${input.toStage}`,
	);
}

/** Evaluate standing authority, time, capability, recovery, and waiver guards. */
function evaluateAuthorityGuards(
	input: SynaipseTransitionInput,
	now: string,
): SynaipseTransitionDecision | null {
	if (!input.authority.standing)
		return blocked("standing_authority_required", "obtain_standing_authority");
	if (!isRfc3339DateTime(now))
		return blocked("invalid_transition_options", "revalidate_decision_time");
	if (!hasRequiredCapability(input))
		return blocked(
			"authority_capability_missing",
			"obtain_transition_capability",
		);
	if (hasInvalidRecovery(input))
		return blocked("recovery_reference_invalid", "refresh_recovery_evidence");
	if (hasInvalidWaiver(input))
		return blocked(
			"waiver_scope_or_authority_invalid",
			"renew_waiver_or_follow_policy",
		);
	if (isExpiredWaiver(input.waiver, now))
		return blocked("waiver_expired", "renew_waiver_or_follow_policy");
	return null;
}

/** Return whether recovery cites a constrained blocker and refreshed evidence. */
function hasInvalidRecovery(input: SynaipseTransitionInput): boolean {
	if (input.recovery === null) return false;
	const requiresOperatorDecision =
		input.recovery.fromBlocker === "vital_decision_required";
	const hasOperatorDecisionReceipt = input.recovery.evidenceRefs.some((ref) =>
		ref.startsWith("operator-decision:"),
	);
	return (
		!BLOCKERS.includes(input.recovery.fromBlocker as Blocker) ||
		input.recovery.refreshedSha !== input.evidence.hostedMain.sha ||
		!input.recovery.evidenceRefs.includes(
			`recovery:${input.recovery.fromBlocker}`,
		) ||
		(requiresOperatorDecision &&
			(input.authority.owner !== "operator" || !hasOperatorDecisionReceipt))
	);
}

/** Return whether a waiver covers this exact transition and authority. */
function hasInvalidWaiver(input: SynaipseTransitionInput): boolean {
	if (input.waiver === null) return false;
	const scope = `${input.fromStage}->${input.toStage}`;
	return (
		input.waiver.scope !== scope ||
		input.waiver.issuer !== input.authority.owner ||
		!input.authority.capabilities.includes(`waiver:${scope}`)
	);
}

/** Return whether a supplied waiver has expired at the decision time. */
function isExpiredWaiver(
	input: SynaipseTransitionInput["waiver"],
	now: string,
): boolean {
	return (
		input !== null &&
		isRfc3339DateTime(input.expiresAt) &&
		Date.parse(input.expiresAt) <= Date.parse(now)
	);
}

import { isRecord } from "../decision/validators.js";
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
	shape: ["admit"],
	admit: ["build"],
	build: ["prove"],
	prove: ["review"],
	review: ["integrate"],
	integrate: ["improve"],
	improve: ["shape"],
};

/** Decide whether a transition can proceed without a new operator decision. */
export function decideSynaipseTransition(
	input: SynaipseTransitionInput,
	options: { expectedSha: string; now: string },
): SynaipseTransitionDecision {
	const bindingBlocker = evaluateBindingGuards(input);
	if (bindingBlocker) return bindingBlocker;
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

/** Return specific recovery or waiver blockers before generic contract errors. */
function evaluateBindingGuards(
	input: SynaipseTransitionInput,
): SynaipseTransitionDecision | null {
	if (hasInvalidRecovery(input))
		return blocked("recovery_reference_invalid", "refresh_recovery_evidence");
	if (hasInvalidWaiver(input))
		return blocked(
			"waiver_scope_or_authority_invalid",
			"renew_waiver_or_follow_policy",
		);
	return null;
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
	if (isExpiredWaiver(input.waiver, now))
		return blocked("waiver_expired", "renew_waiver_or_follow_policy");
	return null;
}

/** Return whether recovery cites a constrained blocker and refreshed evidence. */
function stringRefs(value: unknown): string[] {
	return Array.isArray(value)
		? value.filter((ref): ref is string => typeof ref === "string")
		: [];
}

/** Read the independently observed hosted-main SHA when present. */
function hostedMainSha(input: SynaipseTransitionInput): unknown {
	const evidence = isRecord(input.evidence) ? input.evidence : null;
	const hostedMain =
		evidence && isRecord(evidence.hostedMain) ? evidence.hostedMain : null;
	return hostedMain?.sha;
}

/** Return whether an operator-owned recovery lacks its decision receipt. */
function invalidOperatorRecovery(
	recovery: Record<string, unknown>,
	authority: Record<string, unknown> | null,
	recoveryRefs: string[],
): boolean {
	if (recovery.fromBlocker !== "vital_decision_required") return false;
	return (
		authority?.owner !== "operator" ||
		!recoveryRefs.some((ref) => ref.startsWith("operator-decision:"))
	);
}

/** Return whether recovery cites a constrained blocker and refreshed evidence. */
function hasInvalidRecovery(input: SynaipseTransitionInput): boolean {
	if (input.recovery === null || input.recovery === undefined) return false;
	if (!isRecord(input.recovery)) return true;
	const recovery = input.recovery;
	const authority = isRecord(input.authority) ? input.authority : null;
	const recoveryRefs = stringRefs(recovery.evidenceRefs);
	return [
		!BLOCKERS.includes(recovery.fromBlocker as Blocker),
		recovery.refreshedSha !== hostedMainSha(input),
		!recoveryRefs.includes(`recovery:${recovery.fromBlocker}`),
		invalidOperatorRecovery(recovery, authority, recoveryRefs),
	].some(Boolean);
}

/** Return whether a waiver covers this exact transition and authority. */
function hasInvalidWaiver(input: SynaipseTransitionInput): boolean {
	if (input.waiver === null || input.waiver === undefined) return false;
	if (!isRecord(input.waiver)) return true;
	if (!isRecord(input.authority)) return true;
	const scope = `${input.fromStage}->${input.toStage}`;
	return (
		input.waiver.scope !== scope ||
		input.waiver.issuer !== input.authority.owner ||
		!Array.isArray(input.authority.capabilities) ||
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

/**
 * Identify the exact compact contract emitted by `harness init --minimal`.
 *
 * The compact shape intentionally omits scaffold-dependent policy. Consumers
 * must use this predicate instead of treating an arbitrary empty check list as
 * an opt-out, because schema migrations may add empty arrays to older full
 * contracts.
 */
import type { HarnessContract, ReviewPolicy } from "./types.js";

const COMPACT_MINIMAL_CONTRACT_KEYS = [
	"version",
	"branchProtection",
	"reviewPolicy",
] as const;

/** Return whether a caller-validated raw contract is the exact minimal shape. */
export function isCompactMinimalRawContract(
	contract: Record<string, unknown>,
): boolean {
	return (
		hasExactCompactMinimalKeys(contract) &&
		hasMinimalNoCheckBranchProtection(contract) &&
		hasDisabledCompactReviewPolicy(contract)
	);
}

/** Verify the explicit no-required-check branch-protection posture. */
function hasMinimalNoCheckBranchProtection(
	contract: Record<string, unknown>,
): boolean {
	const branchProtection = contract.branchProtection as
		| HarnessContract["branchProtection"]
		| undefined;
	return (
		Array.isArray(branchProtection?.requiredChecks) &&
		branchProtection.requiredChecks.length === 0 &&
		branchProtection.requiredApprovingReviewCount === 0
	);
}

/** Verify that review evidence remains intentionally disabled for the compact shape. */
function hasDisabledCompactReviewPolicy(
	contract: Record<string, unknown>,
): boolean {
	const reviewPolicy = contract.reviewPolicy;
	if (!isReviewPolicyObject(reviewPolicy)) {
		return false;
	}
	return [
		hasExactCompactReviewPolicyKeys(reviewPolicy),
		hasNoRequiredReviewChecks(reviewPolicy),
		reviewPolicy.timeoutSeconds === 600,
		reviewPolicy.timeoutAction === "fail",
		reviewPolicy.approvalMode === "human_approval",
		reviewPolicy.enforceReviewerIndependence === true,
		reviewPolicy.requireReviewContext === false,
	].every(Boolean);
}

/** Narrow raw review policy data before comparing it to the compact template. */
function isReviewPolicyObject(value: unknown): value is ReviewPolicy {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Verify that compact review policy has no full-policy additions. */
function hasExactCompactReviewPolicyKeys(reviewPolicy: ReviewPolicy): boolean {
	const expectedKeys = [
		"timeoutSeconds",
		"timeoutAction",
		"requiredChecks",
		"approvalMode",
		"enforceReviewerIndependence",
		"requireReviewContext",
	];
	return (
		Object.keys(reviewPolicy).length === expectedKeys.length &&
		expectedKeys.every((key) => Object.hasOwn(reviewPolicy, key))
	);
}

/** Verify that compact review policy declares no CI review checks. */
function hasNoRequiredReviewChecks(reviewPolicy: ReviewPolicy): boolean {
	return (
		Array.isArray(reviewPolicy.requiredChecks) &&
		reviewPolicy.requiredChecks.length === 0
	);
}

/** Verify that no full-scaffold policy was added to the minimal shape. */
function hasExactCompactMinimalKeys(
	contract: Record<string, unknown>,
): boolean {
	const allowedKeys = new Set<string>(COMPACT_MINIMAL_CONTRACT_KEYS);
	if (Object.hasOwn(contract, "projectType")) allowedKeys.add("projectType");
	const keys = Object.keys(contract);
	return (
		keys.length === allowedKeys.size &&
		COMPACT_MINIMAL_CONTRACT_KEYS.every((key) =>
			Object.hasOwn(contract, key),
		) &&
		keys.every((key) => allowedKeys.has(key))
	);
}

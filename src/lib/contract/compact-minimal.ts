/**
 * Identify the exact compact contract emitted by `harness init --minimal`.
 *
 * The compact shape intentionally omits scaffold-dependent policy. Consumers
 * must use this predicate instead of treating an arbitrary empty check list as
 * an opt-out, because schema migrations may add empty arrays to older full
 * contracts.
 */
import type { HarnessContract } from "./types.js";

const COMPACT_MINIMAL_CONTRACT_KEYS = [
	"version",
	"riskTierRules",
	"branchProtection",
	"reviewPolicy",
	"northStar",
	"productSurface",
	"overrideReviewerRegistry",
] as const;

/** Return whether a caller-validated raw contract is the exact minimal shape. */
export function isCompactMinimalRawContract(
	contract: Record<string, unknown>,
): boolean {
	return (
		hasExactCompactMinimalKeys(contract) &&
		hasMinimalNoCheckBranchProtection(contract)
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

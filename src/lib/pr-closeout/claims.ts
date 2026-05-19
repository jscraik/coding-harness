import type { PrCloseoutBlocker, PrCloseoutClaim } from "./types.js";

export { buildCloseoutClaims } from "./claim-builders.js";

function claimBlockerReason(claim: PrCloseoutClaim): string {
	if (claim.freshness === "stale") {
		return `Closeout claim ${claim.claim} has stale evidence for the current head.`;
	}
	if (claim.freshness === "missing") {
		return `Closeout claim ${claim.claim} is missing required evidence.`;
	}
	if (claim.status === "fail") {
		return `Closeout claim ${claim.claim} failed verifier evidence.`;
	}
	return `Closeout claim ${claim.claim} could not be proven from verifier evidence.`;
}

function claimSurface(claim: PrCloseoutClaim): PrCloseoutBlocker["surface"] {
	return claim.source === "harness_gates" ? "harness_gates" : claim.source;
}

function claimFixableByCodex(claim: PrCloseoutClaim): boolean {
	if (claim.blockerClass === "needs_jamie_decision") return false;
	if (claim.blockerClass === "external_service") return false;
	if (claim.source !== "checks") return false;
	return claim.freshness === "missing" || claim.freshness === "unknown";
}

/** Add blockers for closeout claims that are failed, blocked, unknown, or stale. */
export function collectClaimBlockers(
	claims: readonly PrCloseoutClaim[],
	blockers: PrCloseoutBlocker[],
): void {
	for (const claim of claims) {
		if (claim.status === "pass" || claim.status === "not_applicable") continue;
		blockers.push({
			surface: claimSurface(claim),
			classification: claim.blockerClass ?? "unknown",
			kind: "closeout_claim",
			reason: claimBlockerReason(claim),
			fixableByCodex: claimFixableByCodex(claim),
			ref: claim.evidenceRef ?? claim.claim,
			...(claim.missingContext ? { missingContext: claim.missingContext } : {}),
		});
	}
}

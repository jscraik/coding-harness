import type {
	ExternalStateClaimBlocker,
	ExternalStateClaimSupportResult,
	ExternalStateSnapshot,
} from "./types.js";

/** Decide whether a validated snapshot can support delivery/merge claims. */
export function evaluateExternalStateClaimSupport(
	snapshot: ExternalStateSnapshot,
	expectedHeadSha?: string | null,
): ExternalStateClaimSupportResult {
	const blockers: ExternalStateClaimBlocker[] = [];
	if (snapshot.stale) blockers.push("snapshot_stale");
	if (snapshot.evidenceUse !== "claim_support") {
		blockers.push("snapshot_not_claim_support");
	}
	blockers.push(...fetchProofBlockers(snapshot));
	if (expectedHeadSha && snapshot.headSha !== expectedHeadSha) {
		blockers.push("blocked_stale_external_context");
	}
	for (const source of snapshot.sources) {
		if (source.evidenceUse !== "claim_support") {
			blockers.push("source_not_claim_support");
		}
		if (source.status === "unavailable") blockers.push("source_unavailable");
		if (source.status === "stale") blockers.push("source_stale");
		if (source.status === "unknown") blockers.push("source_unknown");
		if (source.freshness !== "current") blockers.push("source_not_current");
		if (source.resultStatus !== "pass") blockers.push("source_not_passing");
		if (source.prHeadSensitive && !source.headSha) {
			blockers.push("missing_pr_head_sha");
		}
		if (
			expectedHeadSha &&
			source.prHeadSensitive &&
			source.headSha !== expectedHeadSha
		) {
			blockers.push("blocked_stale_external_context");
		}
	}
	return {
		canSupportClaim: blockers.length === 0,
		blockers: [...new Set(blockers)],
	};
}

function fetchProofBlockers(
	snapshot: ExternalStateSnapshot,
): ExternalStateClaimBlocker[] {
	const receipt = snapshot.fetchReceipt;
	if (!receipt) return ["missing_fetch_proof"];
	const missing =
		!snapshot.fetchReceiptRef ||
		!snapshot.fetchedArtifactHash ||
		!snapshot.verifierIdentity;
	if (missing) return ["missing_fetch_proof"];
	const mismatch =
		receipt.ref !== snapshot.fetchReceiptRef ||
		receipt.checksum !== snapshot.fetchedArtifactHash ||
		receipt.producer !== snapshot.verifierIdentity ||
		receipt.headSha !== snapshot.headSha ||
		receipt.kind !== "external_state" ||
		receipt.status !== "pass" ||
		receipt.freshness !== "current" ||
		receipt.evidenceUse !== "claim_support" ||
		typeof receipt.sizeBytes !== "number" ||
		receipt.sizeBytes <= 0;
	return mismatch ? ["fetch_proof_mismatch"] : [];
}

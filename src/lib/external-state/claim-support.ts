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
	if (expectedHeadSha && snapshot.headSha !== expectedHeadSha) {
		blockers.push("head_sha_mismatch");
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
			blockers.push("head_sha_mismatch");
		}
	}
	return {
		canSupportClaim: blockers.length === 0,
		blockers: [...new Set(blockers)],
	};
}

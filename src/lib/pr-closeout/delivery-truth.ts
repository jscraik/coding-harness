import type {
	PrCloseoutBlocker,
	PrCloseoutBlockerClassification,
	PrCloseoutDeliveryTruthSummary,
	PrCloseoutDeliveryTruthVerdict,
} from "./types.js";

const PR_CLOSEOUT_DELIVERY_TRUTH_CLAIMS = new Set<
	PrCloseoutDeliveryTruthVerdict["claim"]
>([
	"merge_ready",
	"root_surface_tidy",
	"remote_checks_current",
	"review_threads_resolved",
	"linear_state_aligned",
]);

/** Build a compact delivery-truth projection for PR closeout reports. */
export function buildDeliveryTruthSummary(
	verdicts: readonly PrCloseoutDeliveryTruthVerdict[] | undefined,
): PrCloseoutDeliveryTruthSummary {
	const normalized = verdicts ? [...verdicts] : [];
	return {
		present: normalized.length > 0,
		verdicts: normalized,
		blockingVerdicts: normalized.filter(isBlockingDeliveryTruthVerdict),
		mergeReady: selectMergeReadyVerdict(normalized),
	};
}

/** Add blockers for supplied delivery-truth verdicts that cannot support closeout. */
export function collectDeliveryTruthBlockers(
	summary: PrCloseoutDeliveryTruthSummary,
	blockers: PrCloseoutBlocker[],
): void {
	for (const verdict of summary.blockingVerdicts) {
		blockers.push({
			surface: "delivery_truth",
			classification: deliveryTruthBlockerClass(verdict),
			kind: "closeout_claim",
			reason: deliveryTruthBlockerReason(verdict),
			fixableByCodex: deliveryTruthFixableByCodex(verdict),
			ref: verdict.evidenceRef ?? verdict.claim,
		});
	}
}

function isBlockingDeliveryTruthVerdict(
	verdict: PrCloseoutDeliveryTruthVerdict,
): boolean {
	if (!PR_CLOSEOUT_DELIVERY_TRUTH_CLAIMS.has(verdict.claim)) {
		return false;
	}
	if (verdict.status !== "pass") {
		return true;
	}
	return verdict.freshness !== "current";
}

function selectMergeReadyVerdict(
	verdicts: readonly PrCloseoutDeliveryTruthVerdict[],
): PrCloseoutDeliveryTruthVerdict | null {
	return (
		verdicts.find(
			(verdict) =>
				verdict.claim === "merge_ready" &&
				isBlockingDeliveryTruthVerdict(verdict),
		) ??
		verdicts.find((verdict) => verdict.claim === "merge_ready") ??
		null
	);
}

function deliveryTruthBlockerReason(
	verdict: PrCloseoutDeliveryTruthVerdict,
): string {
	if (verdict.freshness === "stale") {
		return `Delivery-truth claim ${verdict.claim} has stale evidence for the current head.`;
	}
	if (verdict.freshness === "missing") {
		return `Delivery-truth claim ${verdict.claim} is missing required evidence.`;
	}
	if (verdict.status === "fail") {
		return `Delivery-truth claim ${verdict.claim} failed verifier evidence.`;
	}
	if (verdict.status === "not_applicable") {
		return `Delivery-truth claim ${verdict.claim} is not applicable and cannot support closeout.`;
	}
	return `Delivery-truth claim ${verdict.claim} could not be proven from verifier evidence.`;
}

function deliveryTruthBlockerClass(
	verdict: PrCloseoutDeliveryTruthVerdict,
): PrCloseoutBlockerClassification {
	return verdict.blockerClass ?? "unknown";
}

function deliveryTruthFixableByCodex(
	verdict: PrCloseoutDeliveryTruthVerdict,
): boolean {
	if (verdict.blockerClass === "needs_jamie_decision") return false;
	if (verdict.blockerClass === "external_service") return false;
	if (
		verdict.blockerClass === "introduced" &&
		verdict.freshness === "current" &&
		verdict.status === "fail"
	) {
		return true;
	}
	return verdict.freshness === "missing" || verdict.freshness === "unknown";
}

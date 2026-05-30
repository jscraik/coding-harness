import type {
	PrCloseoutBlocker,
	PrCloseoutClaim,
	PrCloseoutConstraintSnapshot,
	PrCloseoutConstraintSnapshotLane,
	PrCloseoutEvidenceFreshness,
	PrCloseoutSnapshotHandoffPointer,
	PrCloseoutStaleEvidenceClass,
	PrCloseoutStatus,
	PrCloseoutReport,
} from "./types.js";

/** Build a compact snapshot for the delivery-lifecycle constraint view. */
export function buildPrCloseoutSnapshot({
	generatedAt,
	pr,
	url,
	status,
	nextAction,
	claims,
	blockers,
}: {
	generatedAt: string;
	pr: number;
	url: string | null;
	status: PrCloseoutStatus;
	nextAction: PrCloseoutReport["nextAction"];
	claims: readonly PrCloseoutClaim[];
	blockers: readonly PrCloseoutBlocker[];
}): PrCloseoutConstraintSnapshot {
	const staleEvidenceClasses = classifyStaleEvidenceClasses(claims, blockers);
	return {
		schemaVersion: "pr-closeout-snapshot/v1",
		generatedAt,
		pr,
		url,
		overallStatus: status,
		nextAction,
		staleEvidenceClasses,
		lanes: {
			pr: summarizeLane("pr", claims, blockers),
			checks: summarizeLane("checks", claims, blockers),
			review: summarizeLane("review", claims, blockers),
			linear: summarizeLane("linear", claims, blockers),
			branch: summarizeLane("branch", claims, blockers),
			deliveryTruth: summarizeLane("delivery_truth", claims, blockers),
		},
		handoffRequirements: buildHandoffRequirements(claims),
	};
}

function summarizeLane(
	name: string,
	claims: readonly PrCloseoutClaim[],
	blockers: readonly PrCloseoutBlocker[],
): PrCloseoutConstraintSnapshotLane {
	const laneClaims = claims.filter((claim) => claim.source === name);
	const laneBlockers = blockers.filter((blocker) => blocker.surface === name);
	const staleEvidence = laneClaims.some((claim) => claim.freshness === "stale");
	const blockerCount = laneBlockers.length;
	const freshness = summarizeFreshness(
		laneClaims.map((claim) => claim.freshness),
	);
	let status: PrCloseoutConstraintSnapshotLane["status"] = "ready";
	// Check blockers before freshness/missing
	if (blockerCount > 0) {
		status = "blocked";
	} else if (freshness === "missing" || freshness === "unknown") {
		status = freshness === "missing" ? "missing" : "unknown";
	} else if (staleEvidence) {
		status = "stale";
	}
	if (status === "ready" && laneClaims.length === 0) {
		status = "unknown";
	}
	return {
		status,
		blockerCount,
		staleEvidence,
		freshness,
		evidenceRefs: laneClaims
			.map((claim) => claim.evidenceRef)
			.filter(
				(value): value is string =>
					typeof value === "string" && value.length > 0,
			),
	};
}

function summarizeFreshness(
	values: readonly PrCloseoutEvidenceFreshness[],
): PrCloseoutEvidenceFreshness {
	if (values.length === 0) return "missing";
	if (values.includes("stale")) return "stale";
	if (values.includes("missing")) return "missing";
	if (values.includes("unknown")) return "unknown";
	if (values.every((value) => value === "current")) return "current";
	if (values.includes("not_applicable")) return "not_applicable";
	return "current";
}

function buildHandoffRequirements(
	claims: readonly PrCloseoutClaim[],
): PrCloseoutSnapshotHandoffPointer[] {
	return claims
		.filter(
			(claim) => claim.status !== "pass" && claim.status !== "not_applicable",
		)
		.map((claim) => ({
			claim: claim.claim,
			surface: claim.source,
			status: claim.status,
			freshness: claim.freshness,
			evidenceRef: claim.evidenceRef,
			blockerClass: claim.blockerClass ?? null,
			verifiedAt: claim.verifiedAt,
		}));
}

function classifyStaleEvidenceClasses(
	claims: readonly PrCloseoutClaim[],
	blockers: readonly PrCloseoutBlocker[],
): PrCloseoutStaleEvidenceClass[] {
	const stale = new Set<PrCloseoutStaleEvidenceClass>();
	for (const claim of claims) {
		if (claim.freshness !== "stale") continue;
		switch (claim.claim) {
			case "pr_metadata_ready":
			case "branch_current_with_base":
				stale.add("stale-pr-metadata");
				break;
			case "ci_green":
			case "tests_passed":
			case "required_checks_match_current_head":
				stale.add("stale-ci");
				break;
			case "review_threads_resolved":
			case "independent_review_status_known":
				stale.add("stale-review");
				break;
			case "linear_tracker_state_aligned":
				stale.add("stale-linear");
				break;
			default:
				break;
		}
	}
	if (
		blockers.some(
			(blocker) =>
				blocker.classification === "external_service" ||
				blocker.surface === "tool",
		)
	) {
		stale.add("stale-external");
	}
	return Array.from(stale);
}

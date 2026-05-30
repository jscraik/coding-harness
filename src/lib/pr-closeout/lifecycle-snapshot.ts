import type {
	PrCloseoutBlocker,
	PrCloseoutClaim,
	PrCloseoutClaimStatus,
	PrCloseoutDeliveryTruthSummary,
	PrCloseoutEvidenceFreshness,
	PrCloseoutInput,
	PrCloseoutLifecycleLane,
	PrCloseoutLifecycleSnapshot,
	PrCloseoutNextAction,
	PrCloseoutRecoveryOwner,
	PrCloseoutReviewArtifactInput,
	PrCloseoutReviewArtifactSummary,
	PrCloseoutStatus,
} from "./types.js";

const STALE_EVIDENCE_CLASS_BY_LANE: Record<
	PrCloseoutLifecycleLane["lane"],
	string
> = {
	local_validation: "stale-validation",
	pr_state: "stale-pr-metadata",
	ci_state: "stale-ci",
	review_state: "stale-review",
	linear_state: "stale-linear",
	branch_worktree: "stale-worktree",
	continuation: "stale-external",
	acceptance: "stale-acceptance",
	release_readiness: "stale-release-readiness",
};

const LANE_ORDER: PrCloseoutLifecycleLane["lane"][] = [
	"local_validation",
	"pr_state",
	"ci_state",
	"review_state",
	"linear_state",
	"branch_worktree",
	"continuation",
	"acceptance",
	"release_readiness",
];

function ownerForBlocker(blocker: PrCloseoutBlocker): PrCloseoutRecoveryOwner {
	if (blocker.classification === "external_service") return "external_service";
	if (blocker.classification === "needs_jamie_decision") return "operator";
	return blocker.fixableByCodex ? "codex" : "operator";
}

function laneForClaim(
	claim: PrCloseoutClaim["claim"],
): PrCloseoutLifecycleLane["lane"] {
	switch (claim) {
		case "tests_passed":
			return "local_validation";
		case "ci_green":
		case "required_checks_match_current_head":
			return "ci_state";
		case "review_threads_resolved":
		case "independent_review_status_known":
			return "review_state";
		case "pr_metadata_ready":
		case "rollback_path_named_or_not_applicable":
			return "pr_state";
		case "branch_current_with_base":
			return "branch_worktree";
		case "linear_tracker_state_aligned":
			return "linear_state";
	}
}

function laneForBlocker(
	blocker: PrCloseoutBlocker,
): PrCloseoutLifecycleLane["lane"] {
	switch (blocker.surface) {
		case "checks":
			return "ci_state";
		case "review":
		case "review_artifact":
			return "review_state";
		case "linear":
			return "linear_state";
		case "branch":
		case "worktree":
			return "branch_worktree";
		case "harness_gates":
		case "assurance":
		case "runtime_evidence":
			return "local_validation";
		case "delivery_truth":
			return "acceptance";
		case "tool":
			return "continuation";
		case "pr":
		case "traceability":
			return "pr_state";
	}
}

function sourceOfTruthForLane(lane: PrCloseoutLifecycleLane["lane"]): string {
	switch (lane) {
		case "local_validation":
			return "harness-gates";
		case "pr_state":
			return "github-pr";
		case "ci_state":
			return "required-checks";
		case "review_state":
			return "github-reviewThreads";
		case "linear_state":
			return "linear";
		case "branch_worktree":
			return "git-worktree";
		case "continuation":
			return "attempt-ledger";
		case "acceptance":
			return "delivery-truth";
		case "release_readiness":
			return "release-readiness";
	}
}

function worseStatus(
	current: PrCloseoutClaimStatus,
	next: PrCloseoutClaimStatus,
): PrCloseoutClaimStatus {
	const rank: Record<PrCloseoutClaimStatus, number> = {
		fail: 5,
		blocked: 4,
		unknown: 3,
		pass: 2,
		not_applicable: 1,
	};
	return rank[next] > rank[current] ? next : current;
}

function worseFreshness(
	current: PrCloseoutEvidenceFreshness,
	next: PrCloseoutEvidenceFreshness,
): PrCloseoutEvidenceFreshness {
	const rank: Record<PrCloseoutEvidenceFreshness, number> = {
		stale: 5,
		missing: 4,
		unknown: 3,
		current: 2,
		not_applicable: 1,
	};
	return rank[next] > rank[current] ? next : current;
}

function laneEvidenceRef(
	lane: PrCloseoutLifecycleLane["lane"],
	claims: readonly PrCloseoutClaim[],
	blockers: readonly PrCloseoutBlocker[],
): string | null {
	const claimRef = claims.find(
		(claim) => laneForClaim(claim.claim) === lane,
	)?.evidenceRef;
	if (claimRef) return claimRef;
	const blockerRef = blockers.find(
		(blocker) => laneForBlocker(blocker) === lane,
	)?.ref;
	return blockerRef ?? null;
}

function laneBlocker(
	lane: PrCloseoutLifecycleLane["lane"],
	blockers: readonly PrCloseoutBlocker[],
): PrCloseoutBlocker | undefined {
	return blockers.find((blocker) => laneForBlocker(blocker) === lane);
}

function laneNextAction(blocker: PrCloseoutBlocker | undefined): string {
	if (!blocker) return "No closeout blocker observed for this lane.";
	if (blocker.fixableByCodex) return "Fix this lane before closeout.";
	if (blocker.classification === "external_service") {
		return "Wait for external state refresh or service completion.";
	}
	return "Route to the named owner before closeout.";
}

function buildReviewArtifactSummary(
	artifacts: readonly PrCloseoutReviewArtifactInput[],
): PrCloseoutReviewArtifactSummary {
	return {
		expected: artifacts.length,
		missing: artifacts.filter((artifact) => artifact.status === "missing")
			.length,
		empty: artifacts.filter((artifact) => artifact.status === "empty").length,
		ignoredRuntimePath: artifacts.filter(
			(artifact) => artifact.status === "ignored_runtime_path",
		).length,
		unknown: artifacts.filter((artifact) => artifact.status === "unknown")
			.length,
		artifacts: [...artifacts],
	};
}

function lifecycleStatusFromReportStatus(
	status: PrCloseoutStatus,
): PrCloseoutClaimStatus {
	if (status === "ready") return "pass";
	if (status === "waiting" || status === "needs_jamie") return "blocked";
	if (status === "fixable" || status === "cleanup_required") return "fail";
	return "blocked";
}

function latestValidationBlocker(
	blockers: readonly PrCloseoutBlocker[],
): PrCloseoutLifecycleSnapshot["latestValidationBlocker"] {
	const blocker = blockers.find((item) =>
		["checks", "harness_gates", "assurance", "runtime_evidence"].includes(
			item.surface,
		),
	);
	if (!blocker) return null;
	return {
		failureClass: blocker.classification,
		reason: blocker.reason,
		resumeCommand:
			blocker.surface === "checks"
				? null
				: "bash scripts/verify-work.sh --resume",
	};
}

function waitingOwner(
	blockers: readonly PrCloseoutBlocker[],
): PrCloseoutRecoveryOwner | "reviewer" | "unknown" {
	const blocker = blockers[0];
	if (!blocker) return "unknown";
	if (blocker.surface === "review" || blocker.surface === "review_artifact") {
		return "reviewer";
	}
	return ownerForBlocker(blocker);
}

function staleEvidenceClasses(
	lanes: readonly PrCloseoutLifecycleLane[],
): string[] {
	return lanes
		.filter((lane) => lane.freshness === "stale")
		.map((lane) => STALE_EVIDENCE_CLASS_BY_LANE[lane.lane]);
}

/** Build the cross-lane delivery lifecycle snapshot for pr-closeout reports. */
export function buildLifecycleSnapshot(args: {
	input: PrCloseoutInput;
	claims: readonly PrCloseoutClaim[];
	blockers: readonly PrCloseoutBlocker[];
	deliveryTruth: PrCloseoutDeliveryTruthSummary;
	generatedAt: string;
	reportStatus: PrCloseoutStatus;
	nextAction: PrCloseoutNextAction;
}): PrCloseoutLifecycleSnapshot {
	const blockers = [...args.blockers];
	const lanes = LANE_ORDER.map((lane): PrCloseoutLifecycleLane => {
		const laneClaims = args.claims.filter(
			(claim) => laneForClaim(claim.claim) === lane,
		);
		const blocker = laneBlocker(lane, blockers);
		const initialStatus: PrCloseoutClaimStatus =
			lane === "continuation" || lane === "release_readiness"
				? "not_applicable"
				: "unknown";
		const initialFreshness: PrCloseoutEvidenceFreshness =
			lane === "continuation" || lane === "release_readiness"
				? "not_applicable"
				: "unknown";
		const status = laneClaims.reduce<PrCloseoutClaimStatus>(
			(current, claim) => worseStatus(current, claim.status),
			initialStatus,
		);
		const freshness = laneClaims.reduce<PrCloseoutEvidenceFreshness>(
			(current, claim) => worseFreshness(current, claim.freshness),
			initialFreshness,
		);
		const blockerStatus = blocker
			? lifecycleStatusFromReportStatus(args.reportStatus)
			: status;
		return {
			lane,
			status: blockerStatus,
			freshness: blocker ? worseFreshness(freshness, "current") : freshness,
			sourceOfTruth: sourceOfTruthForLane(lane),
			evidenceRef: blocker?.ref ?? laneEvidenceRef(lane, args.claims, blockers),
			headSha:
				args.input.pullRequest.headSha ?? args.input.branch?.headSha ?? null,
			blockerClass: blocker?.classification ?? null,
			owner: blocker
				? blocker.surface === "review_artifact"
					? "reviewer"
					: ownerForBlocker(blocker)
				: "unknown",
			nextAction: laneNextAction(blocker),
		};
	});
	const blockedLanes = new Set(
		blockers.map((blocker) => laneForBlocker(blocker)),
	);
	const handoffRequiredEvidence = lanes
		.filter((lane) => blockedLanes.has(lane.lane))
		.map((lane) => ({
			lane: lane.lane,
			evidenceRef:
				lane.evidenceRef ?? `missing:${lane.sourceOfTruth}:${lane.lane}`,
			freshness: lane.freshness,
			sourceOfTruth: lane.sourceOfTruth,
		}));
	return {
		schemaVersion: "delivery-lifecycle-snapshot/v1",
		generatedAt: args.generatedAt,
		worktreeRole: args.input.branch?.worktreeRole ?? "unknown",
		linearMutation: args.input.linearMutation ?? "unknown",
		releaseReadinessImpact: args.input.releaseReadinessImpact ?? "unknown",
		staleEvidenceClasses: staleEvidenceClasses(lanes),
		handoffRequiredEvidence,
		lanes,
		latestValidationBlocker: latestValidationBlocker(blockers),
		reviewArtifacts: buildReviewArtifactSummary(
			args.input.reviewArtifacts ?? [],
		),
		continuation: {
			nextSafeAction: args.nextAction,
			waitingOwner: waitingOwner(blockers),
			blocker: blockers[0]?.reason ?? null,
		},
	};
}

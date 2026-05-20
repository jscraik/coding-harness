import type {
	PrCloseoutBranchInput,
	PrCloseoutCheckInput,
	PrCloseoutClaim,
	PrCloseoutClaimStatus,
	PrCloseoutEvidenceFreshness,
	PrCloseoutInput,
	PrCloseoutPullRequestInput,
	PrCloseoutReviewThreadsInput,
} from "./types.js";
import {
	hasLinearReference,
	isFailedCheck,
	isPendingCheck,
	isPassingCheck,
	normalizeStatus,
} from "./evidence.js";
import {
	buildClaim,
	checkFreshness,
	currentHeadSha,
	evidenceRefFromCheck,
	isTestCheck,
	requiredChecks,
	requiredChecksAreCurrent,
} from "./claim-helpers.js";

function hasKnownIndependentReview(
	pr: PrCloseoutPullRequestInput,
	checks: readonly PrCloseoutCheckInput[],
): boolean {
	if (normalizeStatus(pr.reviewDecision) !== "") return true;
	return checks.some(
		(check) =>
			check.source === "coderabbit" ||
			(/coderabbit/iu.test(check.name) && isPassingCheck(check)),
	);
}

interface CheckClaimOptions {
	required: readonly PrCloseoutCheckInput[];
	currentRequired: boolean;
	freshness: PrCloseoutEvidenceFreshness;
	hasPending: boolean;
}

function checkClaimOptions(
	checks: readonly PrCloseoutCheckInput[],
	headSha: string | null,
): CheckClaimOptions {
	const required = requiredChecks(checks);
	const staleRequired = required.some(
		(check) => checkFreshness(check, headSha) === "stale",
	);
	return {
		required,
		currentRequired: requiredChecksAreCurrent(checks, headSha),
		hasPending: checks.some((check) => isPendingCheck(check)),
		freshness:
			checks.length === 0
				? "missing"
				: staleRequired
					? "stale"
					: requiredChecksAreCurrent(checks, headSha)
						? "current"
						: "unknown",
	};
}

function buildTestsPassedClaim(
	testChecks: readonly PrCloseoutCheckInput[],
	checkOptions: CheckClaimOptions,
	headSha: string | null,
	verifiedAt: string,
): PrCloseoutClaim {
	return buildClaim(
		"tests_passed",
		testChecks.length === 0
			? "unknown"
			: testChecks.every((check) => isPassingCheck(check)) &&
					checkOptions.currentRequired
				? "pass"
				: testChecks.some((check) => isFailedCheck(check))
					? "fail"
					: "blocked",
		"checks",
		verifiedAt,
		{
			evidenceRef: testChecks[0] ? evidenceRefFromCheck(testChecks[0]) : null,
			headSha,
			freshness: testChecks.length === 0 ? "missing" : checkOptions.freshness,
			...(checkOptions.hasPending
				? { blockerClass: "external_service" as const }
				: {}),
		},
	);
}

function buildCiGreenClaim(
	checks: readonly PrCloseoutCheckInput[],
	checkOptions: CheckClaimOptions,
	headSha: string | null,
	verifiedAt: string,
): PrCloseoutClaim {
	const allChecksPassing =
		checks.length > 0 && checks.every((check) => isPassingCheck(check));
	return buildClaim(
		"ci_green",
		checks.length === 0
			? "unknown"
			: allChecksPassing && checkOptions.currentRequired
				? "pass"
				: checks.some((check) => isFailedCheck(check))
					? "fail"
					: "blocked",
		"checks",
		verifiedAt,
		{
			evidenceRef: checks[0] ? evidenceRefFromCheck(checks[0]) : null,
			headSha,
			freshness: checkOptions.freshness,
			...(checkOptions.hasPending
				? { blockerClass: "external_service" as const }
				: {}),
		},
	);
}

function buildReviewThreadsResolvedClaim(
	reviewThreads: PrCloseoutReviewThreadsInput,
	headSha: string | null,
	verifiedAt: string,
): PrCloseoutClaim {
	return buildClaim(
		"review_threads_resolved",
		reviewThreads.unresolved === null
			? "unknown"
			: reviewThreads.unresolved === 0
				? "pass"
				: "fail",
		"review",
		verifiedAt,
		{
			evidenceRef:
				reviewThreads.unresolved === null ? null : "github:reviewThreads",
			headSha,
			freshness: reviewThreads.unresolved === null ? "missing" : "current",
		},
	);
}

function buildPrMetadataReadyClaim(
	pr: PrCloseoutPullRequestInput,
	headSha: string | null,
	verifiedAt: string,
): PrCloseoutClaim {
	return buildClaim(
		"pr_metadata_ready",
		normalizeStatus(pr.state) === "" ||
			pr.isDraft === null ||
			pr.isDraft === undefined
			? "unknown"
			: normalizeStatus(pr.state) !== "" && normalizeStatus(pr.state) !== "OPEN"
				? "blocked"
				: pr.isDraft === true
					? "blocked"
					: "pass",
		"pr",
		verifiedAt,
		{
			evidenceRef: pr.url ?? `pr:#${pr.number}`,
			headSha,
		},
	);
}

function branchClaimState(
	pr: PrCloseoutPullRequestInput,
	branch: PrCloseoutBranchInput | undefined,
): {
	status: PrCloseoutClaimStatus;
	evidenceRef: string | null;
	freshness: PrCloseoutEvidenceFreshness;
} {
	const mergeState = normalizeStatus(pr.mergeStateStatus);
	const current =
		(branch?.behindBase === false && branch?.hasConflicts === false) ||
		mergeState === "CLEAN";
	const stale =
		branch?.behindBase === true ||
		branch?.hasConflicts === true ||
		mergeState === "DIRTY" ||
		mergeState === "BEHIND";
	if (!current && !stale) {
		return { status: "unknown", evidenceRef: null, freshness: "missing" };
	}
	return {
		status: stale ? "fail" : "pass",
		evidenceRef:
			mergeState === "CLEAN" ||
			mergeState === "DIRTY" ||
			mergeState === "BEHIND"
				? "github:mergeStateStatus"
				: "git:branch-state",
		freshness: "current",
	};
}

function buildBranchCurrentClaim(
	branch: ReturnType<typeof branchClaimState>,
	headSha: string | null,
	verifiedAt: string,
): PrCloseoutClaim {
	return buildClaim(
		"branch_current_with_base",
		branch.status,
		"branch",
		verifiedAt,
		{
			evidenceRef: branch.evidenceRef,
			headSha,
			freshness: branch.freshness,
		},
	);
}

function buildLinearClaim(
	hasLinear: boolean,
	headSha: string | null,
	verifiedAt: string,
): PrCloseoutClaim {
	return buildClaim(
		"linear_tracker_state_aligned",
		hasLinear ? "pass" : "unknown",
		"linear",
		verifiedAt,
		{
			evidenceRef: hasLinear ? "pr-body:linear-reference" : null,
			headSha,
			freshness: hasLinear ? "current" : "missing",
		},
	);
}

function buildIndependentReviewClaim(
	input: PrCloseoutInput,
	checks: readonly PrCloseoutCheckInput[],
	headSha: string | null,
	verifiedAt: string,
): PrCloseoutClaim {
	const hasReviewStatus = hasKnownIndependentReview(input.pullRequest, checks);
	return buildClaim(
		"independent_review_status_known",
		hasReviewStatus ? "pass" : "unknown",
		"review",
		verifiedAt,
		{
			evidenceRef: hasReviewStatus
				? input.pullRequest.reviewDecision
					? "github:reviewDecision"
					: "check:coderabbit"
				: null,
			headSha,
			freshness: hasReviewStatus ? "current" : "missing",
		},
	);
}

function buildRequiredChecksCurrentHeadClaim(
	checkOptions: CheckClaimOptions,
	headSha: string | null,
	verifiedAt: string,
): PrCloseoutClaim {
	return buildClaim(
		"required_checks_match_current_head",
		checkOptions.currentRequired
			? "pass"
			: checkOptions.freshness === "stale"
				? "fail"
				: "unknown",
		"checks",
		verifiedAt,
		{
			evidenceRef: checkOptions.required[0]
				? evidenceRefFromCheck(checkOptions.required[0])
				: null,
			headSha,
			freshness: checkOptions.freshness,
			...(checkOptions.hasPending
				? { blockerClass: "external_service" as const }
				: {}),
		},
	);
}

function buildRollbackClaim(
	input: PrCloseoutInput,
	headSha: string | null,
	verifiedAt: string,
): PrCloseoutClaim {
	const rollbackPath = input.rollback?.path?.trim();
	const rollbackOk =
		Boolean(rollbackPath) || input.rollback?.notApplicable === true;
	const rollbackRef =
		input.rollback?.evidenceRef ??
		(rollbackPath ? `rollback:${rollbackPath}` : null);
	return buildClaim(
		"rollback_path_named_or_not_applicable",
		rollbackOk ? "pass" : "unknown",
		"harness_gates",
		verifiedAt,
		{
			evidenceRef: rollbackRef,
			headSha,
			freshness: rollbackOk ? "current" : "missing",
		},
	);
}

/** Build the required pr-closeout/v1 claim set from normalized verifier evidence. */
export function buildCloseoutClaims(
	input: PrCloseoutInput,
	checks: readonly PrCloseoutCheckInput[],
	reviewThreads: PrCloseoutReviewThreadsInput,
	verifiedAt: string,
): PrCloseoutClaim[] {
	const headSha = currentHeadSha(input);
	const checkOptions = checkClaimOptions(checks, headSha);
	const testChecks = checks.filter(isTestCheck);
	const branch = branchClaimState(input.pullRequest, input.branch);
	const hasLinear = hasLinearReference(input.pullRequest.body);
	return [
		buildTestsPassedClaim(testChecks, checkOptions, headSha, verifiedAt),
		buildCiGreenClaim(checks, checkOptions, headSha, verifiedAt),
		buildReviewThreadsResolvedClaim(reviewThreads, headSha, verifiedAt),
		buildPrMetadataReadyClaim(input.pullRequest, headSha, verifiedAt),
		buildBranchCurrentClaim(branch, headSha, verifiedAt),
		buildLinearClaim(hasLinear, headSha, verifiedAt),
		buildIndependentReviewClaim(input, checks, headSha, verifiedAt),
		buildRequiredChecksCurrentHeadClaim(checkOptions, headSha, verifiedAt),
		buildRollbackClaim(input, headSha, verifiedAt),
	];
}

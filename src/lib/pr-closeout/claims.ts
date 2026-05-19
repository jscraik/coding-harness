import type { MissingContextClassification } from "../missing-context/classifier.js";
import { classifyMissingContext } from "../missing-context/classifier.js";
import type {
	PrCloseoutBlocker,
	PrCloseoutBlockerClassification,
	PrCloseoutBranchInput,
	PrCloseoutCheckInput,
	PrCloseoutInput,
	PrCloseoutPullRequestInput,
	PrCloseoutReviewThreadsInput,
} from "../pr-closeout.js";
import {
	hasLinearReference,
	isFailedCheck,
	isPassingCheck,
	normalizeStatus,
} from "./evidence.js";

/** Verifier-backed status for one required PR closeout claim. */
export type PrCloseoutClaimStatus =
	| "pass"
	| "fail"
	| "blocked"
	| "unknown"
	| "not_applicable";

/** Freshness classification for the evidence attached to a closeout claim. */
export type PrCloseoutEvidenceFreshness =
	| "current"
	| "stale"
	| "missing"
	| "unknown"
	| "not_applicable";

/** Evidence surface that produced a closeout claim. */
export type PrCloseoutClaimSource =
	| "pr"
	| "branch"
	| "checks"
	| "review"
	| "linear"
	| "harness_gates";

/** One required claim in the pr-closeout/v1 evidence contract. */
export interface PrCloseoutClaim {
	claim:
		| "tests_passed"
		| "ci_green"
		| "review_threads_resolved"
		| "pr_metadata_ready"
		| "branch_current_with_base"
		| "linear_tracker_state_aligned"
		| "independent_review_status_known"
		| "required_checks_match_current_head"
		| "rollback_path_named_or_not_applicable";
	status: PrCloseoutClaimStatus;
	evidenceRef: string | null;
	source: PrCloseoutClaimSource;
	headSha: string | null;
	freshness: PrCloseoutEvidenceFreshness;
	blockerClass: PrCloseoutBlockerClassification | null;
	missingContext: MissingContextClassification | null;
	verifiedAt: string;
}

function requiredChecks(
	checks: readonly PrCloseoutCheckInput[],
): readonly PrCloseoutCheckInput[] {
	const explicitlyRequired = checks.filter((check) => check.required === true);
	return explicitlyRequired.length > 0 ? explicitlyRequired : checks;
}

function isTestCheck(check: PrCloseoutCheckInput): boolean {
	return /\b(?:test|tests|vitest|jest|playwright|check|quality|pipeline)\b/iu.test(
		check.name,
	);
}

function normalizedSha(value: string | null | undefined): string | null {
	const trimmed = value?.trim();
	return trimmed ? trimmed : null;
}

function currentHeadSha(input: PrCloseoutInput): string | null {
	return (
		normalizedSha(input.pullRequest.headSha) ??
		normalizedSha(input.branch?.headSha) ??
		null
	);
}

function checkFreshness(
	check: PrCloseoutCheckInput,
	headSha: string | null,
): PrCloseoutEvidenceFreshness {
	const checkSha = normalizedSha(check.headSha);
	if (!headSha || !checkSha) return "unknown";
	return checkSha === headSha ? "current" : "stale";
}

function requiredChecksAreCurrent(
	checks: readonly PrCloseoutCheckInput[],
	headSha: string | null,
): boolean {
	const required = requiredChecks(checks);
	return (
		headSha !== null &&
		required.length > 0 &&
		required.every((check) => checkFreshness(check, headSha) === "current")
	);
}

function evidenceRefFromCheck(check: PrCloseoutCheckInput): string {
	return check.url ?? `check:${check.name}`;
}

function hasKnownIndependentReview(
	pr: PrCloseoutPullRequestInput,
	checks: readonly PrCloseoutCheckInput[],
): boolean {
	if (normalizeStatus(pr.reviewDecision) !== "") return true;
	return checks.some((check) => check.source === "coderabbit");
}

function claimBlockerClass(
	status: PrCloseoutClaimStatus,
): PrCloseoutBlockerClassification | null {
	if (status === "pass" || status === "not_applicable") return null;
	return status === "blocked" || status === "unknown"
		? "unknown"
		: "introduced";
}

function claimMissingContext(
	claim: PrCloseoutClaim["claim"],
	status: PrCloseoutClaimStatus,
	source: PrCloseoutClaimSource,
	freshness: PrCloseoutEvidenceFreshness,
): MissingContextClassification | null {
	if (status === "pass" || status === "not_applicable") return null;
	if (status === "fail" && freshness === "current") return null;
	return classifyMissingContext({
		surface: source,
		claim,
		problem:
			freshness === "stale"
				? "stale"
				: freshness === "missing"
					? "missing"
					: status === "blocked"
						? "blocked"
						: "unknown",
	});
}

function buildClaim(
	claim: PrCloseoutClaim["claim"],
	status: PrCloseoutClaimStatus,
	source: PrCloseoutClaimSource,
	verifiedAt: string,
	options: {
		evidenceRef?: string | null;
		headSha?: string | null;
		freshness?: PrCloseoutEvidenceFreshness;
		blockerClass?: PrCloseoutBlockerClassification | null;
		missingContext?: MissingContextClassification | null;
	} = {},
): PrCloseoutClaim {
	const freshness =
		options.freshness ?? (status === "pass" ? "current" : "missing");
	return {
		claim,
		status,
		evidenceRef: options.evidenceRef ?? null,
		source,
		headSha: options.headSha ?? null,
		freshness,
		blockerClass:
			options.blockerClass === undefined
				? claimBlockerClass(status)
				: options.blockerClass,
		missingContext:
			options.missingContext === undefined
				? claimMissingContext(claim, status, source, freshness)
				: options.missingContext,
		verifiedAt,
	};
}

interface CheckClaimOptions {
	required: readonly PrCloseoutCheckInput[];
	currentRequired: boolean;
	freshness: PrCloseoutEvidenceFreshness;
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
		mergeState === "DIRTY";
	if (!current && !stale) {
		return { status: "unknown", evidenceRef: null, freshness: "missing" };
	}
	return {
		status: stale ? "fail" : "pass",
		evidenceRef:
			mergeState === "CLEAN" || mergeState === "DIRTY"
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
	if (claim.source !== "checks") return false;
	return claim.freshness === "missing";
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

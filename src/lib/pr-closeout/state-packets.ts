import type { EvidenceReceipt } from "../evidence/evidence-receipt.js";
import {
	evaluateExternalStateClaimSupport,
	validateExternalStateSnapshot,
	type ExternalStateClaimSupportResult,
	type ExternalStateSnapshot,
	type ExternalStateSource,
	type ExternalStateSourceSnapshot,
	type ExternalStateValidationResult,
} from "../external-state/index.js";
import {
	validateReviewStatePacket,
	type ReviewStateGithubDecision,
	type ReviewStatePacket,
	type ReviewStateReviewerArtifact,
	type ReviewStateValidationResult,
} from "../review-state/index.js";
import {
	hasLinearReference,
	isFailedCheck,
	isPassingCheck,
	isPendingCheck,
	normalizeStatus,
} from "./evidence.js";
import {
	buildPrCloseoutStatePacketDeliveryTruth,
	type DeliveryTruthVerdict,
} from "./state-packet-delivery-truth.js";
import {
	checkFreshness,
	currentHeadSha,
	requiredChecks,
} from "./claim-helpers.js";
import {
	buildStatePacketReceipt,
	isClaimSupportExternalStateSource,
	statePacketByteLength,
	statePacketChecksum,
} from "./state-packet-evidence.js";
import type {
	PrCloseoutCheckInput,
	PrCloseoutInput,
	PrCloseoutPullRequestInput,
} from "./types.js";

const DEFAULT_TTL_SECONDS = 300;
const DEFAULT_VERIFIER_IDENTITY = "harness:pr-closeout-state-packets";
const EXTERNAL_FETCH_REF_PREFIX = "external-state:pr-closeout";
const REVIEW_FETCH_REF_PREFIX = "review-state:pr-closeout";
const SOURCE_ORDER: ExternalStateSource[] = [
	"github_pr",
	"github_checks",
	"github_reviews",
	"coderabbit",
	"linear",
	"circleci",
];

/** Receipt-backed review artifact proof supplied to the state-packet builder. */
export interface PrCloseoutStatePacketReviewerArtifactProof {
	role: string;
	path: string;
	expectedProducer?: string | null;
	ownershipClassification?: ReviewStateReviewerArtifact["ownershipClassification"];
	receipt: EvidenceReceipt;
}

/** Options for deriving closeout state packets from normalized PR closeout input. */
export interface PrCloseoutStatePacketOptions {
	repository: string;
	generatedAt?: string;
	fetchedAt?: string;
	ttlSeconds?: number;
	verifierIdentity?: string;
	reviewerArtifactProofs?: PrCloseoutStatePacketReviewerArtifactProof[];
}

/** Validated packet derivation result for external-state and review-state truth. */
export interface PrCloseoutStatePackets {
	externalState: ExternalStateSnapshot | null;
	reviewState: ReviewStatePacket | null;
	externalStateValidation: ExternalStateValidationResult;
	reviewStateValidation: ReviewStateValidationResult;
	externalStateClaimSupport: ExternalStateClaimSupportResult;
	deliveryTruth: DeliveryTruthVerdict[];
	blockers: string[];
}

/** Derive verifier-owned external-state and review-state packets from closeout input. */
export function buildPrCloseoutStatePackets(
	input: PrCloseoutInput,
	options: PrCloseoutStatePacketOptions,
): PrCloseoutStatePackets {
	const generatedAt = options.generatedAt ?? new Date().toISOString();
	const fetchedAt = options.fetchedAt ?? generatedAt;
	const ttlSeconds = options.ttlSeconds ?? DEFAULT_TTL_SECONDS;
	const verifierIdentity =
		options.verifierIdentity ?? DEFAULT_VERIFIER_IDENTITY;
	const headSha = currentHeadSha(input);
	const reviewerArtifactProofs = options.reviewerArtifactProofs ?? [];
	const blockers = preflightBlockers(
		input,
		options.repository,
		headSha,
		reviewerArtifactProofs,
	);
	const externalState =
		options.repository.trim() === ""
			? null
			: buildExternalStateSnapshot(input, {
					repository: options.repository,
					generatedAt,
					fetchedAt,
					ttlSeconds,
					verifierIdentity,
					headSha,
				});
	const reviewState =
		blockers.length === 0
			? buildReviewStatePacket(input, {
					repository: options.repository,
					generatedAt,
					verifierIdentity,
					headSha: headSha as string,
					reviewerArtifactProofs,
				})
			: null;
	const externalStateValidation = validateExternalStateSnapshot(externalState);
	const reviewStateValidation = validateReviewStatePacket(reviewState);
	const externalStateClaimSupport = externalState
		? evaluateExternalStateClaimSupport(externalState, headSha)
		: {
				canSupportClaim: false,
				blockers: ["missing_fetch_proof" as const],
			};
	const deliveryTruth = buildPrCloseoutStatePacketDeliveryTruth({
		externalState,
		reviewState,
		externalStateValidation,
		reviewStateValidation,
		verifiedAt: generatedAt,
		verdictHeadSha: headSha,
		verifierTtlSeconds: ttlSeconds,
	});

	return {
		externalState,
		reviewState,
		externalStateValidation,
		reviewStateValidation,
		externalStateClaimSupport,
		deliveryTruth,
		blockers,
	};
}

interface PacketBuildContext {
	repository: string;
	generatedAt: string;
	fetchedAt: string;
	ttlSeconds: number;
	verifierIdentity: string;
	headSha: string | null;
}

function preflightBlockers(
	input: PrCloseoutInput,
	repository: string,
	headSha: string | null,
	reviewerArtifactProofs: readonly PrCloseoutStatePacketReviewerArtifactProof[],
): string[] {
	const blockers: string[] = [];
	if (repository.trim() === "") blockers.push("missing_repository");
	if (!headSha) blockers.push("missing_pr_head_sha");
	if (!input.pullRequest.url) blockers.push("missing_pr_url");
	if (!input.pullRequest.baseRefName) blockers.push("missing_pr_base_ref");
	if (!input.pullRequest.headRefName) blockers.push("missing_pr_head_ref");
	if (input.reviewThreads?.unresolved === null || !input.reviewThreads) {
		blockers.push("review_threads_unknown");
	}
	for (const artifact of input.reviewArtifacts ?? []) {
		if (artifact.status !== "present") {
			blockers.push(`reviewer_artifact_${artifact.status}:${artifact.path}`);
			continue;
		}
		const proof = reviewerArtifactProofs.find(
			(candidate) =>
				candidate.path === artifact.path &&
				(candidate.expectedProducer ?? candidate.role) === artifact.producer,
		);
		if (!proof) {
			blockers.push(`reviewer_artifact_missing_proof:${artifact.path}`);
			continue;
		}
		if (!isUsableReviewerArtifactProof(proof)) {
			blockers.push(`reviewer_artifact_unverified_proof:${artifact.path}`);
		}
	}
	return blockers;
}

function isUsableReviewerArtifactProof(
	proof: PrCloseoutStatePacketReviewerArtifactProof,
): boolean {
	return (
		proof.receipt.kind === "review_artifact" &&
		proof.receipt.status === "pass" &&
		proof.receipt.freshness === "current" &&
		proof.receipt.evidenceUse === "claim_support" &&
		proof.receipt.blockerClass === null
	);
}

function buildExternalStateSnapshot(
	input: PrCloseoutInput,
	context: PacketBuildContext,
): ExternalStateSnapshot {
	const fetchReceiptRef = `${EXTERNAL_FETCH_REF_PREFIX}/pr-${String(input.pullRequest.number)}/fetch.json`;
	const fetchedArtifactHash = statePacketChecksum({
		pullRequest: input.pullRequest,
		checks: input.checks ?? [],
		reviewThreads: input.reviewThreads ?? null,
		linearMutation: input.linearMutation ?? "unknown",
		generatedAt: context.generatedAt,
		fetchedAt: context.fetchedAt,
	});
	const sourceContext = { ...context, fetchedArtifactHash };
	const sources = SOURCE_ORDER.map((source) =>
		buildExternalSource(source, input, sourceContext),
	);
	const staleSources = sources.filter((source) => source.status === "stale");
	const evidenceUse = sources.every(isClaimSupportExternalStateSource)
		? "claim_support"
		: "orientation";
	const fetchReceipt = buildStatePacketReceipt({
		kind: "external_state",
		ref: fetchReceiptRef,
		producer: context.verifierIdentity,
		verifiedAt: context.generatedAt,
		headSha: context.headSha,
		checksum: fetchedArtifactHash,
		sizeBytes: statePacketByteLength(fetchedArtifactHash),
	});

	return {
		schemaVersion: "external-state-snapshot/v1",
		generatedAt: context.generatedAt,
		repository: context.repository,
		prNumber: input.pullRequest.number,
		fetchedAt: context.fetchedAt,
		ttlSeconds: context.ttlSeconds,
		headSha: context.headSha,
		fetchReceiptRef,
		fetchedArtifactHash,
		verifierIdentity: context.verifierIdentity,
		fetchReceipt,
		evidenceUse,
		stale: staleSources.length > 0,
		staleReasons: staleSources.flatMap((source) => source.staleReasons),
		sources,
	};
}

interface SourceBuildContext extends PacketBuildContext {
	fetchedArtifactHash: string;
}

function buildExternalSource(
	source: ExternalStateSource,
	input: PrCloseoutInput,
	context: SourceBuildContext,
): ExternalStateSourceSnapshot {
	switch (source) {
		case "github_pr":
			return githubPrSource(input.pullRequest, context);
		case "github_checks":
			return checksSource(
				"github_checks",
				requiredChecks(input.checks ?? []),
				context,
			);
		case "github_reviews":
			return githubReviewsSource(input, context);
		case "coderabbit":
			return checksSource(
				"coderabbit",
				(input.checks ?? []).filter(isCodeRabbitCheck),
				context,
			);
		case "linear":
			return linearSource(input, context);
		case "circleci":
			return checksSource(
				"circleci",
				(input.checks ?? []).filter(isCircleCiCheck),
				context,
			);
	}
}

function githubPrSource(
	pr: PrCloseoutPullRequestInput,
	context: SourceBuildContext,
): ExternalStateSourceSnapshot {
	const statusKnown =
		normalizeStatus(pr.state) !== "" &&
		typeof pr.isDraft === "boolean" &&
		Boolean(pr.url) &&
		Boolean(context.headSha);
	if (!statusKnown) {
		return sourceSnapshot("github_pr", context, {
			status: "unknown",
			freshness: "unknown",
			resultStatus: "unknown",
			evidenceUse: "orientation",
		});
	}
	const ready = normalizeStatus(pr.state) === "OPEN" && pr.isDraft === false;
	return sourceSnapshot("github_pr", context, {
		resultStatus: ready ? "pass" : "blocked",
		evidenceUse: ready ? "claim_support" : "orientation",
	});
}

function checksSource(
	source: ExternalStateSource,
	checks: readonly PrCloseoutCheckInput[],
	context: SourceBuildContext,
): ExternalStateSourceSnapshot {
	if (checks.length === 0) {
		return sourceSnapshot(source, context, {
			status: "unknown",
			freshness: "unknown",
			resultStatus: "unknown",
			evidenceUse: "orientation",
		});
	}
	const staleChecks = checks.filter(
		(check) => checkFreshness(check, context.headSha) === "stale",
	);
	if (staleChecks.length > 0) {
		return sourceSnapshot(source, context, {
			status: "stale",
			freshness: "stale",
			resultStatus: "blocked",
			evidenceUse: "orientation",
			staleReasons: [`${source}_head_sha_mismatch`],
		});
	}
	const allPassing = checks.every((check) => isPassingCheck(check));
	const anyFailed = checks.some((check) => isFailedCheck(check));
	const anyPending = checks.some((check) => isPendingCheck(check));
	if (
		allPassing &&
		checks.every(
			(check) => checkFreshness(check, context.headSha) === "current",
		)
	) {
		return sourceSnapshot(source, context, { resultStatus: "pass" });
	}
	return sourceSnapshot(source, context, {
		resultStatus: anyFailed ? "fail" : anyPending ? "blocked" : "unknown",
		evidenceUse: "orientation",
		freshness: context.headSha ? "unknown" : "missing",
	});
}

function githubReviewsSource(
	input: PrCloseoutInput,
	context: SourceBuildContext,
): ExternalStateSourceSnapshot {
	const reviewThreads = input.reviewThreads;
	if (!reviewThreads || reviewThreads.unresolved === null) {
		return sourceSnapshot("github_reviews", context, {
			status: "unknown",
			freshness: "unknown",
			resultStatus: "unknown",
			evidenceUse: "orientation",
		});
	}
	return sourceSnapshot("github_reviews", context, {
		resultStatus: reviewThreads.unresolved === 0 ? "pass" : "fail",
		evidenceUse:
			reviewThreads.unresolved === 0 ? "claim_support" : "orientation",
	});
}

function linearSource(
	input: PrCloseoutInput,
	context: SourceBuildContext,
): ExternalStateSourceSnapshot {
	const mutationAvailability = input.linearMutation ?? "unknown";
	if (!hasLinearReference(input.pullRequest.body)) {
		return sourceSnapshot("linear", context, {
			status: "unknown",
			freshness: "missing",
			headSha: null,
			prHeadSensitive: false,
			resultStatus: "unknown",
			evidenceUse: "orientation",
		});
	}
	if (
		mutationAvailability === "available" ||
		mutationAvailability === "not_needed"
	) {
		return sourceSnapshot("linear", context, {
			status: "available",
			freshness: "current",
			headSha: context.headSha,
			prHeadSensitive: true,
			resultStatus: "pass",
			evidenceUse: "claim_support",
		});
	}
	return sourceSnapshot("linear", context, {
		status: mutationAvailability === "blocked" ? "available" : "unknown",
		freshness: mutationAvailability === "blocked" ? "current" : "unknown",
		headSha: null,
		prHeadSensitive: false,
		resultStatus: mutationAvailability === "blocked" ? "blocked" : "unknown",
		evidenceUse: "orientation",
	});
}

function sourceSnapshot(
	source: ExternalStateSource,
	context: SourceBuildContext,
	overrides: Partial<ExternalStateSourceSnapshot> = {},
): ExternalStateSourceSnapshot {
	const prHeadSensitive = overrides.prHeadSensitive ?? source !== "linear";
	return {
		source,
		status: overrides.status ?? "available",
		fetchedAt: context.fetchedAt,
		ttlSeconds: context.ttlSeconds,
		headSha:
			overrides.headSha === undefined
				? prHeadSensitive
					? context.headSha
					: null
				: overrides.headSha,
		prHeadSensitive,
		evidenceUse: overrides.evidenceUse ?? "claim_support",
		evidenceRef: overrides.evidenceRef ?? `external-state:${source}.json`,
		freshness: overrides.freshness ?? "current",
		resultStatus: overrides.resultStatus ?? "pass",
		staleReasons: overrides.staleReasons ?? [],
	};
}

function buildReviewStatePacket(
	input: PrCloseoutInput,
	options: {
		repository: string;
		generatedAt: string;
		verifierIdentity: string;
		headSha: string;
		reviewerArtifactProofs: PrCloseoutStatePacketReviewerArtifactProof[];
	},
): ReviewStatePacket {
	const fetchReceiptRef = `${REVIEW_FETCH_REF_PREFIX}/pr-${String(input.pullRequest.number)}/fetch.json`;
	const fetchedArtifactHash = statePacketChecksum({
		pullRequest: input.pullRequest,
		reviewThreads: input.reviewThreads,
		reviewerArtifactProofs: options.reviewerArtifactProofs.map((proof) => ({
			role: proof.role,
			path: proof.path,
			expectedProducer: proof.expectedProducer,
			receipt: proof.receipt,
		})),
		generatedAt: options.generatedAt,
	});
	const fetchReceipt = buildStatePacketReceipt({
		kind: "review_artifact",
		ref: fetchReceiptRef,
		producer: options.verifierIdentity,
		verifiedAt: options.generatedAt,
		headSha: options.headSha,
		checksum: fetchedArtifactHash,
		sizeBytes: statePacketByteLength(fetchedArtifactHash),
	});
	return {
		schemaVersion: "review-state/v1",
		generatedAt: options.generatedAt,
		pr: {
			number: input.pullRequest.number,
			repository: options.repository,
			url: input.pullRequest.url as string,
			baseRef: input.pullRequest.baseRefName as string,
			headRef: input.pullRequest.headRefName as string,
			headSha: options.headSha,
		},
		fetchReceiptRef,
		fetchedArtifactHash,
		verifierIdentity: options.verifierIdentity,
		fetchReceipt,
		githubReviews: githubReviews(input),
		codeRabbit: codeRabbitReview(input),
		unresolvedThreads: {
			total: input.reviewThreads?.unresolved ?? 0,
			needsHuman: input.reviewThreads?.needsHuman ?? 0,
			autofixable: input.reviewThreads?.autofixable ?? 0,
		},
		reviewerArtifacts: options.reviewerArtifactProofs.map((proof) => ({
			role: proof.role,
			path: proof.path,
			expectedProducer: proof.expectedProducer ?? proof.role,
			ownershipClassification:
				proof.ownershipClassification ?? "introduced_by_current_patch",
			receipt: proof.receipt,
		})),
	};
}

function githubReviews(
	input: PrCloseoutInput,
): ReviewStatePacket["githubReviews"] {
	const decision = githubReviewDecision(input.pullRequest.reviewDecision);
	return {
		decision,
		status:
			decision === "approved"
				? "pass"
				: decision === "unknown"
					? "unknown"
					: "blocked",
		reviewCount: decision === "unknown" ? 0 : 1,
	};
}

function githubReviewDecision(
	value: string | null | undefined,
): ReviewStateGithubDecision {
	switch (normalizeStatus(value)) {
		case "APPROVED":
			return "approved";
		case "CHANGES_REQUESTED":
			return "changes_requested";
		case "REVIEW_REQUIRED":
		case "REVIEW_REQUESTED":
			return "review_required";
		default:
			return "unknown";
	}
}

function codeRabbitReview(
	input: PrCloseoutInput,
): ReviewStatePacket["codeRabbit"] {
	const checks = (input.checks ?? []).filter(isCodeRabbitCheck);
	if (checks.length === 0 && input.pullRequest.isDraft === true) {
		return {
			status: "skipped_draft",
			evidenceStatus: "blocked",
			commentCount: 0,
		};
	}
	if (checks.length === 0) {
		return {
			status: "unknown",
			evidenceStatus: "unknown",
			commentCount: 0,
		};
	}
	if (checks.every((check) => isPassingCheck(check))) {
		return { status: "completed", evidenceStatus: "pass", commentCount: 0 };
	}
	if (checks.some((check) => isFailedCheck(check))) {
		return { status: "failed", evidenceStatus: "fail", commentCount: 0 };
	}
	return { status: "unknown", evidenceStatus: "blocked", commentCount: 0 };
}

function isCodeRabbitCheck(check: PrCloseoutCheckInput): boolean {
	return check.source === "coderabbit" || /coderabbit/iu.test(check.name);
}

function isCircleCiCheck(check: PrCloseoutCheckInput): boolean {
	return (
		check.source === "circleci" || /circleci|pr-pipeline/iu.test(check.name)
	);
}

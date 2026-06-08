import {
	composeDeliveryTruth,
	type DeliveryTruthEvidence,
	type DeliveryTruthVerdict,
} from "../delivery-truth/index.js";
import type { EvidenceReceipt } from "../evidence/evidence-receipt.js";
import type {
	ExternalStateSnapshot,
	ExternalStateSource,
	ExternalStateValidationResult,
} from "../external-state/index.js";
import type {
	ReviewStatePacket,
	ReviewStateValidationResult,
} from "../review-state/index.js";
import {
	buildStatePacketReceipt,
	isClaimSupportExternalStateSource,
	statePacketByteLength,
	statePacketChecksum,
	statePacketVerifierTtlOption,
} from "./state-packet-evidence.js";

export type { DeliveryTruthVerdict };

/** Compose the delivery-truth claims this state-packet bridge is allowed to support. */
export function buildPrCloseoutStatePacketDeliveryTruth(options: {
	externalState: ExternalStateSnapshot | null;
	reviewState: ReviewStatePacket | null;
	externalStateValidation: ExternalStateValidationResult;
	reviewStateValidation: ReviewStateValidationResult;
	verifiedAt: string;
	verdictHeadSha: string | null;
	verifierTtlSeconds?: number;
}): DeliveryTruthVerdict[] {
	return [
		composeDeliveryTruth({
			claim: "remote_checks_current",
			source: "external_state",
			evidence: externalStateDeliveryTruthEvidence(options),
			verifiedAt: options.verifiedAt,
			verdictHeadSha: options.verdictHeadSha,
			...statePacketVerifierTtlOption(options.verifierTtlSeconds),
		}),
		composeDeliveryTruth({
			claim: "review_threads_resolved",
			source: "review_state",
			evidence: reviewStateDeliveryTruthEvidence(options),
			verifiedAt: options.verifiedAt,
			verdictHeadSha: options.verdictHeadSha,
			...statePacketVerifierTtlOption(options.verifierTtlSeconds),
		}),
		composeDeliveryTruth({
			claim: "linear_state_aligned",
			source: "external_state",
			evidence: externalStateDeliveryTruthEvidence(options, ["linear"]),
			verifiedAt: options.verifiedAt,
			verdictHeadSha: options.verdictHeadSha,
			...statePacketVerifierTtlOption(options.verifierTtlSeconds),
		}),
		composeDeliveryTruth({
			claim: "merge_ready",
			source: "pr_closeout",
			evidence: mergeReadyDeliveryTruthEvidence(options),
			verifiedAt: options.verifiedAt,
			verdictHeadSha: options.verdictHeadSha,
			...statePacketVerifierTtlOption(options.verifierTtlSeconds),
		}),
		composeDeliveryTruth({
			claim: "root_surface_tidy",
			source: "root_hygiene",
			evidence: [],
			verifiedAt: options.verifiedAt,
			verdictHeadSha: options.verdictHeadSha,
			...statePacketVerifierTtlOption(options.verifierTtlSeconds),
		}),
		composeDeliveryTruth({
			claim: "goal_ready_for_judge_pm",
			source: "pr_closeout",
			evidence: [],
			verifiedAt: options.verifiedAt,
			verdictHeadSha: options.verdictHeadSha,
			...statePacketVerifierTtlOption(options.verifierTtlSeconds),
		}),
	];
}

const REMOTE_CHECK_CLAIM_SOURCE_NAMES = ["github_checks", "circleci"] as const;

function externalStateDeliveryTruthEvidence(
	options: {
		externalState: ExternalStateSnapshot | null;
		externalStateValidation: ExternalStateValidationResult;
		verifierTtlSeconds?: number;
	},
	requiredSourceNames: readonly ExternalStateSource[] = REMOTE_CHECK_CLAIM_SOURCE_NAMES,
): DeliveryTruthEvidence[] {
	const snapshot = options.externalState;
	if (!snapshot || !options.externalStateValidation.valid) return [];
	const sources = snapshot.sources.filter((source) =>
		requiredSourceNames.some((name) => name === source.source),
	);
	if (sources.length !== requiredSourceNames.length) return [];
	const remoteChecksPayload = {
		claim: requiredSourceNames.join("+"),
		fetchReceiptRef: snapshot.fetchReceiptRef,
		sources,
	};
	const receipt = buildStatePacketReceipt({
		kind: "external_state",
		ref: `external-state:pr-closeout/pr-${String(snapshot.prNumber)}/${requiredSourceNames.join("-")}.json`,
		producer: snapshot.verifierIdentity,
		verifiedAt: snapshot.generatedAt,
		headSha: snapshot.headSha,
		checksum: statePacketChecksum(remoteChecksPayload),
		sizeBytes: statePacketByteLength(remoteChecksPayload),
		status: aggregateReceiptStatus(
			sources.map((source) => source.resultStatus),
		),
		freshness: aggregateReceiptFreshness(
			sources.map((source) => source.freshness),
		),
		evidenceUse: sources.every(isClaimSupportExternalStateSource)
			? "claim_support"
			: "orientation",
	});
	return [
		{
			receipt,
			source: "external_state",
			externalStateSources: requiredSourceNames,
			producerTtlSeconds: Math.max(
				...sources.map((source) => source.ttlSeconds),
			),
			...statePacketVerifierTtlOption(options.verifierTtlSeconds),
			fetchedAt: snapshot.fetchedAt,
			recomputedHeadSha: snapshot.headSha,
		},
	];
}

function mergeReadyDeliveryTruthEvidence(options: {
	externalState: ExternalStateSnapshot | null;
	reviewState: ReviewStatePacket | null;
	externalStateValidation: ExternalStateValidationResult;
	reviewStateValidation: ReviewStateValidationResult;
	verifiedAt: string;
	verdictHeadSha: string | null;
	verifierTtlSeconds?: number;
}): DeliveryTruthEvidence[] {
	return [
		...externalStateDeliveryTruthEvidence(options),
		...reviewStateDeliveryTruthEvidence(options),
		...prCloseoutMergeReadyEvidence(options),
	];
}

function prCloseoutMergeReadyEvidence(options: {
	externalState: ExternalStateSnapshot | null;
	reviewState: ReviewStatePacket | null;
	verifiedAt: string;
	verdictHeadSha: string | null;
	verifierTtlSeconds?: number;
}): DeliveryTruthEvidence[] {
	const snapshot = options.externalState;
	const reviewState = options.reviewState;
	if (!snapshot || !reviewState) return [];
	const payload = {
		claim: "merge_ready",
		externalStateRef: snapshot.fetchReceiptRef,
		reviewStateRef: reviewState.fetchReceiptRef,
		prNumber: snapshot.prNumber,
		headSha: options.verdictHeadSha,
	};
	return [
		{
			receipt: buildStatePacketReceipt({
				kind: "artifact",
				ref: `pr-closeout:pr-closeout/pr-${String(snapshot.prNumber)}/merge-ready.json`,
				producer: snapshot.verifierIdentity,
				verifiedAt: options.verifiedAt,
				headSha: options.verdictHeadSha,
				checksum: statePacketChecksum(payload),
				sizeBytes: statePacketByteLength(payload),
				status: "pass",
				freshness: "current",
				evidenceUse: "claim_support",
			}),
			source: "pr_closeout",
			...statePacketVerifierTtlOption(options.verifierTtlSeconds),
			recomputedHeadSha: options.verdictHeadSha,
		},
	];
}

function reviewStateDeliveryTruthEvidence(options: {
	reviewState: ReviewStatePacket | null;
	reviewStateValidation: ReviewStateValidationResult;
	verifierTtlSeconds?: number;
}): DeliveryTruthEvidence[] {
	const packet = options.reviewState;
	if (!packet || !options.reviewStateValidation.valid) return [];
	return [
		{
			receipt: packet.fetchReceipt,
			source: "review_state",
			reviewStateSummary: {
				githubDecision: packet.githubReviews.decision,
				unresolvedThreads: packet.unresolvedThreads,
			},
			...statePacketVerifierTtlOption(options.verifierTtlSeconds),
			recomputedHeadSha: packet.pr.headSha,
		},
	];
}

function aggregateReceiptStatus(
	statuses: readonly EvidenceReceipt["status"][],
): EvidenceReceipt["status"] {
	if (statuses.some((status) => status === "fail")) return "fail";
	if (statuses.some((status) => status === "blocked")) return "blocked";
	if (statuses.some((status) => status === "unknown")) return "unknown";
	if (statuses.some((status) => status === "not_applicable")) {
		return "not_applicable";
	}
	return "pass";
}

function aggregateReceiptFreshness(
	freshnesses: readonly EvidenceReceipt["freshness"][],
): EvidenceReceipt["freshness"] {
	if (freshnesses.some((freshness) => freshness === "stale")) return "stale";
	if (freshnesses.some((freshness) => freshness === "missing"))
		return "missing";
	if (freshnesses.some((freshness) => freshness === "unknown"))
		return "unknown";
	if (freshnesses.some((freshness) => freshness === "not_applicable")) {
		return "not_applicable";
	}
	return "current";
}

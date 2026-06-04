import { createHash } from "node:crypto";
import {
	composeDeliveryTruth,
	type DeliveryTruthEvidence,
	type DeliveryTruthVerdict,
} from "../delivery-truth/index.js";
import type { EvidenceReceipt } from "../evidence/evidence-receipt.js";
import type {
	ExternalStateSnapshot,
	ExternalStateSourceSnapshot,
	ExternalStateValidationResult,
} from "../external-state/index.js";
import type {
	ReviewStatePacket,
	ReviewStateValidationResult,
} from "../review-state/index.js";

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
			...verifierTtlOption(options.verifierTtlSeconds),
		}),
		composeDeliveryTruth({
			claim: "review_threads_resolved",
			source: "review_state",
			evidence: reviewStateDeliveryTruthEvidence(options),
			verifiedAt: options.verifiedAt,
			verdictHeadSha: options.verdictHeadSha,
			...verifierTtlOption(options.verifierTtlSeconds),
		}),
	];
}

function externalStateDeliveryTruthEvidence(options: {
	externalState: ExternalStateSnapshot | null;
	externalStateValidation: ExternalStateValidationResult;
	verifierTtlSeconds?: number;
}): DeliveryTruthEvidence[] {
	const snapshot = options.externalState;
	if (!snapshot || !options.externalStateValidation.valid) return [];
	const sourceNames = ["github_checks", "circleci"] as const;
	const sources = snapshot.sources.filter((source) =>
		sourceNames.some((name) => name === source.source),
	);
	if (sources.length !== sourceNames.length) return [];
	const receipt = buildReceipt({
		kind: "external_state",
		ref: `external-state:pr-closeout/pr-${String(snapshot.prNumber)}/remote-checks.json`,
		producer: snapshot.verifierIdentity,
		verifiedAt: snapshot.generatedAt,
		headSha: snapshot.headSha,
		checksum: checksum({
			claim: "remote_checks_current",
			fetchReceiptRef: snapshot.fetchReceiptRef,
			sources,
		}),
		sizeBytes: byteLength(sources),
		status: aggregateReceiptStatus(
			sources.map((source) => source.resultStatus),
		),
		freshness: aggregateReceiptFreshness(
			sources.map((source) => source.freshness),
		),
		evidenceUse: sources.every(isClaimSupportSource)
			? "claim_support"
			: "orientation",
	});
	return [
		{
			receipt,
			source: "external_state",
			externalStateSources: sourceNames,
			producerTtlSeconds: Math.max(
				...sources.map((source) => source.ttlSeconds),
			),
			...verifierTtlOption(options.verifierTtlSeconds),
			fetchedAt: snapshot.fetchedAt,
			recomputedHeadSha: snapshot.headSha,
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
			...verifierTtlOption(options.verifierTtlSeconds),
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

function verifierTtlOption(
	verifierTtlSeconds: number | undefined,
): { verifierTtlSeconds: number } | Record<string, never> {
	return verifierTtlSeconds === undefined ? {} : { verifierTtlSeconds };
}

function buildReceipt(options: {
	kind: EvidenceReceipt["kind"];
	ref: string;
	producer: string;
	verifiedAt: string;
	headSha: string | null;
	checksum: string;
	sizeBytes: number;
	status?: EvidenceReceipt["status"];
	freshness?: EvidenceReceipt["freshness"];
	evidenceUse?: EvidenceReceipt["evidenceUse"];
}): EvidenceReceipt {
	return {
		schemaVersion: "evidence-receipt/v1",
		kind: options.kind,
		ref: options.ref,
		producer: options.producer,
		status: options.status ?? "pass",
		freshness: options.freshness ?? "current",
		evidenceUse: options.evidenceUse ?? "claim_support",
		blockerClass: null,
		verifiedAt: options.verifiedAt,
		headSha: options.headSha,
		sizeBytes: options.sizeBytes,
		checksum: options.checksum,
	};
}

function isClaimSupportSource(source: ExternalStateSourceSnapshot): boolean {
	return (
		source.status === "available" &&
		source.evidenceUse === "claim_support" &&
		source.freshness === "current" &&
		source.resultStatus === "pass"
	);
}

function checksum(value: unknown): string {
	return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function byteLength(value: unknown): number {
	return Buffer.byteLength(stableStringify(value), "utf8");
}

function stableStringify(value: unknown): string {
	if (Array.isArray(value)) {
		return `[${value.map((item) => stableStringify(item)).join(",")}]`;
	}
	if (value && typeof value === "object") {
		const record = value as Record<string, unknown>;
		return `{${Object.keys(record)
			.sort()
			.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
			.join(",")}}`;
	}
	return JSON.stringify(value);
}

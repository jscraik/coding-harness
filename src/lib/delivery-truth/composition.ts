import {
	isSafeEvidenceReceiptPointer,
	validateEvidenceReceipt,
} from "../evidence/evidence-receipt.js";
import type {
	EvidenceReceiptFreshness,
	EvidenceReceiptKind,
} from "../evidence/evidence-receipt.js";
import type { ExternalStateSource } from "../external-state/types.js";
import type { PrCloseoutClaimStatus } from "../pr-closeout/types.js";
import { sameRootHygieneRepositoryIdentity } from "../root-hygiene/repository-identity.js";
import { isTrustedRootHygieneEvidence } from "./root-hygiene-evidence.js";
import { DELIVERY_TRUTH_SCHEMA_VERSION } from "./types.js";
import type {
	DeliveryTruthBlockerCode,
	DeliveryTruthCompositionInput,
	DeliveryTruthEvidence,
	DeliveryTruthVerdict,
} from "./types.js";

interface DeliveryTruthBlocker {
	status: PrCloseoutClaimStatus;
	code: DeliveryTruthBlockerCode;
	freshness: DeliveryTruthVerdict["freshness"];
	evidence: DeliveryTruthEvidence | null;
}

const MERGE_READY_REQUIRED_SOURCES = [
	"external_state",
	"review_state",
	"pr_closeout",
] satisfies readonly DeliveryTruthEvidence["source"][];

/** Compose a private delivery-truth verdict from receipt-backed claim evidence. */
export function composeDeliveryTruth(
	input: DeliveryTruthCompositionInput,
): DeliveryTruthVerdict {
	const evidenceRefs = input.evidence
		.map((evidence) => evidence.receipt.ref)
		.filter(isSafeEvidenceReceiptPointer);
	const blocker = firstBlocker(input);
	const firstEvidence = blocker?.evidence ?? input.evidence[0] ?? null;
	const status = blocker?.status ?? "pass";
	const evidenceRef = safeEvidenceRef(firstEvidence);
	const blockerRefs = blocker?.evidence
		? [safeEvidenceRef(blocker.evidence)]
		: [];
	return {
		schemaVersion: DELIVERY_TRUTH_SCHEMA_VERSION,
		claim: input.claim,
		status,
		statusLabel: deliveryTruthStatusLabel(input.claim, status, blocker?.code),
		source: firstEvidence?.source ?? input.source,
		evidenceRef,
		evidenceRefs,
		blockerRefs: blockerRefs.filter((ref): ref is string => ref !== null),
		headSha: firstEvidence?.receipt.headSha ?? input.verdictHeadSha ?? null,
		verdictHeadSha: input.verdictHeadSha ?? null,
		freshness: blocker?.freshness ?? "current",
		blockerClass: blocker ? blockerClass(status) : null,
		blockerCode: blocker?.code ?? null,
		verifiedAt: input.verifiedAt,
		evidenceUse: firstEvidence?.receipt.evidenceUse ?? null,
	};
}

function safeEvidenceRef(
	evidence: DeliveryTruthEvidence | null,
): string | null {
	const ref = evidence?.receipt.ref;
	return ref && isSafeEvidenceReceiptPointer(ref) ? ref : null;
}

function deliveryTruthStatusLabel(
	claim: DeliveryTruthCompositionInput["claim"],
	status: PrCloseoutClaimStatus,
	blockerCode: DeliveryTruthBlockerCode | null | undefined,
): string {
	return blockerCode
		? `${claim} ${status}: ${blockerCode}`
		: `${claim} ${status}`;
}

function firstBlocker(
	input: DeliveryTruthCompositionInput,
): DeliveryTruthBlocker | null {
	if (!isIsoTimestamp(input.verifiedAt)) {
		return blocked("invalid_policy_timestamp", "unknown", null);
	}
	if (input.evidence.length === 0) {
		return {
			status: "unknown",
			code: "missing_evidence",
			freshness: "missing",
			evidence: null,
		};
	}

	for (const evidence of input.evidence) {
		const blocker = evidenceBlocker(evidence, input);
		if (blocker) return blocker;
	}
	const separateEvidenceBlocker = mergeReadySeparateEvidenceBlocker(input);
	if (separateEvidenceBlocker) return separateEvidenceBlocker;
	return claimHeadBlocker(input);
}

function evidenceBlocker(
	evidence: DeliveryTruthEvidence,
	input: DeliveryTruthCompositionInput,
): DeliveryTruthBlocker | null {
	const validation = validateEvidenceReceipt(evidence.receipt);
	if (!validation.valid) {
		return blocked("invalid_receipt", "unknown", evidence);
	}
	if (evidence.receipt.evidenceUse !== "claim_support") {
		return blocked("non_claim_support_evidence", "unknown", evidence);
	}
	if (!sourceCanSupportClaim(input.claim, evidence.source)) {
		return blocked("unsupported_claim_source", "unknown", evidence);
	}
	if (!sourceMatchesReceipt(evidence)) {
		return blocked("mismatched_source_receipt", "unknown", evidence);
	}
	if (!isActionableEvidenceRef(evidence)) {
		return blocked("invalid_evidence_ref", "unknown", evidence);
	}
	const repositoryBlocker = rootHygieneRepositoryBlocker(evidence, input);
	if (repositoryBlocker) return repositoryBlocker;
	const freshnessBlocker = receiptFreshnessBlocker(evidence);
	if (freshnessBlocker) return freshnessBlocker;
	const statusBlocker = receiptStatusBlocker(evidence);
	if (statusBlocker) return statusBlocker;
	const ttlBlocker = verifierFreshnessBlocker(evidence, input);
	if (ttlBlocker) return ttlBlocker;
	const claimScopeBlocker = claimScopeEvidenceBlocker(evidence, input);
	if (claimScopeBlocker) return claimScopeBlocker;
	return recomputedHeadBlocker(evidence);
}

function claimScopeEvidenceBlocker(
	evidence: DeliveryTruthEvidence,
	input: DeliveryTruthCompositionInput,
): DeliveryTruthBlocker | null {
	switch (input.claim) {
		case "remote_checks_current":
			return externalSurfaceBlocker(evidence, ["github_checks", "circleci"]);
		case "linear_state_aligned":
			return externalSurfaceBlocker(evidence, ["linear"]);
		case "review_threads_resolved":
			return reviewThreadsResolvedBlocker(evidence);
		case "root_surface_tidy":
		case "goal_ready_for_judge_pm":
		case "merge_ready":
			return null;
	}
}

function externalSurfaceBlocker(
	evidence: DeliveryTruthEvidence,
	requiredSurfaces: readonly ExternalStateSource[],
): DeliveryTruthBlocker | null {
	if (evidence.source !== "external_state") return null;
	const surfaces = evidence.externalStateSources;
	if (!surfaces || surfaces.length === 0) {
		return blocked("missing_claim_scope", "missing", evidence);
	}
	return requiredSurfaces.some((surface) => surfaces.includes(surface))
		? null
		: blocked("claim_scope_mismatch", "unknown", evidence);
}

function reviewThreadsResolvedBlocker(
	evidence: DeliveryTruthEvidence,
): DeliveryTruthBlocker | null {
	if (evidence.source !== "review_state") return null;
	const summary = evidence.reviewStateSummary;
	if (!summary) {
		return blocked("missing_claim_scope", "missing", evidence);
	}
	if (summary.unresolvedThreads.total > 0) {
		return blocked("review_threads_unresolved", "current", evidence);
	}
	if (summary.githubDecision === "changes_requested") {
		return blocked("review_threads_unresolved", "current", evidence);
	}
	return null;
}

function rootHygieneRepositoryBlocker(
	evidence: DeliveryTruthEvidence,
	input: DeliveryTruthCompositionInput,
): DeliveryTruthBlocker | null {
	if (evidence.source !== "root_hygiene") return null;
	if (
		input.repositoryIdentity === undefined ||
		input.repositoryIdentity === null
	) {
		return blocked("missing_repository_identity", "missing", evidence);
	}
	return sameRootHygieneRepositoryIdentity(
		evidence.rootHygieneReport?.repository,
		input.repositoryIdentity,
	)
		? null
		: blocked("repository_identity_mismatch", "stale", evidence);
}

function sourceCanSupportClaim(
	claim: DeliveryTruthCompositionInput["claim"],
	source: DeliveryTruthEvidence["source"],
): boolean {
	switch (claim) {
		case "root_surface_tidy":
			return source === "root_hygiene";
		case "goal_ready_for_judge_pm":
			return source === "pr_closeout";
		case "remote_checks_current":
			return source === "external_state";
		case "review_threads_resolved":
			return source === "review_state";
		case "linear_state_aligned":
			return source === "external_state";
		case "merge_ready":
			return MERGE_READY_REQUIRED_SOURCES.some(
				(requiredSource) => requiredSource === source,
			);
	}
}

function mergeReadySeparateEvidenceBlocker(
	input: DeliveryTruthCompositionInput,
): DeliveryTruthBlocker | null {
	if (input.claim !== "merge_ready") return null;
	const sources = new Set(input.evidence.map((evidence) => evidence.source));
	const hasRequiredSources = MERGE_READY_REQUIRED_SOURCES.every((source) =>
		sources.has(source),
	);
	return hasRequiredSources
		? null
		: blocked("missing_separate_evidence", "missing", input.evidence[0]);
}

interface SourceReceiptPolicy {
	allowedKinds: readonly EvidenceReceiptKind[];
	refPrefix: string;
}

const SOURCE_RECEIPT_POLICIES = {
	validation: { allowedKinds: ["validation"], refPrefix: "validation:" },
	runtime_card: { allowedKinds: ["runtime_card"], refPrefix: "runtime-card:" },
	review_state: {
		allowedKinds: ["review_artifact"],
		refPrefix: "review-state:",
	},
	external_state: {
		allowedKinds: ["external_state"],
		refPrefix: "external-state:",
	},
	root_hygiene: { allowedKinds: ["artifact"], refPrefix: "root-hygiene:" },
	pr_closeout: { allowedKinds: ["artifact"], refPrefix: "pr-closeout:" },
} satisfies Record<DeliveryTruthEvidence["source"], SourceReceiptPolicy>;

function sourceMatchesReceipt(evidence: DeliveryTruthEvidence): boolean {
	const policy = SOURCE_RECEIPT_POLICIES[evidence.source];
	return (policy.allowedKinds as readonly string[]).includes(
		evidence.receipt.kind,
	);
}

function isActionableEvidenceRef(evidence: DeliveryTruthEvidence): boolean {
	if (evidence.source === "root_hygiene") {
		return isTrustedRootHygieneEvidence(evidence);
	}
	const ref = evidence.receipt.ref;
	const policy = SOURCE_RECEIPT_POLICIES[evidence.source];
	return (
		ref.startsWith(policy.refPrefix) &&
		/^[A-Za-z][A-Za-z0-9-]*:[A-Za-z0-9._/@:-]+$/.test(ref)
	);
}

function receiptFreshnessBlocker(
	evidence: DeliveryTruthEvidence,
): DeliveryTruthBlocker | null {
	switch (evidence.receipt.freshness) {
		case "current":
			return null;
		case "stale":
			return blocked("stale_evidence", "stale", evidence);
		case "missing":
			return blocked("missing_evidence", "missing", evidence);
		case "unknown":
			return blocked("unknown_evidence", "unknown", evidence);
		case "not_applicable":
			return blocked("missing_evidence", "not_applicable", evidence);
	}
}

function receiptStatusBlocker(
	evidence: DeliveryTruthEvidence,
): DeliveryTruthBlocker | null {
	switch (evidence.receipt.status) {
		case "pass":
			return null;
		case "fail":
			return {
				status: "fail",
				code: "receipt_failed",
				freshness: "current",
				evidence,
			};
		case "blocked":
			return blocked("receipt_blocked", "current", evidence);
		case "unknown":
			return blocked("receipt_unknown", "unknown", evidence);
		case "not_applicable":
			return blocked("missing_evidence", "not_applicable", evidence);
	}
}

function verifierFreshnessBlocker(
	evidence: DeliveryTruthEvidence,
	input: DeliveryTruthCompositionInput,
): DeliveryTruthBlocker | null {
	const verifierTtl =
		evidence.verifierTtlSeconds ?? input.verifierTtlSeconds ?? null;
	if (evidence.fetchedAt && !isIsoTimestamp(evidence.fetchedAt)) {
		return blocked("invalid_policy_timestamp", "unknown", evidence);
	}
	if (
		verifierTtl !== null &&
		evidence.producerTtlSeconds !== undefined &&
		evidence.producerTtlSeconds > verifierTtl
	) {
		return blocked("producer_ttl_exceeds_verifier_policy", "stale", evidence);
	}
	if (
		evidence.fetchedAt &&
		evidence.receipt.verifiedAt &&
		Date.parse(evidence.fetchedAt) > Date.parse(evidence.receipt.verifiedAt)
	) {
		return blocked("fetched_at_after_verified_at", "stale", evidence);
	}
	return null;
}

function recomputedHeadBlocker(
	evidence: DeliveryTruthEvidence,
): DeliveryTruthBlocker | null {
	const recomputed = evidence.recomputedHeadSha?.trim();
	const receiptHead = evidence.receipt.headSha?.trim();
	if (recomputed && receiptHead && recomputed !== receiptHead) {
		return blocked("head_sha_recomputed_mismatch", "stale", evidence);
	}
	return null;
}

function claimHeadBlocker(
	input: DeliveryTruthCompositionInput,
): DeliveryTruthBlocker | null {
	const verdictHead = input.verdictHeadSha?.trim();
	if (!verdictHead) {
		return requiresVerdictHead(input.claim)
			? blocked("missing_verdict_head_sha", "missing", input.evidence[0])
			: null;
	}
	const receiptHeads = input.evidence.map((evidence) =>
		evidence.receipt.headSha?.trim(),
	);
	if (receiptHeads.some((head) => !head)) {
		return blocked("missing_head_sha", "missing", input.evidence[0]);
	}
	const mixed = receiptHeads.some((head) => head !== verdictHead);
	return mixed
		? blocked("mixed_head_evidence", "stale", input.evidence[0])
		: null;
}

function requiresVerdictHead(
	claim: DeliveryTruthCompositionInput["claim"],
): boolean {
	return (
		claim === "merge_ready" ||
		claim === "remote_checks_current" ||
		claim === "review_threads_resolved" ||
		claim === "linear_state_aligned"
	);
}

function blocked(
	code: DeliveryTruthBlockerCode,
	freshness: EvidenceReceiptFreshness,
	evidence: DeliveryTruthEvidence | null | undefined,
): DeliveryTruthBlocker {
	return { status: "blocked", code, freshness, evidence: evidence ?? null };
}

function blockerClass(
	status: PrCloseoutClaimStatus,
): DeliveryTruthVerdict["blockerClass"] {
	return status === "fail" ? "introduced" : "unknown";
}

function isIsoTimestamp(value: string): boolean {
	return (
		/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) &&
		!Number.isNaN(Date.parse(value))
	);
}

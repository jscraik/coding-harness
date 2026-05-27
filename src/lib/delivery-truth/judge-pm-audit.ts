import {
	isSafeEvidenceReceiptPointer,
	validateEvidenceReceipt,
} from "../evidence/evidence-receipt.js";
import type {
	EvidenceReceipt,
	EvidenceReceiptKind,
} from "../evidence/evidence-receipt.js";
import type {
	PrCloseoutBlockerClassification,
	PrCloseoutClaimStatus,
	PrCloseoutEvidenceFreshness,
} from "../pr-closeout/types.js";
import {
	DELIVERY_TRUTH_SCHEMA_VERSION,
	type DeliveryTruthBlockerCode,
	type DeliveryTruthClaim,
	type DeliveryTruthVerdict,
} from "./types.js";

export const JUDGE_PM_AUDIT_PACKET_SCHEMA_VERSION =
	"judge-pm-audit/v1" as const;

const JUDGE_PM_AUDIT_REQUIRED_VERDICTS = [
	"merge_ready",
	"root_surface_tidy",
	"remote_checks_current",
	"review_threads_resolved",
	"linear_state_aligned",
] satisfies readonly DeliveryTruthClaim[];

const JUDGE_PM_AUDIT_REQUIRED_VERDICT_SOURCES = {
	merge_ready: ["external_state", "review_state", "pr_closeout"],
	root_surface_tidy: ["root_hygiene"],
	remote_checks_current: ["external_state"],
	review_threads_resolved: ["review_state"],
	linear_state_aligned: ["external_state"],
} satisfies Record<
	(typeof JUDGE_PM_AUDIT_REQUIRED_VERDICTS)[number],
	readonly DeliveryTruthVerdict["source"][]
>;

const AUDIT_SURFACE_REF_PREFIXES = {
	runtime_card: "runtime-card:",
	review_artifact: "review-state:",
	external_state: "external-state:",
	validation: "validation:",
	artifact: "root-hygiene:",
	run_record: "run-record:",
} satisfies Record<EvidenceReceiptKind, string>;

const REQUIRED_AUDIT_SURFACE_NAMES = {
	runtimeCard: "runtime-card",
	reviewState: "review-state",
	externalState: "external-state",
	linearState: "linear-state",
	validation: "validation",
	rootHygiene: "root-hygiene",
} as const;

const MULTI_RECEIPT_AUDIT_SURFACE_NAMES = new Set<string>([
	REQUIRED_AUDIT_SURFACE_NAMES.runtimeCard,
	REQUIRED_AUDIT_SURFACE_NAMES.validation,
]);

/** Reviewer artifact plus receipt proof required by the Judge/PM readiness gate. */
export interface JudgePmAuditReviewerArtifact {
	role: string;
	path: string;
	expectedProducer: string;
	receipt: EvidenceReceipt;
}

/** Explicit owner-backed authority decision for a not-applicable closeout surface. */
export interface JudgePmAuditNotApplicableDecision {
	owner: string;
	rationale: string;
	decidedAt: string;
	decisionSourceRef: string;
}

/** Issue, PR, and goal authority mapping that proves the closeout decision boundary. */
export interface JudgePmAuditIssueAuthorityMap {
	lifecycleIssueId: string;
	parentIssueId: string | null;
	parentNotApplicable: JudgePmAuditNotApplicableDecision | null;
	prNumber: number | null;
	prNotApplicable: JudgePmAuditNotApplicableDecision | null;
	externalGoalId: string | null;
	externalGoalNotApplicable: JudgePmAuditNotApplicableDecision | null;
	authorityOwner: string;
	decisionSourceRef: string;
	decidedAt: string;
	rationale: string;
}

/** Required receipt-backed audit surface outside the reviewer-artifact lane. */
export interface JudgePmAuditEvidenceSurface {
	name: string;
	expectedKind: EvidenceReceiptKind;
	receipt: EvidenceReceipt;
}

/** Unresolved risk classification that must be owner-routed before Judge/PM closeout. */
export interface JudgePmAuditRiskClassification {
	risk: string;
	blockerClass: PrCloseoutBlockerClassification;
	owner: string;
	nextAction: string;
	evidenceRef: string;
}

/** Inputs used to build the Judge/PM readiness packet and delivery-truth verdict. */
export interface JudgePmAuditVerdictInput {
	packetRef: string;
	verifiedAt: string;
	headSha: string | null;
	runtimeCardRefs: readonly JudgePmAuditEvidenceSurface[];
	reviewStateRef: JudgePmAuditEvidenceSurface;
	externalStateRef: JudgePmAuditEvidenceSurface;
	linearStateRef: JudgePmAuditEvidenceSurface | null;
	linearStateNotApplicable: JudgePmAuditNotApplicableDecision | null;
	validationReceiptRefs: readonly JudgePmAuditEvidenceSurface[];
	rootHygieneRef: JudgePmAuditEvidenceSurface;
	requiredReviewerRoles: readonly string[];
	reviewerArtifacts: readonly JudgePmAuditReviewerArtifact[];
	issueAuthorityMap: JudgePmAuditIssueAuthorityMap;
	unresolvedRiskClassifications: readonly JudgePmAuditRiskClassification[];
	supportingVerdicts: readonly DeliveryTruthVerdict[];
}

/** Machine-readable Judge/PM audit packet summarized by the closeout verdict. */
export interface JudgePmAuditPacket {
	schemaVersion: typeof JUDGE_PM_AUDIT_PACKET_SCHEMA_VERSION;
	generatedAt: string;
	headSha: string | null;
	status: PrCloseoutClaimStatus;
	freshness: PrCloseoutEvidenceFreshness;
	blockerCode: DeliveryTruthBlockerCode | null;
	blockerClass: PrCloseoutBlockerClassification | null;
	blockerRefs: string[];
	reviewerRoles: {
		required: string[];
		present: string[];
		missing: string[];
	};
	issueAuthority: {
		status: PrCloseoutClaimStatus;
		evidenceRef: string | null;
	};
	auditSurfaces: Array<{
		name: string;
		status: PrCloseoutClaimStatus;
		freshness: PrCloseoutEvidenceFreshness;
		evidenceRef: string | null;
	}>;
	supportingVerdicts: Array<{
		claim: DeliveryTruthClaim;
		status: PrCloseoutClaimStatus;
		freshness: PrCloseoutEvidenceFreshness;
		evidenceRef: string | null;
	}>;
}

interface JudgePmAuditBlocker {
	status: PrCloseoutClaimStatus;
	freshness: PrCloseoutEvidenceFreshness;
	code: DeliveryTruthBlockerCode;
	blockerClass: PrCloseoutBlockerClassification;
	ref: string | null;
}

interface RequiredJudgePmAuditEvidenceSurface
	extends JudgePmAuditEvidenceSurface {
	canonicalName: string;
}

/** Build the closeout-blocking Judge/PM readiness verdict from explicit audit proof. */
export function buildJudgePmAuditVerdict(
	input: JudgePmAuditVerdictInput,
): DeliveryTruthVerdict {
	const packet = buildJudgePmAuditPacket(input);
	const evidenceRef = safeRef(input.packetRef);
	return {
		schemaVersion: DELIVERY_TRUTH_SCHEMA_VERSION,
		claim: "goal_ready_for_judge_pm",
		status: packet.status,
		statusLabel: statusLabel(packet.status, packet.blockerCode),
		source: "pr_closeout",
		evidenceRef,
		evidenceRefs: evidenceRef ? [evidenceRef] : [],
		blockerRefs: packet.blockerRefs,
		headSha: input.headSha,
		verdictHeadSha: input.headSha,
		freshness: packet.freshness,
		blockerClass: packet.blockerClass,
		blockerCode: packet.blockerCode,
		verifiedAt: input.verifiedAt,
		evidenceUse: "claim_support",
	};
}

/** Build the auditable packet that explains the Judge/PM readiness verdict. */
export function buildJudgePmAuditPacket(
	input: JudgePmAuditVerdictInput,
): JudgePmAuditPacket {
	const blocker = firstAuditBlocker(input);
	const requiredRoles = uniqueNonEmpty(input.requiredReviewerRoles);
	const presentRoles = uniqueNonEmpty(
		input.reviewerArtifacts.map((item) => item.role),
	);
	const missingRoles = requiredRoles.filter(
		(role) => !presentRoles.includes(role),
	);
	return {
		schemaVersion: JUDGE_PM_AUDIT_PACKET_SCHEMA_VERSION,
		generatedAt: input.verifiedAt,
		headSha: input.headSha,
		status: blocker?.status ?? "pass",
		freshness: blocker?.freshness ?? "current",
		blockerCode: blocker?.code ?? null,
		blockerClass: blocker?.blockerClass ?? null,
		blockerRefs: blocker?.ref ? [blocker.ref] : [],
		reviewerRoles: {
			required: requiredRoles,
			present: presentRoles,
			missing: missingRoles,
		},
		issueAuthority: {
			status: issueAuthorityBlocker(input.issueAuthorityMap)
				? "blocked"
				: "pass",
			evidenceRef: safeRef(input.issueAuthorityMap.decisionSourceRef),
		},
		auditSurfaces: auditSurfaceSummaries(input),
		supportingVerdicts: input.supportingVerdicts.map((verdict) => ({
			claim: verdict.claim,
			status: verdict.status,
			freshness: verdict.freshness,
			evidenceRef: verdict.evidenceRef,
		})),
	};
}

function firstAuditBlocker(
	input: JudgePmAuditVerdictInput,
): JudgePmAuditBlocker | null {
	if (!isIsoTimestamp(input.verifiedAt)) {
		return blocker("invalid_policy_timestamp", "unknown", null);
	}
	if (!safeRef(input.packetRef)) {
		return blocker("invalid_evidence_ref", "unknown", null);
	}
	const roleBlocker = reviewerRoleBlocker(input);
	if (roleBlocker) return roleBlocker;
	const artifactBlocker = reviewerArtifactBlocker(input);
	if (artifactBlocker) return artifactBlocker;
	const authorityBlocker = issueAuthorityBlocker(input.issueAuthorityMap);
	if (authorityBlocker) return authorityBlocker;
	const auditSurfaceBlocker = requiredAuditSurfaceBlocker(input);
	if (auditSurfaceBlocker) return auditSurfaceBlocker;
	const riskBlocker = unresolvedRiskBlocker(
		input.unresolvedRiskClassifications,
	);
	if (riskBlocker) return riskBlocker;
	return supportingVerdictBlocker(input);
}

function reviewerRoleBlocker(
	input: JudgePmAuditVerdictInput,
): JudgePmAuditBlocker | null {
	const requiredRoles = uniqueNonEmpty(input.requiredReviewerRoles);
	if (requiredRoles.length === 0) {
		return blocker("missing_reviewer_artifact", "missing", input.packetRef);
	}
	const presentRoles = uniqueNonEmpty(
		input.reviewerArtifacts.map((item) => item.role),
	);
	const missingRole = requiredRoles.find(
		(role) => !presentRoles.includes(role),
	);
	return missingRole
		? blocker(
				"missing_reviewer_artifact",
				"missing",
				`review-state:${missingRole}`,
			)
		: null;
}

function reviewerArtifactBlocker(
	input: JudgePmAuditVerdictInput,
): JudgePmAuditBlocker | null {
	for (const artifact of input.reviewerArtifacts) {
		const validation = validateEvidenceReceipt(artifact.receipt);
		if (!validation.valid) {
			return blocker(
				"reviewer_artifact_schema_invalid",
				"unknown",
				artifact.path,
			);
		}
		if (!safeRef(artifact.path) || !safeRef(artifact.expectedProducer)) {
			return blocker("invalid_reviewer_artifact", "unknown", artifact.path);
		}
		if (artifact.receipt.kind !== "review_artifact") {
			return blocker(
				"reviewer_artifact_schema_invalid",
				"unknown",
				artifact.receipt.ref,
			);
		}
		if (artifact.receipt.ref !== `review-state:${artifact.path}`) {
			return blocker(
				"invalid_reviewer_artifact",
				"unknown",
				artifact.receipt.ref,
			);
		}
		if (artifact.receipt.producer !== artifact.expectedProducer) {
			return blocker(
				"reviewer_artifact_producer_mismatch",
				"unknown",
				artifact.receipt.ref,
			);
		}
		if (input.headSha && artifact.receipt.headSha !== input.headSha) {
			return blocker("reviewer_artifact_stale", "stale", artifact.receipt.ref);
		}
		if (artifact.receipt.status !== "pass") {
			return blocker(
				"invalid_reviewer_artifact",
				"current",
				artifact.receipt.ref,
			);
		}
		if (artifact.receipt.freshness !== "current") {
			return blocker(
				"reviewer_artifact_stale",
				artifact.receipt.freshness,
				artifact.receipt.ref,
			);
		}
		if (artifact.receipt.evidenceUse !== "claim_support") {
			return blocker(
				"reviewer_artifact_not_claim_supporting",
				"unknown",
				artifact.receipt.ref,
			);
		}
		if (
			typeof artifact.receipt.sizeBytes !== "number" ||
			artifact.receipt.sizeBytes <= 0
		) {
			return blocker(
				"reviewer_artifact_empty",
				"missing",
				artifact.receipt.ref,
			);
		}
	}
	return null;
}

function requiredAuditSurfaceBlocker(
	input: JudgePmAuditVerdictInput,
): JudgePmAuditBlocker | null {
	if (input.runtimeCardRefs.length === 0) {
		return blocker("missing_audit_surface", "missing", "runtime-card:missing");
	}
	if (input.validationReceiptRefs.length === 0) {
		return blocker("missing_audit_surface", "missing", "validation:missing");
	}
	if (
		input.linearStateRef === null &&
		!validNotApplicableDecision(input.linearStateNotApplicable)
	) {
		return blocker(
			"missing_audit_surface",
			"missing",
			"external-state:linear-state",
			"needs_jamie_decision",
		);
	}
	if (
		input.linearStateRef !== null &&
		input.linearStateNotApplicable !== null
	) {
		return blocker(
			"invalid_audit_surface",
			"unknown",
			input.linearStateRef.receipt.ref,
			"needs_jamie_decision",
		);
	}
	for (const surface of requiredAuditEvidenceSurfaces(input)) {
		const surfaceBlocker = auditSurfaceBlocker(surface, input.headSha);
		if (surfaceBlocker) return surfaceBlocker;
	}
	return null;
}

function requiredAuditEvidenceSurfaces(
	input: JudgePmAuditVerdictInput,
): RequiredJudgePmAuditEvidenceSurface[] {
	return [
		...input.runtimeCardRefs.map((surface) =>
			withCanonicalSurfaceName(
				surface,
				REQUIRED_AUDIT_SURFACE_NAMES.runtimeCard,
			),
		),
		withCanonicalSurfaceName(
			input.reviewStateRef,
			REQUIRED_AUDIT_SURFACE_NAMES.reviewState,
		),
		withCanonicalSurfaceName(
			input.externalStateRef,
			REQUIRED_AUDIT_SURFACE_NAMES.externalState,
		),
		...(input.linearStateRef
			? [
					withCanonicalSurfaceName(
						input.linearStateRef,
						REQUIRED_AUDIT_SURFACE_NAMES.linearState,
					),
				]
			: []),
		...input.validationReceiptRefs.map((surface) =>
			withCanonicalSurfaceName(
				surface,
				REQUIRED_AUDIT_SURFACE_NAMES.validation,
			),
		),
		withCanonicalSurfaceName(
			input.rootHygieneRef,
			REQUIRED_AUDIT_SURFACE_NAMES.rootHygiene,
		),
	];
}

function withCanonicalSurfaceName(
	surface: JudgePmAuditEvidenceSurface,
	canonicalName: string,
): RequiredJudgePmAuditEvidenceSurface {
	return { ...surface, canonicalName };
}

function auditSurfaceBlocker(
	surface: RequiredJudgePmAuditEvidenceSurface,
	headSha: string | null,
): JudgePmAuditBlocker | null {
	const validation = validateEvidenceReceipt(surface.receipt);
	if (
		!validation.valid ||
		!safeRef(surface.name) ||
		surface.name !== surface.canonicalName
	) {
		return blocker("invalid_audit_surface", "unknown", surface.receipt.ref);
	}
	if (surface.receipt.kind !== surface.expectedKind) {
		return blocker("invalid_audit_surface", "unknown", surface.receipt.ref);
	}
	if (!auditSurfaceRefMatches(surface)) {
		return blocker("invalid_audit_surface", "unknown", surface.receipt.ref);
	}
	if (headSha && surface.receipt.headSha !== headSha) {
		return blocker("stale_audit_surface", "stale", surface.receipt.ref);
	}
	if (surface.receipt.status !== "pass") {
		return blocker("invalid_audit_surface", "current", surface.receipt.ref);
	}
	if (surface.receipt.freshness !== "current") {
		return blocker(
			"stale_audit_surface",
			surface.receipt.freshness,
			surface.receipt.ref,
		);
	}
	if (surface.receipt.evidenceUse !== "claim_support") {
		return blocker("invalid_audit_surface", "unknown", surface.receipt.ref);
	}
	if (
		typeof surface.receipt.sizeBytes !== "number" ||
		surface.receipt.sizeBytes <= 0
	) {
		return blocker("missing_audit_surface", "missing", surface.receipt.ref);
	}
	return null;
}

function auditSurfaceRefMatches(surface: JudgePmAuditEvidenceSurface): boolean {
	const refPrefix = AUDIT_SURFACE_REF_PREFIXES[surface.expectedKind];
	const surfaceName =
		"canonicalName" in surface
			? (surface as RequiredJudgePmAuditEvidenceSurface).canonicalName
			: surface.name;
	const validRef = /^[A-Za-z][A-Za-z0-9-]*:[A-Za-z0-9._/@:-]+$/.test(
		surface.receipt.ref,
	);
	if (!validRef) return false;
	if (MULTI_RECEIPT_AUDIT_SURFACE_NAMES.has(surfaceName)) {
		return surface.receipt.ref.startsWith(refPrefix);
	}
	return surface.receipt.ref === refPrefix + surfaceName;
}

function issueAuthorityBlocker(
	map: JudgePmAuditIssueAuthorityMap,
): JudgePmAuditBlocker | null {
	if (
		!safeRef(map.lifecycleIssueId) ||
		!safeRef(map.authorityOwner) ||
		!safeRef(map.decisionSourceRef) ||
		!isIsoTimestamp(map.decidedAt) ||
		map.rationale.trim() === ""
	) {
		return blocker(
			"missing_issue_authority",
			"missing",
			map.decisionSourceRef,
			"needs_jamie_decision",
		);
	}
	if (!map.parentNotApplicable && !safeRef(map.parentIssueId)) {
		return blocker(
			"missing_issue_authority",
			"missing",
			map.decisionSourceRef,
			"needs_jamie_decision",
		);
	}
	if (map.parentNotApplicable && map.parentIssueId !== null) {
		return blocker(
			"invalid_issue_authority",
			"unknown",
			map.decisionSourceRef,
			"needs_jamie_decision",
		);
	}
	if (
		map.parentNotApplicable &&
		!validNotApplicableDecision(map.parentNotApplicable)
	) {
		return blocker(
			"missing_issue_authority",
			"missing",
			map.decisionSourceRef,
			"needs_jamie_decision",
		);
	}
	if (
		!map.prNotApplicable &&
		(typeof map.prNumber !== "number" || map.prNumber <= 0)
	) {
		return blocker(
			"missing_issue_authority",
			"missing",
			map.decisionSourceRef,
			"needs_jamie_decision",
		);
	}
	if (map.prNotApplicable && map.prNumber !== null) {
		return blocker(
			"invalid_issue_authority",
			"unknown",
			map.decisionSourceRef,
			"needs_jamie_decision",
		);
	}
	if (map.prNotApplicable && !validNotApplicableDecision(map.prNotApplicable)) {
		return blocker(
			"missing_issue_authority",
			"missing",
			map.decisionSourceRef,
			"needs_jamie_decision",
		);
	}
	if (!map.externalGoalNotApplicable && !safeRef(map.externalGoalId)) {
		return blocker(
			"missing_issue_authority",
			"missing",
			map.decisionSourceRef,
			"needs_jamie_decision",
		);
	}
	if (map.externalGoalNotApplicable && map.externalGoalId !== null) {
		return blocker(
			"invalid_issue_authority",
			"unknown",
			map.decisionSourceRef,
			"needs_jamie_decision",
		);
	}
	if (
		map.externalGoalNotApplicable &&
		!validNotApplicableDecision(map.externalGoalNotApplicable)
	) {
		return blocker(
			"missing_issue_authority",
			"missing",
			map.decisionSourceRef,
			"needs_jamie_decision",
		);
	}
	return null;
}

function auditSurfaceSummaries(
	input: JudgePmAuditVerdictInput,
): JudgePmAuditPacket["auditSurfaces"] {
	return requiredAuditEvidenceSurfaces(input).map((surface) => {
		const surfaceBlocker = auditSurfaceBlocker(surface, input.headSha);

		return {
			name: surface.canonicalName,
			status: surfaceBlocker?.status ?? "pass",
			freshness: surfaceBlocker?.freshness ?? "current",
			evidenceRef: safeRef(surface.receipt.ref),
		};
	});
}

function unresolvedRiskBlocker(
	risks: readonly JudgePmAuditRiskClassification[],
): JudgePmAuditBlocker | null {
	const risk = risks.find(
		(item) =>
			!safeRef(item.risk) ||
			!safeRef(item.owner) ||
			!safeRef(item.nextAction) ||
			item.blockerClass === "unknown" ||
			!safeRef(item.evidenceRef),
	);
	if (risk) {
		return blocker(
			"unclassified_risk",
			"unknown",
			risk.evidenceRef,
			risk.blockerClass,
		);
	}
	return null;
}

function verdictIsCurrentForAudit(
	verdict: DeliveryTruthVerdict,
	headSha: string | null,
): boolean {
	if (
		verdict.status !== "pass" ||
		verdict.freshness !== "current" ||
		verdict.evidenceUse !== "claim_support"
	) {
		return false;
	}
	if (headSha && verdict.headSha !== headSha) {
		return false;
	}
	if (headSha && verdict.verdictHeadSha !== headSha) {
		return false;
	}
	if (!safeRef(verdict.evidenceRef)) {
		return false;
	}
	return true;
}

function validNotApplicableDecision(
	decision: JudgePmAuditNotApplicableDecision | null,
): decision is JudgePmAuditNotApplicableDecision {
	return (
		decision !== null &&
		safeRef(decision.owner) !== null &&
		decision.rationale.trim() !== "" &&
		isIsoTimestamp(decision.decidedAt) &&
		safeRef(decision.decisionSourceRef) !== null
	);
}

function supportingVerdictBlocker(
	input: JudgePmAuditVerdictInput,
): JudgePmAuditBlocker | null {
	for (const claim of JUDGE_PM_AUDIT_REQUIRED_VERDICTS) {
		const requiredSources = JUDGE_PM_AUDIT_REQUIRED_VERDICT_SOURCES[
			claim
		] as readonly DeliveryTruthVerdict["source"][];
		const candidates = input.supportingVerdicts.filter(
			(item) => item.claim === claim && requiredSources.includes(item.source),
		);
		if (candidates.length === 0) {
			return blocker(
				"missing_required_verdict",
				"missing",
				`delivery-truth:${claim}`,
			);
		}
		const currentVerdict = candidates.find((verdict) =>
			verdictIsCurrentForAudit(verdict, input.headSha),
		);
		if (!currentVerdict) {
			const [blockerVerdict] = candidates as [
				DeliveryTruthVerdict,
				...DeliveryTruthVerdict[],
			];
			const blockerFreshness =
				input.headSha &&
				(blockerVerdict.headSha !== input.headSha ||
					blockerVerdict.verdictHeadSha !== input.headSha)
					? "stale"
					: blockerVerdict.freshness;
			return blocker(
				"audit_verdict_not_current",
				blockerFreshness,
				blockerVerdict.evidenceRef,
			);
		}
	}
	return null;
}

function uniqueNonEmpty(values: readonly string[]): string[] {
	return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function safeRef(value: string | null | undefined): string | null {
	return value && isSafeEvidenceReceiptPointer(value) && value.trim() !== ""
		? value
		: null;
}

function blocker(
	code: DeliveryTruthBlockerCode,
	freshness: PrCloseoutEvidenceFreshness,
	ref: string | null | undefined,
	blockerClass: PrCloseoutBlockerClassification = "unknown",
): JudgePmAuditBlocker {
	return {
		status: "blocked",
		freshness,
		code,
		blockerClass,
		ref: safeRef(ref),
	};
}

function statusLabel(
	status: PrCloseoutClaimStatus,
	blockerCode: DeliveryTruthBlockerCode | null,
): string {
	return blockerCode
		? `goal_ready_for_judge_pm ${status}: ${blockerCode}`
		: `goal_ready_for_judge_pm ${status}`;
}

function isIsoTimestamp(value: string): boolean {
	return (
		/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) &&
		!Number.isNaN(Date.parse(value))
	);
}

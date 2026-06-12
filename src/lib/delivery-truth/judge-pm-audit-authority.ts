import { isSafeEvidenceReceiptPointer } from "../evidence/evidence-receipt.js";
import type {
	PrCloseoutBlockerClassification,
	PrCloseoutClaimStatus,
	PrCloseoutEvidenceFreshness,
} from "../pr-closeout/types.js";
import type { DeliveryTruthBlockerCode } from "./types.js";

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

/** Closeout authority claimed by the packet consumer before Judge/PM handoff. */
export interface JudgePmAuditClaimedAuthority {
	closeoutIssueId: string;
	parentIssueId: string | null;
	prNumber: number | null;
	externalGoalId: string | null;
}

/** Delivery-truth blocker emitted when claimed closeout authority is unsupported. */
export interface JudgePmAuditAuthorityBlocker {
	status: PrCloseoutClaimStatus;
	freshness: PrCloseoutEvidenceFreshness;
	code: DeliveryTruthBlockerCode;
	blockerClass: PrCloseoutBlockerClassification;
	ref: string | null;
}

/** Validate claimed issue, PR, and goal refs against the authorized lifecycle map. */
export function issueAuthorityBlocker(
	map: JudgePmAuditIssueAuthorityMap,
	claimed: JudgePmAuditClaimedAuthority,
): JudgePmAuditAuthorityBlocker | null {
	const shapeBlocker = issueAuthorityShapeBlocker(map);
	if (shapeBlocker) return shapeBlocker;
	if (
		!safeRef(claimed.closeoutIssueId) ||
		(claimed.parentIssueId !== null && !safeRef(claimed.parentIssueId)) ||
		(claimed.prNumber !== null &&
			(typeof claimed.prNumber !== "number" ||
				!Number.isInteger(claimed.prNumber) ||
				claimed.prNumber <= 0)) ||
		(claimed.externalGoalId !== null && !safeRef(claimed.externalGoalId))
	) {
		return blocker(
			"invalid_issue_authority",
			"unknown",
			map.decisionSourceRef,
			"needs_jamie_decision",
		);
	}
	if (map.parentNotApplicable && claimed.parentIssueId !== null) {
		return blocker(
			"invalid_issue_authority",
			"unknown",
			map.decisionSourceRef,
			"needs_jamie_decision",
		);
	}
	if (map.prNotApplicable && claimed.prNumber !== null) {
		return blocker(
			"invalid_issue_authority",
			"unknown",
			map.decisionSourceRef,
			"needs_jamie_decision",
		);
	}
	if (map.externalGoalNotApplicable && claimed.externalGoalId !== null) {
		return blocker(
			"invalid_issue_authority",
			"unknown",
			map.decisionSourceRef,
			"needs_jamie_decision",
		);
	}
	if (claimed.closeoutIssueId !== map.lifecycleIssueId) {
		return blocker(
			"invalid_issue_authority",
			"unknown",
			map.decisionSourceRef,
			"needs_jamie_decision",
		);
	}
	if (!map.parentNotApplicable && claimed.parentIssueId !== map.parentIssueId) {
		return blocker(
			"invalid_issue_authority",
			"unknown",
			map.decisionSourceRef,
			"needs_jamie_decision",
		);
	}
	if (!map.prNotApplicable && claimed.prNumber !== map.prNumber) {
		return blocker(
			"invalid_issue_authority",
			"unknown",
			map.decisionSourceRef,
			"needs_jamie_decision",
		);
	}
	if (
		!map.externalGoalNotApplicable &&
		claimed.externalGoalId !== map.externalGoalId
	) {
		return blocker(
			"invalid_issue_authority",
			"unknown",
			map.decisionSourceRef,
			"needs_jamie_decision",
		);
	}
	return null;
}

function issueAuthorityShapeBlocker(
	map: JudgePmAuditIssueAuthorityMap,
): JudgePmAuditAuthorityBlocker | null {
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
		(typeof map.prNumber !== "number" ||
			!Number.isInteger(map.prNumber) ||
			map.prNumber <= 0)
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
): JudgePmAuditAuthorityBlocker {
	return {
		status: "blocked",
		freshness,
		code,
		blockerClass,
		ref: safeRef(ref),
	};
}

function isIsoTimestamp(value: string): boolean {
	return (
		/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) &&
		!Number.isNaN(Date.parse(value))
	);
}

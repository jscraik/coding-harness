import type {
	DecisionRequestBoundaryBlockerClass,
	DecisionRequestBoundaryType,
	DecisionRequestBuildFailure,
	DecisionRequestFreshness,
	DecisionRequestHiltBoundary,
	DecisionRequestRiskTier,
	DecisionRequestStaleState,
} from "./types.js";

const BOUNDARY_TYPES = new Set<DecisionRequestBoundaryType>([
	"destructive_action",
	"external_mutation",
	"credential_or_secret_access",
	"security_sensitive_action",
	"public_contract_change",
	"release_action",
	"permission_escalation",
	"stale_claim_support",
	"merge_readiness",
	"tracker_authority",
	"goal_completion",
]);

const CLAIM_SENSITIVE_BOUNDARIES = new Set<DecisionRequestBoundaryType>([
	"stale_claim_support",
	"merge_readiness",
	"tracker_authority",
	"goal_completion",
]);

/** Validate and normalize the HILT boundary for a decision-request packet. */
export function buildHiltBoundary(input: {
	boundaryType: string | undefined;
	intent: string;
	evidenceRefs: string[];
	freshness: DecisionRequestFreshness;
	staleState: DecisionRequestStaleState[];
}):
	| { ok: true; hiltBoundary: DecisionRequestHiltBoundary }
	| DecisionRequestBuildFailure {
	const boundaryType = input.boundaryType ?? "";
	if (!isDecisionRequestBoundaryType(boundaryType)) {
		return failure(
			"decision-request.invalid_boundary",
			"--boundary must name a real HILT boundary; routine uncertainty is not a decision request.",
		);
	}

	const claimSensitiveError = validateClaimSensitiveBoundary({
		boundaryType,
		evidenceRefs: input.evidenceRefs,
		freshness: input.freshness,
		staleState: input.staleState,
	});
	if (claimSensitiveError) return claimSensitiveError;

	return {
		ok: true,
		hiltBoundary: {
			boundaryType,
			riskTier: riskTierFor(boundaryType),
			reason: input.intent,
			blockerClass: blockerClassFor(boundaryType),
		},
	};
}

/** Return true when a boundary is part of the closed HILT taxonomy. */
export function isDecisionRequestBoundaryType(
	value: string,
): value is DecisionRequestBoundaryType {
	return BOUNDARY_TYPES.has(value as DecisionRequestBoundaryType);
}

function validateClaimSensitiveBoundary(input: {
	boundaryType: DecisionRequestBoundaryType;
	evidenceRefs: string[];
	freshness: DecisionRequestFreshness;
	staleState: DecisionRequestStaleState[];
}): DecisionRequestBuildFailure | undefined {
	if (!CLAIM_SENSITIVE_BOUNDARIES.has(input.boundaryType)) return undefined;
	const hasNonCurrentState = input.staleState.some((state) =>
		["stale", "missing", "unknown"].includes(state.freshness),
	);
	const hasEvidenceRefs = input.evidenceRefs.some(
		(ref) => ref.trim().length > 0,
	);
	if (!hasEvidenceRefs || !hasNonCurrentState) {
		return failure(
			"decision-request.boundary_evidence_required",
			"--boundary for claim-sensitive decisions requires evidence refs and non-current staleState.",
		);
	}
	if (
		input.boundaryType === "stale_claim_support" &&
		input.freshness === "current"
	) {
		return failure(
			"decision-request.boundary_evidence_required",
			"--boundary stale_claim_support cannot use freshness=current.",
		);
	}
	return undefined;
}

function riskTierFor(
	boundaryType: DecisionRequestBoundaryType,
): DecisionRequestRiskTier {
	switch (boundaryType) {
		case "goal_completion":
		case "release_action":
		case "security_sensitive_action":
		case "credential_or_secret_access":
			return "critical";
		case "destructive_action":
		case "external_mutation":
		case "public_contract_change":
		case "permission_escalation":
		case "stale_claim_support":
		case "merge_readiness":
		case "tracker_authority":
			return "high";
	}
}

function blockerClassFor(
	boundaryType: DecisionRequestBoundaryType,
): DecisionRequestBoundaryBlockerClass {
	switch (boundaryType) {
		case "stale_claim_support":
		case "merge_readiness":
			return "requires_external_state_refresh";
		case "tracker_authority":
			return "requires_tracker_authority";
		case "goal_completion":
			return "requires_goal_completion_audit";
		case "security_sensitive_action":
		case "credential_or_secret_access":
			return "requires_security_review";
		case "release_action":
			return "requires_release_authority";
		case "permission_escalation":
			return "requires_permission_escalation";
		case "public_contract_change":
			return "requires_contract_owner";
		default:
			return "requires_human_authority";
	}
}

function failure(
	code: DecisionRequestBuildFailure["code"],
	message: string,
): DecisionRequestBuildFailure {
	return { ok: false, code, message };
}

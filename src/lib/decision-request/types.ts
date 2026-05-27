/** Authority expected to answer or route a decision request. */
export type DecisionRequestAuthority =
	| "human"
	| "operator"
	| "maintainer"
	| "external_service";

/** Lifecycle status for a decision request packet. */
export type DecisionRequestStatus =
	| "open"
	| "answered"
	| "expired"
	| "cancelled";

/** Freshness status for decision-request supporting evidence. */
export type DecisionRequestFreshness =
	| "current"
	| "stale"
	| "missing"
	| "unknown"
	| "not_applicable";

/** Bounded use of decision-request packets. */
export type DecisionRequestEvidenceUse = "governance_request_only";

/** Claim-support boundary for decision-request packets. */
export type DecisionRequestClaimSupport = "not_closeout_proof";

/** Runtime emission status for decision-request/v1. */
export type DecisionRequestRuntimeStatus = "emitted";

/** Candidate option for the requested decision. */
export interface DecisionRequestOption {
	id: string;
	label: string;
	tradeoffs: string[];
}

/** Machine-readable escalation metadata for routing the decision. */
export interface DecisionRequestEscalation {
	required: boolean;
	targetRole: DecisionRequestAuthority;
	channel: string;
	reason: string;
	requestedAt: string;
}

/** Stale, missing, or otherwise non-current state classification. */
export interface DecisionRequestStaleState {
	surface: string;
	freshness: DecisionRequestFreshness;
	reason: string;
}

/** Versioned read-only governance packet for human or operator decisions. */
export interface DecisionRequestPacket {
	schemaVersion: "decision-request/v1";
	requestId: string;
	generatedAt: string;
	producer: string;
	status: DecisionRequestStatus;
	intent: string;
	authority: DecisionRequestAuthority;
	defaultOptionId: string;
	options: DecisionRequestOption[];
	evidenceRefs: string[];
	freshness: DecisionRequestFreshness;
	expiresAt: string | null;
	runtimeStatus: DecisionRequestRuntimeStatus;
	evidenceUse: DecisionRequestEvidenceUse;
	claimSupport: DecisionRequestClaimSupport;
	escalation: DecisionRequestEscalation;
	staleState: DecisionRequestStaleState[];
}

/** Input accepted by the pure decision-request packet builder. */
export interface DecisionRequestBuildInput {
	requestId?: string;
	generatedAt?: string;
	producer?: string;
	status?: DecisionRequestStatus | string;
	intent?: string;
	authority?: DecisionRequestAuthority | string;
	defaultOptionId?: string;
	options?: DecisionRequestOption[];
	evidenceRefs?: string[];
	freshness?: DecisionRequestFreshness | string;
	expiresAt?: string | null;
	escalation?: {
		required?: boolean;
		targetRole?: DecisionRequestAuthority | string;
		channel?: string;
		reason?: string;
		requestedAt?: string;
	};
}

/** Successful decision-request build result. */
export interface DecisionRequestBuildSuccess {
	ok: true;
	packet: DecisionRequestPacket;
}

/** Failed decision-request build result with deterministic usage code. */
export interface DecisionRequestBuildFailure {
	ok: false;
	code: DecisionRequestUsageErrorCode;
	message: string;
}

/** Decision-request build result. */
export type DecisionRequestBuildResult =
	| DecisionRequestBuildSuccess
	| DecisionRequestBuildFailure;

/** Usage error codes emitted by the decision-request CLI. */
export type DecisionRequestUsageErrorCode =
	| "decision-request.flag_value_required"
	| "decision-request.scalar_flag_duplicate"
	| "decision-request.intent_required"
	| "decision-request.default_option_required"
	| "decision-request.option_required"
	| "decision-request.option_malformed"
	| "decision-request.option_duplicate"
	| "decision-request.tradeoff_unknown_option"
	| "decision-request.default_option_unknown"
	| "decision-request.invalid_authority"
	| "decision-request.invalid_status"
	| "decision-request.invalid_freshness"
	| "decision-request.invalid_datetime"
	| "decision-request.escalation_required";

/** Versioned usage-error payload for invalid decision-request CLI arguments. */
export interface DecisionRequestUsageError {
	schemaVersion: "decision-request-error/v1";
	status: "error";
	error: {
		code: DecisionRequestUsageErrorCode;
		message: string;
	};
}

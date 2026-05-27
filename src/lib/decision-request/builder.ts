import type {
	DecisionRequestAuthority,
	DecisionRequestBuildFailure,
	DecisionRequestBuildInput,
	DecisionRequestBuildResult,
	DecisionRequestEscalation,
	DecisionRequestFreshness,
	DecisionRequestOption,
	DecisionRequestPacket,
	DecisionRequestStaleState,
	DecisionRequestStatus,
	DecisionRequestUsageErrorCode,
} from "./types.js";

const AUTHORITIES = new Set<DecisionRequestAuthority>([
	"human",
	"operator",
	"maintainer",
	"external_service",
]);

const STATUSES = new Set<DecisionRequestStatus>([
	"open",
	"answered",
	"expired",
	"cancelled",
]);

const FRESHNESS_VALUES = new Set<DecisionRequestFreshness>([
	"current",
	"stale",
	"missing",
	"unknown",
	"not_applicable",
]);

const RFC3339_DATE_TIME =
	/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

/** Build and validate a decision-request/v1 packet. */
export function buildDecisionRequest(
	input: DecisionRequestBuildInput,
): DecisionRequestBuildResult {
	const generatedAt = input.generatedAt ?? new Date().toISOString();
	if (!isDateTime(generatedAt)) {
		return failure(
			"decision-request.invalid_datetime",
			"--generated-at must be a valid date-time string.",
		);
	}

	const expiresAt = normalizeOptionalDateTime(input.expiresAt);
	if (expiresAt === undefined) {
		return failure(
			"decision-request.invalid_datetime",
			"--expires-at must be a valid date-time string or null.",
		);
	}

	const authority = input.authority ?? "human";
	if (!isDecisionRequestAuthority(authority)) {
		return failure(
			"decision-request.invalid_authority",
			"--authority must be human, operator, maintainer, or external_service.",
		);
	}

	const options = input.options ?? [];
	const optionValidation = validateOptions(options);
	if (!optionValidation.ok) return optionValidation;

	const intent = input.intent?.trim() ?? "";
	if (intent.length === 0) {
		return failure(
			"decision-request.intent_required",
			"harness decision-request requires --intent.",
		);
	}

	const defaultOptionId = input.defaultOptionId?.trim() ?? "";
	if (defaultOptionId.length === 0) {
		return failure(
			"decision-request.default_option_required",
			"harness decision-request requires --default-option.",
		);
	}
	if (!options.some((option) => option.id === defaultOptionId)) {
		return failure(
			"decision-request.default_option_unknown",
			"--default-option must match one emitted --option id.",
		);
	}

	const requestedStatus = input.status ?? "open";
	if (!isDecisionRequestStatus(requestedStatus)) {
		return failure(
			"decision-request.invalid_status",
			"--status must be open, answered, expired, or cancelled.",
		);
	}

	const requestedFreshness = input.freshness ?? "current";
	if (!isDecisionRequestFreshness(requestedFreshness)) {
		return failure(
			"decision-request.invalid_freshness",
			"--freshness must be current, stale, missing, unknown, or not_applicable.",
		);
	}

	const temporalState = normalizeTemporalState({
		generatedAt,
		expiresAt,
		status: requestedStatus,
		freshness: requestedFreshness,
	});
	const escalation = buildEscalation({
		authority,
		generatedAt,
		intent,
		escalation: input.escalation,
		status: temporalState.status,
	});
	if (!escalation.ok) return escalation;

	const packet: DecisionRequestPacket = {
		schemaVersion: "decision-request/v1",
		requestId:
			input.requestId?.trim() || makeRequestId(generatedAt, defaultOptionId),
		generatedAt,
		producer: input.producer?.trim() || "harness:decision-request",
		status: temporalState.status,
		intent,
		authority,
		defaultOptionId,
		options: options.map((option) => ({
			id: option.id,
			label: option.label,
			tradeoffs: [...option.tradeoffs],
		})),
		evidenceRefs: [...(input.evidenceRefs ?? [])],
		freshness: temporalState.freshness,
		expiresAt,
		runtimeStatus: "emitted",
		evidenceUse: "governance_request_only",
		claimSupport: "not_closeout_proof",
		escalation: escalation.escalation,
		staleState: temporalState.staleState,
	};

	return { ok: true, packet };
}

function validateOptions(
	options: DecisionRequestOption[],
): { ok: true } | DecisionRequestBuildFailure {
	if (options.length === 0) {
		return failure(
			"decision-request.option_required",
			"harness decision-request requires at least one --option.",
		);
	}
	const seen = new Set<string>();
	for (const option of options) {
		if (option.id.trim().length === 0 || option.label.trim().length === 0) {
			return failure(
				"decision-request.option_malformed",
				"--option must use id=label with non-empty id and label.",
			);
		}
		if (seen.has(option.id)) {
			return failure(
				"decision-request.option_duplicate",
				`--option id ${option.id} is duplicated.`,
			);
		}
		seen.add(option.id);
	}
	return { ok: true };
}

function normalizeTemporalState(input: {
	generatedAt: string;
	expiresAt: string | null;
	status: DecisionRequestStatus;
	freshness: DecisionRequestFreshness;
}): {
	status: DecisionRequestStatus;
	freshness: DecisionRequestFreshness;
	staleState: DecisionRequestStaleState[];
} {
	const staleState: DecisionRequestStaleState[] = [];
	if (
		input.expiresAt &&
		Date.parse(input.expiresAt) <= Date.parse(input.generatedAt)
	) {
		staleState.push({
			surface: "decision_request_expiry",
			freshness: "stale",
			reason: "expires_at_not_after_generated_at",
		});
		return {
			status: "expired",
			freshness: "stale",
			staleState,
		};
	}

	const status = input.status === "expired" ? "expired" : input.status;
	const freshness =
		status === "expired" && input.freshness === "current"
			? "stale"
			: input.freshness;

	if (status === "expired") {
		staleState.push({
			surface: "decision_request_status",
			freshness: "stale",
			reason: "status_expired",
		});
	}
	if (!["current", "not_applicable"].includes(freshness)) {
		staleState.push({
			surface: "decision_request_freshness",
			freshness,
			reason: `freshness_${freshness}`,
		});
	}

	return { status, freshness, staleState };
}

function buildEscalation(input: {
	authority: DecisionRequestAuthority;
	generatedAt: string;
	intent: string;
	status: DecisionRequestStatus;
	escalation?: DecisionRequestBuildInput["escalation"];
}):
	| { ok: true; escalation: DecisionRequestEscalation }
	| DecisionRequestBuildFailure {
	const targetRole = input.escalation?.targetRole ?? input.authority;
	if (!isDecisionRequestAuthority(targetRole)) {
		return failure(
			"decision-request.invalid_authority",
			"--escalation-target must be human, operator, maintainer, or external_service.",
		);
	}

	const channel =
		input.escalation?.channel === undefined
			? "codex_user"
			: input.escalation.channel.trim();
	const reason =
		input.escalation?.reason === undefined
			? input.intent
			: input.escalation.reason.trim();
	const requestedAt = input.escalation?.requestedAt ?? input.generatedAt;
	if (channel.length === 0 || reason.length === 0 || !isDateTime(requestedAt)) {
		return failure(
			"decision-request.escalation_required",
			"decision-request/v1 requires escalation channel, reason, and requestedAt.",
		);
	}

	return {
		ok: true,
		escalation: {
			required: !["answered", "cancelled"].includes(input.status),
			targetRole,
			channel,
			reason,
			requestedAt,
		},
	};
}

function normalizeOptionalDateTime(
	value: string | null | undefined,
): string | null | undefined {
	if (value === undefined || value === null || value === "null") return null;
	return isDateTime(value) ? value : undefined;
}

function isDateTime(value: string): boolean {
	return RFC3339_DATE_TIME.test(value) && !Number.isNaN(Date.parse(value));
}

function isDecisionRequestAuthority(
	value: string,
): value is DecisionRequestAuthority {
	return AUTHORITIES.has(value as DecisionRequestAuthority);
}

function isDecisionRequestStatus(
	value: string,
): value is DecisionRequestStatus {
	return STATUSES.has(value as DecisionRequestStatus);
}

function isDecisionRequestFreshness(
	value: string,
): value is DecisionRequestFreshness {
	return FRESHNESS_VALUES.has(value as DecisionRequestFreshness);
}

function makeRequestId(generatedAt: string, defaultOptionId: string): string {
	const compactTimestamp = generatedAt.replace(/[^0-9A-Za-z]/g, "");
	return `decision-request:${defaultOptionId}:${compactTimestamp}`;
}

function failure(
	code: DecisionRequestUsageErrorCode,
	message: string,
): DecisionRequestBuildFailure {
	return { ok: false, code, message };
}

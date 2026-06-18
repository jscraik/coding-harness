import type {
	RuntimeEvidenceVerifierResult,
	RuntimeEvidenceVerifierStatus,
	RuntimeProbeReceipt,
} from "./runtime-evidence-contract.js";

type AddRuntimeEvidenceFinding = (
	path: string,
	code: string,
	message: string,
) => void;

const VERIFIER_STATUSES = new Set<RuntimeEvidenceVerifierStatus>([
	"pass",
	"fail",
	"blocked",
	"unknown",
]);

const VERIFIER_OWNERS = new Set<RuntimeEvidenceVerifierResult["owner"]>([
	"validator",
	"runtime",
	"human",
]);

const RUNTIME_PROBE_SPAWN_OUTCOMES = new Set<
	RuntimeProbeReceipt["spawnOutcome"]
>(["available", "unknown_agent_type", "blocked", "not_run"]);

const ISO_TIMESTAMP_PATTERN =
	/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

/** Validate the verifier result section and return its normalized status. */
export function validateVerifierResult(
	verifierResult: unknown,
	add: AddRuntimeEvidenceFinding,
): RuntimeEvidenceVerifierStatus | undefined {
	if (!isRecord(verifierResult)) {
		addInvalidVerifierResult(add);
		return undefined;
	}
	const verifierStatus = asText(verifierResult.status);
	validateVerifierStatus(verifierStatus, add);
	validateVerifierOwner(verifierResult.owner, add);
	validateVerifierTimestamp(verifierResult.verifiedAt, add);
	validateVerifierEvidenceRefs(verifierResult.evidenceRefs, add);
	validateVerifierReason(verifierResult.reason, verifierStatus, add);
	return normalizeVerifierStatus(verifierStatus);
}

/** Validate the runtime probe receipt section. */
export function validateRuntimeProbe(
	probe: unknown,
	add: AddRuntimeEvidenceFinding,
): void {
	if (probe === null || probe === undefined) {
		add(
			"resolvedState.runtimeProbe",
			"runtime_probe_missing",
			"runtime probe receipt is required.",
		);
		return;
	}
	if (!isRecord(probe)) {
		add(
			"resolvedState.runtimeProbe",
			"runtime_probe_invalid",
			"runtime probe receipt must be a JSON object.",
		);
		return;
	}
	validateRuntimeProbeIdentity(probe, add);
	validateRuntimeProbeSpawnOutcome(probe.spawnOutcome, add);
	validateRuntimeProbeBlocker(probe, add);
}

function addInvalidVerifierResult(add: AddRuntimeEvidenceFinding): void {
	add(
		"verifierResult",
		"verifier_result_invalid",
		"verifierResult must be a JSON object.",
	);
	add(
		"verifierResult.verifiedAt",
		"verified_at_invalid",
		"verifiedAt must be an ISO timestamp.",
	);
	add(
		"verifierResult.evidenceRefs",
		"verifier_evidence_missing",
		"verifier result must cite evidence.",
	);
	add(
		"verifierResult.reason",
		"verifier_reason_missing",
		"non-pass verifier results require a reason.",
	);
}

function validateVerifierStatus(
	value: string | null,
	add: AddRuntimeEvidenceFinding,
): void {
	if (!VERIFIER_STATUSES.has(value as RuntimeEvidenceVerifierStatus)) {
		add(
			"verifierResult.status",
			"verifier_status_invalid",
			"verifier status is not recognized.",
		);
	}
}

function validateVerifierOwner(
	value: unknown,
	add: AddRuntimeEvidenceFinding,
): void {
	if (
		!VERIFIER_OWNERS.has(
			asText(value) as RuntimeEvidenceVerifierResult["owner"],
		)
	) {
		add(
			"verifierResult.owner",
			"verifier_owner_invalid",
			"verifier owner is not recognized.",
		);
	}
}

function validateVerifierTimestamp(
	value: unknown,
	add: AddRuntimeEvidenceFinding,
): void {
	if (!isIsoTimestamp(asText(value))) {
		add(
			"verifierResult.verifiedAt",
			"verified_at_invalid",
			"verifiedAt must be an ISO timestamp.",
		);
	}
}

function validateVerifierEvidenceRefs(
	value: unknown,
	add: AddRuntimeEvidenceFinding,
): void {
	if (!Array.isArray(value) || value.length === 0) {
		add(
			"verifierResult.evidenceRefs",
			"verifier_evidence_missing",
			"verifier result must cite evidence.",
		);
		return;
	}
	if (value.some((ref) => isBlank(asText(ref)))) {
		add(
			"verifierResult.evidenceRefs",
			"verifier_evidence_ref_invalid",
			"verifier evidence refs must be non-empty strings.",
		);
	}
}

function validateVerifierReason(
	value: unknown,
	verifierStatus: string | null,
	add: AddRuntimeEvidenceFinding,
): void {
	if (!isNullableString(value)) {
		add(
			"verifierResult.reason",
			"verifier_reason_invalid",
			"verifier reason must be a string or null.",
		);
		return;
	}
	if (verifierStatus !== "pass" && isBlank(asText(value))) {
		add(
			"verifierResult.reason",
			"verifier_reason_missing",
			"non-pass verifier results require a reason.",
		);
	}
}

function normalizeVerifierStatus(
	value: string | null,
): RuntimeEvidenceVerifierStatus | undefined {
	return VERIFIER_STATUSES.has(value as RuntimeEvidenceVerifierStatus)
		? (value as RuntimeEvidenceVerifierStatus)
		: undefined;
}

function validateRuntimeProbeIdentity(
	probe: Record<string, unknown>,
	add: AddRuntimeEvidenceFinding,
): void {
	if (isBlank(asText(probe.roleName))) {
		add(
			"resolvedState.runtimeProbe.roleName",
			"runtime_probe_role_missing",
			"runtime probe must name the role.",
		);
	}
	if (!isIsoTimestamp(asText(probe.checkedAt))) {
		add(
			"resolvedState.runtimeProbe.checkedAt",
			"runtime_probe_checked_at_invalid",
			"runtime probe checkedAt must be an ISO timestamp.",
		);
	}
	if (isBlank(asText(probe.checkout))) {
		add(
			"resolvedState.runtimeProbe.checkout",
			"runtime_probe_checkout_missing",
			"runtime probe must name the checkout.",
		);
	}
	if (!(probe.sessionId === null || typeof probe.sessionId === "string")) {
		add(
			"resolvedState.runtimeProbe.sessionId",
			"runtime_probe_session_id_invalid",
			"runtime probe sessionId must be a string or null.",
		);
	}
}

function validateRuntimeProbeSpawnOutcome(
	value: unknown,
	add: AddRuntimeEvidenceFinding,
): void {
	if (
		!RUNTIME_PROBE_SPAWN_OUTCOMES.has(
			asText(value) as RuntimeProbeReceipt["spawnOutcome"],
		)
	) {
		add(
			"resolvedState.runtimeProbe.spawnOutcome",
			"runtime_probe_spawn_outcome_invalid",
			"runtime probe spawnOutcome is not recognized.",
		);
	}
}

function validateRuntimeProbeBlocker(
	probe: Record<string, unknown>,
	add: AddRuntimeEvidenceFinding,
): void {
	if (!isNullableString(probe.blockerClass)) {
		add(
			"resolvedState.runtimeProbe.blockerClass",
			"runtime_probe_blocker_invalid",
			"runtime probe blockerClass must be a string or null.",
		);
		return;
	}
	if (
		probe.spawnOutcome !== "available" &&
		isBlank(asText(probe.blockerClass))
	) {
		add(
			"resolvedState.runtimeProbe.blockerClass",
			"runtime_probe_blocker_missing",
			"non-available probes must classify the blocker.",
		);
	}
}

/** Return a string value as text, otherwise null. */
export function asText(value: unknown): string | null {
	return typeof value === "string" ? value : null;
}

/** Return whether optional text is null, undefined, or blank. */
export function isBlank(value: string | null | undefined): boolean {
	return value === null || value === undefined || value.trim().length === 0;
}

/** Return whether a value is either null or a string. */
export function isNullableString(value: unknown): boolean {
	return value === null || typeof value === "string";
}

/** Return whether a value is a strict UTC ISO-8601 timestamp. */
export function isIsoTimestamp(value: string | null | undefined): boolean {
	if (
		typeof value !== "string" ||
		value.trim().length === 0 ||
		!ISO_TIMESTAMP_PATTERN.test(value)
	) {
		return false;
	}
	const normalized =
		value.endsWith("Z") && !value.includes(".")
			? value.replace("Z", ".000Z")
			: value;
	const timestamp = new Date(value);
	return (
		!Number.isNaN(timestamp.getTime()) && timestamp.toISOString() === normalized
	);
}

/** Return whether a value is a non-array record. */
export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

import type {
	ExitClassification,
	RunOutcome,
} from "../contract/run-records-core.js";

/** Contract that ties an agent claim to runtime truth, verifier evidence, and run-record semantics. */
export const RUNTIME_EVIDENCE_CONTRACT_SCHEMA_VERSION =
	"runtime-evidence-contract/v1" as const;

/** Runtime verifier result states accepted by runtime-evidence-contract/v1. */
export type RuntimeEvidenceVerifierStatus =
	| "pass"
	| "fail"
	| "blocked"
	| "unknown";

/** Runtime permission posture observed for the current execution lane. */
export type RuntimeEvidencePermissionProfile =
	| "read_only"
	| "workspace_write"
	| "escalated"
	| "unknown";

/** Contract for proving project-local role availability without relying on file presence alone. */
export interface RuntimeProbeReceipt {
	roleName: string;
	spawnOutcome: "available" | "unknown_agent_type" | "blocked" | "not_run";
	checkedAt: string;
	sessionId: string | null;
	checkout: string;
	blockerClass: string | null;
	failureText?: string | null;
}

/** Declared operator intent for the current execution. */
export interface RuntimeEvidenceDeclaredIntent {
	objective: string;
	requestedScope: "analysis" | "implementation" | "review" | "closeout";
	sourceRefs: string[];
}

/** Live runtime state observed before an implementation or closeout claim is trusted. */
export interface RuntimeEvidenceResolvedState {
	permissionProfile: RuntimeEvidencePermissionProfile;
	goalStatus: string | null;
	serviceTier: string | null;
	pluginAttribution: string[];
	runtimeProbe: RuntimeProbeReceipt | null;
}

/** Verifier-backed result for the runtime-evidence contract. */
export interface RuntimeEvidenceVerifierResult {
	status: RuntimeEvidenceVerifierStatus;
	owner: "validator" | "runtime" | "human";
	evidenceRefs: string[];
	verifiedAt: string;
	reason: string | null;
}

/** Mapping from runtime verifier state to the canonical run-record outcome fields. */
export interface RuntimeEvidenceOutcomeMapping {
	outcome: RunOutcome;
	exitClassification: ExitClassification;
}

/** Full runtime evidence contract consumed by agent-native closeout surfaces. */
export interface RuntimeEvidenceContract {
	schemaVersion: typeof RUNTIME_EVIDENCE_CONTRACT_SCHEMA_VERSION;
	declaredIntent: RuntimeEvidenceDeclaredIntent;
	resolvedState: RuntimeEvidenceResolvedState;
	verifierResult: RuntimeEvidenceVerifierResult;
	claimTraceConsistency: "consistent" | "inconsistent" | "unknown";
	evaluation: {
		portable: boolean;
		command: string | null;
		status: RuntimeEvidenceVerifierStatus;
	};
	outcomeMapping: RuntimeEvidenceOutcomeMapping;
}

/** Validation finding for malformed or overclaimed runtime-evidence contracts. */
export interface RuntimeEvidenceContractFinding {
	code: string;
	message: string;
	path: string;
}

/** Runtime-evidence contract validation report. */
export interface RuntimeEvidenceContractValidationResult {
	valid: boolean;
	findings: RuntimeEvidenceContractFinding[];
}

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

const PERMISSION_PROFILES = new Set<RuntimeEvidencePermissionProfile>([
	"read_only",
	"workspace_write",
	"escalated",
	"unknown",
]);

const REQUESTED_SCOPES = new Set<
	RuntimeEvidenceDeclaredIntent["requestedScope"]
>(["analysis", "implementation", "review", "closeout"]);

const RUNTIME_PROBE_SPAWN_OUTCOMES = new Set<
	RuntimeProbeReceipt["spawnOutcome"]
>(["available", "unknown_agent_type", "blocked", "not_run"]);

const CLAIM_TRACE_CONSISTENCIES = new Set<
	RuntimeEvidenceContract["claimTraceConsistency"]
>(["consistent", "inconsistent", "unknown"]);

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

type AddRuntimeEvidenceFinding = (
	path: string,
	code: string,
	message: string,
) => void;

/** Map verifier status into the canonical run-record outcome and exit classification. */
export function mapRuntimeVerifierToRunExit(
	status: RuntimeEvidenceVerifierStatus,
): RuntimeEvidenceOutcomeMapping {
	switch (status) {
		case "pass":
			return { outcome: "success", exitClassification: "ok" };
		case "fail":
			return { outcome: "failed", exitClassification: "validation_failed" };
		case "blocked":
			return {
				outcome: "blocked",
				exitClassification: "manual_intervention_required",
			};
		case "unknown":
			return { outcome: "hold", exitClassification: "precondition_failed" };
	}
}

/** Validate a runtime-evidence-contract/v1 object before it can support a closeout claim. */
export function validateRuntimeEvidenceContract(
	contract: RuntimeEvidenceContract,
): RuntimeEvidenceContractValidationResult {
	const findings: RuntimeEvidenceContractFinding[] = [];
	const add: AddRuntimeEvidenceFinding = (path, code, message): void => {
		findings.push({ path, code, message });
	};
	const candidate = contract as unknown as Record<string, unknown>;

	if (candidate.schemaVersion !== RUNTIME_EVIDENCE_CONTRACT_SCHEMA_VERSION) {
		add(
			"schemaVersion",
			"schema_version_invalid",
			"schemaVersion must be runtime-evidence-contract/v1.",
		);
	}
	validateDeclaredIntent(candidate.declaredIntent, add);
	const resolvedState = candidate.resolvedState;
	validateResolvedState(resolvedState, add);
	const verifierStatus = validateVerifierResult(candidate.verifierResult, add);
	validateClaimTraceConsistency(
		candidate.claimTraceConsistency,
		verifierStatus,
		add,
	);
	validateEvaluation(candidate.evaluation, add);
	validateOutcomeMapping(candidate.outcomeMapping, verifierStatus, add);
	validateRuntimeProbe(
		isRecord(resolvedState) ? resolvedState.runtimeProbe : null,
		add,
	);

	return { valid: findings.length === 0, findings };
}

function validateDeclaredIntent(
	declaredIntent: unknown,
	add: AddRuntimeEvidenceFinding,
): void {
	if (!isRecord(declaredIntent)) {
		add(
			"declaredIntent",
			"declared_intent_invalid",
			"declaredIntent must be a JSON object.",
		);
	} else {
		if (isBlank(asText(declaredIntent.objective))) {
			add(
				"declaredIntent.objective",
				"objective_missing",
				"declared intent must name the objective.",
			);
		}
		if (
			!Array.isArray(declaredIntent.sourceRefs) ||
			declaredIntent.sourceRefs.length === 0
		) {
			add(
				"declaredIntent.sourceRefs",
				"source_refs_missing",
				"declared intent must cite at least one source reference.",
			);
		}
		if (
			!REQUESTED_SCOPES.has(
				asText(
					declaredIntent.requestedScope,
				) as RuntimeEvidenceDeclaredIntent["requestedScope"],
			)
		) {
			add(
				"declaredIntent.requestedScope",
				"requested_scope_invalid",
				"requested scope is not recognized.",
			);
		}
	}
}

function validateResolvedState(
	resolvedState: unknown,
	add: AddRuntimeEvidenceFinding,
): void {
	if (!isRecord(resolvedState)) {
		add(
			"resolvedState",
			"resolved_state_invalid",
			"resolvedState must be a JSON object.",
		);
	} else if (
		!PERMISSION_PROFILES.has(
			asText(
				resolvedState.permissionProfile,
			) as RuntimeEvidencePermissionProfile,
		)
	) {
		add(
			"resolvedState.permissionProfile",
			"permission_profile_invalid",
			"permission profile is not recognized.",
		);
	}
}

function validateVerifierResult(
	verifierResult: unknown,
	add: AddRuntimeEvidenceFinding,
): RuntimeEvidenceVerifierStatus | undefined {
	const verifierStatus = isRecord(verifierResult)
		? asText(verifierResult.status)
		: undefined;
	if (!isRecord(verifierResult)) {
		add(
			"verifierResult",
			"verifier_result_invalid",
			"verifierResult must be a JSON object.",
		);
	} else if (
		!VERIFIER_STATUSES.has(verifierStatus as RuntimeEvidenceVerifierStatus)
	) {
		add(
			"verifierResult.status",
			"verifier_status_invalid",
			"verifier status is not recognized.",
		);
	}
	if (
		isRecord(verifierResult) &&
		!VERIFIER_OWNERS.has(
			asText(verifierResult.owner) as RuntimeEvidenceVerifierResult["owner"],
		)
	) {
		add(
			"verifierResult.owner",
			"verifier_owner_invalid",
			"verifier owner is not recognized.",
		);
	}
	if (
		!isRecord(verifierResult) ||
		!ISO_DATE_PATTERN.test(asText(verifierResult.verifiedAt) ?? "")
	) {
		add(
			"verifierResult.verifiedAt",
			"verified_at_invalid",
			"verifiedAt must be an ISO timestamp.",
		);
	}
	if (
		!isRecord(verifierResult) ||
		!Array.isArray(verifierResult.evidenceRefs) ||
		verifierResult.evidenceRefs.length === 0
	) {
		add(
			"verifierResult.evidenceRefs",
			"verifier_evidence_missing",
			"verifier result must cite evidence.",
		);
	}
	if (
		verifierStatus !== "pass" &&
		(!isRecord(verifierResult) || isBlank(asText(verifierResult.reason)))
	) {
		add(
			"verifierResult.reason",
			"verifier_reason_missing",
			"non-pass verifier results require a reason.",
		);
	}
	return VERIFIER_STATUSES.has(verifierStatus as RuntimeEvidenceVerifierStatus)
		? (verifierStatus as RuntimeEvidenceVerifierStatus)
		: undefined;
}

function validateClaimTraceConsistency(
	claimTraceConsistency: unknown,
	verifierStatus: RuntimeEvidenceVerifierStatus | undefined,
	add: AddRuntimeEvidenceFinding,
): void {
	const normalizedClaimTraceConsistency = asText(
		claimTraceConsistency,
	) as RuntimeEvidenceContract["claimTraceConsistency"];
	if (!CLAIM_TRACE_CONSISTENCIES.has(normalizedClaimTraceConsistency)) {
		add(
			"claimTraceConsistency",
			"claim_trace_consistency_invalid",
			"claimTraceConsistency is not recognized.",
		);
	}
	if (claimTraceConsistency === "inconsistent" && verifierStatus === "pass") {
		add(
			"claimTraceConsistency",
			"inconsistent_claim_overclaimed",
			"inconsistent claim traces cannot be marked passing.",
		);
	}
}

function validateEvaluation(
	evaluation: unknown,
	add: AddRuntimeEvidenceFinding,
): void {
	if (!isRecord(evaluation)) {
		add(
			"evaluation",
			"evaluation_invalid",
			"evaluation must be a JSON object.",
		);
	} else {
		if (
			!VERIFIER_STATUSES.has(
				asText(evaluation.status) as RuntimeEvidenceVerifierStatus,
			)
		) {
			add(
				"evaluation.status",
				"evaluation_status_invalid",
				"evaluation status is not recognized.",
			);
		}
		if (evaluation.portable === true && isBlank(asText(evaluation.command))) {
			add(
				"evaluation.command",
				"portable_command_missing",
				"portable evaluations must name the replay command.",
			);
		}
	}
}

function validateOutcomeMapping(
	outcomeMapping: unknown,
	verifierStatus: RuntimeEvidenceVerifierStatus | undefined,
	add: AddRuntimeEvidenceFinding,
): void {
	if (!isRecord(outcomeMapping)) {
		add(
			"outcomeMapping",
			"outcome_mapping_invalid",
			"outcomeMapping must be a JSON object.",
		);
	} else if (verifierStatus !== undefined) {
		const expectedOutcome = mapRuntimeVerifierToRunExit(verifierStatus);
		if (
			outcomeMapping.outcome !== expectedOutcome.outcome ||
			outcomeMapping.exitClassification !== expectedOutcome.exitClassification
		) {
			add(
				"outcomeMapping",
				"outcome_mapping_mismatch",
				"outcome mapping must match verifier status.",
			);
		}
	}
}

function validateRuntimeProbe(
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
	if (isBlank(asText(probe.roleName))) {
		add(
			"resolvedState.runtimeProbe.roleName",
			"runtime_probe_role_missing",
			"runtime probe must name the role.",
		);
	}
	if (!ISO_DATE_PATTERN.test(asText(probe.checkedAt) ?? "")) {
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
	if (
		!RUNTIME_PROBE_SPAWN_OUTCOMES.has(
			asText(probe.spawnOutcome) as RuntimeProbeReceipt["spawnOutcome"],
		)
	) {
		add(
			"resolvedState.runtimeProbe.spawnOutcome",
			"runtime_probe_spawn_outcome_invalid",
			"runtime probe spawnOutcome is not recognized.",
		);
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

function asText(value: unknown): string | null {
	return typeof value === "string" ? value : null;
}

function isBlank(value: string | null | undefined): boolean {
	return value === null || value === undefined || value.trim().length === 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

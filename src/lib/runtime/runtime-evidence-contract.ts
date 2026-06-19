import type {
	ExitClassification,
	RunOutcome,
} from "../contract/run-records-core.js";
import {
	asText,
	isBlank,
	isNullableString,
	isRecord,
	validateRuntimeProbe,
	validateVerifierResult,
} from "./runtime-evidence-contract-validation-sections.js";

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

const PERMISSION_PROFILES = new Set<RuntimeEvidencePermissionProfile>([
	"read_only",
	"workspace_write",
	"escalated",
	"unknown",
]);

const REQUESTED_SCOPES = new Set<
	RuntimeEvidenceDeclaredIntent["requestedScope"]
>(["analysis", "implementation", "review", "closeout"]);

const CLAIM_TRACE_CONSISTENCIES = new Set<
	RuntimeEvidenceContract["claimTraceConsistency"]
>(["consistent", "inconsistent", "unknown"]);

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
	contract: unknown,
): RuntimeEvidenceContractValidationResult {
	const findings: RuntimeEvidenceContractFinding[] = [];
	const add: AddRuntimeEvidenceFinding = (path, code, message): void => {
		findings.push({ path, code, message });
	};
	if (!isRecord(contract)) {
		return {
			valid: false,
			findings: [
				{
					path: "contract",
					code: "contract_invalid",
					message: "contract must be an object.",
				},
			],
		};
	}
	const candidate = contract;

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
			Array.isArray(declaredIntent.sourceRefs) &&
			declaredIntent.sourceRefs.some((ref) => isBlank(asText(ref)))
		) {
			add(
				"declaredIntent.sourceRefs",
				"source_ref_invalid",
				"declared intent source refs must be non-empty strings.",
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
	} else {
		if (
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
		if (!isNullableString(resolvedState.goalStatus)) {
			add(
				"resolvedState.goalStatus",
				"goal_status_invalid",
				"goalStatus must be a string or null.",
			);
		}
		if (!isNullableString(resolvedState.serviceTier)) {
			add(
				"resolvedState.serviceTier",
				"service_tier_invalid",
				"serviceTier must be a string or null.",
			);
		}
		if (
			!Array.isArray(resolvedState.pluginAttribution) ||
			resolvedState.pluginAttribution.some((plugin) => isBlank(asText(plugin)))
		) {
			add(
				"resolvedState.pluginAttribution",
				"plugin_attribution_invalid",
				"pluginAttribution must contain only non-empty strings.",
			);
		}
	}
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
		if (typeof evaluation.portable !== "boolean") {
			add(
				"evaluation.portable",
				"evaluation_portable_invalid",
				"evaluation portable flag must be a boolean.",
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

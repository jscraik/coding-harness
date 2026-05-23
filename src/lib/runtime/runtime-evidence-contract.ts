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

const PERMISSION_PROFILES = new Set<RuntimeEvidencePermissionProfile>([
	"read_only",
	"workspace_write",
	"escalated",
	"unknown",
]);

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

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
	const add = (path: string, code: string, message: string): void => {
		findings.push({ path, code, message });
	};

	if (contract.schemaVersion !== RUNTIME_EVIDENCE_CONTRACT_SCHEMA_VERSION) {
		add(
			"schemaVersion",
			"schema_version_invalid",
			"schemaVersion must be runtime-evidence-contract/v1.",
		);
	}
	if (isBlank(contract.declaredIntent.objective)) {
		add(
			"declaredIntent.objective",
			"objective_missing",
			"declared intent must name the objective.",
		);
	}
	if (contract.declaredIntent.sourceRefs.length === 0) {
		add(
			"declaredIntent.sourceRefs",
			"source_refs_missing",
			"declared intent must cite at least one source reference.",
		);
	}
	if (!PERMISSION_PROFILES.has(contract.resolvedState.permissionProfile)) {
		add(
			"resolvedState.permissionProfile",
			"permission_profile_invalid",
			"permission profile is not recognized.",
		);
	}
	if (!VERIFIER_STATUSES.has(contract.verifierResult.status)) {
		add(
			"verifierResult.status",
			"verifier_status_invalid",
			"verifier status is not recognized.",
		);
	}
	if (!ISO_DATE_PATTERN.test(contract.verifierResult.verifiedAt)) {
		add(
			"verifierResult.verifiedAt",
			"verified_at_invalid",
			"verifiedAt must be an ISO timestamp.",
		);
	}
	if (contract.verifierResult.evidenceRefs.length === 0) {
		add(
			"verifierResult.evidenceRefs",
			"verifier_evidence_missing",
			"verifier result must cite evidence.",
		);
	}
	if (
		contract.verifierResult.status !== "pass" &&
		isBlank(contract.verifierResult.reason)
	) {
		add(
			"verifierResult.reason",
			"verifier_reason_missing",
			"non-pass verifier results require a reason.",
		);
	}
	if (
		contract.claimTraceConsistency === "inconsistent" &&
		contract.verifierResult.status === "pass"
	) {
		add(
			"claimTraceConsistency",
			"inconsistent_claim_overclaimed",
			"inconsistent claim traces cannot be marked passing.",
		);
	}
	if (contract.evaluation.portable && isBlank(contract.evaluation.command)) {
		add(
			"evaluation.command",
			"portable_command_missing",
			"portable evaluations must name the replay command.",
		);
	}
	const expectedOutcome = mapRuntimeVerifierToRunExit(
		contract.verifierResult.status,
	);
	if (
		contract.outcomeMapping.outcome !== expectedOutcome.outcome ||
		contract.outcomeMapping.exitClassification !==
			expectedOutcome.exitClassification
	) {
		add(
			"outcomeMapping",
			"outcome_mapping_mismatch",
			"outcome mapping must match verifier status.",
		);
	}
	validateRuntimeProbe(contract.resolvedState.runtimeProbe, add);

	return { valid: findings.length === 0, findings };
}

function validateRuntimeProbe(
	probe: RuntimeProbeReceipt | null,
	add: (path: string, code: string, message: string) => void,
): void {
	if (probe === null) {
		add(
			"resolvedState.runtimeProbe",
			"runtime_probe_missing",
			"runtime probe receipt is required.",
		);
		return;
	}
	if (isBlank(probe.roleName)) {
		add(
			"resolvedState.runtimeProbe.roleName",
			"runtime_probe_role_missing",
			"runtime probe must name the role.",
		);
	}
	if (!ISO_DATE_PATTERN.test(probe.checkedAt)) {
		add(
			"resolvedState.runtimeProbe.checkedAt",
			"runtime_probe_checked_at_invalid",
			"runtime probe checkedAt must be an ISO timestamp.",
		);
	}
	if (isBlank(probe.checkout)) {
		add(
			"resolvedState.runtimeProbe.checkout",
			"runtime_probe_checkout_missing",
			"runtime probe must name the checkout.",
		);
	}
	if (probe.spawnOutcome !== "available" && isBlank(probe.blockerClass)) {
		add(
			"resolvedState.runtimeProbe.blockerClass",
			"runtime_probe_blocker_missing",
			"non-available probes must classify the blocker.",
		);
	}
}

function isBlank(value: string | null | undefined): boolean {
	return value === null || value === undefined || value.trim().length === 0;
}

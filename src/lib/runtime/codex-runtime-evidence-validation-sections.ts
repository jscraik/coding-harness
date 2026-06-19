import {
	CODEX_RUNTIME_APPROVAL_SCOPES,
	CODEX_RUNTIME_ENVIRONMENT_STATES,
	CODEX_RUNTIME_EXECUTOR_KINDS,
	CODEX_RUNTIME_SOURCE_KINDS,
	classifyCodexRuntimeSourceKind,
} from "./codex-runtime-evidence-types.js";
import {
	type AddFinding,
	asText,
	isBlank,
	isRecord,
	requireEnum,
	requireIsoTimestamp,
	requireNonEmptyString,
	requireNullableNonEmptyString,
} from "./codex-runtime-evidence-validation-helpers.js";

/** Validate source provenance for a Codex runtime evidence packet. */
export function validateSourceProvenance(
	value: unknown,
	add: AddFinding,
): void {
	if (!isRecord(value)) {
		add(
			"sourceProvenance",
			"source_provenance_invalid",
			"sourceProvenance must be an object.",
		);
		return;
	}
	requireEnum(
		value.sourceKind,
		CODEX_RUNTIME_SOURCE_KINDS,
		"sourceProvenance.sourceKind",
		add,
	);
	requireNonEmptyString(
		value.codexRepoPath,
		"sourceProvenance.codexRepoPath",
		add,
	);
	validateSourceKindMatch(value, add);
	requireNullableNonEmptyString(
		value.commitSha,
		"sourceProvenance.commitSha",
		add,
	);
	requireEnum(
		value.dirtyState,
		["clean", "dirty", "unknown"],
		"sourceProvenance.dirtyState",
		add,
	);
	validateSourceFileChecksums(value.sourceFileChecksums, add);
	requireIsoTimestamp(value.capturedAt, "sourceProvenance.capturedAt", add);
}

/** Validate runtime environment identity and permission consistency. */
export function validateEnvironment(
	value: unknown,
	permissions: unknown,
	add: AddFinding,
): void {
	if (!isRecord(value)) {
		add("environment", "environment_invalid", "environment must be an object.");
		return;
	}
	validateEnvironmentFields(value, add);
	validateExpectedApprovalScope(value, add);
	validateEnvironmentState(value, permissions, add);
}

function validateSourceKindMatch(
	value: Record<string, unknown>,
	add: AddFinding,
): void {
	if (
		typeof value.codexRepoPath !== "string" ||
		typeof value.sourceKind !== "string"
	) {
		return;
	}
	const derivedKind = classifyCodexRuntimeSourceKind(value.codexRepoPath);
	if (derivedKind !== "unknown" && derivedKind !== value.sourceKind) {
		add(
			"sourceProvenance.sourceKind",
			"source_kind_mismatch",
			"sourceKind must match the Codex source path classification when the source path is recognized.",
		);
	}
}

function validateSourceFileChecksums(value: unknown, add: AddFinding): void {
	if (!isRecord(value)) {
		add(
			"sourceProvenance.sourceFileChecksums",
			"source_file_checksums_invalid",
			"sourceFileChecksums must be an object.",
		);
		return;
	}
	const entries = Object.entries(value);
	if (entries.length === 0) {
		add(
			"sourceProvenance.sourceFileChecksums",
			"source_file_checksums_missing",
			"sourceFileChecksums must include at least one source checksum.",
		);
	}
	for (const [path, checksum] of entries) {
		if (path.trim().length === 0 || isBlank(asText(checksum))) {
			add(
				"sourceProvenance.sourceFileChecksums",
				"source_file_checksum_invalid",
				"sourceFileChecksums entries must have non-empty paths and checksum strings.",
			);
		}
	}
}

function validateEnvironmentFields(
	value: Record<string, unknown>,
	add: AddFinding,
): void {
	requireNullableNonEmptyString(
		value.environmentId,
		"environment.environmentId",
		add,
	);
	requireNullableNonEmptyString(value.cwd, "environment.cwd", add);
	requireNullableNonEmptyString(
		value.expectedCwd,
		"environment.expectedCwd",
		add,
	);
	requireEnum(
		value.executorKind,
		CODEX_RUNTIME_EXECUTOR_KINDS,
		"environment.executorKind",
		add,
	);
	requireEnum(
		value.approvalScope,
		CODEX_RUNTIME_APPROVAL_SCOPES,
		"environment.approvalScope",
		add,
	);
	requireNullableNonEmptyString(
		value.sandboxPolicyRef,
		"environment.sandboxPolicyRef",
		add,
	);
	requireEnum(
		value.state,
		CODEX_RUNTIME_ENVIRONMENT_STATES,
		"environment.state",
		add,
	);
	requireNullableNonEmptyString(
		value.failureClass,
		"environment.failureClass",
		add,
	);
}

function validateExpectedApprovalScope(
	value: Record<string, unknown>,
	add: AddFinding,
): void {
	if (value.expectedApprovalScope === null) return;
	requireEnum(
		value.expectedApprovalScope,
		CODEX_RUNTIME_APPROVAL_SCOPES,
		"environment.expectedApprovalScope",
		add,
	);
}

function validateEnvironmentState(
	value: Record<string, unknown>,
	permissions: unknown,
	add: AddFinding,
): void {
	requireFailureClassForStaleEnvironment(value, add);
	requireMatchingEnvironmentState(value, add);
	requireSandboxPolicyRefWhenKnown(value, permissions, add);
	requireCurrentEnvironmentIdentity(value, add);
}

function requireFailureClassForStaleEnvironment(
	value: Record<string, unknown>,
	add: AddFinding,
): void {
	if (value.state !== "current" && isBlank(asText(value.failureClass))) {
		add(
			"environment.failureClass",
			"environment_failure_class_missing",
			"failureClass is required when environment state is not current.",
		);
	}
	if (value.state === "current" && !isBlank(asText(value.failureClass))) {
		add(
			"environment.failureClass",
			"environment_failure_class_unexpected",
			"failureClass must be null when environment state is current.",
		);
	}
}

function requireMatchingEnvironmentState(
	value: Record<string, unknown>,
	add: AddFinding,
): void {
	const hasStaleCwd =
		value.cwd !== null &&
		value.expectedCwd !== null &&
		value.cwd !== value.expectedCwd;
	const hasApprovalScopeMismatch =
		!hasStaleCwd &&
		value.approvalScope !== "unknown" &&
		value.expectedApprovalScope !== null &&
		value.approvalScope !== value.expectedApprovalScope;
	if (hasStaleCwd && value.state !== "stale_cwd") {
		add(
			"environment.state",
			"environment_stale_cwd_missing",
			"state must be stale_cwd when cwd differs from expectedCwd.",
		);
	}
	if (hasApprovalScopeMismatch && value.state !== "approval_scope_mismatch") {
		add(
			"environment.state",
			"approval_scope_mismatch_missing",
			"state must be approval_scope_mismatch when approvalScope differs from expectedApprovalScope.",
		);
	}
}

function requireSandboxPolicyRefWhenKnown(
	value: Record<string, unknown>,
	permissions: unknown,
	add: AddFinding,
): void {
	if (
		!permissionFactsAreKnown(permissions) ||
		!isBlank(asText(value.sandboxPolicyRef))
	) {
		return;
	}
	add(
		"environment.sandboxPolicyRef",
		"sandbox_policy_ref_missing",
		"sandboxPolicyRef is required when permission and network facts are known.",
	);
}

function requireCurrentEnvironmentIdentity(
	value: Record<string, unknown>,
	add: AddFinding,
): void {
	if (
		value.state === "current" &&
		isBlank(asText(value.environmentId)) &&
		isBlank(asText(value.cwd)) &&
		isBlank(asText(value.expectedCwd)) &&
		isBlank(asText(value.sandboxPolicyRef))
	) {
		add(
			"environment.state",
			"environment_current_scope_missing",
			"current environment state requires an explicit environment identity, cwd, expectedCwd, or sandboxPolicyRef.",
		);
	}
}

function permissionFactsAreKnown(value: unknown): boolean {
	if (!isRecord(value)) return false;
	const profile = typeof value.profile === "string" ? value.profile : null;
	const network = typeof value.network === "string" ? value.network : null;
	return (
		profile !== null &&
		profile !== "unknown" &&
		network !== null &&
		network !== "unknown" &&
		(!isWriteCapablePermissionProfile(profile) ||
			(Array.isArray(value.writableRoots) && value.writableRoots.length > 0))
	);
}

function isWriteCapablePermissionProfile(value: unknown): boolean {
	return value === "workspace_write" || value === "escalated";
}

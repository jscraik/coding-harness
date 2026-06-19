import { validateEvidenceReceipt } from "../evidence/evidence-receipt.js";
import {
	CODEX_RUNTIME_EVIDENCE_SCHEMA_VERSION,
	CODEX_RUNTIME_GOAL_STATES,
	CODEX_RUNTIME_MCP_SERVER_STATUSES,
	CODEX_RUNTIME_NETWORK_STATES,
	CODEX_RUNTIME_OPTIONAL_STATE_STATUSES,
	CODEX_RUNTIME_PERMISSION_PROFILES,
	CODEX_RUNTIME_STALE_STATE_CLASSIFICATIONS,
} from "./codex-runtime-evidence-types.js";
import { validateRuntimeEvidenceReferences } from "./codex-runtime-evidence-references.js";
import {
	validateEnvironment,
	validateSourceProvenance,
} from "./codex-runtime-evidence-validation-sections.js";
import {
	type AddFinding,
	asText,
	isBlank,
	isRecord,
	requireEnum,
	requireIsoTimestamp,
	requireNonEmptyString,
	requireNullableNonEmptyString,
	requireStringArray,
} from "./codex-runtime-evidence-validation-helpers.js";

/** Validation finding for codex-runtime-evidence/v1. */
export interface CodexRuntimeEvidenceFinding {
	/** Machine-stable finding code. */
	code: string;
	/** Field path that failed validation. */
	path: string;
	/** Human-readable validation message. */
	message: string;
}

/** Validation result for codex-runtime-evidence/v1. */
export interface CodexRuntimeEvidenceValidationResult {
	/** Whether the packet satisfies the contract. */
	valid: boolean;
	/** Contract findings emitted by the validator. */
	findings: CodexRuntimeEvidenceFinding[];
}

/** Validate a Codex runtime evidence packet before it can feed runtime-card projection. */
export function validateCodexRuntimeEvidence(
	packet: unknown,
): CodexRuntimeEvidenceValidationResult {
	const findings: CodexRuntimeEvidenceFinding[] = [];
	const add = (path: string, code: string, message: string): void => {
		findings.push({ path, code, message });
	};
	if (!isRecord(packet)) {
		return {
			valid: false,
			findings: [
				{
					path: "packet",
					code: "packet_invalid",
					message: "packet must be an object.",
				},
			],
		};
	}
	const candidate = packet;
	if (candidate.schemaVersion !== CODEX_RUNTIME_EVIDENCE_SCHEMA_VERSION) {
		add(
			"schemaVersion",
			"schema_version_invalid",
			"schemaVersion must be codex-runtime-evidence/v1.",
		);
	}
	requireIsoTimestamp(candidate.generatedAt, "generatedAt", add);
	validateSourceProvenance(candidate.sourceProvenance, add);
	validateIdentity(candidate.codex, add);
	validatePermissions(candidate.permissions, add);
	validateEnvironment(candidate.environment, candidate.permissions, add);
	validateMcp(candidate.mcp, add);
	validateReceipts(candidate.receipts, add);
	validateValidationResults(candidate.validationResults, add);
	validateOptionalState(candidate.externalState, "externalState", add);
	validateOptionalState(candidate.reviewState, "reviewState", add);
	validateStaleState(candidate.staleState, add);
	validateRuntimeEvidenceReferences(candidate, add);
	return { valid: findings.length === 0, findings };
}

function validateIdentity(value: unknown, add: AddFinding): void {
	if (!isRecord(value)) {
		add("codex", "codex_identity_invalid", "codex must be an object.");
		return;
	}
	requireNullableNonEmptyString(value.threadId, "codex.threadId", add);
	requireNonEmptyString(value.turnId, "codex.turnId", add);
	const clientUserMessageId = value.clientUserMessageId ?? null;
	requireNullableNonEmptyString(
		clientUserMessageId,
		"codex.clientUserMessageId",
		add,
	);
	requireNullableNonEmptyString(value.traceId, "codex.traceId", add);
	requireNullableNonEmptyString(
		value.traceFailureClass,
		"codex.traceFailureClass",
		add,
	);
	if (value.traceId === null && isBlank(asText(value.traceFailureClass))) {
		add(
			"codex.traceFailureClass",
			"trace_failure_class_missing",
			"traceFailureClass is required when traceId is null.",
		);
	}
	requireEnum(
		value.goalState,
		CODEX_RUNTIME_GOAL_STATES,
		"codex.goalState",
		add,
	);
	if (value.model !== undefined) {
		requireNullableNonEmptyString(value.model, "codex.model", add);
	}
}

function validatePermissions(value: unknown, add: AddFinding): void {
	if (!isRecord(value)) {
		add("permissions", "permissions_invalid", "permissions must be an object.");
		return;
	}
	requireEnum(
		value.profile,
		CODEX_RUNTIME_PERMISSION_PROFILES,
		"permissions.profile",
		add,
	);
	requireStringArray(value.writableRoots, "permissions.writableRoots", add);
	requireEnum(
		value.network,
		CODEX_RUNTIME_NETWORK_STATES,
		"permissions.network",
		add,
	);
	requireNullableNonEmptyString(
		value.evidenceRef,
		"permissions.evidenceRef",
		add,
	);
	requireNullableNonEmptyString(
		value.failureClass,
		"permissions.failureClass",
		add,
	);
	if (
		(value.profile === "unknown" || value.network === "unknown") &&
		isBlank(asText(value.failureClass))
	) {
		add(
			"permissions.failureClass",
			"permission_failure_class_missing",
			"failureClass is required when permission or network state is unknown.",
		);
	}
}

function validateMcp(value: unknown, add: AddFinding): void {
	if (!isRecord(value)) {
		add("mcp", "mcp_invalid", "mcp must be an object.");
		return;
	}
	if (!Array.isArray(value.servers)) {
		add("mcp.servers", "mcp_servers_invalid", "mcp.servers must be an array.");
		return;
	}
	for (const [index, server] of value.servers.entries()) {
		const path = `mcp.servers[${index}]`;
		if (!isRecord(server)) {
			add(path, "mcp_server_invalid", "mcp server entries must be objects.");
			continue;
		}
		requireNonEmptyString(server.name, `${path}.name`, add);
		requireEnum(
			server.status,
			CODEX_RUNTIME_MCP_SERVER_STATUSES,
			`${path}.status`,
			add,
		);
		requireNullableNonEmptyString(
			server.failureClass,
			`${path}.failureClass`,
			add,
		);
		if (server.status !== "available" && isBlank(asText(server.failureClass))) {
			add(
				`${path}.failureClass`,
				"mcp_failure_class_missing",
				"failureClass is required when an MCP server is unavailable or unknown.",
			);
		}
	}
}

function validateReceipts(value: unknown, add: AddFinding): void {
	if (!Array.isArray(value)) {
		add("receipts", "receipts_invalid", "receipts must be an array.");
		return;
	}
	for (const [index, receipt] of value.entries()) {
		const result = validateEvidenceReceipt(receipt);
		for (const error of result.errors) {
			add(`receipts[${index}].${error.path}`, "receipt_invalid", error.code);
		}
	}
}

function validateValidationResults(value: unknown, add: AddFinding): void {
	if (!Array.isArray(value)) {
		add(
			"validationResults",
			"validation_results_invalid",
			"validationResults must be an array.",
		);
		return;
	}
	for (const [index, result] of value.entries()) {
		const path = `validationResults[${index}]`;
		if (!isRecord(result)) {
			add(
				path,
				"validation_result_invalid",
				"validation result entries must be objects.",
			);
			continue;
		}
		requireNonEmptyString(result.name, `${path}.name`, add);
		requireEnum(
			result.status,
			["pass", "fail", "blocked", "unknown", "not_applicable"],
			`${path}.status`,
			add,
		);
		requireNullableNonEmptyString(
			result.evidenceRef,
			`${path}.evidenceRef`,
			add,
		);
		requireNullableNonEmptyString(result.verifiedAt, `${path}.verifiedAt`, add);
		if (typeof result.verifiedAt === "string") {
			requireIsoTimestamp(result.verifiedAt, `${path}.verifiedAt`, add);
		}
	}
}

function validateOptionalState(
	value: unknown,
	path: string,
	add: AddFinding,
): void {
	if (value === undefined) return;
	if (!isRecord(value)) {
		add(path, "optional_state_invalid", `${path} must be an object.`);
		return;
	}
	requireEnum(
		value.status,
		CODEX_RUNTIME_OPTIONAL_STATE_STATUSES,
		`${path}.status`,
		add,
	);
	requireNullableNonEmptyString(value.evidenceRef, `${path}.evidenceRef`, add);
	requireNullableNonEmptyString(
		value.failureClass,
		`${path}.failureClass`,
		add,
	);
	if (value.status === "provided" && isBlank(asText(value.evidenceRef))) {
		add(
			`${path}.evidenceRef`,
			"optional_state_evidence_missing",
			"evidenceRef is required when optional state is provided.",
		);
	}
	if (value.status === "unknown" && isBlank(asText(value.failureClass))) {
		add(
			`${path}.failureClass`,
			"optional_state_failure_class_missing",
			"failureClass is required when optional state is unknown.",
		);
	}
}

function validateStaleState(value: unknown, add: AddFinding): void {
	if (!Array.isArray(value)) {
		add("staleState", "stale_state_invalid", "staleState must be an array.");
		return;
	}
	for (const [index, state] of value.entries()) {
		const path = `staleState[${index}]`;
		if (!isRecord(state)) {
			add(
				path,
				"stale_state_entry_invalid",
				"staleState entries must be objects.",
			);
			continue;
		}
		requireNonEmptyString(state.subject, `${path}.subject`, add);
		requireEnum(
			state.classification,
			CODEX_RUNTIME_STALE_STATE_CLASSIFICATIONS,
			`${path}.classification`,
			add,
		);
		requireNullableNonEmptyString(state.reason, `${path}.reason`, add);
		requireNullableNonEmptyString(
			state.evidenceRef,
			`${path}.evidenceRef`,
			add,
		);
	}
}

import type { EvidenceReceipt } from "../evidence/evidence-receipt.js";
import {
	CODEX_RUNTIME_EVIDENCE_SCHEMA_VERSION,
	type CodexRuntimeEvidence,
	type CodexRuntimeGoalState,
	type CodexRuntimeMcpServerSnapshot,
	type CodexRuntimeNetworkState,
	type CodexRuntimeOptionalState,
	type CodexRuntimePermissionProfile,
	type CodexRuntimeSourceProvenance,
	type CodexRuntimeStaleState,
	type CodexRuntimeValidationResult,
} from "./codex-runtime-evidence-types.js";
import {
	type CodexRuntimeEvidenceFinding,
	validateCodexRuntimeEvidence,
} from "./codex-runtime-evidence-validation.js";
import {
	type CodexRuntimeObservedSourceSnapshot,
	type CodexRuntimeSourceSnapshot,
	type CodexRuntimeSourceSnapshotFinding,
	validateCodexRuntimeSourceSnapshot,
} from "./codex-runtime-source-provenance.js";

/** Producer-owned finding emitted before codex-runtime-evidence packet admission. */
export type CodexRuntimeEvidenceProducerFinding =
	| CodexRuntimeEvidenceFinding
	| CodexRuntimeSourceSnapshotFinding;

/** Error thrown when a produced Codex runtime evidence packet is not admissible. */
export class CodexRuntimeEvidenceProducerError extends Error {
	/** Contract findings emitted by codex-runtime-evidence validation. */
	readonly findings: CodexRuntimeEvidenceProducerFinding[];

	constructor(findings: CodexRuntimeEvidenceProducerFinding[]) {
		super(
			"produced codex runtime evidence failed validation: " +
				findings.map((finding) => finding.code).join("; "),
		);
		this.name = "CodexRuntimeEvidenceProducerError";
		this.findings = findings;
	}
}

/** Explicit Codex identity facts available to the Harness-owned producer. */
export interface CodexRuntimeEvidenceProducerIdentityInput {
	/** Codex thread identifier, when visible to the producer. */
	threadId?: string | null;
	/** Codex turn identifier. This is required because claim support is turn-scoped. */
	turnId: string;
	/** Client user-message identifier, when visible to the producer. */
	clientUserMessageId?: string | null;
	/** Trace identifier, when visible to the producer. */
	traceId?: string | null;
	/** Required blocker class when traceId is unavailable. */
	traceFailureClass?: string | null;
	/** Goal state visible to the producer. Defaults to unknown. */
	goalState?: CodexRuntimeGoalState;
	/** Model identifier, when visible to the producer. */
	model?: string | null;
}

/** Permission facts available to the Harness-owned producer. */
export interface CodexRuntimeEvidenceProducerPermissionInput {
	/** Explicit permission profile, or unknown with failureClass. */
	profile?: CodexRuntimePermissionProfile;
	/** Writable roots visible to the producer. */
	writableRoots?: string[];
	/** Network state, or unknown with failureClass. */
	network?: CodexRuntimeNetworkState;
	/** Evidence receipt ref that supports the permission facts. */
	evidenceRef?: string | null;
	/** Required when profile or network is unknown. */
	failureClass?: string | null;
}

/** Input for building a validated codex-runtime-evidence/v1 packet. */
export interface CodexRuntimeEvidenceProducerInput {
	/** Packet generation timestamp. */
	generatedAt: string;
	/** Source provenance for the producer input. */
	sourceProvenance: CodexRuntimeSourceProvenance;
	/** Pinned and observed Codex source state that proves provenance freshness. */
	sourceSnapshot: {
		/** Source evidence captured during intent review. */
		expected: CodexRuntimeSourceSnapshot;
		/** Source evidence observed immediately before packet production. */
		observed: CodexRuntimeObservedSourceSnapshot;
	};
	/** Codex identity facts. */
	codex: CodexRuntimeEvidenceProducerIdentityInput;
	/** Permission facts, defaulting to explicit unknown classifications. */
	permissions?: CodexRuntimeEvidenceProducerPermissionInput;
	/** MCP servers visible to the producer. */
	mcpServers?: CodexRuntimeMcpServerSnapshot[];
	/** Shared evidence receipts referenced by the packet. */
	receipts?: EvidenceReceipt[];
	/** Validation summaries carried by the packet. */
	validationResults?: CodexRuntimeValidationResult[];
	/** Optional external-state pointer. */
	externalState?: CodexRuntimeOptionalState;
	/** Optional review-state pointer. */
	reviewState?: CodexRuntimeOptionalState;
	/** Stale-state classifications for claim-relevant inputs. */
	staleState?: CodexRuntimeStaleState[];
}

/** Admit an already-built Codex runtime evidence packet through the producer boundary. */
export function admitCodexRuntimeEvidencePacket(
	packet: CodexRuntimeEvidence,
): CodexRuntimeEvidence {
	const validation = validateCodexRuntimeEvidence(packet);
	if (!validation.valid) {
		throw new CodexRuntimeEvidenceProducerError(validation.findings);
	}
	return packet;
}

/** Build and validate a codex-runtime-evidence/v1 packet from explicit wrapper/import facts. */
export function buildCodexRuntimeEvidenceFromProducerInput(
	input: CodexRuntimeEvidenceProducerInput,
): CodexRuntimeEvidence {
	const sourceValidation = validateCodexRuntimeSourceSnapshot(
		input.sourceSnapshot.expected,
		input.sourceSnapshot.observed,
	);
	if (!sourceValidation.valid) {
		throw new CodexRuntimeEvidenceProducerError(sourceValidation.findings);
	}
	return admitCodexRuntimeEvidencePacket({
		schemaVersion: CODEX_RUNTIME_EVIDENCE_SCHEMA_VERSION,
		generatedAt: input.generatedAt,
		sourceProvenance: input.sourceProvenance,
		codex: {
			threadId: input.codex.threadId ?? null,
			turnId: input.codex.turnId,
			clientUserMessageId: input.codex.clientUserMessageId ?? null,
			traceId: input.codex.traceId ?? null,
			traceFailureClass:
				input.codex.traceId === undefined || input.codex.traceId === null
					? (input.codex.traceFailureClass ??
						"producer_input_missing_trace_context")
					: (input.codex.traceFailureClass ?? null),
			goalState: input.codex.goalState ?? "unknown",
			model: input.codex.model ?? null,
		},
		permissions: normalizePermissions(input.permissions),
		mcp: {
			servers: input.mcpServers ?? [],
		},
		receipts: input.receipts ?? [],
		validationResults: input.validationResults ?? [],
		externalState:
			input.externalState ??
			unknownOptionalState("producer_input_missing_external_state"),
		reviewState:
			input.reviewState ??
			unknownOptionalState("producer_input_missing_review_state"),
		staleState: input.staleState ?? [],
	});
}

function normalizePermissions(
	input: CodexRuntimeEvidenceProducerPermissionInput | undefined,
): CodexRuntimeEvidence["permissions"] {
	const requestedProfile = input?.profile ?? "unknown";
	const writableRoots = input?.writableRoots ?? [];
	const missingWritableRootEvidence =
		isWriteCapableProfile(requestedProfile) && writableRoots.length === 0;
	const profile = missingWritableRootEvidence ? "unknown" : requestedProfile;
	const network = input?.network ?? "unknown";

	let failureClass: string | null;
	if (profile === "unknown" || network === "unknown") {
		if (input?.failureClass !== undefined) {
			failureClass = input.failureClass;
		} else if (missingWritableRootEvidence) {
			failureClass = "producer_input_missing_writable_roots";
		} else if (profile === "unknown") {
			failureClass = "producer_input_missing_permission_profile";
		} else {
			// network === "unknown" and profile is known
			failureClass = "producer_input_missing_network";
		}
	} else {
		failureClass = input?.failureClass ?? null;
	}

	return {
		profile,
		writableRoots,
		network,
		evidenceRef: input?.evidenceRef ?? null,
		failureClass,
	};
}

function isWriteCapableProfile(
	profile: CodexRuntimePermissionProfile,
): boolean {
	return profile === "workspace_write" || profile === "escalated";
}

function unknownOptionalState(failureClass: string): CodexRuntimeOptionalState {
	return {
		status: "unknown",
		evidenceRef: null,
		failureClass,
	};
}

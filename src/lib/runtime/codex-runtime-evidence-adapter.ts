import type {
	EvidenceReceipt,
	EvidenceReceiptFreshness,
	EvidenceReceiptKind,
	EvidenceReceiptStatus,
} from "../evidence/evidence-receipt.js";
import type {
	CodexRuntimeEvidence,
	CodexRuntimeMcpServerSnapshot,
	CodexRuntimeOptionalState,
	CodexRuntimeStaleState,
	CodexRuntimeValidationResult,
} from "./codex-runtime-evidence-types.js";
import { validateCodexRuntimeEvidence } from "./codex-runtime-evidence-validation.js";
import {
	RUNTIME_EVIDENCE_BUNDLE_SCHEMA_VERSION,
	type RuntimeEvidenceBundle,
} from "./runtime-evidence-bundle.js";
import type {
	RuntimeCardFreshness,
	RuntimeCardSource,
	RuntimeCardSourceKind,
	RuntimeCardSourceStatus,
} from "./runtime-card.js";
import { mergeRuntimeCardSources } from "./runtime-evidence-adapter.js";

/** Options for normalizing a Codex runtime evidence packet into runtime-evidence-bundle/v1. */
export interface CodexRuntimeEvidenceBundleAdapterOptions {
	/** Optional tracker key supplied by a higher-level caller. */
	issueKey?: string | null;
	/** Stable artifact or packet ref for the Codex evidence packet. */
	provenanceRef?: string;
}

/** Normalize a validated Codex runtime packet into the existing runtime evidence bundle module. */
export function adaptCodexRuntimeEvidenceToRuntimeEvidenceBundle(
	packet: CodexRuntimeEvidence,
	options: CodexRuntimeEvidenceBundleAdapterOptions = {},
): RuntimeEvidenceBundle {
	const validation = validateCodexRuntimeEvidence(packet);
	if (!validation.valid) {
		throw new Error(
			"codex runtime evidence failed validation: " +
				validation.findings.map((finding) => finding.code).join("; "),
		);
	}

	const provenanceRef = normalizeProvenanceRef(
		options.provenanceRef,
		packet.codex.turnId,
	);
	const sources = mergeRuntimeCardSources([
		toSourceProvenanceSource(packet),
		toPermissionSource(packet),
		...packet.mcp.servers.map(toMcpSource),
		...packet.receipts.map(toReceiptSource),
		...packet.validationResults.map(toValidationResultSource),
		...optionalStateSources(packet),
		...packet.staleState.map(toStaleStateSource),
	]);

	return {
		schemaVersion: RUNTIME_EVIDENCE_BUNDLE_SCHEMA_VERSION,
		generatedAt: packet.generatedAt,
		issueKey: options.issueKey ?? null,
		provenance: {
			kind: "codex_runtime",
			ref: provenanceRef,
			collectedAt: packet.sourceProvenance.capturedAt,
		},
		sources,
		blockers: buildBlockers(packet),
	};
}

function toSourceProvenanceSource(
	packet: CodexRuntimeEvidence,
): RuntimeCardSource {
	const source = packet.sourceProvenance;
	const commitRef = source.commitSha ?? source.dirtyState;
	return {
		kind: "artifact",
		ref:
			"codex-source://" +
			source.sourceKind +
			"/" +
			source.codexRepoPath +
			"@" +
			commitRef,
		freshness: sourceProvenanceFreshness(source.dirtyState),
		status: sourceProvenanceStatus(source.dirtyState),
		failureClass: sourceProvenanceFailureClass(source.dirtyState),
	};
}

function toPermissionSource(packet: CodexRuntimeEvidence): RuntimeCardSource {
	const incomplete =
		packet.permissions.profile === "unknown" ||
		packet.permissions.network === "unknown";
	return {
		kind: "session",
		ref:
			packet.permissions.evidenceRef ??
			`codex-runtime://${packet.codex.turnId}/permissions`,
		freshness: incomplete ? "unknown" : "current",
		status: incomplete ? "blocked" : "usable",
		failureClass: packet.permissions.failureClass,
	};
}

function toMcpSource(server: CodexRuntimeMcpServerSnapshot): RuntimeCardSource {
	return {
		kind: "session",
		ref: `codex-mcp://${server.name}`,
		freshness: server.status === "available" ? "current" : "unknown",
		status: server.status === "available" ? "usable" : "blocked",
		failureClass: server.failureClass,
	};
}

function toReceiptSource(receipt: EvidenceReceipt): RuntimeCardSource {
	return {
		kind: receiptKindToSourceKind(receipt.kind),
		ref: receipt.ref,
		freshness: receiptFreshnessToRuntimeFreshness(receipt.freshness),
		status: receiptStatusToSourceStatus(receipt.status),
		failureClass:
			receipt.blockerClass ?? receiptStatusFailureClass(receipt.status),
	};
}

function toValidationResultSource(
	result: CodexRuntimeValidationResult,
): RuntimeCardSource {
	return {
		kind: "validation",
		ref: result.evidenceRef ?? `codex-validation://${slugify(result.name)}`,
		freshness: result.verifiedAt ? "current" : "unknown",
		status: receiptStatusToSourceStatus(result.status),
		failureClass: receiptStatusFailureClass(result.status),
	};
}

function optionalStateSources(
	packet: CodexRuntimeEvidence,
): RuntimeCardSource[] {
	return [
		optionalStateSource("external_state", packet.externalState),
		optionalStateSource("review_state", packet.reviewState),
	].filter((source): source is RuntimeCardSource => source !== null);
}

function optionalStateSource(
	subject: "external_state" | "review_state",
	state: CodexRuntimeOptionalState | undefined,
): RuntimeCardSource | null {
	if (!state) return null;
	return {
		kind: subject === "review_state" ? "review" : "artifact",
		ref: state.evidenceRef ?? `codex-${subject}://unknown`,
		freshness: state.status === "provided" ? "current" : "unknown",
		status: state.status === "provided" ? "usable" : "blocked",
		failureClass: state.failureClass,
	};
}

function toStaleStateSource(state: CodexRuntimeStaleState): RuntimeCardSource {
	return {
		kind: "artifact",
		ref: state.evidenceRef ?? `codex-stale-state://${slugify(state.subject)}`,
		freshness: staleStateToFreshness(state.classification),
		status: state.classification === "current" ? "usable" : "blocked",
		failureClass:
			state.classification === "current"
				? null
				: `stale_state_${state.classification}`,
	};
}

function receiptKindToSourceKind(
	kind: EvidenceReceiptKind,
): RuntimeCardSourceKind {
	if (kind === "validation") return "validation";
	if (kind === "review_artifact") return "review";
	if (kind === "run_record") return "session";
	return "artifact";
}

function receiptFreshnessToRuntimeFreshness(
	freshness: EvidenceReceiptFreshness,
): RuntimeCardFreshness {
	if (freshness === "not_applicable") return "unknown";
	return freshness;
}

function staleStateToFreshness(
	classification: CodexRuntimeStaleState["classification"],
): RuntimeCardFreshness {
	return classification;
}

function receiptStatusToSourceStatus(
	status: EvidenceReceiptStatus,
): RuntimeCardSourceStatus {
	if (status === "pass") return "usable";
	if (status === "not_applicable") return "empty";
	if (status === "fail") return "invalid";
	return "blocked";
}

function receiptStatusFailureClass(
	status: EvidenceReceiptStatus,
): string | null {
	if (status === "pass" || status === "not_applicable") return null;
	return `evidence_${status}`;
}

function buildBlockers(packet: CodexRuntimeEvidence): string[] {
	return [
		...sourceProvenanceBlockers(packet),
		...identityBlockers(packet),
		...permissionBlockers(packet),
		...mcpBlockers(packet),
		...validationResultBlockers(packet),
		...receiptBlockers(packet),
		...optionalStateBlockers(packet),
		...staleStateBlockers(packet),
	];
}

function sourceProvenanceBlockers(packet: CodexRuntimeEvidence): string[] {
	if (packet.sourceProvenance.dirtyState !== "clean") {
		return [
			"Codex source provenance is " +
				packet.sourceProvenance.dirtyState +
				": " +
				(sourceProvenanceFailureClass(packet.sourceProvenance.dirtyState) ??
					"unknown") +
				".",
		];
	}
	return [];
}

function identityBlockers(packet: CodexRuntimeEvidence): string[] {
	if (packet.codex.traceId === null) {
		return [
			"Codex trace unavailable: " +
				(packet.codex.traceFailureClass ?? "unknown") +
				".",
		];
	}
	return [];
}

function permissionBlockers(packet: CodexRuntimeEvidence): string[] {
	if (
		packet.permissions.profile === "unknown" ||
		packet.permissions.network === "unknown"
	) {
		return [
			"Codex permission profile incomplete: " +
				(packet.permissions.failureClass ?? "unknown") +
				".",
		];
	}
	return [];
}

function mcpBlockers(packet: CodexRuntimeEvidence): string[] {
	return packet.mcp.servers
		.filter((server) => server.status !== "available")
		.map(
			(server) =>
				"Codex MCP server " +
				server.name +
				" is " +
				server.status +
				": " +
				(server.failureClass ?? "unknown") +
				".",
		);
}

function validationResultBlockers(packet: CodexRuntimeEvidence): string[] {
	return packet.validationResults
		.filter(
			(result) =>
				result.status !== "pass" && result.status !== "not_applicable",
		)
		.map(
			(result) =>
				"Codex validation " +
				result.name +
				" is " +
				result.status +
				"; evidence " +
				(result.evidenceRef ?? "missing") +
				".",
		);
}

function receiptBlockers(packet: CodexRuntimeEvidence): string[] {
	return packet.receipts
		.filter(
			(receipt) =>
				receipt.status !== "pass" && receipt.status !== "not_applicable",
		)
		.map(
			(receipt) =>
				"Evidence receipt " +
				receipt.ref +
				" is " +
				receipt.status +
				": " +
				(receipt.blockerClass ?? "unknown") +
				".",
		);
}

function staleStateBlockers(packet: CodexRuntimeEvidence): string[] {
	return packet.staleState
		.filter((state) => state.classification !== "current")
		.map(
			(state) =>
				state.subject +
				" is " +
				state.classification +
				": " +
				(state.reason ?? "no reason supplied") +
				".",
		);
}

function optionalStateBlockers(packet: CodexRuntimeEvidence): string[] {
	const blockers: string[] = [];
	if (packet.externalState?.status === "unknown") {
		blockers.push(
			"External state unavailable: " +
				(packet.externalState.failureClass ?? "unknown") +
				".",
		);
	}
	if (packet.reviewState?.status === "unknown") {
		blockers.push(
			"Review state unavailable: " +
				(packet.reviewState.failureClass ?? "unknown") +
				".",
		);
	}
	return blockers;
}

function slugify(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9._-]+/gu, "-")
		.replace(/^-+|-+$/gu, "");
}

function normalizeProvenanceRef(
	value: string | undefined,
	turnId: string,
): string {
	if (value?.trim()) return value;
	return `codex-runtime://${turnId}`;
}

function sourceProvenanceFreshness(
	dirtyState: CodexRuntimeEvidence["sourceProvenance"]["dirtyState"],
): RuntimeCardFreshness {
	if (dirtyState === "clean") return "current";
	if (dirtyState === "dirty") return "stale";
	return "unknown";
}

function sourceProvenanceStatus(
	dirtyState: CodexRuntimeEvidence["sourceProvenance"]["dirtyState"],
): RuntimeCardSourceStatus {
	if (dirtyState === "clean") return "usable";
	if (dirtyState === "dirty") return "invalid";
	return "blocked";
}

function sourceProvenanceFailureClass(
	dirtyState: CodexRuntimeEvidence["sourceProvenance"]["dirtyState"],
): string | null {
	if (dirtyState === "clean") return null;
	if (dirtyState === "dirty") return "codex_source_dirty";
	return "codex_source_cleanliness_unknown";
}

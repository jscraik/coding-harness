import type { HePhaseExit } from "../decision/he-phase-exit.js";
import {
	asRuntimeEvidenceBundle,
	type RuntimeEvidenceBundle,
} from "./runtime-evidence-bundle.js";
import type {
	RuntimeCard,
	RuntimeCardCodexRuntimeProjection,
	RuntimeCardFreshness,
	RuntimeCardPhaseExitState,
	RuntimeCardSource,
	RuntimeCardSourceStatus,
} from "./runtime-card.js";

/** Function that collapses HePhaseExit/v1 into runtime-card phase-exit state. */
export type RuntimeEvidencePhaseExitCollapser = (
	phaseExit: HePhaseExit,
) => RuntimeCardPhaseExitState;

/** Normalized runtime-card evidence extracted from runtime-evidence-bundle/v1. */
export interface RuntimeEvidenceBundleSnapshot {
	/** Tracker key supplied by the evidence source, when known. */
	issueKey: string | null;
	/** Optional PR state from the evidence bundle. */
	pullRequest?: RuntimeCard["pullRequest"];
	/** Optional tracker state from the evidence bundle. */
	linear?: RuntimeCard["linear"];
	/** Optional phase-exit state collapsed from the evidence bundle. */
	phaseExit?: {
		phaseExit: RuntimeCardPhaseExitState;
		source?: RuntimeCardSource;
		blockers: string[];
	};
	/** Normalized source records to merge into runtime-card/v1. */
	sources: RuntimeCardSource[];
	/** Compact Codex runtime projection when the evidence came from Codex runtime packets. */
	codexRuntime?: RuntimeCardCodexRuntimeProjection;
	/** Blocking conditions reported by the evidence producer. */
	blockers: string[];
}

/** Options for consuming normalized runtime evidence. */
export interface RuntimeEvidenceBundleInspectionOptions {
	/** Whether a phase-exit projection must be gate-backed to satisfy the consumer. */
	requireGateBackedPhaseExit?: boolean;
}

const SUMMARY_ONLY_REQUIRED_PHASE_EXIT_REASON =
	"Summary-only phase-exit evidence cannot satisfy required gate evidence.";

const SUMMARY_ONLY_REQUIRED_PHASE_EXIT_BLOCKER =
	"Gate-backed phase-exit evidence is required; summary-only runtime-card phase-exit context cannot satisfy required evidence.";

const SOURCE_STATUS_RISK: Record<RuntimeCardSourceStatus, number> = {
	usable: 0,
	empty: 1,
	invalid: 2,
	blocked: 3,
};

const SOURCE_FRESHNESS_RISK: Record<RuntimeCardFreshness, number> = {
	current: 0,
	unknown: 1,
	stale: 2,
	missing: 3,
};

function failureClassRisk(source: RuntimeCardSource): number {
	return source.failureClass ? 1 : 0;
}

function compareSourceRisk(
	left: RuntimeCardSource,
	right: RuntimeCardSource,
): number {
	const statusDifference =
		SOURCE_STATUS_RISK[left.status] - SOURCE_STATUS_RISK[right.status];
	if (statusDifference !== 0) return statusDifference;

	const freshnessDifference =
		SOURCE_FRESHNESS_RISK[left.freshness] -
		SOURCE_FRESHNESS_RISK[right.freshness];
	if (freshnessDifference !== 0) return freshnessDifference;

	return failureClassRisk(left) - failureClassRisk(right);
}

function sourceIdentity(source: RuntimeCardSource): string {
	return `${source.kind}\u0000${source.ref}`;
}

/** Merge duplicate runtime-card sources by identity while retaining the highest-risk evidence record. */
export function mergeRuntimeCardSources(
	sources: RuntimeCardSource[],
): RuntimeCardSource[] {
	const byIdentity = new Map<string, RuntimeCardSource>();
	for (const source of sources) {
		const key = sourceIdentity(source);
		const current = byIdentity.get(key);
		if (!current || compareSourceRisk(source, current) > 0) {
			byIdentity.set(key, source);
		}
	}
	return Array.from(byIdentity.values());
}

function provenanceSourceKind(
	kind: RuntimeEvidenceBundle["provenance"]["kind"],
): RuntimeCardSource["kind"] {
	if (kind === "ci") return "validation";
	if (kind === "session_collector" || kind === "codex_runtime")
		return "session";
	return "artifact";
}

function provenanceSource(bundle: RuntimeEvidenceBundle): RuntimeCardSource {
	return {
		kind: provenanceSourceKind(bundle.provenance.kind),
		ref: bundle.provenance.ref,
		freshness: "current",
		status: "usable",
		failureClass: null,
	};
}

function buildRuntimeEvidenceSources(
	bundle: RuntimeEvidenceBundle,
): RuntimeCardSource[] {
	return mergeRuntimeCardSources([provenanceSource(bundle), ...bundle.sources]);
}

function uniqueRefs(sources: RuntimeCardSource[]): string[] {
	return [...new Set(sources.map((source) => source.ref))];
}

function uniqueBlockedRefs(sources: RuntimeCardSource[]): Set<string> {
	return new Set(
		sources
			.filter((source) => source.status !== "usable")
			.map((source) => source.ref),
	);
}

function buildCodexRuntimeProjection(
	bundle: RuntimeEvidenceBundle,
): RuntimeCardCodexRuntimeProjection | undefined {
	if (bundle.provenance.kind !== "codex_runtime") return undefined;
	const codexSources = mergeRuntimeCardSources(bundle.sources);
	const receiptRefs = uniqueRefs(codexSources);
	const blockedRefs = uniqueBlockedRefs(codexSources);
	return {
		provenanceRef: bundle.provenance.ref,
		collectedAt: bundle.provenance.collectedAt,
		sourceCount: receiptRefs.length,
		blockedSourceCount: receiptRefs.filter((ref) => blockedRefs.has(ref))
			.length,
		blockerCount: bundle.blockers.length,
		receiptRefs,
		validationRefs: uniqueRefs(
			bundle.sources.filter((source) => source.kind === "validation"),
		),
		reviewRefs: uniqueRefs(
			bundle.sources.filter((source) => source.kind === "review"),
		),
		sessionRefs: uniqueRefs(
			bundle.sources.filter((source) => source.kind === "session"),
		),
		environmentRefs: uniqueRefs(
			bundle.sources.filter(
				(source) =>
					// Match session sources that are explicitly environment-related:
					// 1. Exact match for sandbox policy refs (e.g., "artifact://sandbox-policy.json")
					// 2. Codex runtime environment refs (e.g., "codex-runtime://turn-123/environment")
					// 3. Legacy: substring check for "/environment" or "sandbox-policy" for backward compatibility
					(source.kind === "session" &&
						(source.ref.endsWith("/environment") ||
							source.ref.includes("sandbox-policy"))) ||
					(source.kind === "artifact" && source.ref.includes("sandbox-policy")),
			),
		),
		staleStateRefs: uniqueRefs(
			bundle.sources.filter(
				(source) =>
					source.ref.startsWith("codex-stale-state://") ||
					source.freshness === "stale",
			),
		),
		...(bundle.continuity ? { continuity: bundle.continuity } : {}),
		...(bundle.toolExposure ? { toolExposure: bundle.toolExposure } : {}),
	};
}

/**
 * Produce a normalized snapshot of a runtime evidence bundle for runtime-card generation.
 *
 * When `value` is `undefined`, returns a snapshot with `issueKey` set to `null` and empty
 * `sources` and `blockers`.
 *
 * @param value - The runtime evidence bundle (or unknown) to inspect; expected to conform to the normalized runtime-evidence-bundle/v1 shape.
 * @param collapsePhaseExit - Function that converts a bundle `phaseExit` into a `RuntimeCardPhaseExitState`; invoked only if the bundle contains `phaseExit`.
 * @returns A `RuntimeEvidenceBundleSnapshot` containing issue key, optional PR/tracker/phase-exit state, normalized sources, and blockers.
 */
export function inspectRuntimeEvidenceBundle(
	value: RuntimeEvidenceBundle | unknown | undefined,
	collapsePhaseExit: RuntimeEvidencePhaseExitCollapser,
	options: RuntimeEvidenceBundleInspectionOptions = {},
): RuntimeEvidenceBundleSnapshot {
	if (value === undefined) {
		return {
			issueKey: null,
			sources: [],
			blockers: [],
		};
	}
	const bundle = asRuntimeEvidenceBundle(value);
	const sources = buildRuntimeEvidenceSources(bundle);
	const rejectSummaryOnlyRequiredPhaseExit =
		options.requireGateBackedPhaseExit === true &&
		bundle.phaseExitSourceCompleteness === "summary_only";
	const phaseExit =
		bundle.phaseExit && !rejectSummaryOnlyRequiredPhaseExit
			? collapsePhaseExit(bundle.phaseExit)
			: undefined;
	const rejectedSummaryOnlyPhaseExit =
		bundle.phaseExit && rejectSummaryOnlyRequiredPhaseExit;
	const codexRuntime = buildCodexRuntimeProjection(bundle);
	return {
		issueKey: bundle.issueKey,
		...(bundle.pullRequest ? { pullRequest: bundle.pullRequest } : {}),
		...(bundle.linear ? { linear: bundle.linear } : {}),
		...(rejectedSummaryOnlyPhaseExit
			? {
					phaseExit: {
						phaseExit: {
							status: "blocked" as const,
							reason: SUMMARY_ONLY_REQUIRED_PHASE_EXIT_REASON,
						},
						source: {
							kind: "phase_exit" as const,
							ref: `${bundle.provenance.ref}#phaseExit`,
							freshness: "current" as const,
							status: "blocked" as const,
							failureClass: "phase_exit_summary_only",
						},
						blockers: [SUMMARY_ONLY_REQUIRED_PHASE_EXIT_BLOCKER],
					},
				}
			: {}),
		...(phaseExit
			? {
					phaseExit: {
						phaseExit,
						source: {
							kind: "phase_exit",
							ref: `${bundle.provenance.ref}#phaseExit`,
							freshness: "current",
							status: phaseExit.status === "pass" ? "usable" : "blocked",
							failureClass:
								phaseExit.status === "pass" ? null : "phase_exit_blocks",
						},
						blockers:
							phaseExit.status === "pass"
								? []
								: [
										phaseExit.reason ??
											"Runtime evidence bundle phase-exit blocks continuation.",
									],
					},
				}
			: {}),
		sources,
		...(codexRuntime ? { codexRuntime } : {}),
		blockers: [...bundle.blockers],
	};
}

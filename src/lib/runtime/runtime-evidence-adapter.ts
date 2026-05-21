import type { HePhaseExit } from "../decision/he-phase-exit.js";
import {
	asRuntimeEvidenceBundle,
	type RuntimeEvidenceBundle,
} from "./runtime-evidence-bundle.js";
import type {
	RuntimeCard,
	RuntimeCardPhaseExitState,
	RuntimeCardSource,
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

/**
 * Deduplicates runtime card sources by their `kind` and `ref`, preserving the first occurrence of each.
 *
 * @param sources - The list of runtime card sources to filter
 * @returns An array containing the first occurrence of each unique source where uniqueness is determined by `source.kind` and `source.ref`
 */
function uniqueSources(sources: RuntimeCardSource[]): RuntimeCardSource[] {
	const seen = new Set<string>();
	return sources.filter((source) => {
		const key = `${source.kind}\u0000${source.ref}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

function provenanceSourceKind(
	kind: RuntimeEvidenceBundle["provenance"]["kind"],
): RuntimeCardSource["kind"] {
	if (kind === "ci") return "validation";
	if (kind === "session_collector") return "session";
	return "artifact";
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
	const sources = uniqueSources([
		{
			kind: provenanceSourceKind(bundle.provenance.kind),
			ref: bundle.provenance.ref,
			freshness: "current",
			status: "usable",
			failureClass: null,
		},
		...bundle.sources,
	]);
	const rejectSummaryOnlyRequiredPhaseExit =
		options.requireGateBackedPhaseExit === true &&
		bundle.phaseExitSourceCompleteness === "summary_only";
	const phaseExit =
		bundle.phaseExit && !rejectSummaryOnlyRequiredPhaseExit
			? collapsePhaseExit(bundle.phaseExit)
			: undefined;
	const rejectedSummaryOnlyPhaseExit =
		bundle.phaseExit && rejectSummaryOnlyRequiredPhaseExit;
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
		blockers: [...bundle.blockers],
	};
}

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

/**
 * Produce a normalized snapshot of a runtime evidence bundle for runtime-card generation.
 *
 * When `value` is `undefined`, returns a snapshot with `issueKey` set to `null` and empty
 * `sources` and `blockers`.
 *
 * @param value - The runtime evidence bundle (or unknown) to inspect; expected to conform to the normalized runtime-evidence-bundle/v1 shape.
 * @param collapsePhaseExit - Function that converts a bundle `phaseExit` into a `RuntimeCardPhaseExitState`; invoked only if the bundle contains `phaseExit`.
 * @returns A `RuntimeEvidenceBundleSnapshot` containing:
 *  - `issueKey` copied from the bundle (or `null` when `value` is `undefined`),
 *  - optional `pullRequest` and `linear` when present on the bundle,
 *  - optional `phaseExit` (with the collapsed `phaseExit` state, a generated `phase_exit` source whose `status` and `failureClass` reflect the phase result, and `blockers` derived from the phase result),
 *  - `sources` composed of a synthetic `session` source prepended to the bundle sources and deduplicated,
 *  - `blockers` copied from the bundle.
 */
export function inspectRuntimeEvidenceBundle(
	value: RuntimeEvidenceBundle | unknown | undefined,
	collapsePhaseExit: RuntimeEvidencePhaseExitCollapser,
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
			kind: "session",
			ref: bundle.provenance.ref,
			freshness: "current",
			status: "usable",
			failureClass: null,
		},
		...bundle.sources,
	]);
	const phaseExit = bundle.phaseExit
		? collapsePhaseExit(bundle.phaseExit)
		: undefined;
	return {
		issueKey: bundle.issueKey,
		...(bundle.pullRequest ? { pullRequest: bundle.pullRequest } : {}),
		...(bundle.linear ? { linear: bundle.linear } : {}),
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

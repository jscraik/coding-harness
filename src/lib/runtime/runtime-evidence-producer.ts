import {
	RUNTIME_EVIDENCE_BUNDLE_SCHEMA_VERSION,
	asRuntimeEvidenceBundle,
	type RuntimeEvidenceBundle,
} from "./runtime-evidence-bundle.js";
import type { RuntimeCard, RuntimeCardSource } from "./runtime-card.js";

/** Inputs for producing a normalized runtime evidence bundle from runtime-card state. */
export interface RuntimeEvidenceBundleProducerOptions {
	/** Stable producer reference such as an artifact path or command invocation. */
	provenanceRef: string;
	/** Optional override for the bundle generation clock. */
	generatedAt?: string;
}

function hasKnownPullRequest(card: RuntimeCard): boolean {
	return (
		card.pullRequest.number !== null ||
		card.pullRequest.state !== null ||
		card.pullRequest.isDraft !== null ||
		card.pullRequest.mergeStateStatus !== null ||
		card.pullRequest.url !== null
	);
}

function hasKnownLinearState(card: RuntimeCard): boolean {
	return (
		card.linear.issueKey !== null ||
		card.linear.status !== null ||
		card.linear.statusType !== null ||
		card.linear.url !== null ||
		card.linear.actionRequired !== null
	);
}

function uniqueSources(sources: RuntimeCardSource[]): RuntimeCardSource[] {
	const seen = new Set<string>();
	return sources.filter((source) => {
		const key = `${source.kind}\u0000${source.ref}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

/** Produce a reusable runtime-evidence-bundle/v1 artifact from runtime-card/v1 state. */
export function buildRuntimeEvidenceBundleFromCard(
	card: RuntimeCard,
	options: RuntimeEvidenceBundleProducerOptions,
): RuntimeEvidenceBundle {
	const bundle = {
		schemaVersion: RUNTIME_EVIDENCE_BUNDLE_SCHEMA_VERSION,
		generatedAt: options.generatedAt ?? card.generatedAt,
		issueKey: card.issueKey,
		provenance: {
			kind: "runtime_card_adapter",
			ref: options.provenanceRef,
			collectedAt: card.generatedAt,
		},
		...(hasKnownPullRequest(card) ? { pullRequest: card.pullRequest } : {}),
		...(hasKnownLinearState(card) ? { linear: card.linear } : {}),
		sources: uniqueSources(card.sources),
		blockers: [...card.blockers],
	};
	return asRuntimeEvidenceBundle(bundle);
}

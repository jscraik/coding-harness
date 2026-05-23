import type { RuntimeCardArtifactSnapshot } from "./local-runtime-card-artifacts.js";
import { addRuntimeAttemptMetadata } from "./local-runtime-card-attempts.js";
import type { RuntimeCardPhaseExitSnapshot } from "./local-runtime-card-phase-exit.js";
import type { RuntimeCardLiveEvidence } from "./local-runtime-card-live.js";
import { issueKeysMatch } from "./issue-key.js";
import {
	mergeRuntimeCardSources,
	type RuntimeEvidenceBundleSnapshot,
} from "./runtime-evidence-adapter.js";
import {
	RUNTIME_CARD_SCHEMA_VERSION,
	type RuntimeCard,
	validateRuntimeCard,
} from "./runtime-card.js";

interface RuntimeCardGitSnapshot {
	branchName: string | null;
	clean: boolean | null;
	ref: string | null;
	source: RuntimeCard["sources"][number];
}

interface AssembleLocalRuntimeCardArgs {
	git: RuntimeCardGitSnapshot;
	artifacts: RuntimeCardArtifactSnapshot;
	phaseExit: RuntimeCardPhaseExitSnapshot;
	evidence: RuntimeEvidenceBundleSnapshot;
	issueKey: string | null;
	generatedAt: string;
	phaseExitPathSupplied: boolean;
}

function deriveLifecycle(args: {
	blockers: readonly string[];
	artifacts: RuntimeCard["artifacts"];
	phaseExit: RuntimeCard["phaseExit"];
}): RuntimeCard["lifecycle"] {
	if (args.blockers.length > 0) return "blocked";
	if (args.phaseExit.status === "pass") return "locally_validated";
	if (args.artifacts.status === "current") return "active";
	if (args.artifacts.status === "stale") return "stale";
	return "unknown";
}

function nextSafeAction(
	card: Pick<RuntimeCard, "blockers" | "phaseExit">,
): string {
	if (card.blockers.length > 0) return card.blockers[0] ?? "Resolve blockers.";
	if (card.phaseExit.status === "not_run") {
		return "Run focused validation and supply a HePhaseExit/v1 artifact before closeout.";
	}
	return "Run harness next --json --runtime-card <runtime-card.json>.";
}

function evidenceBlockers(
	evidence: RuntimeEvidenceBundleSnapshot,
	phaseExitPathSupplied: boolean,
): string[] {
	if (!phaseExitPathSupplied || evidence.phaseExit === undefined) {
		return evidence.blockers;
	}
	return evidence.blockers.filter(
		(blocker) => !evidence.phaseExit?.blockers.includes(blocker),
	);
}

function fallbackLinear(issueKey: string | null): RuntimeCard["linear"] {
	return {
		issueKey,
		freshness: issueKey ? "unknown" : "missing",
		status: null,
		statusType: null,
		url: null,
		actionRequired:
			"Live Linear state was not refreshed by local runtime-card generation.",
	};
}

function matchingLinearEvidence(
	linear: RuntimeEvidenceBundleSnapshot["linear"],
	issueKey: string | null,
): RuntimeCard["linear"] | null {
	if (!linear || !issueKeysMatch(linear.issueKey, issueKey)) return null;
	return linear;
}

function validatedRuntimeCard(card: RuntimeCard): RuntimeCard {
	const validation = validateRuntimeCard(card);
	if (!validation.valid) {
		throw new Error(
			"generated runtime card failed validation: " +
				validation.errors.map((error) => error.code).join("; "),
		);
	}
	return card;
}

/** Assemble and validate the runtime-card/v1 artifact from inspected local evidence. */
export function assembleLocalRuntimeCard(
	args: AssembleLocalRuntimeCardArgs,
): RuntimeCard {
	const blockers = [
		...args.artifacts.blockers,
		...args.phaseExit.blockers,
		...evidenceBlockers(args.evidence, args.phaseExitPathSupplied),
	];
	const sources = mergeRuntimeCardSources([
		args.git.source,
		args.artifacts.source,
		...(args.phaseExit.source ? [args.phaseExit.source] : []),
		...args.evidence.sources,
	]);
	const phaseExit = args.phaseExit.phaseExit;
	const card = {
		schemaVersion: RUNTIME_CARD_SCHEMA_VERSION,
		generatedAt: args.generatedAt,
		issueKey: args.issueKey,
		lifecycle: deriveLifecycle({
			blockers,
			artifacts: args.artifacts.artifacts,
			phaseExit,
		}),
		summary:
			blockers.length > 0
				? "Local runtime evidence has blockers."
				: "Local runtime evidence was assembled from available repo state.",
		nextSafeAction: nextSafeAction({ blockers, phaseExit }),
		branch: {
			name: args.git.branchName,
			clean: args.git.clean,
			ref: args.git.ref,
		},
		pullRequest: {
			number: args.evidence.pullRequest?.number ?? null,
			state: args.evidence.pullRequest?.state ?? null,
			isDraft: args.evidence.pullRequest?.isDraft ?? null,
			mergeStateStatus: args.evidence.pullRequest?.mergeStateStatus ?? null,
			url: args.evidence.pullRequest?.url ?? null,
		},
		artifacts: args.artifacts.artifacts,
		linear:
			matchingLinearEvidence(args.evidence.linear, args.issueKey) ??
			fallbackLinear(args.issueKey),
		phaseExit,
		sources,
		blockers,
	};
	return validatedRuntimeCard(addRuntimeAttemptMetadata(card));
}

/** Merge live provider evidence into an already validated local runtime-card/v1 artifact. */
export function assembleLiveRuntimeCard(
	base: RuntimeCard,
	live: RuntimeCardLiveEvidence,
): RuntimeCard {
	const blockers = [...base.blockers, ...(live.blockers ?? [])];
	const phaseExit = base.phaseExit;
	const card = {
		...base,
		pullRequest: live.pullRequest ?? base.pullRequest,
		linear: live.linear ?? base.linear,
		sources: mergeRuntimeCardSources([
			...base.sources,
			...(live.sources ?? []),
		]),
		blockers,
		lifecycle: deriveLifecycle({
			blockers,
			artifacts: base.artifacts,
			phaseExit,
		}),
		summary:
			blockers.length > 0
				? "Runtime evidence has blockers."
				: "Runtime evidence was assembled from local and live provider state.",
		nextSafeAction: nextSafeAction({ blockers, phaseExit }),
	};
	return validatedRuntimeCard(addRuntimeAttemptMetadata(card));
}

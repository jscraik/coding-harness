import type { HarnessDecision } from "./harness-decision.js";

/** Source kinds inspected or reserved by `harness next` before recommendation. */
export type DecisionSourceKind =
	| "git"
	| "contract"
	| "catalog"
	| "run"
	| "learning"
	| "linear"
	| "pr"
	| "config";

/** Freshness of a decision source relative to the current repository state. */
export type DecisionSourceFreshness =
	| "current"
	| "stale"
	| "missing"
	| "unknown";

/** Usability state for a normalized decision source. */
export type DecisionSourceStatus = "usable" | "empty" | "invalid" | "blocked";

/** Normalized source record used by `harness next` before recommendation. */
export interface DecisionSource {
	/** Source family. */
	kind: DecisionSourceKind;
	/** Stable file, command, URL, or artifact reference. */
	ref: string;
	/** Freshness of the source relative to current repo state. */
	freshness: DecisionSourceFreshness;
	/** Git SHA the source applies to when known. */
	sha: string | null;
	/** Whether the source can be used as decision input. */
	status: DecisionSourceStatus;
	/** Stable reason when the source cannot be used. */
	failureClass: string | null;
}

/** Internal candidate produced before deterministic recommendation ranking. */
export interface RecommendationCandidate {
	/** Exact runnable command, or null when the candidate is explanatory only. */
	command: string | null;
	/** Plain operational reason for the candidate. */
	reason: string;
	/** Decision sources that produced the candidate. */
	sourceRefs: string[];
	/** Deterministic ranking score; higher wins after safety tie-breakers. */
	score: number;
	/** Candidate risk tier. */
	riskTier: HarnessDecision["riskTier"];
	/** Whether the candidate can run without extra approval. */
	safeToRun: boolean;
	/** Whether the candidate requires human judgment or approval. */
	requiresHuman: boolean;
	/** Whether the candidate requires network/API access. */
	requiresNetwork: boolean;
	/** Whether the candidate writes files. */
	writesFiles: boolean;
}

/** Decision source for run artifacts with bounded selection metadata. */
export interface RunDecisionSource extends DecisionSource {
	/** ISO-like timestamp used to choose the newest run within the same SHA. */
	timestamp: string;
}

const REQUIRED_LOCAL_SOURCE_KINDS: ReadonlySet<DecisionSourceKind> = new Set([
	"git",
	"contract",
	"catalog",
	"config",
]);

const RISK_ORDER: Record<HarnessDecision["riskTier"], number> = {
	low: 0,
	medium: 1,
	high: 2,
	critical: 3,
	unknown: 4,
};

function compareStrings(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}

function compareStringArrays(left: string[], right: string[]): number {
	const length = Math.max(left.length, right.length);
	for (let index = 0; index < length; index += 1) {
		const leftValue = left[index];
		const rightValue = right[index];
		if (leftValue === undefined) return -1;
		if (rightValue === undefined) return 1;
		const compared = compareStrings(leftValue, rightValue);
		if (compared !== 0) return compared;
	}
	return 0;
}

function sourceNeedsError(source: DecisionSource): boolean {
	if (source.status !== "usable") return true;
	if (source.freshness === "stale") return true;
	return source.freshness === "missing" && source.failureClass !== null;
}

function staleRunSourceError(
	source: RunDecisionSource,
	currentHeadSha: string,
): DecisionSource | null {
	if (source.status !== "usable") return null;
	if (source.freshness === "stale") return null;
	if (source.sha === currentHeadSha) return null;
	return {
		...source,
		freshness: "stale",
		failureClass: source.failureClass ?? "run_head_mismatch",
	};
}

/** Return unusable or stale sources that should be carried in metadata. */
export function collectSourceErrors(
	sources: readonly DecisionSource[],
): DecisionSource[] {
	return sources.filter(sourceNeedsError).sort(compareDecisionSources);
}

/** Return the first required local source that should block recommendation. */
export function findBlockingSource(
	sources: readonly DecisionSource[],
): DecisionSource | null {
	return (
		sources.find(
			(source) =>
				source.status === "blocked" &&
				REQUIRED_LOCAL_SOURCE_KINDS.has(source.kind),
		) ?? null
	);
}

/** Sort recommendation candidates deterministically for identical inputs. */
export function sortRecommendationCandidates(
	candidates: readonly RecommendationCandidate[],
): RecommendationCandidate[] {
	return [...candidates].sort((left, right) => {
		const risk = RISK_ORDER[left.riskTier] - RISK_ORDER[right.riskTier];
		if (risk !== 0) return risk;
		if (left.safeToRun !== right.safeToRun) return left.safeToRun ? -1 : 1;
		if (left.requiresHuman !== right.requiresHuman)
			return left.requiresHuman ? 1 : -1;
		if (left.requiresNetwork !== right.requiresNetwork)
			return left.requiresNetwork ? 1 : -1;
		if (left.writesFiles !== right.writesFiles)
			return left.writesFiles ? 1 : -1;
		const score = right.score - left.score;
		if (score !== 0) return score;
		const command = compareStrings(left.command ?? "", right.command ?? "");
		if (command !== 0) return command;
		return compareStringArrays(left.sourceRefs, right.sourceRefs);
	});
}

/** Select the bounded recent run source for a current head, reporting unusable runs. */
export function selectRecentRunSource(
	sources: readonly RunDecisionSource[],
	currentHeadSha: string,
): { selected: RunDecisionSource | null; sourceErrors: DecisionSource[] } {
	const sourceErrors = collectSourceErrors([
		...sources,
		...sources.flatMap((source) => {
			const staleError = staleRunSourceError(source, currentHeadSha);
			return staleError ? [staleError] : [];
		}),
	]);
	const usable = sources.filter((source) => source.status === "usable");
	const current = usable.filter((source) => source.sha === currentHeadSha);
	const selected =
		[...current].sort((left, right) => {
			const timestamp = compareStrings(right.timestamp, left.timestamp);
			if (timestamp !== 0) return timestamp;
			return compareStrings(left.ref, right.ref);
		})[0] ?? null;
	return { selected, sourceErrors };
}

function compareDecisionSources(
	left: DecisionSource,
	right: DecisionSource,
): number {
	const kind = compareStrings(left.kind, right.kind);
	if (kind !== 0) return kind;
	return compareStrings(left.ref, right.ref);
}

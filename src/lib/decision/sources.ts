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

/**
 * Compare two strings using lexicographic (dictionary) ordering.
 *
 * @param left - The first string to compare
 * @param right - The second string to compare
 * @returns `-1` if `left` is lexicographically less than `right`, `1` if `left` is greater, `0` if they are equal
 */
function compareStrings(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * Compares two string arrays lexicographically, element by element.
 *
 * @param left - The first array to compare
 * @param right - The second array to compare
 * @returns `-1` if `left` is less than `right`, `1` if `left` is greater than `right`, `0` if they are equal. If all shared elements are equal, the shorter array is considered smaller.
 */
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

/**
 * Determines whether a DecisionSource represents an error condition.
 *
 * @returns `true` if the source's `status` is not `"usable"`, or its `freshness` is `"stale"`, or its `freshness` is `"missing"` with a non-null `failureClass`; `false` otherwise.
 */
function sourceNeedsError(source: DecisionSource): boolean {
	if (source.status !== "usable") return true;
	if (source.freshness === "stale") return true;
	return source.freshness === "missing" && source.failureClass !== null;
}

/**
 * Mark a run source as stale when its SHA does not match the current head.
 *
 * @param source - The run decision source to evaluate
 * @param currentHeadSha - The current head commit SHA to compare against
 * @returns A copy of `source` with `freshness` set to `"stale"` and `failureClass` set to `source.failureClass` or `"run_head_mismatch"` when the source SHA differs from `currentHeadSha`; `null` if the source is not `usable`, already `stale`, or its SHA equals `currentHeadSha`
 */
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

/**
 * Identify decision sources that represent errors or stale data to include in metadata.
 *
 * A source is considered error-carrying when its status is not `usable`, when its freshness is `stale`,
 * or when freshness is `missing` with a non-null `failureClass`.
 *
 * @returns The input sources filtered to those error-carrying and deterministically sorted by `kind` then `ref`.
 */
export function collectSourceErrors(
	sources: readonly DecisionSource[],
): DecisionSource[] {
	return sources.filter(sourceNeedsError).sort(compareDecisionSources);
}

/**
 * Finds the first required local source whose status is `blocked`.
 *
 * @returns The first blocked required local `DecisionSource`, or `null` if none are found.
 */
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

/**
 * Produce a deterministically ordered copy of recommendation candidates.
 *
 * The resulting array is a new sorted copy; the original input is not mutated.
 * Candidates are ordered by, in priority order: risk tier (low→critical), safeToRun (`true` before `false`),
 * requiresHuman (`false` before `true`), requiresNetwork (`false` before `true`), writesFiles (`false` before `true`),
 * score (higher first), command (lexicographic, `null` treated as empty string), and finally sourceRefs (element-wise lexicographic).
 *
 * @param candidates - The list of recommendation candidates to sort
 * @returns A new array containing the same candidates sorted deterministically according to the rules above
 */
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
		if (left.command === null && right.command !== null) return 1;
		if (left.command !== null && right.command === null) return -1;
		const command = compareStrings(left.command ?? "", right.command ?? "");
		if (command !== 0) return command;
		return compareStringArrays(left.sourceRefs, right.sourceRefs);
	});
}

/**
 * Choose the most recent usable run that matches the current head and report sources with errors.
 *
 * Filters the provided run sources to those with `status === "usable"` and `sha === currentHeadSha`, then selects the newest by `timestamp` (ties broken by `ref`). Also returns all decision sources that carry errors, including per-run stale head mismatches.
 *
 * @param sources - Candidate run decision sources to evaluate
 * @param currentHeadSha - The current head SHA to match against run sources
 * @returns An object with `selected` set to the newest matching `RunDecisionSource` or `null` if none, and `sourceErrors` containing all error-carrying `DecisionSource` records
 */
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

/**
 * Compare two DecisionSource records by `kind` then `ref` using lexicographic ordering.
 *
 * @returns `-1` if `left` is less than `right`, `1` if `left` is greater than `right`, `0` if they are equal
 */
function compareDecisionSources(
	left: DecisionSource,
	right: DecisionSource,
): number {
	const kind = compareStrings(left.kind, right.kind);
	if (kind !== 0) return kind;
	return compareStrings(left.ref, right.ref);
}

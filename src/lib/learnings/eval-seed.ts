import { existsSync, mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import {
	type LearningPromotionCandidate,
	buildLearningPromotionCandidates,
} from "./promote.js";
import {
	type ReviewContextLearning,
	type ReviewContextOptions,
	type ReviewContextResult,
	buildReviewContext,
} from "./review-context.js";

/** Schema version for deterministic eval-seed artifacts. */
export const EVAL_SEED_PACK_SCHEMA_VERSION = "eval-seed-pack/v1";

/** Late-stage remediation source inferred from repeated learning evidence. */
export type EvalSeedRemediationSource =
	| "ci"
	| "code_review"
	| "github_history"
	| "validation"
	| "generated_artifact"
	| "source_of_truth"
	| "unknown";

/** Repeated failure class the future eval should prevent. */
export type EvalSeedFailureClass =
	| "ci_failure"
	| "review_feedback"
	| "github_pr_remediation"
	| "validation_gap"
	| "generated_artifact_drift"
	| "source_of_truth_drift"
	| "guardrail_gap"
	| "unknown";

/** One durable eval candidate derived from repeated review or validation noise. */
export interface EvalSeedCandidate {
	/** Stable learning identifier that generated the seed. */
	id: string;
	/** Repeat-signal usage count from imported learnings. */
	usage: number;
	/** Learning classification that informs the target surface. */
	classification: ReviewContextLearning["classification"];
	/** Enforcement severity associated with the source learning. */
	enforcement: ReviewContextLearning["enforcement"];
	/** Promotion lifecycle status for the source learning. */
	promotionStatus: ReviewContextLearning["promotionStatus"];
	/** Late-stage remediation source inferred from evidence and learning text. */
	remediationSource: EvalSeedRemediationSource;
	/** Repeated failure class this seed should catch earlier next time. */
	failureClass: EvalSeedFailureClass;
	/** Changed files that triggered this seed candidate. */
	matchedFiles: string[];
	/** Human-readable summary of the repeated failure pattern. */
	summary: string;
	/** Suggested next durable control-plane destination. */
	recommendedTarget: string;
	/** Suggested regression or gate surface to extend. */
	recommendedTest: string;
	/** Why this learning should become future eval coverage. */
	reason: string;
	/** Review-context remediation guidance for the repeated failure. */
	fix: string;
	/** Source evidence references backing this seed. */
	evidenceRef: string[];
	/** Recommended validation commands connected to the matched files. */
	validationCommands: string[];
}

/** Result emitted by the eval-seed builder. */
export interface EvalSeedPackResult {
	schemaVersion: typeof EVAL_SEED_PACK_SCHEMA_VERSION;
	status: "success" | "error";
	source: string;
	repo: string;
	changedFiles: string[];
	minUsage: number;
	candidates: EvalSeedCandidate[];
	validationPlan: ReviewContextResult["validationPlan"];
	networkRequired: ReviewContextResult["networkRequired"];
	outputPath?: string;
	summary: {
		applicableLearnings: number;
		promotionCandidates: number;
		seedCandidates: number;
		validationCommands: number;
		networkRequired: number;
		byRemediationSource: Partial<Record<EvalSeedRemediationSource, number>>;
		byFailureClass: Partial<Record<EvalSeedFailureClass, number>>;
	};
	error?: {
		code: string;
		message: string;
		fix?: string;
	};
}

/** Options for building a deterministic eval-seed artifact. */
export interface EvalSeedPackOptions extends ReviewContextOptions {
	/** Minimum usage signal required before a learning can become an eval seed. */
	minUsage?: number;
	/** Optional output path for persisting the eval-seed artifact. */
	output?: string;
}

const DEFAULT_MIN_USAGE = 25;

/**
 * Build a deterministic eval-seed artifact from repeated learnings plus changed files.
 *
 * This is the narrowest production slice for the "post-feature remediation noise"
 * problem: intersect changed-file review context with high-signal promotion candidates
 * so repeated review and CI failures can become concrete future eval work instead of
 * recurring human cleanup.
 *
 * @param options - Source artifact path, changed files, optional repo root and enforcement ledger, minimum usage threshold, and optional output path.
 * @returns A stable result containing filtered eval-seed candidates plus the supporting validation plan and network-required checks; on failure returns `status: "error"` with a machine-readable code.
 */
export function buildEvalSeedPack(
	options: EvalSeedPackOptions,
): EvalSeedPackResult {
	const minUsage = options.minUsage ?? DEFAULT_MIN_USAGE;
	if (!Number.isInteger(minUsage) || minUsage < 0) {
		return invalidMinUsageResult(options);
	}

	const reviewContext = buildReviewContext(options);
	if (reviewContext.status === "error") {
		return reviewContextErrorResult(reviewContext, minUsage);
	}

	const promotionCandidates = buildLearningPromotionCandidates(
		buildPromotionOptions(options, minUsage),
	);
	if (promotionCandidates.status === "error") {
		return promotionCandidatesErrorResult(
			promotionCandidates,
			reviewContext,
			minUsage,
		);
	}

	const candidates = buildEvalSeedCandidates(
		reviewContext,
		promotionCandidates.promotionCandidates,
	);

	const result: EvalSeedPackResult = {
		schemaVersion: EVAL_SEED_PACK_SCHEMA_VERSION,
		status: "success",
		source: reviewContext.source,
		repo: reviewContext.repo,
		changedFiles: reviewContext.changedFiles,
		minUsage,
		candidates,
		validationPlan: reviewContext.validationPlan,
		networkRequired: reviewContext.networkRequired,
		summary: {
			applicableLearnings: reviewContext.applicableLearnings.length,
			promotionCandidates: promotionCandidates.promotionCandidates.length,
			seedCandidates: candidates.length,
			validationCommands: reviewContext.validationPlan.length,
			networkRequired: reviewContext.networkRequired.length,
			byRemediationSource: countBy(candidates, "remediationSource"),
			byFailureClass: countBy(candidates, "failureClass"),
		},
	};

	if (options.output) {
		return writeEvalSeedPack(result, options);
	}
	return result;
}

/**
 * Create a standardized error EvalSeedPackResult when the provided `minUsage` is invalid.
 *
 * Produces a result with `status: "error"`, an empty candidate list and validation plan, `changedFiles`
 * normalized from `options.files`, `minUsage` set to `DEFAULT_MIN_USAGE`, and an `error` object
 * containing `code: "eval_seed.invalid_min_usage"` along with a human-facing message and fix hint.
 *
 * @param options - The original EvalSeedPackOptions used to populate `source` and `changedFiles`
 * @returns An `EvalSeedPackResult` representing the invalid `minUsage` error payload
 */
function invalidMinUsageResult(
	options: EvalSeedPackOptions,
): EvalSeedPackResult {
	return {
		schemaVersion: EVAL_SEED_PACK_SCHEMA_VERSION,
		status: "error",
		source: options.source ?? "",
		repo: "unknown",
		changedFiles: normalizeFiles(options.files),
		minUsage: DEFAULT_MIN_USAGE,
		candidates: [],
		validationPlan: [],
		networkRequired: [],
		summary: emptyEvalSeedSummary(),
		error: {
			code: "eval_seed.invalid_min_usage",
			message: "minUsage must be a non-negative integer.",
			fix: "Pass a finite non-negative integer for minUsage.",
		},
	};
}

/**
 * Constructs an error EvalSeedPackResult that reflects a failed review-context build.
 *
 * The result copies metadata (source, repo, changedFiles, validationPlan, networkRequired),
 * sets `status` to `"error"`, includes an empty `candidates` list, records `minUsage`,
 * and populates the summary counters (including `validationCommands` and `networkRequired`)
 * from the provided review context. If `reviewContext.error` exists, it is attached to the result.
 *
 * @param reviewContext - The failed review context result used to seed the error output
 * @param minUsage - The minimum usage threshold to include in the returned result
 * @returns An `EvalSeedPackResult` with `status: "error"`, metadata copied from `reviewContext`, empty candidates, and an optional `error` payload
 */
function reviewContextErrorResult(
	reviewContext: ReviewContextResult,
	minUsage: number,
): EvalSeedPackResult {
	const errorResult: EvalSeedPackResult = {
		schemaVersion: EVAL_SEED_PACK_SCHEMA_VERSION,
		status: "error",
		source: reviewContext.source,
		repo: reviewContext.repo,
		changedFiles: reviewContext.changedFiles,
		minUsage,
		candidates: [],
		validationPlan: reviewContext.validationPlan,
		networkRequired: reviewContext.networkRequired,
		summary: {
			...emptyEvalSeedSummary(),
			validationCommands: reviewContext.validationPlan.length,
			networkRequired: reviewContext.networkRequired.length,
		},
	};
	return reviewContext.error
		? { ...errorResult, error: reviewContext.error }
		: errorResult;
}

/**
 * Constructs an error EvalSeedPackResult representing a failure to build promotion candidates.
 *
 * @param promotionCandidates - The result from promotion candidate generation used to populate `source` and, if present, its `error`.
 * @param reviewContext - The review context whose `repo`, `changedFiles`, `validationPlan`, and `networkRequired` are copied into the result.
 * @param minUsage - The resolved minimum usage value to include in the result.
 * @returns An EvalSeedPackResult with `status: "error"`, an empty `candidates` array, `promotionCandidates` and `seedCandidates` set to 0, summary counts copied from `reviewContext`, and the `promotionCandidates.error` attached when available.
 */
function promotionCandidatesErrorResult(
	promotionCandidates: ReturnType<typeof buildLearningPromotionCandidates>,
	reviewContext: ReviewContextResult,
	minUsage: number,
): EvalSeedPackResult {
	const errorResult: EvalSeedPackResult = {
		schemaVersion: EVAL_SEED_PACK_SCHEMA_VERSION,
		status: "error",
		source: promotionCandidates.source,
		repo: reviewContext.repo,
		changedFiles: reviewContext.changedFiles,
		minUsage,
		candidates: [],
		validationPlan: reviewContext.validationPlan,
		networkRequired: reviewContext.networkRequired,
		summary: {
			applicableLearnings: reviewContext.applicableLearnings.length,
			promotionCandidates: 0,
			seedCandidates: 0,
			validationCommands: reviewContext.validationPlan.length,
			networkRequired: reviewContext.networkRequired.length,
			byRemediationSource: {},
			byFailureClass: {},
		},
	};
	return promotionCandidates.error
		? { ...errorResult, error: promotionCandidates.error }
		: errorResult;
}

/**
 * Create an empty eval-seed summary with all numeric counters set to zero and empty breakdown maps.
 *
 * @returns A summary object where `applicableLearnings`, `promotionCandidates`, `seedCandidates`, `validationCommands`, and `networkRequired` are `0`, and `byRemediationSource` and `byFailureClass` are empty objects.
 */
function emptyEvalSeedSummary(): EvalSeedPackResult["summary"] {
	return {
		applicableLearnings: 0,
		promotionCandidates: 0,
		seedCandidates: 0,
		validationCommands: 0,
		networkRequired: 0,
		byRemediationSource: {},
		byFailureClass: {},
	};
}

/**
 * Build the options object for promotion candidate generation by including `minUsage` and any relevant repo/context fields from `options`.
 *
 * @param options - Incoming EvalSeedPackOptions potentially containing `source`, `repoRoot`, and `enforcementStatusPath`
 * @param minUsage - Minimum usage threshold to include on the returned options
 * @returns An object containing `minUsage` and, when present on `options`, `source`, `repoRoot`, and `enforcementStatusPath`
 */
function buildPromotionOptions(options: EvalSeedPackOptions, minUsage: number) {
	return {
		minUsage,
		...(options.source ? { source: options.source } : {}),
		...(options.repoRoot ? { repoRoot: options.repoRoot } : {}),
		...(options.enforcementStatusPath
			? { enforcementStatusPath: options.enforcementStatusPath }
			: {}),
	};
}

/**
 * Build a deterministic list of eval seed candidates by matching applicable learnings to promotion candidates.
 *
 * Skips learnings that have no matching promotion candidate and returns candidates sorted by descending `usage` then ascending `id`.
 *
 * @param reviewContext - The review context containing `applicableLearnings` and the `validationPlan` used when constructing candidates.
 * @param promotionCandidates - Promotion candidates keyed by `id` to match against `applicableLearnings`.
 * @returns A sorted array of `EvalSeedCandidate` objects for learnings that had matching promotion candidates.
 */
function buildEvalSeedCandidates(
	reviewContext: ReviewContextResult,
	promotionCandidates: LearningPromotionCandidate[],
): EvalSeedCandidate[] {
	const candidateById = new Map(
		promotionCandidates.map((candidate) => [candidate.id, candidate]),
	);
	return reviewContext.applicableLearnings
		.flatMap((learning) => {
			const promotionCandidate = candidateById.get(learning.id);
			if (!promotionCandidate) return [];
			return [
				buildEvalSeedCandidate(learning, promotionCandidate, reviewContext),
			];
		})
		.sort(
			(left, right) =>
				right.usage - left.usage || left.id.localeCompare(right.id),
		);
}

/**
 * Builds an EvalSeedCandidate from a learning and its promotion metadata within a review context.
 *
 * @returns An `EvalSeedCandidate` that combines fields from `learning` and `promotion`, includes inferred `remediationSource` and `failureClass`, and contains `validationCommands` filtered to those whose files intersect the learning's `matchedFiles`.
 */
function buildEvalSeedCandidate(
	learning: ReviewContextLearning,
	promotion: LearningPromotionCandidate,
	reviewContext: ReviewContextResult,
): EvalSeedCandidate {
	const validationCommands = reviewContext.validationPlan
		.filter((command) =>
			command.files.some((file) => learning.matchedFiles.includes(file)),
		)
		.map((command) => command.command);
	return {
		id: learning.id,
		usage: learning.usage,
		classification: learning.classification,
		enforcement: learning.enforcement,
		promotionStatus: promotion.promotionStatus,
		remediationSource: inferRemediationSource(learning),
		failureClass: inferFailureClass(learning),
		matchedFiles: [...learning.matchedFiles],
		summary: learning.summary,
		recommendedTarget: promotion.recommendedTarget,
		recommendedTest: promotion.recommendedTest,
		reason: promotion.reason,
		fix: learning.fix,
		evidenceRef: [...learning.evidenceRef],
		validationCommands,
	};
}

/**
 * Infers the most likely remediation source for a single learning.
 *
 * @param learning - A learning entry from the review context
 * @returns The inferred remediation source: `ci` for CI-related indications, `github_history` for GitHub/PR/merge/branch-protection signals, `validation` for test/validation/lint/typecheck signals, `generated_artifact` when classification equals `"generated_artifact"`, `source_of_truth` when classification equals `"source_of_truth"`, `code_review` for code-review related text or evidence refs prefixed with `"coderabbit_csv:"`, or `unknown` if none match.
 */
function inferRemediationSource(
	learning: ReviewContextLearning,
): EvalSeedRemediationSource {
	if (learning.classification === "generated_artifact") {
		return "generated_artifact";
	}
	if (learning.classification === "source_of_truth") {
		return "source_of_truth";
	}
	if (learning.classification === "validation_contract") {
		return "validation";
	}
	const haystack = evalSeedHaystack(learning);
	if (
		/\b(circleci|ci job|pipeline|workflow failed|red job)\b/i.test(haystack)
	) {
		return "ci";
	}
	if (
		/\b(github|pull request|pr review|merge|branch protection)\b/i.test(
			haystack,
		)
	) {
		return "github_history";
	}
	if (/\b(validation|verify|test|typecheck|lint|gate)\b/i.test(haystack)) {
		return "validation";
	}
	if (
		/\b(coderabbit|review|comment|finding)\b/i.test(haystack) ||
		learning.evidenceRef.some((ref) => ref.startsWith("coderabbit_csv:"))
	) {
		return "code_review";
	}
	return "unknown";
}

/**
 * Infers the most likely recurring failure class for a learning using its text and metadata.
 *
 * @param learning - The review-context learning to classify
 * @returns `ci_failure` when CI-related keywords are present; `github_pr_remediation` when GitHub/PR/merge/branch-protection keywords are present; `generated_artifact_drift` when `learning.classification` is `"generated_artifact"`; `source_of_truth_drift` when `learning.classification` is `"source_of_truth"`; `validation_gap` when `learning.classification` is `"validation_contract"`; `guardrail_gap` when `learning.classification` is `"guardrail"`; `review_feedback` when review-related keywords or evidence refs starting with `coderabbit_csv:` are present; otherwise `unknown`.
 */
function inferFailureClass(
	learning: ReviewContextLearning,
): EvalSeedFailureClass {
	if (learning.classification === "generated_artifact") {
		return "generated_artifact_drift";
	}
	if (learning.classification === "source_of_truth") {
		return "source_of_truth_drift";
	}
	if (learning.classification === "validation_contract") {
		return "validation_gap";
	}
	if (learning.classification === "guardrail") {
		return "guardrail_gap";
	}
	const haystack = evalSeedHaystack(learning);
	if (
		/\b(circleci|ci job|pipeline|workflow failed|red job)\b/i.test(haystack)
	) {
		return "ci_failure";
	}
	if (
		/\b(github|pull request|pr review|merge|branch protection)\b/i.test(
			haystack,
		)
	) {
		return "github_pr_remediation";
	}
	if (
		/\b(coderabbit|review|comment|finding)\b/i.test(haystack) ||
		learning.evidenceRef.some((ref) => ref.startsWith("coderabbit_csv:"))
	) {
		return "review_feedback";
	}
	return "unknown";
}

/**
 * Builds a single searchable string containing the learning's identifying and descriptive fields.
 *
 * @param learning - The learning whose id, summary, fix, classification, and evidence references will be concatenated.
 * @returns A space-separated string formed from the learning's id, summary, fix, classification, and evidenceRef entries.
 */
function evalSeedHaystack(learning: ReviewContextLearning): string {
	return [
		learning.id,
		learning.summary,
		learning.fix,
		learning.classification,
		...learning.evidenceRef,
	].join(" ");
}

/**
 * Produce a mapping of how many candidates share each string value for a given candidate property.
 *
 * @param candidates - The list of eval seed candidates to aggregate
 * @param key - The candidate property whose string values will be counted
 * @returns A partial record mapping each distinct string value of `key` to the number of occurrences
 */
function countBy<T extends keyof EvalSeedCandidate>(
	candidates: EvalSeedCandidate[],
	key: T,
): Partial<Record<Extract<EvalSeedCandidate[T], string>, number>> {
	const counts: Partial<Record<Extract<EvalSeedCandidate[T], string>, number>> =
		{};
	for (const candidate of candidates) {
		const value = candidate[key];
		if (typeof value !== "string") continue;
		counts[value as Extract<EvalSeedCandidate[T], string>] =
			(counts[value as Extract<EvalSeedCandidate[T], string>] ?? 0) + 1;
	}
	return counts;
}

/**
 * Write the eval seed pack to disk when `options.output` is a path contained within `options.repoRoot`; otherwise return an error result.
 *
 * @param result - The eval seed pack object to persist.
 * @param options - Options that may include `repoRoot` and an `output` path where the pack should be written.
 * @returns The original `result` with `outputPath` added on successful write; on failure returns a result with `status: "error"` and an `error` object with `code` set to `"eval_seed.write_failed"`.
 */
function writeEvalSeedPack(
	result: EvalSeedPackResult,
	options: EvalSeedPackOptions,
): EvalSeedPackResult {
	const repoRoot = resolve(options.repoRoot ?? process.cwd());
	const outputPath = resolve(repoRoot, options.output ?? "");
	const relativeOutput = relative(repoRoot, outputPath);
	if (
		relativeOutput === ".." ||
		relativeOutput.startsWith(`..${sep}`) ||
		isAbsolute(relativeOutput) ||
		!isContainedByRealRepoRoot(repoRoot, outputPath)
	) {
		return {
			...result,
			status: "error",
			error: {
				code: "eval_seed.write_failed",
				message:
					"Failed to write eval seed pack: output must stay within repoRoot.",
			},
		};
	}
	try {
		mkdirSync(dirname(outputPath), { recursive: true });
		writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf-8");
		return { ...result, outputPath };
	} catch (error) {
		return {
			...result,
			status: "error",
			error: {
				code: "eval_seed.write_failed",
				message: `Failed to write eval seed pack: ${error instanceof Error ? error.message : String(error)}`,
			},
		};
	}
}

/**
 * Determines whether an output path is contained within a repository root when both are resolved to real filesystem paths.
 *
 * @param repoRoot - The repository root path used as the containment boundary.
 * @param outputPath - The target output path to test; may refer to a file or directory that does not exist.
 * @returns `true` if `outputPath` (or its nearest existing ancestor) resolves to a location inside `repoRoot`, `false` otherwise. Returns `false` on any path resolution error.
 */
function isContainedByRealRepoRoot(
	repoRoot: string,
	outputPath: string,
): boolean {
	try {
		const realRepoRoot = realpathSync(repoRoot);
		const existingOutputTarget = existsSync(outputPath)
			? outputPath
			: findNearestExistingAncestor(dirname(outputPath));
		if (!existingOutputTarget) return false;
		const realOutputTarget = realpathSync(existingOutputTarget);
		const relativeTarget = relative(realRepoRoot, realOutputTarget);
		return (
			relativeTarget === "" ||
			(!relativeTarget.startsWith(`..${sep}`) && !isAbsolute(relativeTarget))
		);
	} catch {
		return false;
	}
}

/**
 * Finds the nearest existing filesystem ancestor of the given path.
 *
 * @param filePath - Path to start the upward search from
 * @returns The first ancestor path that exists, or `undefined` if no existing ancestor is found
 */
function findNearestExistingAncestor(filePath: string): string | undefined {
	let current = filePath;
	for (;;) {
		if (existsSync(current)) return current;
		const parent = dirname(current);
		if (parent === current) return undefined;
		current = parent;
	}
}

/**
 * Normalize and deduplicate a list of file path strings.
 *
 * Trims whitespace from each entry, removes empty strings, deduplicates entries, and returns the resulting list sorted lexicographically.
 *
 * @param files - Array of file path strings to normalize
 * @returns The normalized array of unique, sorted file paths
 */
function normalizeFiles(files: string[]): string[] {
	return [...new Set(files.map((file) => file.trim()).filter(Boolean))].sort();
}

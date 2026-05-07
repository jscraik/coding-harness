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
 * Constructs a deterministic eval-seed pack from changed-file review context and promotion candidates.
 *
 * Intersects review context derived from the provided changed files with learning-driven promotion
 * candidates, filters candidates by the configured minimum usage, and assembles the resulting
 * seed candidates together with the validation plan, network-required checks, and summary metadata.
 * If `options.output` is set, the pack is written to disk (or an error result is returned if writing fails).
 *
 * @param options - Options controlling source, changed files, repository root, enforcement ledger path, minimum usage threshold, and optional output path for persisting the pack.
 * @returns An `EvalSeedPackResult` containing `candidates`, `validationPlan`, `networkRequired`, `summary`, and related metadata; on failure the result has `status: "error"` and an `error.code`.
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
 * Build an error-shaped EvalSeedPackResult for the case when `minUsage` is invalid.
 *
 * @param options - Input options used to populate `source` and normalized `changedFiles`
 * @returns An `EvalSeedPackResult` with `status: "error"`, `error.code` set to `"eval_seed.invalid_min_usage"`, an explanatory message and suggested fix, and empty candidates/summary fields
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
 * Constructs an error-shaped EvalSeedPackResult that surfaces a failed review context.
 *
 * Produces an `EvalSeedPackResult` with `status: "error"` that preserves `reviewContext`'s
 * `source`, `repo`, `changedFiles`, `validationPlan`, and `networkRequired`. The result
 * contains no candidates, sets `minUsage` as provided, and populates the summary with
 * counts derived from the `validationPlan` and `networkRequired`. If `reviewContext.error`
 * exists, it is attached to the returned result.
 *
 * @param reviewContext - The review context result that failed and whose metadata should be included
 * @param minUsage - The minimum usage threshold that was applied when attempting to build the pack
 * @returns An `EvalSeedPackResult` representing the error state, including `reviewContext.error` when available
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
 * Constructs an `EvalSeedPackResult` representing a failure to build promotion candidates.
 *
 * The returned result has `status: "error"`, uses `promotionCandidates.source` and fields
 * from `reviewContext` (`repo`, `changedFiles`, `validationPlan`, `networkRequired`),
 * sets `candidates` to an empty array, and sets promotion- and seed-related counts to zero
 * while preserving `applicableLearnings`, `validationCommands`, and `networkRequired` counts
 * derived from `reviewContext`.
 *
 * @param promotionCandidates - The result of `buildLearningPromotionCandidates`; if it includes an `error`, that error will be attached to the returned result.
 * @param reviewContext - The review context used to populate repository, changed files, validation plan, and network requirements in the result.
 * @param minUsage - The minimum usage value to include in the result.
 * @returns An `EvalSeedPackResult` with `status: "error"`. Includes `promotionCandidates.error` when present.
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
 * Create an empty summary for an eval seed pack with all counts zeroed and empty breakdowns.
 *
 * @returns A summary object where numeric counters (`applicableLearnings`, `promotionCandidates`, `seedCandidates`, `validationCommands`, `networkRequired`) are `0`, and `byRemediationSource` and `byFailureClass` are empty maps.
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
 * Builds the options object for promotion-candidate generation.
 *
 * Includes the provided `minUsage` and conditionally copies `source`, `repoRoot`,
 * and `enforcementStatusPath` from the given `options` when they are present.
 *
 * @param options - The original EvalSeedPackOptions to read optional fields from
 * @param minUsage - The minimum usage threshold to include in the returned options
 * @returns An object containing `minUsage` and any of `source`, `repoRoot`, and `enforcementStatusPath` present on `options`
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
 * Builds a list of eval seed candidates by matching review-context learnings to promotion candidates.
 *
 * @param reviewContext - The review context whose `applicableLearnings` are used to produce seed candidates and whose validation info may be referenced.
 * @param promotionCandidates - Promotion candidates keyed by `id`; only learnings with a matching promotion candidate are converted into seeds.
 * @returns An array of `EvalSeedCandidate` objects sorted by descending `usage` and, for ties, ascending `id`.
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
 * Builds an EvalSeedCandidate by combining a review learning with its promotion candidate and review context.
 *
 * @param learning - The review-derived learning to convert into a seed candidate.
 * @param promotion - The promotion candidate that supplies promotion status, recommended target/test, and reason.
 * @param reviewContext - The review context whose validationPlan is used to collect validation commands relevant to the learning.
 * @returns The assembled EvalSeedCandidate with fields copied from `learning` and `promotion`, inferred `remediationSource` and `failureClass`, and `validationCommands` extracted from `reviewContext.validationPlan` entries that reference the learning's matched files.
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
 * Infer the remediation source category for a learning item.
 *
 * Examines the learning's text fields and classification to choose the most
 * appropriate EvalSeedRemediationSource describing where remediation is likely
 * to originate.
 *
 * @param learning - The learning to analyze; the function examines `id`, `summary`, `fix`, `classification`, and `evidenceRef`
 * @returns One of:
 * - `"ci"` when CI-related signals are present
 * - `"github_history"` when GitHub/PR-related signals are present
 * - `"validation"` when validation/test/lint-related signals are present or classification is `validation_contract`
 * - `"generated_artifact"` when the learning's classification is `generated_artifact`
 * - `"source_of_truth"` when the learning's classification is `source_of_truth`
 * - `"code_review"` when code-review signals or coderabbit CSV evidence are present
 * - `"unknown"` when none of the above apply
 */
function inferRemediationSource(
	learning: ReviewContextLearning,
): EvalSeedRemediationSource {
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
	if (learning.classification === "validation_contract") {
		return "validation";
	}
	if (learning.classification === "generated_artifact") {
		return "generated_artifact";
	}
	if (learning.classification === "source_of_truth") {
		return "source_of_truth";
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
 * Infers the failure class for a learning by inspecting its text fields and classification.
 *
 * Examines a concatenated "haystack" of the learning's id, summary, fix, classification, and evidence references,
 * then maps detected CI, GitHub/PR, generated-artifact, source-of-truth, validation-contract, guardrail,
 * or code-review indicators to their corresponding failure class.
 *
 * @param learning - The learning object whose fields are analyzed (uses `id`, `summary`, `fix`, `classification`, and `evidenceRef`)
 * @returns `ci_failure`, `github_pr_remediation`, `generated_artifact_drift`, `source_of_truth_drift`, `validation_gap`, `guardrail_gap`, `review_feedback`, or `unknown` depending on detected indicators
 */
function inferFailureClass(
	learning: ReviewContextLearning,
): EvalSeedFailureClass {
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
	if (
		/\b(coderabbit|review|comment|finding)\b/i.test(haystack) ||
		learning.evidenceRef.some((ref) => ref.startsWith("coderabbit_csv:"))
	) {
		return "review_feedback";
	}
	return "unknown";
}

/**
 * Builds a searchable text "haystack" from key fields of a learning record.
 *
 * @param learning - The learning whose `id`, `summary`, `fix`, `classification`, and `evidenceRef` entries are concatenated
 * @returns A single string containing the learning's `id`, `summary`, `fix`, `classification`, and each `evidenceRef`, separated by spaces
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
 * Count occurrences of string-valued values for a given candidate property.
 *
 * @param candidates - Array of eval seed candidates to aggregate
 * @param key - Key of the candidate property to count; only values of type `string` are included
 * @returns A partial record mapping each encountered string value for `key` to its occurrence count
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
 * Persists an eval seed pack to a repo-contained output path or returns an error result if writing is not allowed or fails.
 *
 * Validates that the resolved output path is contained within the repository root; if validation fails the returned
 * result has `status: "error"` and `error.code = "eval_seed.write_failed"`. On success the same `result` is returned
 * with an added `outputPath` property pointing to the written file. If an exception occurs while creating directories
 * or writing the file, the function returns an error-shaped `EvalSeedPackResult` with `error.code = "eval_seed.write_failed"`
 * and an explanatory message.
 *
 * @param result - The in-memory `EvalSeedPackResult` to serialize and persist.
 * @param options - Options that provide `repoRoot` and `output` (relative to `repoRoot`) used to compute the final path.
 * @returns The original `EvalSeedPackResult` augmented with `outputPath` on success, or an error-shaped `EvalSeedPackResult`
 *          describing the failure (`status: "error"`, `error.code = "eval_seed.write_failed"`) on validation or write failure.
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
 * Determines whether the resolved target for `outputPath` is contained within the real (symlink-resolved) `repoRoot`.
 *
 * The function resolves symlinks for `repoRoot` and for the nearest existing ancestor of `outputPath` (or `outputPath` itself if it exists) and returns `true` when that resolved target is equal to or a descendant of the resolved `repoRoot`.
 *
 * @param repoRoot - Path to the repository root to check containment against; symlinks will be resolved.
 * @param outputPath - Intended output file or directory path; may not exist — the nearest existing ancestor will be used for containment checks.
 * @returns `true` if the nearest existing target for `outputPath` resolves to the `repoRoot` or a path contained within it, `false` otherwise (including on resolution errors).
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
 * Finds the nearest existing ancestor path for the provided file or directory path.
 *
 * @param filePath - The file or directory path to start searching from
 * @returns The nearest existing ancestor path, or `undefined` if no existing ancestor is found
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
 * Normalize a list of file path strings by trimming whitespace, removing empty entries, deduplicating, and sorting.
 *
 * @param files - The file path strings to normalize
 * @returns An array of trimmed, non-empty, unique file strings sorted in ascending order
 */
function normalizeFiles(files: string[]): string[] {
	return [...new Set(files.map((file) => file.trim()).filter(Boolean))].sort();
}

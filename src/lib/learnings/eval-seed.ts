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

function evalSeedHaystack(learning: ReviewContextLearning): string {
	return [
		learning.id,
		learning.summary,
		learning.fix,
		learning.classification,
		...learning.evidenceRef,
	].join(" ");
}

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

function findNearestExistingAncestor(filePath: string): string | undefined {
	let current = filePath;
	for (;;) {
		if (existsSync(current)) return current;
		const parent = dirname(current);
		if (parent === current) return undefined;
		current = parent;
	}
}

function normalizeFiles(files: string[]): string[] {
	return [...new Set(files.map((file) => file.trim()).filter(Boolean))].sort();
}

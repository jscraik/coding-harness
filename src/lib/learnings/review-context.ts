import { existsSync, mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { DEFAULT_CODERABBIT_LOCAL_ARTIFACT } from "./artifact-io.js";
import {
	applyLearningEnforcementStatus,
	loadLearningEnforcementStatusLedger,
} from "./enforcement-status.js";
import { type LearningFileMatch, matchLearningToFile } from "./fuzzy-match.js";
import { loadLearningArtifact } from "./gate.js";
import {
	buildReviewLearningCloseout,
	buildUnavailableReviewLearningCloseout,
	type ReviewLearningCloseout,
} from "./review-learning-closeout.js";
import type { LearningItem } from "./types.js";
import {
	type ValidationPlanResult,
	buildValidationPlan,
} from "./validation-plan.js";

/** Applicable learning summary included in a PR review-context pack. */
export interface ReviewContextLearning {
	/** Stable learning identifier. */
	id: string;
	/** Usage count from the provider export. */
	usage: number;
	/** Learning classification for reviewer routing. */
	classification: LearningItem["classification"];
	/** Enforcement level to consider during review. */
	enforcement: LearningItem["enforcement"];
	/** Promotion lifecycle status. */
	promotionStatus: LearningItem["promotionStatus"];
	/** Short summary of the learned constraint. */
	summary: string;
	/** Changed files this learning applies to. */
	matchedFiles: string[];
	/** Human guidance for reviewers and agents. */
	fix: string;
	/** Evidence references back to the imported learning source. */
	evidenceRef: string[];
	/** Highest-confidence match metadata for measurement. */
	match: LearningFileMatch;
	/** Per-file match metadata used to preserve mixed exact and fuzzy counts. */
	matches?: LearningFileMatch[];
	/** Concrete implementation or test paths enforcing this learning. */
	enforcedBy?: string[];
	/** Decision rationale from the enforcement ledger, when recorded. */
	promotionReason?: string;
}

/** Result emitted by `harness review-context --json`. */
export interface ReviewContextResult {
	schemaVersion: "review-context/v1";
	status: "success" | "error";
	source: string;
	generatedAt?: string;
	sourceFingerprint?: string;
	repo: string;
	changedFiles: string[];
	applicableLearnings: ReviewContextLearning[];
	validationPlan: ValidationPlanResult["commands"];
	/** Advisory historical-learning and promotion closeout artifact. */
	closeout: ReviewLearningCloseout;
	networkRequired: ValidationPlanResult["networkRequired"];
	reviewerLikelyConcerns: string[];
	mustMentionInPr: string[];
	evidenceRequired: string[];
	knownRepeatedFailures: string[];
	recommendedReviewers: string[];
	doNotClaim: string[];
	outputPath?: string;
	summary: {
		applicableLearnings: number;
		validationCommands: number;
		networkRequired: number;
	};
	error?: {
		code: string;
		message: string;
		fix?: string;
	};
}

/** Options for generating PR review context from changed files. */
export interface ReviewContextOptions {
	/** Imported learning artifact path. */
	source?: string;
	/** Changed files to match against imported learnings. */
	files: string[];
	/** Optional output path for the context artifact. */
	output?: string;
	/** Repository root used for relative artifact resolution and output writes. */
	repoRoot?: string;
	/** Optional enforcement-status ledger path. */
	enforcementStatusPath?: string;
	/** Optional deterministic generation timestamp for tests and reproducible artifacts. */
	generatedAt?: string;
}

/**
 * Build a deterministic PR review-context pack.
 *
 * @param options - Inputs controlling the source learning artifact (optional), the list of changed files, an optional output path to write the generated JSON, an optional repository root for resolving paths, and an optional enforcement status ledger path.
 * @returns The generated ReviewContextResult containing schema/version metadata, generation timestamp, artifact fingerprint, repository, normalized changed files, applicable learnings, validation plan commands, required network resources, summary counts, and optionally `outputPath` when written to disk. If artifact or ledger loading fails, or if writing to `options.output` fails, the returned result will have `status: "error"` and an `error` object with `code`, `message`, and an optional `fix`.
 */
export function buildReviewContext(
	options: ReviewContextOptions,
): ReviewContextResult {
	const source = options.source ?? DEFAULT_CODERABBIT_LOCAL_ARTIFACT;
	const changedFiles = normalizeFiles(options.files);
	const loaded = loadLearningArtifact(source, options.repoRoot);
	if (!loaded.ok) {
		return {
			schemaVersion: "review-context/v1",
			status: "error",
			source,
			repo: "unknown",
			changedFiles,
			applicableLearnings: [],
			validationPlan: [],
			closeout: buildUnavailableReviewLearningCloseout({
				source,
				repo: "unknown",
				changedFiles,
				reason: `n.a.: ${loaded.message}`,
			}),
			networkRequired: [],
			...emptyReviewHandoff(),
			summary: {
				applicableLearnings: 0,
				validationCommands: 0,
				networkRequired: 0,
			},
			error: {
				code: loaded.code,
				message: loaded.message,
				...(loaded.fix ? { fix: loaded.fix } : {}),
			},
		};
	}
	const enforcementStatus = loadLearningEnforcementStatusLedger(
		options.enforcementStatusPath,
		options.repoRoot,
	);
	if (!enforcementStatus.ok) {
		return {
			schemaVersion: "review-context/v1",
			status: "error",
			source,
			repo: loaded.artifact.repository,
			changedFiles,
			applicableLearnings: [],
			validationPlan: [],
			closeout: buildUnavailableReviewLearningCloseout({
				source,
				repo: loaded.artifact.repository,
				changedFiles,
				reason: `n.a.: ${enforcementStatus.message}`,
			}),
			networkRequired: [],
			...emptyReviewHandoff(),
			summary: {
				applicableLearnings: 0,
				validationCommands: 0,
				networkRequired: 0,
			},
			error: {
				code: enforcementStatus.code,
				message: enforcementStatus.message,
				...(enforcementStatus.fix ? { fix: enforcementStatus.fix } : {}),
			},
		};
	}
	const learningItems = applyLearningEnforcementStatus(
		loaded.artifact.items,
		enforcementStatus.ledger,
	);
	const promotionReasons = new Map(
		enforcementStatus.ledger.items.map((item) => [
			item.learningId,
			item.reason,
		]),
	);

	const validationPlan = buildValidationPlan({
		source,
		files: changedFiles,
		...(options.repoRoot ? { repoRoot: options.repoRoot } : {}),
	});
	if (validationPlan.status === "error") {
		return buildValidationPlanErrorResult({
			source,
			repo: loaded.artifact.repository,
			changedFiles,
			validationPlan,
			closeout: buildUnavailableReviewLearningCloseout({
				source,
				repo: loaded.artifact.repository,
				changedFiles,
				reason: `n.a.: ${validationPlan.error?.message ?? "validation plan generation failed."}`,
			}),
		});
	}
	const applicableLearnings = learningItems
		.map((item) =>
			buildReviewContextLearning(item, changedFiles, promotionReasons),
		)
		.filter((item): item is ReviewContextLearning => item !== undefined)
		.sort((a, b) => b.usage - a.usage || a.id.localeCompare(b.id));
	const closeout =
		enforcementStatus.fingerprint === ""
			? buildUnavailableReviewLearningCloseout({
					source,
					repo: loaded.artifact.repository,
					changedFiles,
					reason: `n.a.: learning enforcement-status ledger is unavailable at ${enforcementStatus.path}.`,
				})
			: buildReviewLearningCloseout({
					source,
					sourceFingerprint: loaded.artifact.inputFingerprint,
					repo: loaded.artifact.repository,
					changedFiles,
					matchingLearnings: applicableLearnings,
				});
	const reviewHandoff = buildReviewHandoff(applicableLearnings, validationPlan);

	const result: ReviewContextResult = {
		schemaVersion: "review-context/v1",
		status: "success",
		source,
		generatedAt: options.generatedAt ?? new Date().toISOString(),
		sourceFingerprint: loaded.artifact.inputFingerprint,
		repo: loaded.artifact.repository,
		changedFiles,
		applicableLearnings,
		validationPlan: validationPlan.commands,
		closeout,
		networkRequired: validationPlan.networkRequired,
		...reviewHandoff,
		summary: {
			applicableLearnings: applicableLearnings.length,
			validationCommands: validationPlan.commands.length,
			networkRequired: validationPlan.networkRequired.length,
		},
	};

	if (options.output) {
		return writeReviewContextResult(result, options);
	}

	return result;
}

function writeReviewContextResult(
	result: ReviewContextResult,
	options: ReviewContextOptions,
): ReviewContextResult {
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
				code: "review-context.write_failed",
				message:
					"Failed to write review context: output must stay within repoRoot.",
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
				code: "review-context.write_failed",
				message: `Failed to write review context: ${error instanceof Error ? error.message : String(error)}`,
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
		if (!existingOutputTarget) {
			return false;
		}
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
 * Find the nearest existing filesystem ancestor for a candidate path.
 *
 * @param path - Absolute or repository-relative path to inspect
 * @returns The nearest existing ancestor path, or `undefined` when none exists
 */
function findNearestExistingAncestor(path: string): string | undefined {
	let current = path;
	for (;;) {
		if (existsSync(current)) {
			return current;
		}
		const parent = dirname(current);
		if (parent === current) {
			return undefined;
		}
		current = parent;
	}
}

/**
 * Build an error review-context result while preserving the advisory learning closeout.
 *
 * @param input - Source, repository, changed files, validation-plan failure, and closeout evidence to preserve
 * @returns A review-context error result with the validation failure and advisory closeout attached
 */
function buildValidationPlanErrorResult(input: {
	source: string;
	repo: string;
	changedFiles: string[];
	validationPlan: ValidationPlanResult;
	closeout: ReviewLearningCloseout;
}): ReviewContextResult {
	return {
		schemaVersion: "review-context/v1",
		status: "error",
		source: input.source,
		repo: input.repo,
		changedFiles: input.changedFiles,
		applicableLearnings: [],
		validationPlan: [],
		closeout: input.closeout,
		networkRequired: [],
		...emptyReviewHandoff(),
		summary: {
			applicableLearnings: 0,
			validationCommands: 0,
			networkRequired: 0,
		},
		error: {
			code:
				input.validationPlan.error?.code ??
				"review-context.validation_plan_failed",
			message:
				input.validationPlan.error?.message ??
				"Validation plan generation failed.",
			...(input.validationPlan.error?.fix
				? { fix: input.validationPlan.error.fix }
				: {}),
		},
	};
}

/**
 * Builds a ReviewContextLearning when a learning item applies to one or more changed files.
 *
 * @param item - The learning item to evaluate for applicability
 * @param changedFiles - Array of normalized changed file paths to match against the learning
 * @returns `ReviewContextLearning` when the item matches at least one file, `undefined` otherwise
 */
function buildReviewContextLearning(
	item: LearningItem,
	changedFiles: string[],
	promotionReasons: ReadonlyMap<string, string | undefined>,
): ReviewContextLearning | undefined {
	const matches = changedFiles
		.map((file) => ({ file, match: matchLearningToFile(item, file) }))
		.filter(
			(entry): entry is { file: string; match: LearningFileMatch } =>
				entry.match !== undefined,
		);
	const matchedFiles = matches.map((entry) => entry.file);
	if (matchedFiles.length === 0) return undefined;
	const strongestMatch = matches
		.map((entry) => entry.match)
		.sort((a, b) => b.confidence - a.confidence)[0];
	if (!strongestMatch) return undefined;
	const promotionReason = promotionReasons.get(item.id);
	const enforcedBy = normalizeEnforcedBy(item.enforcedBy);
	return {
		id: item.id,
		usage: item.usage,
		classification: item.classification,
		enforcement: item.enforcement,
		promotionStatus: item.promotionStatus,
		summary: item.learning,
		matchedFiles,
		fix: buildFix(item),
		evidenceRef: buildEvidenceRefs(item),
		match: strongestMatch,
		matches: matches.map((entry) => entry.match),
		...(enforcedBy ? { enforcedBy } : {}),
		...(promotionReason !== undefined ? { promotionReason } : {}),
	};
}

/**
 * Accept only concrete non-empty enforcement paths from untrusted learning artifacts.
 *
 * @param value - Runtime value supplied by an imported learning artifact
 * @returns A deduplicated path list, or `undefined` when the value is malformed or empty
 */
function normalizeEnforcedBy(value: unknown): string[] | undefined {
	if (
		!Array.isArray(value) ||
		value.length === 0 ||
		value.some((path) => typeof path !== "string" || path.trim().length === 0)
	) {
		return undefined;
	}
	return [...new Set(value as string[])];
}

function emptyReviewHandoff(): Pick<
	ReviewContextResult,
	| "reviewerLikelyConcerns"
	| "mustMentionInPr"
	| "evidenceRequired"
	| "knownRepeatedFailures"
	| "recommendedReviewers"
	| "doNotClaim"
> {
	return {
		reviewerLikelyConcerns: [],
		mustMentionInPr: [],
		evidenceRequired: [],
		knownRepeatedFailures: [],
		recommendedReviewers: [],
		doNotClaim: [],
	};
}

function buildReviewHandoff(
	applicableLearnings: ReviewContextLearning[],
	validationPlan: ValidationPlanResult,
): Pick<
	ReviewContextResult,
	| "reviewerLikelyConcerns"
	| "mustMentionInPr"
	| "evidenceRequired"
	| "knownRepeatedFailures"
	| "recommendedReviewers"
	| "doNotClaim"
> {
	const highSeverityLearnings = applicableLearnings.filter(
		(learning) =>
			learning.enforcement === "error" ||
			learning.promotionStatus === "enforced",
	);
	return {
		reviewerLikelyConcerns: applicableLearnings.map((learning) =>
			buildReviewerConcern(learning),
		),
		mustMentionInPr: [
			...highSeverityLearnings.map(
				(learning) =>
					`Acknowledge review-context learning ${learning.id}: ${learning.summary}`,
			),
			...(validationPlan.commands.length > 0
				? ["List the validation evidence used for the changed files."]
				: []),
			...(validationPlan.networkRequired.length > 0
				? [
						"Call out network-required checks that were blocked or run separately.",
					]
				: []),
		],
		evidenceRequired: [
			...validationPlan.commands.map(
				(command) => `${command.command}: ${command.reason}`,
			),
			...validationPlan.networkRequired.map(
				(command) => `${command.command}: ${command.reason}`,
			),
			...highSeverityLearnings.map(
				(learning) =>
					`PR body acknowledgement for high-severity learning ${learning.id}.`,
			),
		],
		knownRepeatedFailures: applicableLearnings.map(
			(learning) =>
				`${learning.id} (${learning.usage} uses): ${learning.summary}`,
		),
		recommendedReviewers:
			applicableLearnings.length > 0
				? ["CodeRabbit: imported learnings matched the changed files."]
				: [],
		doNotClaim: [
			...(validationPlan.commands.length > 0
				? [
						"Do not claim required validation has passed until the listed validation commands have run.",
					]
				: []),
			...(validationPlan.networkRequired.length > 0
				? [
						"Do not claim network-required checks are clear without separate evidence or an explicit blocker.",
					]
				: []),
			...(highSeverityLearnings.length > 0
				? [
						"Do not claim review-context learnings are acknowledged until high-severity learning IDs appear in the PR body.",
					]
				: []),
		],
	};
}

function buildReviewerConcern(learning: ReviewContextLearning): string {
	return `Reviewer should check review-context learning ${learning.id}: ${learning.summary}`;
}

/**
 * Constructs reviewer or agent instruction text based on a learning's classification, enforcement, and promotion status.
 *
 * @param item - The learning item whose attributes determine the instruction
 * @returns An instruction string guiding review or validation actions derived from `item`
 */
function buildFix(item: LearningItem): string {
	if (item.classification === "validation_contract") {
		return "Use the validation plan command selected from this learning before review handoff.";
	}
	if (item.promotionStatus === "enforced") {
		return "Confirm the corresponding permanent gate or validator passes before review handoff.";
	}
	if (item.enforcement === "error") {
		return "Resolve this learned constraint or document an explicit exception before review.";
	}
	return "Use this learned context while reviewing the changed files.";
}

/**
 * Builds evidence reference strings for a learning item.
 *
 * @param item - The learning item whose source and optional GitHub URL are used to construct references
 * @returns An array of reference strings including the primary source reference (`<kind>:<uri>#row=<row>`) and, if present, a `github_pr:<githubUrl>` entry
 */
function buildEvidenceRefs(item: LearningItem): string[] {
	const refs = [
		`${item.source.kind}:${item.source.uri}#row=${item.source.row}`,
	];
	if (item.githubUrl) refs.push(`github_pr:${item.githubUrl}`);
	return refs;
}

/**
 * Normalize, de-duplicate, and sort an array of file path strings.
 *
 * @param files - File path strings to normalize
 * @returns Sorted array of unique, normalized file paths
 */
function normalizeFiles(files: string[]): string[] {
	return [
		...new Set(files.map((file) => normalizeFile(file)).filter(Boolean)),
	].sort();
}

/**
 * Normalize a file path into a canonical, POSIX-style form.
 *
 * Trims surrounding whitespace, converts backslashes to forward slashes, and removes a leading `./`.
 *
 * @param file - The input file path string to normalize
 * @returns The normalized file path
 */
function normalizeFile(file: string): string {
	return file.trim().replace(/\\/g, "/").replace(/^\.\//, "");
}

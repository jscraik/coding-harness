import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DEFAULT_CODERABBIT_LOCAL_ARTIFACT } from "./artifact-io.js";
import { learningMatchesFile, loadLearningArtifact } from "./gate.js";
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
}

/** Result emitted by `harness review-context --json`. */
export interface ReviewContextResult {
	schemaVersion: "review-context/v1";
	status: "success" | "error";
	source: string;
	repo: string;
	changedFiles: string[];
	applicableLearnings: ReviewContextLearning[];
	validationPlan: ValidationPlanResult["commands"];
	networkRequired: ValidationPlanResult["networkRequired"];
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
}

/** Build a deterministic PR review-context pack. */
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
			networkRequired: [],
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

	const validationPlan = buildValidationPlan({
		source,
		files: changedFiles,
		...(options.repoRoot ? { repoRoot: options.repoRoot } : {}),
	});
	const applicableLearnings = loaded.artifact.items
		.map((item) => buildReviewContextLearning(item, changedFiles))
		.filter((item): item is ReviewContextLearning => item !== undefined)
		.sort((a, b) => b.usage - a.usage || a.id.localeCompare(b.id));

	const result: ReviewContextResult = {
		schemaVersion: "review-context/v1",
		status: "success",
		source,
		repo: loaded.artifact.repository,
		changedFiles,
		applicableLearnings,
		validationPlan: validationPlan.commands,
		networkRequired: validationPlan.networkRequired,
		summary: {
			applicableLearnings: applicableLearnings.length,
			validationCommands: validationPlan.commands.length,
			networkRequired: validationPlan.networkRequired.length,
		},
	};

	if (options.output) {
		const outputPath = resolve(
			options.repoRoot ?? process.cwd(),
			options.output,
		);
		mkdirSync(dirname(outputPath), { recursive: true });
		writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf-8");
		return { ...result, outputPath };
	}

	return result;
}

function buildReviewContextLearning(
	item: LearningItem,
	changedFiles: string[],
): ReviewContextLearning | undefined {
	const matchedFiles = changedFiles.filter((file) =>
		learningMatchesFile(item, file),
	);
	if (matchedFiles.length === 0) return undefined;
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
	};
}

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

function buildEvidenceRefs(item: LearningItem): string[] {
	const refs = [
		`${item.source.kind}:${item.source.uri}#row=${item.source.row}`,
	];
	if (item.githubUrl) refs.push(`github_pr:${item.githubUrl}`);
	return refs;
}

function normalizeFiles(files: string[]): string[] {
	return [...new Set(files.map((file) => normalizeFile(file)).filter(Boolean))];
}

function normalizeFile(file: string): string {
	return file.trim().replace(/\\/g, "/").replace(/^\.\//, "");
}

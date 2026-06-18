import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { inspectFlagList, inspectFlagValue } from "../lib/cli/parse-utils.js";
import {
	type CandidateSibling,
	buildSearchCommands,
	detectTriggerPhrases,
	findCandidateSiblings,
	isPathInsideRepo,
	listRepoFiles,
	normalizeRepoPath,
} from "./pattern-scope-siblings.js";

const EXIT_CODES = {
	SUCCESS: 0,
	FAILURE: 1,
	USAGE: 2,
} as const;

interface PatternScopeOptions {
	files: string[];
	feedback?: string;
	output?: string;
	repoRoot?: string;
}

interface PatternScopeArtifact {
	schemaVersion: "pattern-scope/v1";
	status: "success";
	repoRoot: string;
	changedFiles: string[];
	scanningTruncated: boolean;
	totalFilesScanned: number;
	feedback: string;
	triggered: boolean;
	triggerPhrases: string[];
	principlePrompt: string;
	searchCommands: string[];
	candidateSiblings: CandidateSibling[];
	requiredInventory: {
		principle: string;
		siblingSearch: string;
		siblingsChanged: string;
		siblingsUnchanged: string;
		validation: string;
	};
	nextActions: string[];
	outputPath?: string;
}

interface PatternScopeError {
	schemaVersion: "pattern-scope/v1";
	status: "error";
	error: {
		code: string;
		message: string;
	};
}

function patternScopeError(
	code: PatternScopeError["error"]["code"],
	message: string,
): PatternScopeError {
	return {
		schemaVersion: "pattern-scope/v1",
		status: "error",
		error: { code, message },
	};
}

function validatePatternScopeRepoRoot(
	repoRoot: string,
): PatternScopeError | null {
	if (!existsSync(repoRoot)) {
		return patternScopeError(
			"pattern-scope.repo_missing",
			`Repo root does not exist: ${repoRoot}`,
		);
	}
	if (!statSync(repoRoot).isDirectory()) {
		return patternScopeError(
			"pattern-scope.repo_not_directory",
			`Repo root must be a directory: ${repoRoot}`,
		);
	}
	return null;
}

function writePatternScopeOutput(
	repoRoot: string,
	output: string,
	artifact: PatternScopeArtifact,
): PatternScopeError | null {
	const outputPath = resolve(repoRoot, output);
	const outputRepoPath = relative(repoRoot, outputPath);
	if (!isPathInsideRepo(outputRepoPath)) {
		return patternScopeError(
			"pattern-scope.output_outside_repo",
			`Output path must stay inside repo root: ${output}`,
		);
	}
	if (existsSync(outputPath) && !statSync(outputPath).isFile()) {
		return patternScopeError(
			"pattern-scope.output_not_file",
			`Output path must be a file: ${output}`,
		);
	}
	artifact.outputPath = outputRepoPath;
	try {
		mkdirSync(dirname(outputPath), { recursive: true });
		writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
	} catch (err) {
		return patternScopeError(
			"pattern-scope.output_write_failed",
			`Failed to write output file: ${err instanceof Error ? err.message : String(err)}`,
		);
	}
	return null;
}

function renderPatternScopeResult(
	result: PatternScopeArtifact | PatternScopeError,
	json: boolean,
): number {
	if ("error" in result) {
		renderPatternScopeFailure(result, json);
		return EXIT_CODES.FAILURE;
	}

	renderPatternScopeSuccess(result, json);
	return EXIT_CODES.SUCCESS;
}

function renderPatternScopeFailure(
	result: PatternScopeError,
	json: boolean,
): void {
	if (json) {
		console.info(JSON.stringify(result, null, 2));
		return;
	}
	console.error(`Error: ${result.error.message}`);
}

function renderPatternScopeSuccess(
	result: PatternScopeArtifact,
	json: boolean,
): void {
	if (json) {
		console.info(JSON.stringify(result, null, 2));
		return;
	}
	console.info(`Pattern scope triggered: ${result.triggered ? "yes" : "no"}`);
	console.info(`Candidate siblings: ${result.candidateSiblings.length}`);
	if (result.outputPath) {
		console.info(`Artifact: ${result.outputPath}`);
	}
}

/**
 * Execute the pattern-scope command.
 *
 * Produces a compact artifact that forces local steering or review feedback to
 * be widened into sibling-surface discovery before an agent claims the fix is
 * done.
 *
 * @param args - CLI arguments for pattern-scope.
 * @returns Process exit code.
 */
export function runPatternScopeCLI(args: string[]): number {
	const json = args.includes("--json");
	const filesFlag = inspectFlagList(args, "--files");
	const feedbackFlag = inspectFlagValue(args, "--feedback");
	const outputFlag = inspectFlagValue(args, "--output");
	const repoRootFlag = inspectFlagValue(args, "--repo-root");
	const missingFlag = [
		{ flag: "--feedback", inspection: feedbackFlag },
		{ flag: "--output", inspection: outputFlag },
		{ flag: "--repo-root", inspection: repoRootFlag },
	].find(({ inspection }) => inspection.missingValue);

	if (missingFlag) {
		return emitError({
			json,
			code: "pattern-scope.flag_value_required",
			message: `harness pattern-scope requires a value after ${missingFlag.flag}.`,
		});
	}
	if (!filesFlag.present || filesFlag.missingValue) {
		return emitError({
			json,
			code: "pattern-scope.files_required",
			message: "harness pattern-scope requires --files.",
		});
	}

	const artifactOptions: PatternScopeOptions = {
		files: filesFlag.values,
	};
	if (feedbackFlag.value !== undefined) {
		artifactOptions.feedback = feedbackFlag.value;
	}
	if (outputFlag.value !== undefined) {
		artifactOptions.output = outputFlag.value;
	}
	if (repoRootFlag.value !== undefined) {
		artifactOptions.repoRoot = repoRootFlag.value;
	}

	const result = buildPatternScopeArtifact(artifactOptions);
	return renderPatternScopeResult(result, json);
}

/**
 * Create a pattern-scope artifact describing repository context and candidate sibling files for given changed files and optional feedback.
 *
 * @param options - Inputs: `files` (changed repo paths), optional `feedback` text to detect broader-scope triggers, optional `output` file path (written inside the repo when provided), and optional `repoRoot` to resolve paths against.
 * @returns A `PatternScopeArtifact` on success; otherwise a `PatternScopeError` with one of:
 * - `pattern-scope.repo_missing` when the resolved repo root does not exist,
 * - `pattern-scope.repo_not_directory` when the resolved repo root is not a directory,
 * - `pattern-scope.file_outside_repo` when any changed file resolves outside the repo root,
 * - `pattern-scope.output_outside_repo` when a requested output path resolves outside the repo root,
 * - `pattern-scope.output_not_file` when a requested output path already exists as a directory.
 */
export function buildPatternScopeArtifact(
	options: PatternScopeOptions,
): PatternScopeArtifact | PatternScopeError {
	const repoRoot = resolve(options.repoRoot ?? process.cwd());
	const repoRootError = validatePatternScopeRepoRoot(repoRoot);
	if (repoRootError) return repoRootError;

	const normalizedFiles = options.files.map((file) =>
		normalizeRepoPath(repoRoot, file),
	);
	const outsideFile = normalizedFiles.find((file) => !isPathInsideRepo(file));
	if (outsideFile !== undefined) {
		return patternScopeError(
			"pattern-scope.file_outside_repo",
			`Changed files must stay inside repo root: ${outsideFile}`,
		);
	}

	const changedFiles = Array.from(new Set(normalizedFiles)).sort();
	const repoFileScan = listRepoFiles(repoRoot);
	const candidateSiblings = findCandidateSiblings(
		repoRoot,
		changedFiles,
		repoFileScan.files,
	);
	const feedback = options.feedback ?? "";
	const triggerPhrases = detectTriggerPhrases(feedback);
	const artifact: PatternScopeArtifact = {
		schemaVersion: "pattern-scope/v1",
		status: "success",
		repoRoot,
		changedFiles,
		scanningTruncated: repoFileScan.scanningTruncated,
		totalFilesScanned: repoFileScan.totalFilesScanned,
		feedback,
		triggered: triggerPhrases.length > 0,
		triggerPhrases,
		principlePrompt:
			"Infer the design/API/workflow principle behind the feedback before editing siblings.",
		searchCommands: buildSearchCommands(changedFiles, feedback),
		candidateSiblings,
		requiredInventory: {
			principle: "Name the inferred principle before claiming the fix.",
			siblingSearch:
				"List sibling code, tests, docs, schemas, generated projections, skills, and gates searched.",
			siblingsChanged:
				"List matching siblings changed or the shared owner updated.",
			siblingsUnchanged:
				"List siblings intentionally left unchanged with reasons or tracked follow-up.",
			validation:
				"Record exact validation commands proving the wider pass or blocker.",
		},
		nextActions: [
			"Review candidateSiblings before editing.",
			"Run the listed searchCommands or stronger repo-specific equivalents.",
			"Update shared owner or matching siblings when the principle applies.",
			"Record intentionally unchanged siblings with reasons.",
		],
	};

	if (options.output) {
		const outputError = writePatternScopeOutput(
			repoRoot,
			options.output,
			artifact,
		);
		if (outputError) return outputError;
	}

	return artifact;
}

/**
 * Emit a structured JSON error to stdout or a plain error message to stderr.
 *
 * @param options - Error emission options
 * @param options.json - If `true`, print a structured `PatternScopeError` JSON to stdout; otherwise print a plain error to stderr
 * @param options.code - Machine-readable error code to include in the structured payload
 * @param options.message - Human-readable error message to display
 * @returns The usage exit code `EXIT_CODES.USAGE`
 */
function emitError(options: {
	json: boolean;
	code: string;
	message: string;
}): number {
	if (options.json) {
		const payload: PatternScopeError = {
			schemaVersion: "pattern-scope/v1",
			status: "error",
			error: {
				code: options.code,
				message: options.message,
			},
		};
		console.info(JSON.stringify(payload, null, 2));
	} else {
		console.error(`Error: ${options.message}`);
	}
	return EXIT_CODES.USAGE;
}

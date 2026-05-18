import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	statSync,
	writeFileSync,
} from "node:fs";
import {
	basename,
	dirname,
	extname,
	isAbsolute,
	join,
	relative,
	resolve,
} from "node:path";
import { inspectFlagList, inspectFlagValue } from "../lib/cli/parse-utils.js";

const EXIT_CODES = {
	SUCCESS: 0,
	FAILURE: 1,
	USAGE: 2,
} as const;

const IGNORED_DIRS = new Set([
	".git",
	".next",
	"node_modules",
	"dist",
	"artifacts",
	"codex-scripts",
	"coverage",
	".turbo",
	".cache",
	"cache",
	"runs",
	"backups",
	"tmp",
	"temp",
]);

const IGNORED_PATH_PATTERNS = [
	/^\.harness\/runs(?:\/|$)/,
	/^\.harness\/backups(?:\/|$)/,
	/^\.harness\/knowledge(?:\/|$)/,
	/^\.harness\/memory\/codex-learned(?:\/|$)/,
	/^\.harness\/guardrails(?:\/|$)/,
];

const MAX_SCANNED_FILES = 3000;
const MAX_TEXT_FILE_BYTES = 128 * 1024;

const BROADER_SCOPE_PHRASES = [
	"line-level correction",
	"line-level design feedback",
	"example-based feedback",
	"concrete correction",
	"single line",
	"single function",
	"single class",
	"just fix that line",
	"do not just fix that line",
	"not just that line",
	"similar classes of misbehavior",
	"similar misbehavior",
	"class of misbehavior",
	"similar class",
	"same pattern",
	"same things in multiple places",
	"larger perspective",
	"larger-system judgment",
	"broader perspective",
	"apply this everywhere relevant",
	"sibling implementations",
	"sibling pattern",
	"sibling",
	"broader design principle",
	"design principle",
	"design model",
	"API design generally",
	"across everything we do",
	"across everything",
	"named sentinel error",
	"success and failure as a bool",
	"success/failure boolean",
	"boolean result",
] as const;

const BROADER_SCOPE_PATTERN = new RegExp(
	BROADER_SCOPE_PHRASES.map(escapeRegex).join("|"),
	"i",
);

interface CandidateSibling {
	file: string;
	reasons: string[];
}

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

interface RepoFileScan {
	files: string[];
	scanningTruncated: boolean;
	totalFilesScanned: number;
}

interface PatternScopeError {
	schemaVersion: "pattern-scope/v1";
	status: "error";
	error: {
		code: string;
		message: string;
	};
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

	if ("error" in result) {
		if (json) {
			console.info(JSON.stringify(result, null, 2));
		} else {
			console.error(`Error: ${result.error.message}`);
		}
		return EXIT_CODES.FAILURE;
	}

	if (json) {
		console.info(JSON.stringify(result, null, 2));
	} else {
		console.info(`Pattern scope triggered: ${result.triggered ? "yes" : "no"}`);
		console.info(`Candidate siblings: ${result.candidateSiblings.length}`);
		if (result.outputPath) {
			console.info(`Artifact: ${result.outputPath}`);
		}
	}
	return EXIT_CODES.SUCCESS;
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
	if (!existsSync(repoRoot)) {
		return {
			schemaVersion: "pattern-scope/v1",
			status: "error",
			error: {
				code: "pattern-scope.repo_missing",
				message: `Repo root does not exist: ${repoRoot}`,
			},
		};
	}
	if (!statSync(repoRoot).isDirectory()) {
		return {
			schemaVersion: "pattern-scope/v1",
			status: "error",
			error: {
				code: "pattern-scope.repo_not_directory",
				message: `Repo root must be a directory: ${repoRoot}`,
			},
		};
	}

	const normalizedFiles = options.files.map((file) =>
		normalizeRepoPath(repoRoot, file),
	);
	const outsideFile = normalizedFiles.find((file) => !isPathInsideRepo(file));
	if (outsideFile !== undefined) {
		return {
			schemaVersion: "pattern-scope/v1",
			status: "error",
			error: {
				code: "pattern-scope.file_outside_repo",
				message: `Changed files must stay inside repo root: ${outsideFile}`,
			},
		};
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
		const outputPath = resolve(repoRoot, options.output);
		const outputRepoPath = relative(repoRoot, outputPath);
		if (!isPathInsideRepo(outputRepoPath)) {
			return {
				schemaVersion: "pattern-scope/v1",
				status: "error",
				error: {
					code: "pattern-scope.output_outside_repo",
					message: `Output path must stay inside repo root: ${options.output}`,
				},
			};
		}
		if (existsSync(outputPath) && !statSync(outputPath).isFile()) {
			return {
				schemaVersion: "pattern-scope/v1",
				status: "error",
				error: {
					code: "pattern-scope.output_not_file",
					message: `Output path must be a file: ${options.output}`,
				},
			};
		}
		artifact.outputPath = outputRepoPath;
		mkdirSync(dirname(outputPath), { recursive: true });
		writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
	}

	return artifact;
}

/**
 * Emit a structured JSON error or a plain stderr message and return the usage exit code.
 *
 * @param options - Error emission options
 * @param options.json - If `true`, print a structured `PatternScopeError` JSON to stdout; otherwise print a plain error to stderr
 * @param options.code - Machine-readable error code to include in the structured payload
 * @param options.message - Human-readable error message to display
 * @returns The usage exit code (`EXIT_CODES.USAGE`)
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

/**
 * Produce a normalized repository-relative path with forward slashes.
 *
 * @param repoRoot - Absolute or relative filesystem path to the repository root
 * @param file - File path to normalize (absolute or relative to `repoRoot`)
 * @returns The repo-relative path to `file` using `/` as the path separator
 */
function normalizeRepoPath(repoRoot: string, file: string): string {
	const absolute = resolve(repoRoot, file);
	return relative(repoRoot, absolute)
		.split(/[/\\]+/)
		.join("/");
}

/**
 * Scans a repository tree and returns repo-relative file paths found under the given root.
 *
 * Performs a depth-first traversal starting at `repoRoot`, skipping directories listed in `IGNORED_DIRS`
 * and paths that match `IGNORED_PATH_PATTERNS`. Collection stops when `MAX_SCANNED_FILES` is reached.
 *
 * @param repoRoot - Root directory of the repository to scan
 * @returns An object with:
 *  - `files`: sorted array of repo-relative file paths,
 *  - `scanningTruncated`: `true` if the scan stopped because the max file limit was reached,
 *  - `totalFilesScanned`: the number of files returned
 */
function listRepoFiles(repoRoot: string): RepoFileScan {
	const files: string[] = [];
	const stack = [repoRoot];
	let scanningTruncated = false;
	while (stack.length > 0 && files.length < MAX_SCANNED_FILES) {
		const current = stack.pop();
		if (!current) continue;
		for (const entry of readdirSync(current, { withFileTypes: true })) {
			const absolute = join(current, entry.name);
			const repoPath = relative(repoRoot, absolute)
				.split(/[/\\]+/)
				.join("/");
			if (
				entry.isDirectory() &&
				(IGNORED_DIRS.has(entry.name) || shouldIgnorePath(repoPath))
			) {
				continue;
			}
			if (entry.isDirectory()) {
				stack.push(absolute);
			} else if (entry.isFile()) {
				files.push(repoPath);
				if (files.length >= MAX_SCANNED_FILES) {
					scanningTruncated = true;
					break;
				}
			}
		}
	}
	return {
		files: files.sort(),
		scanningTruncated,
		totalFilesScanned: files.length,
	};
}

/**
 * Determines whether a repository-relative path should be ignored by the scanner based on configured ignore patterns.
 *
 * @param repoPath - The repository-relative path to test (use forward-slash separators)
 * @returns `true` if any configured ignore regex matches `repoPath`, `false` otherwise
 */
function shouldIgnorePath(repoPath: string): boolean {
	return IGNORED_PATH_PATTERNS.some((pattern) => pattern.test(repoPath));
}

/**
 * Identify up to 100 repository files that are likely "sibling" files to the changed files.
 *
 * Examines each candidate repo file (excluding the changed files) for four heuristics: same basename, same directory and extension, common test counterpart naming, and mentions of the changed file's stem in text/code files. Collects human-readable reasons for each match, sorts candidates by path, and returns at most the first 100.
 *
 * @param repoRoot - Repository root used when resolving/reading files for stem-mention checks.
 * @param changedFiles - Repo-relative paths of the changed files (normalized, deduplicated).
 * @param repoFiles - Sorted list of repo-relative file paths to consider as potential siblings.
 * @returns An array of candidate sibling objects, each with `file` (repo-relative path) and `reasons` (sorted list of matching heuristics); the array is lexically sorted by file and limited to 100 entries.
 */
function findCandidateSiblings(
	repoRoot: string,
	changedFiles: string[],
	repoFiles: string[],
): CandidateSibling[] {
	const candidates = new Map<string, Set<string>>();
	const changedSet = new Set(changedFiles);
	for (const changedFile of changedFiles) {
		const changedBase = basename(changedFile);
		const changedExt = extname(changedFile);
		const changedStem = changedBase.slice(
			0,
			changedBase.length - changedExt.length,
		);
		const changedDir = dirname(changedFile);
		for (const repoFile of repoFiles) {
			if (changedSet.has(repoFile)) continue;
			const reasons = candidates.get(repoFile) ?? new Set<string>();
			if (basename(repoFile) === changedBase) {
				reasons.add(`same basename as ${changedFile}`);
			}
			if (
				dirname(repoFile) === changedDir &&
				extname(repoFile) === changedExt
			) {
				reasons.add(`same directory and extension as ${changedFile}`);
			}
			if (isTestCounterpart(repoFile, changedStem, changedExt)) {
				reasons.add(`test counterpart for ${changedFile}`);
			}
			if (mentionsChangedStem(repoRoot, repoFile, changedStem)) {
				reasons.add(`mentions ${changedStem}`);
			}
			if (reasons.size > 0) {
				candidates.set(repoFile, reasons);
			}
		}
	}
	return Array.from(candidates.entries())
		.map(([file, reasons]) => ({
			file,
			reasons: Array.from(reasons).sort(),
		}))
		.sort((left, right) => left.file.localeCompare(right.file))
		.slice(0, 100);
}

/**
 * Determines whether a repository file is a test counterpart for a changed file stem.
 *
 * @param repoFile - Repo-relative path of the candidate file
 * @param changedStem - Basename of the changed file without its extension (e.g., `utils`)
 * @param changedExt - Extension of the changed file including the leading dot (e.g., `.ts`)
 * @returns `true` if `repoFile` follows common test naming conventions for the stem (`<stem>.test<ext>`, `<stem>.spec<ext>`, or resides under a `/__tests__/` directory containing the stem), `false` otherwise.
 */
function isTestCounterpart(
	repoFile: string,
	changedStem: string,
	changedExt: string,
): boolean {
	const repoBase = basename(repoFile);
	return (
		repoBase === `${changedStem}.test${changedExt}` ||
		repoBase === `${changedStem}.spec${changedExt}` ||
		repoFile.includes(`/__tests__/${changedStem}`)
	);
}

/**
 * Determines whether a repository file likely contains the given changed file stem.
 *
 * Performs fast checks (allowed text file extensions, stem length, and file size) before reading the file; returns `true` only if the file content includes `changedStem`.
 *
 * @param repoRoot - Repository root directory used to resolve `repoFile`
 * @param repoFile - Repo-relative path to the file to inspect
 * @param changedStem - Basename (without extension) to search for; must be at least 4 characters
 * @returns `true` if `repoFile` passes quick checks and its contents include `changedStem`, `false` otherwise
 */
function mentionsChangedStem(
	repoRoot: string,
	repoFile: string,
	changedStem: string,
): boolean {
	if (!/\.(md|mdx|txt|json|ya?ml|ts|tsx|js|jsx)$/.test(repoFile)) {
		return false;
	}
	if (changedStem.length < 4) {
		return false;
	}
	try {
		if (statSync(resolve(repoRoot, repoFile)).size > MAX_TEXT_FILE_BYTES) {
			return false;
		}
		return readFileSync(resolve(repoRoot, repoFile), "utf8").includes(
			changedStem,
		);
	} catch {
		return false;
	}
}

/**
 * Detects configured broader-scope trigger phrases present in the provided feedback.
 *
 * @param feedback - Free-form feedback text to scan for trigger phrases
 * @returns The matched broader-scope phrases in their original form and in the order defined by the configured phrase list; empty array if none are found
 */
function detectTriggerPhrases(feedback: string): string[] {
	if (!feedback.trim()) {
		return [];
	}
	if (!BROADER_SCOPE_PATTERN.test(feedback)) {
		return [];
	}
	const lowerFeedback = feedback.toLowerCase();
	return BROADER_SCOPE_PHRASES.filter((phrase) =>
		lowerFeedback.includes(phrase.toLowerCase()),
	);
}

/**
 * Build a small set of shell commands to help locate related files and changes.
 *
 * @param changedFiles - Paths of changed files; their basenames (without extensions) with length >= 4 are used (up to 5 unique names) to form a search pattern.
 * @param feedback - Optional feedback text; when non-empty, an additional fixed-string ripgrep command is added using the first 80 characters (escaped for double quotes).
 * @returns An array of shell commands: an `rg` command searching for the selected basenames (or a placeholder pattern), `git diff --name-only`, and optionally an `rg -F -n` command for the feedback snippet.
 */
function buildSearchCommands(
	changedFiles: string[],
	feedback: string,
): string[] {
	const basenames = changedFiles
		.map((file) => basename(file, extname(file)))
		.filter((name) => name.length >= 4);
	const uniqueNames = Array.from(new Set(basenames)).slice(0, 5);
	return [
		`rg -n "${uniqueNames.join("|") || "TODO_REPLACE_WITH_PATTERN"}" src tests docs .harness`,
		"git diff --name-only",
		...(feedback.trim()
			? [`rg -F -n "${escapeForDoubleQuotedRg(feedback.slice(0, 80))}" .`]
			: []),
	];
}

/**
 * Escape double quotes and backslashes so a string can be safely placed inside a double-quoted ripgrep pattern.
 *
 * @param value - The string to escape
 * @returns The input with `"` and `\` prefixed by a backslash
 */
function escapeForDoubleQuotedRg(value: string): string {
	return value.replace(/["\\]/g, "\\$&");
}

/**
 * Escapes regex metacharacters in a string for safe inclusion in a regular expression.
 *
 * @param value - The input string to escape
 * @returns The input with regex metacharacters (`. * + ? ^ $ { } ( ) | [ ] \`) prefixed with a backslash
 */
function escapeRegex(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Determines whether a repository-relative path points inside the repository.
 *
 * @param repoRelativePath - The path to evaluate, expressed relative to the repository root
 * @returns `true` if `repoRelativePath` is non-empty, does not start with `..`, and is not an absolute path; `false` otherwise
 */
function isPathInsideRepo(repoRelativePath: string): boolean {
	return (
		repoRelativePath.length > 0 &&
		!repoRelativePath.startsWith("..") &&
		!isAbsolute(repoRelativePath)
	);
}

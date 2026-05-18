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
 * Build a pattern-scope artifact from changed files and optional feedback text.
 *
 * @param options - Pattern-scope input options.
 * @returns A successful artifact or structured error.
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
		artifact.outputPath = outputRepoPath;
		mkdirSync(dirname(outputPath), { recursive: true });
		writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
	}

	return artifact;
}

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

function normalizeRepoPath(repoRoot: string, file: string): string {
	const absolute = resolve(repoRoot, file);
	return relative(repoRoot, absolute)
		.split(/[/\\]+/)
		.join("/");
}

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

function shouldIgnorePath(repoPath: string): boolean {
	return IGNORED_PATH_PATTERNS.some((pattern) => pattern.test(repoPath));
}

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

function escapeForDoubleQuotedRg(value: string): string {
	return value.replace(/["\\]/g, "\\$&");
}

function escapeRegex(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isPathInsideRepo(repoRelativePath: string): boolean {
	return (
		repoRelativePath.length > 0 &&
		!repoRelativePath.startsWith("..") &&
		!isAbsolute(repoRelativePath)
	);
}

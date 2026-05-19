import { readdirSync, readFileSync, statSync } from "node:fs";
import {
	basename,
	dirname,
	extname,
	isAbsolute,
	join,
	relative,
	resolve,
} from "node:path";

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

/** Candidate file that may share the same pattern-scope principle as a changed file. */
export interface CandidateSibling {
	file: string;
	reasons: string[];
}

interface RepoFileScan {
	files: string[];
	scanningTruncated: boolean;
	totalFilesScanned: number;
}

/**
 * Produce a normalized repository-relative path with forward slashes.
 *
 * @param repoRoot - Absolute or relative filesystem path to the repository root
 * @param file - File path to normalize (absolute or relative to `repoRoot`)
 * @returns The repo-relative path to `file` using `/` as the path separator
 */
export function normalizeRepoPath(repoRoot: string, file: string): string {
	const absolute = resolve(repoRoot, file);
	return relative(repoRoot, absolute)
		.split(/[/\\]+/)
		.join("/");
}

/**
 * Collects repo-relative file paths under the given repository root.
 *
 * Performs a depth-first traversal starting at `repoRoot`, skipping directories named in
 * `IGNORED_DIRS` and paths that match `IGNORED_PATH_PATTERNS`. Collection stops once
 * `MAX_SCANNED_FILES` entries have been gathered.
 *
 * @param repoRoot - Root directory of the repository to scan
 * @returns An object containing:
 *  - `files`: a sorted array of repo-relative file paths,
 *  - `scanningTruncated`: `true` if the scan stopped because the max file limit was reached,
 *  - `totalFilesScanned`: the number of files returned
 */
export function listRepoFiles(repoRoot: string): RepoFileScan {
	const files: string[] = [];
	const stack = [repoRoot];
	let scanningTruncated = false;
	while (stack.length > 0 && files.length < MAX_SCANNED_FILES) {
		const current = stack.pop();
		if (!current) continue;
		let entries;
		try {
			entries = readdirSync(current, { withFileTypes: true });
		} catch {
			continue;
		}
		for (const entry of entries) {
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
export function findCandidateSiblings(
	repoRoot: string,
	changedFiles: string[],
	repoFiles: string[],
): CandidateSibling[] {
	const candidates = new Map<string, Set<string>>();
	const changedSet = new Set(changedFiles);
	const textFileCache = new Map<string, string | null>();
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
			if (mentionsChangedStem(repoRoot, repoFile, changedStem, textFileCache)) {
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
 * Checks whether a repository file's text contains the specified changed-file stem.
 *
 * Only text/code/markup files are considered and the `changedStem` must be at least 4 characters; file contents are read once and cached via `textFileCache`.
 *
 * @param repoRoot - Repository root directory used to resolve `repoFile`
 * @param repoFile - Repo-relative path to the file to inspect
 * @param changedStem - Basename (without extension) to search for; must be at least 4 characters
 * @param textFileCache - Cache mapping repo-relative file paths to their contents (`string`) or `null` (unreadable/oversized); used to avoid repeated reads
 * @returns `true` if `repoFile` is a considered text file and its contents include `changedStem`, `false` otherwise
 */
function mentionsChangedStem(
	repoRoot: string,
	repoFile: string,
	changedStem: string,
	textFileCache: Map<string, string | null>,
): boolean {
	if (!/\.(md|mdx|txt|json|ya?ml|ts|tsx|js|jsx)$/.test(repoFile)) {
		return false;
	}
	if (changedStem.length < 4) {
		return false;
	}
	if (!textFileCache.has(repoFile)) {
		textFileCache.set(repoFile, readTextFileForStemSearch(repoRoot, repoFile));
	}
	return textFileCache.get(repoFile)?.includes(changedStem) ?? false;
}

/**
 * Reads the UTF-8 contents of a repository-relative file when it is present and not too large.
 *
 * @param repoRoot - Absolute path to the repository root
 * @param repoFile - Path to the file relative to `repoRoot`
 * @returns The file contents as a UTF-8 string, or `null` if the file is larger than `MAX_TEXT_FILE_BYTES` or cannot be accessed/read
 */
function readTextFileForStemSearch(
	repoRoot: string,
	repoFile: string,
): string | null {
	try {
		if (statSync(resolve(repoRoot, repoFile)).size > MAX_TEXT_FILE_BYTES) {
			return null;
		}
		return readFileSync(resolve(repoRoot, repoFile), "utf8");
	} catch {
		return null;
	}
}

/**
 * Detects configured broader-scope trigger phrases within the provided feedback.
 *
 * Matching is case-insensitive; phrases are returned in their original form and
 * in the order defined by the configured phrase list.
 *
 * @param feedback - Free-form feedback text to scan for trigger phrases
 * @returns The matched broader-scope phrases in their original form and in the order defined by the configured phrase list; empty array if none are found
 */
export function detectTriggerPhrases(feedback: string): string[] {
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
 * Constructs shell commands to help locate files related to the provided changed files and optional feedback.
 *
 * @param changedFiles - File paths whose basenames (without extensions) are used to build up to five search terms (only names with length ≥ 4 are considered).
 * @param feedback - Optional free-form text; when non-empty, a fixed-string ripgrep command is added using the first 80 characters.
 * @returns An array of shell command strings: (1) a ripgrep (`rg -n`) command searching for the selected basenames or a placeholder pattern, (2) `git diff --name-only`, and (3) when `feedback` is non-empty, an `rg -F -n` command for the escaped feedback excerpt.
 */
export function buildSearchCommands(
	changedFiles: string[],
	feedback: string,
): string[] {
	const basenames = changedFiles
		.map((file) => basename(file, extname(file)))
		.filter((name) => name.length >= 4);
	const uniqueNames = Array.from(new Set(basenames)).slice(0, 5);
	const escapedNames = uniqueNames.map((name) =>
		escapeForDoubleQuotedRg(escapeRegex(name)),
	);
	return [
		`rg -n "${escapedNames.join("|") || "TODO_REPLACE_WITH_PATTERN"}" src tests docs .harness`,
		"git diff --name-only",
		...(feedback.trim()
			? [`rg -F -n "${escapeForDoubleQuotedRg(feedback.slice(0, 80))}" .`]
			: []),
	];
}

/**
 * Escape characters so a string can be safely placed inside a double-quoted ripgrep pattern.
 *
 * @param value - The string to escape
 * @returns The input with `"`, `\`, `$`, and `` ` `` prefixed by a backslash
 */
function escapeForDoubleQuotedRg(value: string): string {
	return value.replace(/["\\$`]/g, "\\$&");
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
import {
	basename,
	dirname,
	extname,
	isAbsolute,
	join,
	normalize,
	relative,
	resolve,
} from "node:path";

export function isPathInsideRepo(repoRelativePath: string): boolean {
	const normalized = normalize(repoRelativePath).replace(/\\/g, "/");
	return (
		normalized.length > 0 &&
		normalized !== "." &&
		normalized !== ".." &&
		!normalized.startsWith("../") &&
		!isAbsolute(normalized)
	);
}
}

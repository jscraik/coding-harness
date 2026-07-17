import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { loadContract } from "../lib/contract/loader.js";
import {
	DEFAULT_CONTRACT,
	type HarnessContract,
} from "../lib/contract/types.js";
import { PathTraversalError, validatePath } from "../lib/input/validator.js";
import { findRepositories } from "../lib/org/repositories.js";
import {
	APPROVED_PREK_LEAF_ENTRIES,
	REQUIRED_HOOK_SUPPORT_FILES,
	REQUIRED_PACKAGE_SCRIPTS,
	REQUIRED_PREK_HOOKS,
	TOOLING_PACKAGE_JSON_PATH,
	TOOLING_PREK_CONFIG_PATH,
} from "../lib/policy/tooling-baseline.js";
import { type CliResult, err, ok } from "../lib/result/types.js";

export const EXIT_CODES = {
	SUCCESS: 0,
	NO_REPOS_FOUND: 1,
	SCAN_ERRORS: 2,
	DRIFT_DETECTED: 3,
	INVALID_ARGUMENT: 4,
} as const;

/**
 * Supported output formats for tooling-audit reports.
 */
export type OutputFormat = "json" | "markdown" | "table";
/**
 * Severity classes emitted by tooling-audit findings.
 */
export type FindingSeverity = "critical" | "warning" | "info";

/**
 * Single tooling-audit finding describing detected drift.
 */
export interface ToolingAuditFinding {
	path: string;
	severity: FindingSeverity;
	description: string;
	expected?: unknown;
	actual?: unknown;
}

/**
 * Per-repository tooling-audit result.
 */
export interface ToolingAuditRepoResult {
	path: string;
	status: "success" | "error" | "no-contract";
	findings: ToolingAuditFinding[];
	error?: string | undefined;
}

/**
 * Options accepted by tooling-audit execution.
 */
export interface ToolingAuditOptions {
	path: string;
	baseContract?: HarnessContract | undefined;
	format: OutputFormat;
	includeMissing?: boolean | undefined;
}

/**
 * Aggregate tooling-audit report across scanned repositories.
 */
export interface ToolingAuditResult {
	totalRepos: number;
	successfulRepos: number;
	errors: number;
	noContract: number;
	findings: {
		total: number;
		critical: number;
		warning: number;
		info: number;
	};
	results: ToolingAuditRepoResult[];
}

interface PackageManifest {
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
}

const FORBIDDEN_PREK_HOOK_ENTRY_PATTERNS = [
	/\bmake\s+hooks-(?:pre-commit|pre-push|commit-msg)\b/,
	/\bpre-commit\s+run\b/,
	/\bprek\s+run\b/,
	/(?:^|\s)\.git\/hooks\//,
	/\bscripts\/run-prek\.sh\s+hook\b/,
] as const;

const MAX_READINESS_FORWARDING_DEPTH = 4;

const PREK_ALL_STAGES = [
	"manual",
	"commit-msg",
	"post-checkout",
	"post-commit",
	"post-merge",
	"post-rewrite",
	"pre-commit",
	"pre-merge-commit",
	"pre-push",
	"pre-rebase",
	"prepare-commit-msg",
] as const;

interface ParsedPrekHook {
	id: string | undefined;
	name: string | undefined;
	entry: string | undefined;
	language: string | undefined;
	passFilenames: boolean | undefined;
	stages: string[];
	duplicateKeys: string[];
	invalidKeys: string[];
}

interface ParsedTomlAssignment {
	key: string;
	value: unknown;
	valid: boolean;
}

interface TomlValueResult {
	value: unknown;
	end: number;
	valid: boolean;
}

interface ReadinessScriptSource {
	content: string;
	path: string;
}

interface ReadinessScriptResolution {
	source: ReadinessScriptSource | null;
	error: string | null;
}

interface ReadinessForwardingParse {
	target: string | null;
	error: string | null;
}

interface ReadinessStepResult {
	resolution: ReadinessScriptResolution | null;
	nextPath: string | null;
}

/**
 * Build a terminal readiness-resolution error.
 *
 * @param error - Human-readable failure reason.
 * @returns A terminal step result.
 */
function readinessStepError(error: string): ReadinessStepResult {
	return { resolution: { source: null, error }, nextPath: null };
}

/**
 * Validate and normalize a repository path supplied to the CLI.
 *
 * @param rawPath - User-provided path to validate.
 * @param field - Field name used in validation errors.
 * @returns A safe absolute path or a structured validation error.
 */
function validatePathInput(
	rawPath: string,
	field: string,
): CliResult<{ absolutePath: string; safePath: string }> {
	const absolutePath = resolve(rawPath);
	try {
		const safePath = validatePath(dirname(absolutePath), absolutePath);
		return ok({ absolutePath, safePath });
	} catch (error) {
		if (error instanceof PathTraversalError) {
			return err({
				code: "VALIDATION_ERROR",
				message: `${field} contains an unsafe path traversal sequence`,
			});
		}
		return err({
			code: "VALIDATION_ERROR",
			message: `${field} is not a valid path`,
		});
	}
}

function getRawJson(content: string): Record<string, unknown> {
	const parsed = JSON.parse(content) as unknown;
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
		throw new Error("Contract root must be an object");
	}
	return parsed as Record<string, unknown>;
}

/**
 * Read a UTF-8 text file when it exists.
 *
 * @param path - Absolute file path.
 * @returns File contents, or `null` when the file is absent.
 */
function readTextFile(path: string): string | null {
	if (!existsSync(path)) {
		return null;
	}
	try {
		return readFileSync(path, "utf-8");
	} catch {
		return null;
	}
}

/**
 * Check whether a candidate path is rooted within a repository path.
 *
 * @param rootPath - Canonical repository root.
 * @param candidatePath - Path to test for containment.
 * @returns Whether the candidate is the root or one of its descendants.
 */
function isContainedPath(rootPath: string, candidatePath: string): boolean {
	return (
		candidatePath === rootPath || candidatePath.startsWith(`${rootPath}${sep}`)
	);
}

/**
 * Extract an approved SCRIPT_DIR forwarding target from a shell wrapper.
 *
 * @param content - Shell source to inspect.
 * @returns The relative target path, a malformed-wrapper error, or no wrapper.
 */
function parseReadinessForwardingTarget(
	content: string,
): ReadinessForwardingParse {
	const scriptDirMarkerPattern =
		/^\s*SCRIPT_DIR=.*(?:BASH_SOURCE|\$\{?BASH_SOURCE)/;
	const lines = content.split(/\r?\n/);
	const hasForwardingExec = lines.some((line) =>
		/^\s*exec\b[^\r\n]*(?:\$\{SCRIPT_DIR\}|\$SCRIPT_DIR)\/[A-Za-z0-9._/-]+/.test(
			line,
		),
	);
	const scriptDirLines = lines.filter((line) =>
		scriptDirMarkerPattern.test(line),
	);
	if (!hasForwardingExec) {
		return { target: null, error: null };
	}
	if (scriptDirLines.length === 0) {
		return {
			target: null,
			error:
				"Readiness forwarding must use the canonical SCRIPT_DIR assignment",
		};
	}
	const invalidScriptDirLine = scriptDirLines.find(
		(line) => !isCanonicalScriptDirAssignment(line),
	);
	if (invalidScriptDirLine !== undefined) {
		return {
			target: null,
			error: `Readiness forwarding contains an unsupported command: ${invalidScriptDirLine.trim()}`,
		};
	}

	const forwardingExecPattern =
		/^\s*exec\s+bash\s+(?:"(?:\$\{SCRIPT_DIR\}|\$SCRIPT_DIR)\/([A-Za-z0-9._/-]+)"|(?:\$\{SCRIPT_DIR\}|\$SCRIPT_DIR)\/([A-Za-z0-9._/-]+))\s+"\$@"(?:\s+#.*)?\s*$/;
	const forwardingMatches = lines
		.map((line) => line.trim())
		.filter((line) => line.length > 0 && forwardingExecPattern.test(line));
	if (forwardingMatches.length !== 1) {
		return {
			target: null,
			error:
				"Readiness forwarding must use exactly one bash exec with the original arguments",
		};
	}

	const allowedLines = lines
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
	const shapeError = validateReadinessForwardingShape(
		allowedLines,
		forwardingExecPattern,
	);
	if (shapeError !== null) {
		return {
			target: null,
			error: `Readiness forwarding contains an unsupported command: ${shapeError}`,
		};
	}

	const match = forwardingExecPattern.exec(
		allowedLines.find((line) => forwardingExecPattern.test(line)) ?? "",
	);
	const target = match?.[1] ?? match?.[2] ?? null;
	if (target !== null && hasPathTraversalSegment(target)) {
		return {
			target: null,
			error: `Readiness forwarding target contains path traversal: ${target}`,
		};
	}
	return { target, error: null };
}

/**
 * Validate the required commands in an approved readiness forwarding wrapper.
 *
 * @param lines - Normalized non-empty shell source lines.
 * @param forwardingExecPattern - Exact forwarding command grammar.
 * @returns The invalid component, or `null` when the wrapper shape is valid.
 */
function validateReadinessForwardingShape(
	lines: string[],
	forwardingExecPattern: RegExp,
): string | null {
	if (lines[0] !== "#!/usr/bin/env bash") return "invalid shebang";
	const commandLines = lines.filter((line) => !line.startsWith("#"));
	const strictModeCount = lines.filter(
		(line) => stripShellTrailingComment(line) === "set -euo pipefail",
	).length;
	if (strictModeCount !== 1) return "invalid strict-mode declaration";
	const scriptDirCount = lines.filter((line) =>
		isCanonicalScriptDirAssignment(line),
	).length;
	if (scriptDirCount !== 1) return "invalid SCRIPT_DIR assignment";
	if (
		stripShellTrailingComment(commandLines[0] ?? "") !== "set -euo pipefail" ||
		!isCanonicalScriptDirAssignment(commandLines[1] ?? "") ||
		!forwardingExecPattern.test(commandLines[2] ?? "")
	) {
		return "strict mode, SCRIPT_DIR assignment, and exec must appear in order";
	}
	return (
		lines.find(
			(line) =>
				line !== "#!/usr/bin/env bash" &&
				!line.startsWith("#") &&
				stripShellTrailingComment(line) !== "set -euo pipefail" &&
				!isCanonicalScriptDirAssignment(line) &&
				!forwardingExecPattern.test(line),
		) ?? null
	);
}

/**
 * Detect explicit current-directory or parent-directory path segments.
 *
 * @param target - Repository-relative forwarding target.
 * @returns Whether the target contains a traversal segment.
 */
function hasPathTraversalSegment(target: string): boolean {
	return target
		.split("/")
		.some((segment) => segment === "." || segment === "..");
}

/**
 * Remove a shell comment when it starts after whitespace.
 *
 * @param line - Shell source line to normalize.
 * @returns The line without a trailing comment.
 */
function stripShellTrailingComment(line: string): string {
	return line.replace(/\s+#.*$/, "").trimEnd();
}

/**
 * Check that a SCRIPT_DIR assignment is the complete canonical assignment line.
 *
 * @param line - Shell source line to inspect.
 * @returns Whether the line ends at the assignment value without extra commands.
 */
function isCanonicalScriptDirAssignment(line: string): boolean {
	return /^\s*SCRIPT_DIR="\$\(cd -- "\$\(dirname -- "\$\{BASH_SOURCE\[0\]\}"\)" && pwd -P\)"(?:\s+#.*)?$/.test(
		line,
	);
}

/**
 * Resolve one readiness path hop while preserving the visited-path guard.
 *
 * @param repoPath - Repository root to constrain resolution.
 * @param repoRealPath - Canonical repository root.
 * @param currentPath - Current configured or forwarded path.
 * @param visited - Canonical paths already inspected.
 * @returns A terminal resolution or the next path to inspect.
 */
function resolveReadinessStep(
	repoPath: string,
	repoRealPath: string,
	currentPath: string,
	visited: Set<string>,
): ReadinessStepResult {
	if (!existsSync(currentPath)) {
		return readinessStepError(
			`Forwarded readiness target is missing: ${relative(repoPath, currentPath)}`,
		);
	}

	let realPath: string;
	try {
		realPath = realpathSync(currentPath);
	} catch {
		return readinessStepError(
			`Readiness script cannot be resolved: ${relative(repoPath, currentPath)}`,
		);
	}
	if (!isContainedPath(repoRealPath, realPath)) {
		return readinessStepError(
			`Readiness script resolves outside the repository: ${relative(repoPath, currentPath)}`,
		);
	}
	if (visited.has(realPath)) {
		return readinessStepError(
			`Readiness script forwarding cycle detected at ${relative(repoPath, currentPath)}`,
		);
	}
	visited.add(realPath);

	const content = readTextFile(realPath);
	if (content === null) {
		return readinessStepError(
			`Readiness script cannot be read: ${relative(repoPath, currentPath)}`,
		);
	}
	const forwarding = parseReadinessForwardingTarget(content);
	if (forwarding.error !== null) {
		return readinessStepError(forwarding.error);
	}
	if (forwarding.target === null) {
		return {
			resolution: {
				source: { content, path: relative(repoPath, realPath) },
				error: null,
			},
			nextPath: null,
		};
	}

	const nextPath = resolve(dirname(currentPath), forwarding.target);
	if (!isContainedPath(repoPath, nextPath)) {
		return readinessStepError(
			`Forwarded readiness target escapes the repository: ${forwarding.target}`,
		);
	}
	return { resolution: null, nextPath };
}

/**
 * Resolve a readiness wrapper to its in-repository implementation.
 *
 * @param repoPath - Repository root to constrain resolution.
 * @param configuredPath - Contract-relative readiness script path.
 * @returns The effective source or a typed resolution error.
 */
function resolveReadinessScript(
	repoPath: string,
	configuredPath: string,
): ReadinessScriptResolution {
	let repoRealPath: string;
	try {
		repoRealPath = realpathSync(repoPath);
	} catch {
		return {
			source: null,
			error: `Repository root is not resolvable: ${repoPath}`,
		};
	}

	let currentPath = resolve(repoPath, configuredPath);
	const visited = new Set<string>();
	for (let depth = 0; depth <= MAX_READINESS_FORWARDING_DEPTH; depth += 1) {
		const step = resolveReadinessStep(
			repoPath,
			repoRealPath,
			currentPath,
			visited,
		);
		if (step.resolution !== null) {
			return step.resolution;
		}
		if (step.nextPath === null) {
			return {
				source: null,
				error: "Readiness resolution ended without a terminal result",
			};
		}
		currentPath = step.nextPath;
	}

	return {
		source: null,
		error: `Readiness script forwarding exceeded ${MAX_READINESS_FORWARDING_DEPTH} hops`,
	};
}

/**
 * Read a quoted scalar from a TOML hook block.
 *
 * @param block - TOML hook block.
 * @param key - Scalar key to read.
 * @returns The scalar value when declared.
 */
function parseQuotedTomlValue(block: string, key: string): string | undefined {
	const assignment = parseTomlAssignments(block).find(
		(candidate) => candidate.key === key,
	);
	return assignment?.valid && typeof assignment.value === "string"
		? assignment.value
		: undefined;
}

/**
 * Read a boolean scalar from a TOML hook block.
 *
 * @param block - TOML hook block.
 * @param key - Boolean key to read.
 * @returns The boolean value when declared.
 */
function parseBooleanTomlValue(
	block: string,
	key: string,
): boolean | undefined {
	const assignment = parseTomlAssignments(block).find(
		(candidate) => candidate.key === key,
	);
	return assignment?.valid && typeof assignment.value === "boolean"
		? assignment.value
		: undefined;
}

/**
 * Read a string array from a TOML hook block.
 *
 * @param block - TOML hook block.
 * @param key - Array key to read.
 * @returns The parsed strings when the array is declared.
 */
function parseStringArrayTomlValue(
	block: string,
	key: string,
): string[] | undefined {
	const assignment = parseTomlAssignments(block).find(
		(candidate) => candidate.key === key,
	);
	return assignment?.valid &&
		Array.isArray(assignment.value) &&
		assignment.value.every(
			(value): value is string => typeof value === "string",
		)
		? assignment.value
		: undefined;
}

/**
 * Remove TOML comments while preserving quoted string contents.
 *
 * @param value - TOML fragment to normalize.
 * @returns The fragment without comments outside quoted strings.
 */
function stripTomlComments(value: string): string {
	let state: TomlQuoteState = { quote: undefined, multiline: false };
	let result = "";
	for (let index = 0; index < value.length; index += 1) {
		const quoted = consumeTomlQuoteForComments(value, index, state);
		if (quoted !== null) {
			result += quoted.text;
			index = quoted.nextIndex;
			state = quoted.state;
			continue;
		}
		const character = value[index];
		if (character === "#") {
			while (index < value.length && value[index] !== "\n") {
				index += 1;
			}
			result += "\n";
			continue;
		}
		result += character;
	}
	return result;
}

interface TomlQuoteState {
	quote: '"' | "'" | undefined;
	multiline: boolean;
}

interface TomlQuoteCommentFragment {
	text: string;
	nextIndex: number;
	state: TomlQuoteState;
}

/**
 * Copy one quoted fragment while stripping TOML comments.
 *
 * @param value - TOML fragment.
 * @param index - Current character offset.
 * @param state - Active quote state.
 * @returns Copied fragment and next state, or null outside a quoted string.
 */
function consumeTomlQuoteForComments(
	value: string,
	index: number,
	state: TomlQuoteState,
): TomlQuoteCommentFragment | null {
	const character = value[index];
	if (state.quote === undefined) {
		if (character !== '"' && character !== "'") return null;
		const multiline = value.slice(index, index + 3) === character.repeat(3);
		return {
			text: value.slice(index, index + (multiline ? 3 : 1)),
			nextIndex: index + (multiline ? 2 : 0),
			state: { quote: character, multiline },
		};
	}
	const delimiter = state.quote.repeat(state.multiline ? 3 : 1);
	if (
		value.slice(index, index + delimiter.length) === delimiter &&
		(state.quote === "'" || !isTomlEscaped(value, index))
	) {
		return {
			text: delimiter,
			nextIndex: index + delimiter.length - 1,
			state: { quote: undefined, multiline: false },
		};
	}
	return { text: character ?? "", nextIndex: index, state };
}

/**
 * Parse assignments in one Prek hook block with TOML-aware value boundaries.
 *
 * @param block - TOML hook block to parse.
 * @returns Every assignment and whether its value is syntactically valid.
 */
function parseTomlAssignments(block: string): ParsedTomlAssignment[] {
	const assignments: ParsedTomlAssignment[] = [];
	let cursor = 0;
	while (cursor < block.length) {
		const newline = block.indexOf("\n", cursor);
		const lineEnd = newline === -1 ? block.length : newline;
		const parsed = parseTomlAssignment(block, cursor, lineEnd);
		if (parsed !== null) assignments.push(parsed.assignment);
		cursor =
			parsed?.nextCursor ?? (newline === -1 ? block.length : newline + 1);
	}
	return assignments;
}

/**
 * Parse one assignment from a TOML line.
 *
 * @param block - TOML source.
 * @param start - Candidate line start.
 * @param lineEnd - End offset for the current line.
 * @returns Assignment and next cursor, or null when no assignment starts here.
 */
function parseTomlAssignment(
	block: string,
	start: number,
	lineEnd: number,
): { assignment: ParsedTomlAssignment; nextCursor: number } | null {
	const key = readTomlKey(block, start, lineEnd);
	if (key === null) return null;
	let valueStart = key.end;
	while (valueStart < block.length && /[ \t]/.test(block[valueStart] ?? ""))
		valueStart += 1;
	if (block[valueStart] !== "=") return null;
	const parsed = parseTomlValue(block, valueStart + 1);
	return {
		assignment: {
			key: key.value,
			value: parsed.valid ? parsed.value : undefined,
			valid: parsed.valid,
		},
		nextCursor: parsed.end > lineEnd ? parsed.end : lineEnd + 1,
	};
}

/**
 * Read a TOML key at the start of a logical line.
 *
 * @param block - TOML hook block.
 * @param start - Candidate line start.
 * @param lineEnd - End offset for the current line.
 * @returns The key and end offset, or null when this line is not an assignment.
 */
function readTomlKey(
	block: string,
	start: number,
	lineEnd: number,
): { value: string; end: number } | null {
	let cursor = start;
	while (cursor < lineEnd && /[ \t]/.test(block[cursor] ?? "")) {
		cursor += 1;
	}
	if (cursor >= lineEnd || block[cursor] === "#") {
		return null;
	}
	const quote = block[cursor];
	if (quote === '"' || quote === "'")
		return readQuotedTomlKey(block, cursor, lineEnd, quote);
	const match = block.slice(cursor, lineEnd).match(/^[A-Za-z0-9_.-]+/);
	return match === null
		? null
		: { value: match[0], end: cursor + match[0].length };
}

/** Decode one quoted TOML key into its canonical key identity. */
function readQuotedTomlKey(
	block: string,
	start: number,
	lineEnd: number,
	quote: '"' | "'",
): { value: string; end: number } | null {
	const end = findTomlQuote(block, start, quote, false);
	if (end === -1 || end >= lineEnd) return null;
	const raw = block.slice(start + 1, end);
	const value = quote === '"' ? decodeTomlBasicString(raw, false) : raw;
	return value === null ? null : { value, end: end + 1 };
}

/**
 * Parse one TOML value from an absolute offset.
 *
 * @param block - TOML source.
 * @param start - Value start offset.
 * @returns Parsed value, end offset, and syntax validity.
 */
function parseTomlValue(block: string, start: number): TomlValueResult {
	let cursor = start;
	while (cursor < block.length && /[ \t]/.test(block[cursor] ?? "")) {
		cursor += 1;
	}
	return parseTomlValueAtCursor(block, cursor);
}

/**
 * Dispatch a TOML value parser based on its first token.
 *
 * @param block - TOML source.
 * @param cursor - First non-whitespace value offset.
 * @returns Parsed value result.
 */
function parseTomlValueAtCursor(
	block: string,
	cursor: number,
): TomlValueResult {
	const marker = block.slice(cursor, cursor + 3);
	if (marker === '"""' || marker === "'''") {
		return parseTomlQuotedWithTrailing(
			block,
			cursor,
			marker[0] as '"' | "'",
			true,
		);
	}
	if (block[cursor] === '"' || block[cursor] === "'") {
		return parseTomlQuotedWithTrailing(
			block,
			cursor,
			block[cursor] as '"' | "'",
			false,
		);
	}
	if (block[cursor] === "[") return parseTomlArray(block, cursor);
	if (block[cursor] === "{") return parseTomlInlineTable(block, cursor);
	const newline = block.indexOf("\n", cursor);
	const lineEnd = newline === -1 ? block.length : newline;
	const raw = stripTomlComments(block.slice(cursor, lineEnd)).trim();
	const value = parseTomlBareValue(raw);
	return { value, end: lineEnd, valid: raw !== "" && value !== undefined };
}

/**
 * Parse a quoted TOML value and reject non-comment trailing tokens.
 *
 * @param block - TOML source.
 * @param start - Opening quote offset.
 * @param quote - Quote type.
 * @param multiline - Whether the delimiter is triple-quoted.
 * @returns Parsed string result with trailing validation.
 */
function parseTomlQuotedWithTrailing(
	block: string,
	start: number,
	quote: '"' | "'",
	multiline: boolean,
): TomlValueResult {
	const parsed = parseTomlQuotedValue(block, start, quote, multiline);
	const trailing = consumeTomlTrailing(block, parsed.end);
	return {
		...parsed,
		end: trailing.end,
		valid: parsed.valid && trailing.valid,
	};
}

/**
 * Parse a basic or literal TOML string.
 *
 * @param block - TOML source.
 * @param start - String delimiter offset.
 * @param quote - Quote type.
 * @param multiline - Whether the delimiter is triple-quoted.
 * @returns Parsed string result.
 */
function parseTomlQuotedValue(
	block: string,
	start: number,
	quote: '"' | "'",
	multiline: boolean,
): TomlValueResult {
	const end = findTomlQuote(block, start, quote, multiline);
	if (end === -1) return { value: undefined, end: block.length, valid: false };
	const delimiterLength = multiline ? 3 : 1;
	const raw = block.slice(start + delimiterLength, end);
	const value =
		quote === '"'
			? decodeTomlBasicString(raw, multiline)
			: normalizeTomlMultilineString(raw, multiline);
	return {
		value: value ?? undefined,
		end: end + delimiterLength,
		valid: value !== null,
	};
}

/**
 * Find the closing TOML quote, respecting escaped basic-string delimiters.
 *
 * @param block - TOML source.
 * @param start - Opening delimiter offset.
 * @param quote - Quote type.
 * @param multiline - Whether the delimiter is triple-quoted.
 * @returns Closing delimiter offset, or -1 when absent.
 */
function findTomlQuote(
	block: string,
	start: number,
	quote: '"' | "'",
	multiline: boolean,
): number {
	const delimiter = quote.repeat(multiline ? 3 : 1);
	for (
		let cursor = start + delimiter.length;
		cursor < block.length;
		cursor += 1
	) {
		if (!multiline && (block[cursor] === "\n" || block[cursor] === "\r")) {
			return -1;
		}
		if (
			block.slice(cursor, cursor + delimiter.length) === delimiter &&
			(quote === "'" || !isTomlEscaped(block, cursor))
		) {
			return cursor;
		}
	}
	return -1;
}

/**
 * Check whether a TOML quote is escaped by an odd backslash run.
 *
 * @param block - TOML source.
 * @param offset - Quote offset.
 * @returns Whether the quote is escaped.
 */
function isTomlEscaped(block: string, offset: number): boolean {
	let backslashes = 0;
	for (
		let cursor = offset - 1;
		cursor >= 0 && block[cursor] === "\\";
		cursor -= 1
	) {
		backslashes += 1;
	}
	return backslashes % 2 === 1;
}

/**
 * Decode the TOML basic-string escapes used by hook command values.
 *
 * @param raw - Raw string contents.
 * @param multiline - Whether the source was triple-quoted.
 * @returns Decoded string.
 */
function decodeTomlBasicString(raw: string, multiline: boolean): string | null {
	const normalized = multiline
		? normalizeTomlMultilineString(raw, true).replace(
				/\\(?:\r\n|\n)[ \t\r\n]*/g,
				"",
			)
		: raw;
	const escapes: Record<string, string> = {
		'"': '"',
		"\\": "\\",
		b: "\b",
		f: "\f",
		n: "\n",
		r: "\r",
		t: "\t",
	};
	let decoded = "";
	for (let cursor = 0; cursor < normalized.length; cursor += 1) {
		const character = normalized[cursor];
		if (character !== "\\") {
			decoded += character;
			continue;
		}
		const decodedEscape = decodeTomlBasicEscape(normalized, cursor, escapes);
		if (decodedEscape === null) return null;
		decoded += decodedEscape.value;
		cursor = decodedEscape.end;
	}
	return decoded;
}

/** Decode one TOML basic-string escape and report its consumed source offset. */
function decodeTomlBasicEscape(
	source: string,
	start: number,
	escapes: Record<string, string>,
): { value: string; end: number } | null {
	const escapeCode = source[start + 1];
	if (escapeCode === "u" || escapeCode === "U")
		return decodeTomlUnicodeEscape(source, start, escapeCode);
	const value = escapeCode === undefined ? undefined : escapes[escapeCode];
	return value === undefined ? null : { value, end: start + 1 };
}

/** Decode one TOML Unicode escape while rejecting invalid scalar values. */
function decodeTomlUnicodeEscape(
	source: string,
	start: number,
	escapeCode: "u" | "U",
): { value: string; end: number } | null {
	const width = escapeCode === "u" ? 4 : 8;
	const digits = source.slice(start + 2, start + 2 + width);
	if (digits.length !== width || !/^[0-9A-Fa-f]+$/.test(digits)) return null;
	const codePoint = Number.parseInt(digits, 16);
	if (codePoint > 0x10ffff || (codePoint >= 0xd800 && codePoint <= 0xdfff))
		return null;
	return { value: String.fromCodePoint(codePoint), end: start + width + 1 };
}

/**
 * Apply TOML multiline first-newline trimming.
 *
 * @param raw - Raw string contents.
 * @param multiline - Whether the source was triple-quoted.
 * @returns Normalized string contents.
 */
function normalizeTomlMultilineString(raw: string, multiline: boolean): string {
	return multiline ? raw.replace(/^\r?\n/, "") : raw;
}

/**
 * Parse a TOML array while respecting quoted brackets and nested values.
 *
 * @param block - TOML source.
 * @param start - Opening bracket offset.
 * @returns Parsed array result.
 */
function parseTomlArray(block: string, start: number): TomlValueResult {
	const end = findTomlArrayEnd(block, start);
	if (end === -1) return { value: undefined, end: block.length, valid: false };
	const values = parseTomlArrayElements(block.slice(start + 1, end));
	const trailing = consumeTomlTrailing(block, end + 1);
	return {
		value: values.values,
		end: trailing.end,
		valid: values.valid && trailing.valid,
	};
}

/**
 * Find the closing bracket for a TOML array.
 *
 * @param block - TOML source.
 * @param start - Opening bracket offset.
 * @returns Closing bracket offset, or -1 when absent.
 */
function findTomlArrayEnd(block: string, start: number): number {
	let depth = 1;
	let cursor = start + 1;
	while (cursor < block.length) {
		const character = block[cursor];
		const quotedEnd = skipTomlQuotedValue(block, cursor);
		if (quotedEnd !== null) {
			if (quotedEnd === -1) return -1;
			cursor = quotedEnd;
			continue;
		}
		if (character === "#") {
			cursor = skipTomlComment(block, cursor);
			continue;
		}
		const nesting = updateTomlNesting(character, depth);
		depth = nesting.depth;
		if (nesting.closed) return cursor;
		cursor += 1;
	}
	return -1;
}

/**
 * Skip a TOML quoted value while scanning an array.
 *
 * @param block - TOML source.
 * @param cursor - Candidate quote offset.
 * @returns Next offset, -1 for an unclosed quote, or null when not quoted.
 */
function skipTomlQuotedValue(block: string, cursor: number): number | null {
	const character = block[cursor];
	if (character !== '"' && character !== "'") return null;
	const multiline = block.slice(cursor, cursor + 3) === character.repeat(3);
	const end = findTomlQuote(block, cursor, character, multiline);
	return end === -1 ? -1 : end + (multiline ? 3 : 1);
}

/**
 * Skip a TOML comment while scanning a value.
 *
 * @param block - TOML source.
 * @param cursor - Comment marker offset.
 * @returns Offset after the comment line.
 */
function skipTomlComment(block: string, cursor: number): number {
	const newline = block.indexOf("\n", cursor);
	return newline === -1 ? block.length : newline + 1;
}

/**
 * Update nested TOML array/table depth.
 *
 * @param character - Current source character.
 * @param depth - Current nesting depth.
 * @returns Updated depth and whether the outer array closed.
 */
function updateTomlNesting(
	character: string | undefined,
	depth: number,
): { depth: number; closed: boolean } {
	if (character === "[" || character === "{") {
		return { depth: depth + 1, closed: false };
	}
	if (character === "]" || character === "}") {
		const nextDepth = depth - 1;
		return { depth: nextDepth, closed: character === "]" && nextDepth === 0 };
	}
	return { depth, closed: false };
}

/**
 * Parse top-level comma-separated TOML array elements.
 *
 * @param raw - Array contents without brackets.
 * @returns Parsed values and syntax validity.
 */
function parseTomlArrayElements(raw: string): {
	values: unknown[];
	valid: boolean;
} {
	const elements = splitTomlArrayElements(stripTomlComments(raw));
	if (elements === null) return { values: [], valid: false };
	if (elements.length === 0) return { values: [], valid: true };
	const values: unknown[] = [];
	for (const element of elements) {
		const parsed = parseTomlInlineValue(element.trim());
		if (!parsed.valid) return { values: [], valid: false };
		values.push(parsed.value);
	}
	return { values, valid: true };
}

/**
 * Split TOML array contents without treating quoted commas as separators.
 *
 * @param source - Comment-free TOML array contents.
 * @returns Element fragments, or null for an unclosed quoted value.
 */
function splitTomlArrayElements(source: string): string[] | null {
	const elements: string[] = [];
	let start = 0;
	let depth = 0;
	for (let cursor = 0; cursor < source.length; cursor += 1) {
		const quotedEnd = skipTomlQuotedValue(source, cursor);
		if (quotedEnd !== null) {
			if (quotedEnd === -1) return null;
			cursor = quotedEnd - 1;
			continue;
		}
		const character = source[cursor];
		const nesting = updateTomlNesting(character, depth);
		depth = nesting.depth;
		if (character === "," && depth === 0) {
			elements.push(source.slice(start, cursor));
			start = cursor + 1;
		}
	}
	const tail = source.slice(start).trim();
	if (tail !== "") elements.push(tail);
	return elements;
}

/**
 * Parse an inline TOML value and require complete consumption.
 *
 * @param source - Standalone TOML value.
 * @returns Parsed value result.
 */
function parseTomlInlineValue(source: string): TomlValueResult {
	const parsed = parseTomlValue(source, 0);
	const trailing = consumeTomlTrailing(source, parsed.end);
	return {
		value: parsed.value,
		end: trailing.end,
		valid: parsed.valid && trailing.valid && trailing.end === source.length,
	};
}

/** Validate every key/value entry in a TOML inline table. */
function isValidTomlInlineTableBody(source: string): boolean {
	const entries = splitTomlArrayElements(source);
	if (entries === null) return false;
	const keys = new Set<string>();
	for (const rawEntry of entries) {
		const key = parseTomlInlineTableEntry(rawEntry);
		if (key === null || keys.has(key)) return false;
		keys.add(key);
	}
	return true;
}

/** Parse one complete inline-table entry and return its canonical key. */
function parseTomlInlineTableEntry(rawEntry: string): string | null {
	const entry = rawEntry.trim();
	if (entry === "") return null;
	const key = readTomlKey(entry, 0, entry.length);
	if (key === null) return null;
	let valueStart = key.end;
	while (valueStart < entry.length && /[ \t]/.test(entry[valueStart] ?? ""))
		valueStart += 1;
	if (entry[valueStart] !== "=") return null;
	const parsed = parseTomlValue(entry, valueStart + 1);
	const trailing = consumeTomlTrailing(entry, parsed.end);
	return parsed.valid && trailing.valid && trailing.end === entry.length
		? key.value
		: null;
}

/**
 * Parse a TOML inline table as a balanced value.
 *
 * @param block - TOML source.
 * @param start - Opening brace offset.
 * @returns Balanced table result.
 */
function parseTomlInlineTable(block: string, start: number): TomlValueResult {
	const end = findTomlInlineTableEnd(block, start);
	if (end === -1) return { value: undefined, end: block.length, valid: false };
	const trailing = consumeTomlTrailing(block, end + 1);
	return {
		value: block.slice(start, end + 1),
		end: trailing.end,
		valid:
			trailing.valid && isValidTomlInlineTableBody(block.slice(start + 1, end)),
	};
}

/** Find the balanced closing brace for one TOML inline table. */
function findTomlInlineTableEnd(block: string, start: number): number {
	let depth = 1;
	let cursor = start + 1;
	while (cursor < block.length) {
		const quotedEnd = skipTomlQuotedValue(block, cursor);
		if (quotedEnd !== null) {
			if (quotedEnd === -1) return -1;
			cursor = quotedEnd;
			continue;
		}
		const character = block[cursor];
		if (character === "{") depth += 1;
		if (character === "}" && --depth === 0) return cursor;
		cursor += 1;
	}
	return -1;
}

/**
 * Parse a TOML bare scalar conservatively.
 *
 * @param raw - Trimmed scalar text.
 * @returns A normalized scalar or undefined for invalid syntax.
 */
function parseTomlBareValue(raw: string): unknown {
	if (/^(?:true|false)$/.test(raw)) return raw === "true";
	if (
		/^[+-]?(?:0|[1-9](?:_?[0-9])*)(?:\.[0-9](?:_?[0-9])*)?(?:[eE][+-]?[0-9](?:_?[0-9])*)?$/.test(
			raw,
		)
	) {
		return Number(raw.replaceAll("_", ""));
	}
	if (/^[+-]?(?:inf|nan)$/.test(raw)) return raw;
	if (
		/^\d{4}-\d{2}-\d{2}(?:[Tt ][0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]+)?(?:Z|[+-][0-9]{2}:[0-9]{2})?)?$/.test(
			raw,
		)
	)
		return raw;
	return undefined;
}

/**
 * Validate trailing TOML whitespace or a comment after a value.
 *
 * @param block - TOML source.
 * @param start - Trailing content offset.
 * @returns End offset and whether the trailing content is valid.
 */
function consumeTomlTrailing(
	block: string,
	start: number,
): { end: number; valid: boolean } {
	let cursor = start;
	while (cursor < block.length && /[ \t\r]/.test(block[cursor] ?? ""))
		cursor += 1;
	if (block[cursor] === "#") {
		const newline = block.indexOf("\n", cursor);
		return { end: newline === -1 ? block.length : newline, valid: true };
	}
	return {
		end: cursor,
		valid: block[cursor] === undefined || block[cursor] === "\n",
	};
}

/**
 * Parse Prek hook blocks without assuming hook identifiers encode stages.
 *
 * @param content - Prek TOML configuration.
 * @returns Parsed hook entries and their effective stages.
 */
type TomlMultilineState = "normal" | "basic" | "literal";

/** Find a multiline TOML delimiter after a scan offset. */
function findTomlMultilineEnd(
	line: string,
	start: number,
	delimiter: '"""' | "'''",
): number {
	let cursor = line.indexOf(delimiter, start);
	while (delimiter === '"""' && cursor !== -1 && isTomlEscaped(line, cursor))
		cursor = line.indexOf(delimiter, cursor + delimiter.length);
	return cursor;
}

/** Skip one single-line TOML quoted string. */
function skipTomlQuotedString(
	line: string,
	start: number,
	quote: '"' | "'",
): number {
	let cursor = start + 1;
	while (cursor < line.length) {
		if (
			line[cursor] === quote &&
			(quote === "'" || !isTomlEscaped(line, cursor))
		)
			return cursor;
		cursor += 1;
	}
	return line.length;
}

/** Advance multiline TOML string state across one physical line. */
function tomlStateAfterLine(
	line: string,
	initial: TomlMultilineState,
): TomlMultilineState {
	let state = initial;
	for (let cursor = 0; cursor < line.length; cursor += 1) {
		if (state !== "normal") {
			const delimiter = state === "basic" ? '"""' : "'''";
			const end = findTomlMultilineEnd(line, cursor, delimiter);
			if (end === -1) return state;
			state = "normal";
			cursor = end + delimiter.length - 1;
			continue;
		}
		if (line[cursor] === "#") break;
		if (line.slice(cursor, cursor + 3) === '"""') {
			state = "basic";
			cursor += 2;
			continue;
		}
		if (line.slice(cursor, cursor + 3) === "'''") {
			state = "literal";
			cursor += 2;
			continue;
		}
		if (line[cursor] === '"') cursor = skipTomlQuotedString(line, cursor, '"');
		else if (line[cursor] === "'")
			cursor = skipTomlQuotedString(line, cursor, "'");
	}
	return state;
}

/** Split real hook tables while ignoring header-shaped text inside strings. */
function splitPrekHookBlocks(content: string): string[] {
	const headers: Array<{ start: number; end: number }> = [];
	const headerPattern = /^\s*\[\[\s*repos\s*\.\s*hooks\s*\]\](?:\s*#.*)?\s*$/;
	let state: TomlMultilineState = "normal";
	let offset = 0;
	while (offset < content.length) {
		const newline = content.indexOf("\n", offset);
		const end = newline === -1 ? content.length : newline + 1;
		const line = content.slice(offset, newline === -1 ? end : newline);
		if (state === "normal" && headerPattern.test(line))
			headers.push({ start: offset, end });
		state = tomlStateAfterLine(line, state);
		offset = end;
	}
	if (headers.length === 0) return [content];
	return [
		content.slice(0, headers[0]?.start ?? 0),
		...headers.map((header, index) =>
			content.slice(header.end, headers[index + 1]?.start ?? content.length),
		),
	];
}

/** Return only TOML assignments that occur before the first table header. */
function getTomlRootPreamble(content: string): string {
	const lines = content.split(/\r?\n/);
	const firstTableIndex = lines.findIndex((line) => /^\s*\[/.test(line));
	return lines
		.slice(0, firstTableIndex === -1 ? lines.length : firstTableIndex)
		.join("\n");
}

function parsePrekHooks(content: string): ParsedPrekHook[] {
	const hookBlocks = splitPrekHookBlocks(content);
	const defaultStages = parseStringArrayTomlValue(
		getTomlRootPreamble(content),
		"default_stages",
	) ?? [...PREK_ALL_STAGES];
	return hookBlocks.slice(1).map((block) => {
		const id = parseQuotedTomlValue(block, "id");
		const name = parseQuotedTomlValue(block, "name");
		const entry = parseQuotedTomlValue(block, "entry");
		const language = parseQuotedTomlValue(block, "language");
		const passFilenames = parseBooleanTomlValue(block, "pass_filenames");
		const declaredStages = parseStringArrayTomlValue(block, "stages");
		const hasStagesAssignment = parseTomlAssignments(block).some(
			(assignment) => assignment.key === "stages",
		);
		return {
			id,
			name,
			entry,
			language,
			passFilenames,
			stages: declaredStages ?? (hasStagesAssignment ? [] : defaultStages),
			duplicateKeys: collectDuplicateTomlKeys(block),
			invalidKeys: collectInvalidTomlKeys(block, {
				id,
				name,
				entry,
				language,
				pass_filenames: passFilenames,
				stages: declaredStages,
			}),
		};
	});
}

/** Reject duplicate or malformed policy assignments in the TOML root. */
function auditPrekRootAssignments(
	findings: ToolingAuditFinding[],
	rootPreamble: string,
): void {
	const assignments = parseTomlAssignments(rootPreamble);
	for (const key of ["default_install_hook_types", "default_stages"] as const) {
		const matches = assignments.filter((assignment) => assignment.key === key);
		if (matches.length > 1) {
			findings.push({
				path: TOOLING_PREK_CONFIG_PATH,
				severity: "critical",
				description: `Prek root repeats policy key '${key}'`,
				expected: "Each root policy key appears at most once",
				actual: matches.length,
			});
		}
		const parsed = parseStringArrayTomlValue(rootPreamble, key);
		if (matches.length > 0 && parsed === undefined) {
			findings.push({
				path: TOOLING_PREK_CONFIG_PATH,
				severity: "critical",
				description: `Prek root has an invalid value for policy key '${key}'`,
				expected: "A valid TOML string array",
				actual: key,
			});
		}
	}
}

/** Require every configured approved hook stage to be installed by Prek. */
function auditPrekInstallCoverage(
	findings: ToolingAuditFinding[],
	content: string,
	hooks: ParsedPrekHook[],
): void {
	const rootPreamble = getTomlRootPreamble(content);
	auditPrekRootAssignments(findings, rootPreamble);
	const installTypes =
		parseStringArrayTomlValue(rootPreamble, "default_install_hook_types") ?? [];
	for (const stage of Object.keys(APPROVED_PREK_LEAF_ENTRIES)) {
		const configured = hooks.some(
			(hook) =>
				hook.stages.includes(stage) &&
				isApprovedPrekLeafEntry(stage, hook.entry),
		);
		if (configured && !installTypes.includes(stage)) {
			findings.push({
				path: TOOLING_PREK_CONFIG_PATH,
				severity: "critical",
				description: `Prek hook for effective stage '${stage}' is not included in default_install_hook_types`,
				expected: stage,
				actual: installTypes,
			});
		}
	}
}

/**
 * Identify repeated policy-relevant keys inside one Prek hook block.
 *
 * @param block - TOML hook block to inspect.
 * @returns Keys declared more than once in the block.
 */
function collectDuplicateTomlKeys(block: string): string[] {
	const keys = ["id", "name", "entry", "language", "pass_filenames", "stages"];
	const assignments = parseTomlAssignments(block);
	return keys.filter(
		(key) =>
			assignments.filter((assignment) => assignment.key === key).length > 1,
	);
}

/**
 * Identify policy keys whose declared values do not match the supported TOML grammar.
 *
 * @param block - TOML hook block to inspect.
 * @param parsedValues - Parsed values keyed by their TOML field names.
 * @returns Declared keys that failed parsing.
 */
function collectInvalidTomlKeys(
	block: string,
	parsedValues: Record<string, unknown>,
): string[] {
	const assignments = parseTomlAssignments(block);
	const policyKeys = Object.entries(parsedValues).flatMap(
		([key, parsedValue]) => {
			const assignment = assignments.find((candidate) => candidate.key === key);
			return assignment !== undefined &&
				(!assignment.valid || parsedValue === undefined)
				? [key]
				: [];
		},
	);
	const malformed = assignments
		.filter((assignment) => !assignment.valid)
		.map((assignment) => assignment.key);
	return [...new Set([...policyKeys, ...malformed])];
}

/**
 * Determine whether a hook command is an approved leaf adapter for a stage.
 *
 * @param stage - Effective Prek stage.
 * @param actualEntry - Hook command parsed from the configuration.
 * @returns Whether the command is an approved leaf entry.
 */
function isApprovedPrekLeafEntry(
	stage: string,
	actualEntry: string | undefined,
): boolean {
	if (actualEntry === undefined) {
		return false;
	}
	const approvedEntries: readonly string[] | undefined =
		APPROVED_PREK_LEAF_ENTRIES[
			stage as keyof typeof APPROVED_PREK_LEAF_ENTRIES
		];
	if (approvedEntries === undefined) {
		return false;
	}
	return approvedEntries.includes(actualEntry);
}

/**
 * Read and validate a package manifest for tooling policy checks.
 *
 * @param path - Absolute package manifest path.
 * @returns Parsed package metadata, or `null` when the file is absent.
 */
function readPackageManifest(path: string): PackageManifest | null {
	if (!existsSync(path)) return null;
	const content = readFileSync(path, "utf-8");
	const parsed = JSON.parse(content) as unknown;
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
		throw new Error("package.json root must be an object");
	}
	const manifest = parsed as PackageManifest;
	return manifest;
}

/**
 * Read a JSON object from disk when the file exists.
 *
 * @param path - Absolute JSON file path.
 * @returns Parsed object, or `null` when the file is absent.
 */
function readJsonObject(path: string): Record<string, unknown> | null {
	if (!existsSync(path)) return null;
	const content = readFileSync(path, "utf-8");
	const parsed = JSON.parse(content) as unknown;
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
		throw new Error("JSON root must be an object");
	}
	return parsed as Record<string, unknown>;
}

/**
 * Reject Prek entries that recursively invoke hook orchestration.
 *
 * @param findings - Finding list to append violations to.
 * @param prekContent - Prek TOML configuration.
 */
function auditPrekHookEntryBoundaries(
	findings: ToolingAuditFinding[],
	prekContent: string,
): void {
	for (const hook of parsePrekHooks(prekContent)) {
		const hookName = hook.id ?? "unknown";
		const entry = hook.entry;
		if (entry && isForbiddenPrekHookEntry(entry)) {
			findings.push({
				path: TOOLING_PREK_CONFIG_PATH,
				severity: "critical",
				description: `Prek hook '${hookName}' invokes nested hook orchestration instead of a leaf adapter`,
				expected:
					"Hook entrypoints call scripts/hook-pre-commit.sh or scripts/hook-pre-push.sh leaf adapters",
				actual: entry,
			});
		}
	}
}

/**
 * Identify hook commands that recursively invoke hook orchestration.
 *
 * @param entry - Parsed Prek hook command.
 * @returns Whether the command is forbidden nested orchestration.
 */
function isForbiddenPrekHookEntry(entry: string): boolean {
	return FORBIDDEN_PREK_HOOK_ENTRY_PATTERNS.some((pattern) =>
		pattern.test(entry),
	);
}

/**
 * Reject every extra Prek hook whose effective stage or leaf command is outside policy.
 *
 * @param findings - Finding list to append policy violations to.
 * @param parsedHooks - Parsed Prek hook entries.
 */
function auditPrekHookLeafEntries(
	findings: ToolingAuditFinding[],
	parsedHooks: ParsedPrekHook[],
	repoPath: string,
): void {
	for (const hook of parsedHooks) {
		for (const field of ["id", "name", "entry", "language"] as const) {
			if (hook[field] === undefined) {
				findings.push({
					path: TOOLING_PREK_CONFIG_PATH,
					severity: "critical",
					description: `Prek hook '${hook.id ?? "unknown"}' is missing required field '${field}'`,
					expected: "Every local hook declares id, name, entry, and language",
					actual: hook,
				});
			}
		}
		auditPrekCommitMsgRuntimeShape(findings, hook);
		const entry = hook.entry;
		if (entry !== undefined && isForbiddenPrekHookEntry(entry)) {
			continue;
		}
		for (const stage of hook.stages) {
			const approvedEntries: readonly string[] | undefined =
				APPROVED_PREK_LEAF_ENTRIES[
					stage as keyof typeof APPROVED_PREK_LEAF_ENTRIES
				];
			if (approvedEntries === undefined) {
				findings.push({
					path: TOOLING_PREK_CONFIG_PATH,
					severity: "critical",
					description: `Prek hook '${hook.id ?? "unknown"}' uses unsupported effective stage '${stage}'`,
					expected: Object.keys(APPROVED_PREK_LEAF_ENTRIES),
					actual: hook,
				});
				continue;
			}
			if (entry === undefined || !approvedEntries.includes(entry)) {
				findings.push({
					path: TOOLING_PREK_CONFIG_PATH,
					severity: "critical",
					description: `Prek hook '${hook.id ?? "unknown"}' uses an unapproved leaf command for effective stage '${stage}'`,
					expected: approvedEntries,
					actual: hook,
				});
			}
		}
		auditPrekHookCommandFile(findings, hook, repoPath);
	}
}

/** Require approved commit-message validators to receive Git's filename input. */
function auditPrekCommitMsgRuntimeShape(
	findings: ToolingAuditFinding[],
	hook: ParsedPrekHook,
): void {
	if (
		!hook.stages.includes("commit-msg") ||
		!isApprovedPrekLeafEntry("commit-msg", hook.entry) ||
		hook.passFilenames === true
	)
		return;
	findings.push({
		path: TOOLING_PREK_CONFIG_PATH,
		severity: "critical",
		description: `Prek hook '${hook.id ?? "unknown"}' disables the commit-msg filename input`,
		expected: "Approved commit-msg hooks set pass_filenames = true",
		actual: hook.passFilenames,
	});
}

/**
 * Require the script referenced by an approved Prek leaf command.
 *
 * @param findings - Finding list to append missing-command violations to.
 * @param hook - Parsed hook whose entry may name an approved script.
 * @param repoPath - Repository root used to resolve the command path.
 */
function auditPrekHookCommandFile(
	findings: ToolingAuditFinding[],
	hook: ParsedPrekHook,
	repoPath: string,
): void {
	const entry = hook.entry;
	if (entry === undefined) return;
	const approved = Object.values(APPROVED_PREK_LEAF_ENTRIES).some((entries) =>
		(entries as readonly string[]).includes(entry),
	);
	if (!approved) return;
	const commandPath = entry.match(
		/^(?:bash|node)\s+(scripts\/[A-Za-z0-9._/-]+)$/,
	)?.[1];
	if (commandPath === undefined) return;
	try {
		const repoRealPath = realpathSync(repoPath);
		const commandRealPath = realpathSync(join(repoPath, commandPath));
		if (
			isContainedPath(repoRealPath, commandRealPath) &&
			statSync(commandRealPath).isFile()
		)
			return;
	} catch {
		// Fall through to one fail-closed audit finding.
	}
	findings.push({
		path: commandPath,
		severity: "critical",
		description: `Prek hook '${hook.id ?? "unknown"}' references an invalid approved leaf command`,
		expected:
			"Configured approved leaf command resolves to a regular file inside the repository",
		actual: commandPath,
	});
}

/**
 * Collect runtime and development dependency names from a package manifest.
 *
 * @param manifest - Parsed package manifest.
 * @returns Set of declared dependency names.
 */
function collectPackageDependencies(manifest: PackageManifest): Set<string> {
	return new Set([
		...Object.keys(manifest.dependencies ?? {}),
		...Object.keys(manifest.devDependencies ?? {}),
	]);
}

/**
 * Determine tooling capabilities applicable to a repository from a harness contract and optional package manifest.
 *
 * If the contract includes a packagePolicy, the returned set contains any explicitly declared capabilities and any capabilities inferred from the manifest's dependencies when a manifest is provided.
 *
 * @param contract - The harness contract that may include a `toolingPolicy.packagePolicy`
 * @param manifest - The parsed package manifest (`package.json`)
 * @returns A set of capability identifiers present either explicitly in the contract or inferred from the manifest's dependency markers
 */
function detectCapabilities(
	contract: HarnessContract,
	manifest: PackageManifest,
): Set<string> {
	const capabilities = new Set<string>();
	const packagePolicy = contract.toolingPolicy?.packagePolicy;
	if (!packagePolicy) {
		return capabilities;
	}

	for (const capability of packagePolicy.explicitCapabilities ?? []) {
		capabilities.add(capability);
	}

	const dependencyNames = collectPackageDependencies(manifest);
	for (const detector of packagePolicy.capabilityDetectors) {
		if (
			detector.dependencyMarkers.some((marker) => dependencyNames.has(marker))
		) {
			capabilities.add(detector.capability);
		}
	}

	return capabilities;
}

/**
 * Checks whether a package name appears in the package manifest according to the specified dependency scope.
 *
 * @param manifest - The parsed package.json manifest to inspect
 * @param packageName - The package name to look for
 * @param dependencyType - Which dependency section to check: `"dependencies"` for runtime deps, `"devDependencies"` for dev-only deps, or `"either"` to check both
 * @returns `true` if the package is present in the selected dependency section(s), `false` otherwise
 */
function hasRequiredPackage(
	manifest: PackageManifest,
	packageName: string,
	dependencyType: "dependencies" | "devDependencies" | "either",
): boolean {
	const dependencies = manifest.dependencies ?? {};
	const devDependencies = manifest.devDependencies ?? {};

	if (dependencyType === "dependencies") {
		return Object.hasOwn(dependencies, packageName);
	}
	if (dependencyType === "devDependencies") {
		return Object.hasOwn(devDependencies, packageName);
	}

	return (
		Object.hasOwn(dependencies, packageName) ||
		Object.hasOwn(devDependencies, packageName)
	);
}

/**
 * Collect tool-version pins from a mise configuration.
 *
 * @param content - Mise TOML source.
 * @returns Tool names mapped to their pinned versions.
 */
function collectMisePins(content: string): Map<string, string> {
	const pins = new Map<string, string>();
	const regex = /^\s*(?:"([^"]+)"|([A-Za-z0-9:@._/-]+))\s*=\s*"([^"]+)"\s*$/gm;
	let match = regex.exec(content);
	while (match !== null) {
		const tool = match[1] ?? match[2];
		const version = match[3];
		if (tool && version) {
			pins.set(tool, version);
		}
		match = regex.exec(content);
	}
	return pins;
}

/**
 * Collect Codex action name/icon pairs from an environment file.
 *
 * @param content - Codex environment TOML source.
 * @returns Declared action pairs.
 */
function collectCodexActionPairs(content: string): Set<string> {
	const pairs = new Set<string>();
	const blockRegex = /\[\[actions\]\][\s\S]*?(?=\n\[\[actions\]\]|$)/g;
	for (const block of content.match(blockRegex) ?? []) {
		const name = /\nname = "([^"]+)"/.exec(`\n${block}`)?.[1];
		const icon = /\nicon = "([^"]+)"/.exec(`\n${block}`)?.[1];
		if (name && icon) {
			pairs.add(`${name}|${icon}`);
		}
	}
	return pairs;
}

/**
 * Collect Makefile target names.
 *
 * @param content - Makefile source.
 * @returns Declared target names.
 */
function collectMakeTargets(content: string): Set<string> {
	const targets = new Set<string>();
	const regex = /^([A-Za-z0-9_.-]+):/gm;
	let match = regex.exec(content);
	while (match !== null) {
		const target = match[1];
		if (target) {
			targets.add(target);
		}
		match = regex.exec(content);
	}
	return targets;
}

/**
 * Add a critical finding for a missing required file.
 *
 * @param findings - Finding list to append to.
 * @param path - Repository-relative missing path.
 * @param label - Human-readable file category.
 */
function addMissingFileFinding(
	findings: ToolingAuditFinding[],
	path: string,
	label: string,
): void {
	findings.push({
		path,
		severity: "critical",
		description: `Missing required ${label}: ${path}`,
	});
}

/**
 * Audit the effective readiness implementation behind an optional wrapper.
 *
 * @param findings - Finding list to append readiness violations to.
 * @param repoPath - Repository root being audited.
 * @param contract - Tooling contract containing readiness policy.
 */
function auditReadinessScript(
	findings: ToolingAuditFinding[],
	repoPath: string,
	contract: HarnessContract,
): void {
	const toolingPolicy =
		contract.toolingPolicy ?? DEFAULT_CONTRACT.toolingPolicy;
	if (!toolingPolicy) {
		return;
	}
	const resolution = resolveReadinessScript(
		repoPath,
		toolingPolicy.readinessScriptPath,
	);
	if (resolution.error !== null) {
		findings.push({
			path: toolingPolicy.readinessScriptPath,
			severity: "critical",
			description: `Unable to inspect forwarded readiness target: ${resolution.error}`,
			expected:
				"An in-repository readiness implementation or approved forwarding wrapper",
			actual: toolingPolicy.readinessScriptPath,
		});
		return;
	}
	const content = resolution.source?.content;
	if (content === undefined) {
		addMissingFileFinding(
			findings,
			toolingPolicy.readinessScriptPath,
			"readiness script",
		);
		return;
	}

	for (const term of toolingPolicy.requiredDocumentationTerms) {
		if (!content.includes(`"${term}"`)) {
			findings.push({
				path: "toolingPolicy.requiredDocumentationTerms",
				severity: "warning",
				description: `Readiness script no longer enforces tooling inventory term '${term}'`,
				expected: term,
				actual: toolingPolicy.readinessScriptPath,
			});
		}
	}

	for (const binary of toolingPolicy.requiredBinaries) {
		if (!content.includes(`"${binary}"`)) {
			findings.push({
				path: "toolingPolicy.requiredBinaries",
				severity: "critical",
				description: `Readiness script no longer enforces binary '${binary}'`,
				expected: binary,
				actual: toolingPolicy.readinessScriptPath,
			});
		}
	}

	for (const action of toolingPolicy.codexEnvironment.requiredActions) {
		const pair = `${action.name}|${action.icon}`;
		if (!content.includes(`"${pair}"`)) {
			findings.push({
				path: "toolingPolicy.codexEnvironment.requiredActions",
				severity: "warning",
				description: `Readiness script no longer checks Codex action '${pair}'`,
				expected: pair,
				actual: toolingPolicy.readinessScriptPath,
			});
		}
	}

	for (const target of toolingPolicy.makefile.requiredTargets) {
		if (!content.includes(`"${target}"`)) {
			findings.push({
				path: "toolingPolicy.makefile.requiredTargets",
				severity: "warning",
				description: `Readiness script no longer checks Makefile target '${target}'`,
				expected: target,
				actual: toolingPolicy.readinessScriptPath,
			});
		}
	}

	if (toolingPolicy.projectBrainMemoryExtension?.enabled) {
		if (!content.includes("project_brain_memory_extension_enabled=true")) {
			findings.push({
				path: "toolingPolicy.projectBrainMemoryExtension.enabled",
				severity: "warning",
				description:
					"Readiness script no longer enables Project Brain memory-extension checks",
				expected: "project_brain_memory_extension_enabled=true",
				actual: toolingPolicy.readinessScriptPath,
			});
		}

		if (!content.includes("required_project_brain_paths=(")) {
			findings.push({
				path: "toolingPolicy.projectBrainMemoryExtension.requiredPaths",
				severity: "warning",
				description:
					"Readiness script no longer declares required Project Brain memory-extension paths",
				expected: toolingPolicy.projectBrainMemoryExtension.requiredPaths,
				actual: toolingPolicy.readinessScriptPath,
			});
		}

		for (const requiredPath of toolingPolicy.projectBrainMemoryExtension
			.requiredPaths) {
			if (!content.includes(`"${requiredPath}"`)) {
				findings.push({
					path: "toolingPolicy.projectBrainMemoryExtension.requiredPaths",
					severity: "warning",
					description: `Readiness script no longer checks Project Brain path '${requiredPath}'`,
					expected: requiredPath,
					actual: toolingPolicy.readinessScriptPath,
				});
			}
		}
	}

	for (const detector of toolingPolicy.packagePolicy.capabilityDetectors) {
		if (!content.includes(detector.capability)) {
			findings.push({
				path: "toolingPolicy.packagePolicy.capabilityDetectors",
				severity: "warning",
				description: `Readiness script no longer references capability detector '${detector.capability}'`,
				expected: detector.capability,
				actual: toolingPolicy.readinessScriptPath,
			});
		}
		for (const marker of detector.dependencyMarkers) {
			if (!content.includes(marker)) {
				findings.push({
					path: "toolingPolicy.packagePolicy.capabilityDetectors",
					severity: "warning",
					description: `Readiness script no longer references package marker '${marker}' for capability '${detector.capability}'`,
					expected: marker,
					actual: toolingPolicy.readinessScriptPath,
				});
			}
		}
	}

	for (const capability of toolingPolicy.packagePolicy.explicitCapabilities ??
		[]) {
		if (!content.includes(`"${capability}"`)) {
			findings.push({
				path: "toolingPolicy.packagePolicy.explicitCapabilities",
				severity: "warning",
				description: `Readiness script no longer references explicit capability '${capability}'`,
				expected: capability,
				actual: toolingPolicy.readinessScriptPath,
			});
		}
	}

	for (const requiredPackage of toolingPolicy.packagePolicy.requiredPackages) {
		if (!content.includes(requiredPackage.package)) {
			findings.push({
				path: "toolingPolicy.packagePolicy.requiredPackages",
				severity: "warning",
				description: `Readiness script no longer references required package '${requiredPackage.package}'`,
				expected: requiredPackage.package,
				actual: toolingPolicy.readinessScriptPath,
			});
		}
	}
}

function auditMise(
	findings: ToolingAuditFinding[],
	repoPath: string,
	contract: HarnessContract,
): void {
	const toolingPolicy =
		contract.toolingPolicy ?? DEFAULT_CONTRACT.toolingPolicy;
	if (!toolingPolicy) {
		return;
	}
	const misePath = join(repoPath, toolingPolicy.miseFilePath);
	const content = readTextFile(misePath);
	if (content === null) {
		addMissingFileFinding(findings, toolingPolicy.miseFilePath, "mise file");
		return;
	}

	const pins = collectMisePins(content);
	for (const tool of toolingPolicy.requiredMiseTools) {
		const actualVersion = pins.get(tool.tool);
		if (!actualVersion) {
			findings.push({
				path: "toolingPolicy.requiredMiseTools",
				severity: "critical",
				description: `Missing mise tool pin for '${tool.tool}'`,
				expected: tool.version,
			});
			continue;
		}
		if (actualVersion !== tool.version) {
			findings.push({
				path: `toolingPolicy.requiredMiseTools.${tool.tool}`,
				severity: "warning",
				description: `Mise pin drift for '${tool.tool}'`,
				expected: tool.version,
				actual: actualVersion,
			});
		}
	}
}

/**
 * Audit required Codex environment action mappings.
 *
 * @param findings - Finding list to append to.
 * @param repoPath - Repository root being audited.
 * @param contract - Tooling contract containing environment policy.
 */
function auditCodexEnvironment(
	findings: ToolingAuditFinding[],
	repoPath: string,
	contract: HarnessContract,
): void {
	const toolingPolicy =
		contract.toolingPolicy ?? DEFAULT_CONTRACT.toolingPolicy;
	if (!toolingPolicy) {
		return;
	}
	const envPath = join(repoPath, toolingPolicy.codexEnvironment.path);
	const content = readTextFile(envPath);
	if (content === null) {
		addMissingFileFinding(
			findings,
			toolingPolicy.codexEnvironment.path,
			"Codex environment file",
		);
		return;
	}

	const pairs = collectCodexActionPairs(content);
	for (const action of toolingPolicy.codexEnvironment.requiredActions) {
		const pair = `${action.name}|${action.icon}`;
		if (!pairs.has(pair)) {
			findings.push({
				path: "toolingPolicy.codexEnvironment.requiredActions",
				severity: "critical",
				description: `Missing Codex action mapping '${pair}'`,
				expected: pair,
			});
		}
	}
}

/**
 * Audit required Makefile targets.
 *
 * @param findings - Finding list to append to.
 * @param repoPath - Repository root being audited.
 * @param contract - Tooling contract containing Makefile policy.
 */
function auditMakefile(
	findings: ToolingAuditFinding[],
	repoPath: string,
	contract: HarnessContract,
): void {
	const toolingPolicy =
		contract.toolingPolicy ?? DEFAULT_CONTRACT.toolingPolicy;
	if (!toolingPolicy) {
		return;
	}
	const makefilePath = join(repoPath, toolingPolicy.makefile.path);
	const content = readTextFile(makefilePath);
	if (content === null) {
		addMissingFileFinding(findings, toolingPolicy.makefile.path, "Makefile");
		return;
	}

	const targets = collectMakeTargets(content);
	for (const target of toolingPolicy.makefile.requiredTargets) {
		if (!targets.has(target)) {
			findings.push({
				path: "toolingPolicy.makefile.requiredTargets",
				severity: "warning",
				description: `Missing Makefile target '${target}'`,
				expected: target,
			});
		}
	}
}

/**
 * Audit required Project Brain memory-extension paths.
 *
 * @param findings - Finding list to append missing paths to.
 * @param repoPath - Repository root being audited.
 * @param contract - Tooling contract containing memory-extension policy.
 */
function auditProjectBrainMemoryExtension(
	findings: ToolingAuditFinding[],
	repoPath: string,
	contract: HarnessContract,
): void {
	const toolingPolicy =
		contract.toolingPolicy ?? DEFAULT_CONTRACT.toolingPolicy;
	if (!toolingPolicy?.projectBrainMemoryExtension?.enabled) {
		return;
	}

	for (const requiredPath of toolingPolicy.projectBrainMemoryExtension
		.requiredPaths) {
		if (!existsSync(join(repoPath, requiredPath))) {
			findings.push({
				path: "toolingPolicy.projectBrainMemoryExtension.requiredPaths",
				severity: "critical",
				description: `Missing Project Brain memory-extension path '${requiredPath}'`,
				expected: requiredPath,
			});
		}
	}
}

/**
 * Audit capability-conditioned package requirements.
 *
 * @param findings - Finding list to append package-policy violations to.
 * @param repoPath - Repository root being audited.
 * @param contract - Tooling contract containing package policy.
 */
function auditPackagePolicy(
	findings: ToolingAuditFinding[],
	repoPath: string,
	contract: HarnessContract,
): void {
	const toolingPolicy =
		contract.toolingPolicy ?? DEFAULT_CONTRACT.toolingPolicy;
	if (!toolingPolicy) {
		return;
	}

	const packagePath = join(
		repoPath,
		toolingPolicy.packagePolicy.packageJsonPath,
	);
	let manifest: PackageManifest | null;
	try {
		manifest = readPackageManifest(packagePath);
	} catch (error) {
		findings.push({
			path: "toolingPolicy.packagePolicy.packageJsonPath",
			severity: "critical",
			description: `Failed to parse package manifest at '${toolingPolicy.packagePolicy.packageJsonPath}'`,
			expected: "Valid JSON object",
			actual: error instanceof Error ? error.message : "Invalid JSON",
		});
		return;
	}
	if (manifest === null) {
		return;
	}

	const capabilities = detectCapabilities(contract, manifest);
	for (const requiredPackage of toolingPolicy.packagePolicy.requiredPackages) {
		const shouldApply = requiredPackage.requiredWhenCapabilities.some(
			(capability) => capabilities.has(capability),
		);
		if (!shouldApply) {
			continue;
		}
		if (
			!hasRequiredPackage(
				manifest,
				requiredPackage.package,
				requiredPackage.dependencyType,
			)
		) {
			findings.push({
				path: "toolingPolicy.packagePolicy.requiredPackages",
				severity: "critical",
				description: `Missing required package '${requiredPackage.package}' for detected capabilities: ${requiredPackage.requiredWhenCapabilities.filter((capability) => capabilities.has(capability)).join(", ")}`,
				expected: {
					package: requiredPackage.package,
					dependencyType: requiredPackage.dependencyType,
				},
				actual: toolingPolicy.packagePolicy.packageJsonPath,
			});
		}
	}
}

/**
 * Validate repository hook support files, Prek hook configurations, and hook-related package.json scripts, appending findings for detected issues.
 *
 * Appends ToolingAuditFinding entries for missing or out-of-date hook support files, Prek config parse errors or missing/incorrect hook definitions, missing or incorrect `package.json` scripts, and presence of legacy `simple-git-hooks` configuration.
 *
 * @param findings - Mutable array that will receive ToolingAuditFinding entries describing any detected problems.
 * @param repoPath - Filesystem path to the repository root to inspect.
 */
function auditLocalHooks(
	findings: ToolingAuditFinding[],
	repoPath: string,
): void {
	for (const supportFile of REQUIRED_HOOK_SUPPORT_FILES) {
		if (!existsSync(join(repoPath, supportFile))) {
			addMissingFileFinding(findings, supportFile, "hook support file");
		}
	}

	const prekPath = join(repoPath, TOOLING_PREK_CONFIG_PATH);
	const prekContent = readTextFile(prekPath);
	if (prekContent === null) {
		addMissingFileFinding(findings, TOOLING_PREK_CONFIG_PATH, "prek config");
	} else {
		const parsedHooks = parsePrekHooks(prekContent);
		auditPrekInstallCoverage(findings, prekContent, parsedHooks);
		for (const hook of parsedHooks) {
			for (const key of hook.duplicateKeys) {
				findings.push({
					path: TOOLING_PREK_CONFIG_PATH,
					severity: "critical",
					description: `Prek hook '${hook.id ?? "unknown"}' repeats policy key '${key}'`,
					expected: "Each policy key appears at most once per hook block",
					actual: key,
				});
			}
			for (const key of hook.invalidKeys) {
				findings.push({
					path: TOOLING_PREK_CONFIG_PATH,
					severity: "critical",
					description: `Prek hook '${hook.id ?? "unknown"}' has an invalid value for policy key '${key}'`,
					expected: "A supported TOML scalar or string-array value",
					actual: key,
				});
			}
		}
		for (const [hookName, hookConfig] of Object.entries(REQUIRED_PREK_HOOKS)) {
			const requiredStage =
				"stages" in hookConfig && hookConfig.stages?.length
					? hookConfig.stages[0]
					: hookName;
			const hasEffectiveLeafHook = parsedHooks.some(
				(hook) =>
					hook.id !== undefined &&
					hook.name !== undefined &&
					hook.stages.includes(requiredStage) &&
					isApprovedPrekLeafEntry(requiredStage, hook.entry) &&
					hook.language === hookConfig.language &&
					hook.passFilenames === hookConfig.pass_filenames,
			);
			if (!hasEffectiveLeafHook) {
				findings.push({
					path: TOOLING_PREK_CONFIG_PATH,
					severity: "critical",
					description: `Prek hook for effective stage '${requiredStage}' is missing or out of date`,
					expected: {
						stage: requiredStage,
						entry: APPROVED_PREK_LEAF_ENTRIES[
							requiredStage as keyof typeof APPROVED_PREK_LEAF_ENTRIES
						] ?? [hookConfig.entry],
						language: hookConfig.language,
						pass_filenames: hookConfig.pass_filenames,
					},
					actual: parsedHooks,
				});
			}
		}
		auditPrekHookEntryBoundaries(findings, prekContent);
		auditPrekHookLeafEntries(findings, parsedHooks, repoPath);
	}

	const packagePath = join(repoPath, TOOLING_PACKAGE_JSON_PATH);
	let packageJson: Record<string, unknown> | null;
	try {
		packageJson = readJsonObject(packagePath);
	} catch (error) {
		findings.push({
			path: TOOLING_PACKAGE_JSON_PATH,
			severity: "critical",
			description: `Failed to parse package manifest at '${TOOLING_PACKAGE_JSON_PATH}'`,
			expected: "Valid JSON object",
			actual: error instanceof Error ? error.message : "Invalid JSON",
		});
		return;
	}
	if (packageJson === null) {
		return;
	}

	const scripts = packageJson.scripts;
	const scriptObject =
		scripts && typeof scripts === "object" && !Array.isArray(scripts)
			? (scripts as Record<string, unknown>)
			: null;
	for (const [scriptName, expectedCommand] of Object.entries(
		REQUIRED_PACKAGE_SCRIPTS,
	)) {
		if (!scriptObject || scriptObject[scriptName] !== expectedCommand) {
			findings.push({
				path: TOOLING_PACKAGE_JSON_PATH,
				severity: "critical",
				description: `package.json script '${scriptName}' is missing or out of date`,
				expected: expectedCommand,
				actual: scriptObject?.[scriptName],
			});
		}
	}

	const legacySimpleGitHooksLocations: string[] = [];
	if (Object.hasOwn(packageJson, "simple-git-hooks")) {
		legacySimpleGitHooksLocations.push("simple-git-hooks");
	}
	for (const dependencyField of ["dependencies", "devDependencies"] as const) {
		const dependencies = packageJson[dependencyField];
		if (
			dependencies &&
			typeof dependencies === "object" &&
			!Array.isArray(dependencies) &&
			Object.hasOwn(dependencies, "simple-git-hooks")
		) {
			legacySimpleGitHooksLocations.push(`${dependencyField}.simple-git-hooks`);
		}
	}
	if (scriptObject) {
		for (const [scriptName, scriptValue] of Object.entries(scriptObject)) {
			if (
				typeof scriptValue === "string" &&
				scriptValue.includes("simple-git-hooks")
			) {
				legacySimpleGitHooksLocations.push(`scripts.${scriptName}`);
			}
		}
	}

	if (legacySimpleGitHooksLocations.length > 0) {
		findings.push({
			path: TOOLING_PACKAGE_JSON_PATH,
			severity: "critical",
			description:
				"Legacy simple-git-hooks config should be removed after migrating to prek",
			expected: "No simple-git-hooks config, dependency, or script usage",
			actual: legacySimpleGitHooksLocations,
		});
	}
}

function auditBaseDrift(
	findings: ToolingAuditFinding[],
	contract: HarnessContract,
	baseContract: HarnessContract,
): void {
	const basePolicy = baseContract.toolingPolicy;
	const actualPolicy = contract.toolingPolicy;
	if (!basePolicy || !actualPolicy) {
		return;
	}

	const actualDocs = new Set(actualPolicy.requiredDocumentationTerms);
	for (const term of basePolicy.requiredDocumentationTerms) {
		if (!actualDocs.has(term)) {
			findings.push({
				path: "toolingPolicy.requiredDocumentationTerms",
				severity: "warning",
				description: `Contract drift: missing tooling documentation term '${term}'`,
				expected: term,
			});
		}
	}

	const actualBins = new Set(actualPolicy.requiredBinaries);
	for (const binary of basePolicy.requiredBinaries) {
		if (!actualBins.has(binary)) {
			findings.push({
				path: "toolingPolicy.requiredBinaries",
				severity: "critical",
				description: `Contract drift: missing required binary '${binary}'`,
				expected: binary,
			});
		}
	}

	const actualDetectors = new Map(
		actualPolicy.packagePolicy.capabilityDetectors.map((detector) => [
			detector.capability,
			new Set(detector.dependencyMarkers),
		]),
	);
	for (const detector of basePolicy.packagePolicy.capabilityDetectors) {
		const actualMarkers = actualDetectors.get(detector.capability);
		if (!actualMarkers) {
			findings.push({
				path: "toolingPolicy.packagePolicy.capabilityDetectors",
				severity: "warning",
				description: `Contract drift: missing capability detector '${detector.capability}'`,
				expected: detector.capability,
			});
			continue;
		}
		for (const marker of detector.dependencyMarkers) {
			if (!actualMarkers.has(marker)) {
				findings.push({
					path: "toolingPolicy.packagePolicy.capabilityDetectors",
					severity: "warning",
					description: `Contract drift: capability '${detector.capability}' no longer checks dependency marker '${marker}'`,
					expected: marker,
				});
			}
		}
	}

	const actualExplicitCapabilities = new Set(
		actualPolicy.packagePolicy.explicitCapabilities ?? [],
	);
	for (const capability of basePolicy.packagePolicy.explicitCapabilities ??
		[]) {
		if (!actualExplicitCapabilities.has(capability)) {
			findings.push({
				path: "toolingPolicy.packagePolicy.explicitCapabilities",
				severity: "warning",
				description: `Contract drift: missing explicit tooling capability '${capability}'`,
				expected: capability,
			});
		}
	}

	const actualRequiredPackages = new Map(
		actualPolicy.packagePolicy.requiredPackages.map((requiredPackage) => [
			requiredPackage.package,
			requiredPackage,
		]),
	);
	for (const requiredPackage of basePolicy.packagePolicy.requiredPackages) {
		const actualPackage = actualRequiredPackages.get(requiredPackage.package);
		if (!actualPackage) {
			findings.push({
				path: "toolingPolicy.packagePolicy.requiredPackages",
				severity: "critical",
				description: `Contract drift: missing conditional package '${requiredPackage.package}'`,
				expected: requiredPackage.package,
			});
			continue;
		}
		if (actualPackage.dependencyType !== requiredPackage.dependencyType) {
			findings.push({
				path: `toolingPolicy.packagePolicy.requiredPackages.${requiredPackage.package}`,
				severity: "warning",
				description: `Contract drift: conditional package '${requiredPackage.package}' changed dependency type`,
				expected: requiredPackage.dependencyType,
				actual: actualPackage.dependencyType,
			});
		}
	}

	const baseProjectBrain = basePolicy.projectBrainMemoryExtension;
	const actualProjectBrain = actualPolicy.projectBrainMemoryExtension;
	if (baseProjectBrain?.enabled) {
		if (!actualProjectBrain?.enabled) {
			findings.push({
				path: "toolingPolicy.projectBrainMemoryExtension.enabled",
				severity: "warning",
				description:
					"Contract drift: Project Brain memory-extension checks are no longer enabled",
				expected: true,
				actual: actualProjectBrain?.enabled ?? false,
			});
		}

		const actualPaths = new Set(actualProjectBrain?.requiredPaths ?? []);
		for (const requiredPath of baseProjectBrain.requiredPaths) {
			if (!actualPaths.has(requiredPath)) {
				findings.push({
					path: "toolingPolicy.projectBrainMemoryExtension.requiredPaths",
					severity: "warning",
					description: `Contract drift: missing Project Brain memory-extension path '${requiredPath}'`,
					expected: requiredPath,
				});
			}
		}
	}
}

/**
 * Aggregate finding counts by severity from an array of repository results.
 *
 * @param results - Per-repository audit results whose findings will be counted
 * @returns An object with counts: `total` (sum of all findings), `critical` (number of critical findings), `warning` (number of warning findings), and `info` (number of informational findings)
 */
function summarizeFindings(
	results: ToolingAuditRepoResult[],
): ToolingAuditResult["findings"] {
	let critical = 0;
	let warning = 0;
	let info = 0;
	for (const result of results) {
		for (const finding of result.findings) {
			if (finding.severity === "critical") critical += 1;
			if (finding.severity === "warning") warning += 1;
			if (finding.severity === "info") info += 1;
		}
	}
	return {
		total: critical + warning + info,
		critical,
		warning,
		info,
	};
}

/**
 * Audit a repository for tooling policy compliance.
 *
 * Performs the repository-level checks specified by the repository's harness contract (if present) and collects findings from readiness script, Mise, Codex environment, Makefile, Project Brain memory-extension, package policy, local hooks audits, and optional base-contract drift detection.
 *
 * @param repoPath - Filesystem path to the repository to audit
 * @param baseContract - Optional base contract to compare against for drift detection
 * @param includeMissing - If true, treat repositories without a harness.contract.json as `no-contract` results instead of an `error`
 * @returns A ToolingAuditRepoResult containing the repository `path`, `status`, collected `findings`, and an optional `error` message. `status` will be:
 *  - `"success"`: contract found and audits executed (findings may be empty),
 *  - `"no-contract"`: no contract found and `includeMissing` was true,
 *  - `"error"`: an error occurred reading or loading the contract (see `error` for details)
 */
async function auditRepository(
	repoPath: string,
	baseContract?: HarnessContract,
	includeMissing = false,
): Promise<ToolingAuditRepoResult> {
	const contractPath = join(repoPath, "harness.contract.json");
	if (!existsSync(contractPath)) {
		return includeMissing
			? { path: repoPath, status: "no-contract", findings: [] }
			: {
					path: repoPath,
					status: "error",
					findings: [],
					error: "No harness.contract.json found",
				};
	}

	let rawContract: Record<string, unknown>;
	try {
		rawContract = getRawJson(readFileSync(contractPath, "utf-8"));
	} catch (error) {
		return {
			path: repoPath,
			status: "error",
			findings: [],
			error:
				error instanceof Error ? error.message : "Failed to parse contract",
		};
	}

	let contract: HarnessContract;
	try {
		contract = loadContract(contractPath, repoPath);
	} catch (error) {
		return {
			path: repoPath,
			status: "error",
			findings: [],
			error: error instanceof Error ? error.message : "Failed to load contract",
		};
	}

	const findings: ToolingAuditFinding[] = [];
	if (!Object.hasOwn(rawContract, "toolingPolicy")) {
		findings.push({
			path: "toolingPolicy",
			severity: "warning",
			description:
				"Contract relies on implicit tooling defaults; run 'harness upgrade --dry-run' to preview a safe upgrade path, or 'harness init --update' to re-scaffold tracked files when needed",
		});
	}

	auditReadinessScript(findings, repoPath, contract);
	auditMise(findings, repoPath, contract);
	auditCodexEnvironment(findings, repoPath, contract);
	auditMakefile(findings, repoPath, contract);
	auditProjectBrainMemoryExtension(findings, repoPath, contract);
	auditPackagePolicy(findings, repoPath, contract);
	auditLocalHooks(findings, repoPath);
	if (baseContract) {
		auditBaseDrift(findings, contract, baseContract);
	}

	return {
		path: repoPath,
		status: "success",
		findings,
	};
}

/**
 * Executes tooling-audit checks over discovered repositories.
 */
export async function runToolingAudit(
	options: ToolingAuditOptions,
): Promise<CliResult<{ result: ToolingAuditResult; exitCode: number }>> {
	const pathValidation = validatePathInput(options.path, "path");
	if (!pathValidation.ok) {
		return err(pathValidation.error);
	}
	const validatedPath = pathValidation.value.safePath;
	const repos = findRepositories(validatedPath);
	if (repos.length === 0) {
		return ok({
			result: {
				totalRepos: 0,
				successfulRepos: 0,
				errors: 0,
				noContract: 0,
				findings: { total: 0, critical: 0, warning: 0, info: 0 },
				results: [],
			},
			exitCode: EXIT_CODES.NO_REPOS_FOUND,
		});
	}

	const results = await Promise.all(
		repos.map((repo) =>
			auditRepository(repo, options.baseContract, options.includeMissing),
		),
	);
	const findings = summarizeFindings(results);
	const errors = results.filter((result) => result.status === "error").length;
	const noContract = results.filter(
		(result) => result.status === "no-contract",
	).length;
	const successfulRepos = results.filter(
		(result) => result.status === "success",
	).length;
	const result: ToolingAuditResult = {
		totalRepos: repos.length,
		successfulRepos,
		errors,
		noContract,
		findings,
		results,
	};

	let exitCode: (typeof EXIT_CODES)[keyof typeof EXIT_CODES] =
		EXIT_CODES.SUCCESS;
	if (errors > 0) {
		exitCode = EXIT_CODES.SCAN_ERRORS;
	} else if (findings.critical > 0 || findings.warning > 0) {
		exitCode = EXIT_CODES.DRIFT_DETECTED;
	}

	return ok({ result, exitCode });
}

function formatJson(result: ToolingAuditResult): string {
	return JSON.stringify(result, null, 2);
}

function formatMarkdown(result: ToolingAuditResult): string {
	const lines: string[] = [];
	lines.push("# Tooling Audit Report", "", "## Summary", "");
	lines.push(`- **Total Repositories**: ${result.totalRepos}`);
	lines.push(`- **Successful**: ${result.successfulRepos}`);
	lines.push(`- **Errors**: ${result.errors}`);
	lines.push(`- **No Contract**: ${result.noContract}`);
	lines.push(`- **Critical Findings**: ${result.findings.critical}`);
	lines.push(`- **Warning Findings**: ${result.findings.warning}`);
	lines.push("");
	for (const repo of result.results) {
		lines.push(`## ${repo.path}`, "");
		if (repo.status === "error") {
			lines.push(`- Error: ${repo.error ?? "Unknown error"}`, "");
			continue;
		}
		if (repo.status === "no-contract") {
			lines.push("- No harness contract found.", "");
			continue;
		}
		if (repo.findings.length === 0) {
			lines.push("- No tooling drift detected.", "");
			continue;
		}
		for (const finding of repo.findings) {
			lines.push(`- [${finding.severity}] ${finding.description}`);
		}
		lines.push("");
	}
	return lines.join("\n");
}

function formatTable(result: ToolingAuditResult): string {
	const lines: string[] = [];
	lines.push("Tooling Audit Report", "====================", "");
	lines.push(`Total Repositories: ${result.totalRepos}`);
	lines.push(`Successful: ${result.successfulRepos}`);
	lines.push(`Errors: ${result.errors}`);
	lines.push(`No Contract: ${result.noContract}`);
	lines.push(`Critical Findings: ${result.findings.critical}`);
	lines.push(`Warning Findings: ${result.findings.warning}`);
	lines.push("");
	for (const repo of result.results) {
		lines.push(`${repo.path}:`);
		if (repo.status === "error") {
			lines.push(`  ❌ ${repo.error ?? "Unknown error"}`);
			lines.push("");
			continue;
		}
		if (repo.status === "no-contract") {
			lines.push("  ℹ️ no harness contract found");
			lines.push("");
			continue;
		}
		if (repo.findings.length === 0) {
			lines.push("  ✅ no tooling drift detected");
			lines.push("");
			continue;
		}
		for (const finding of repo.findings) {
			const icon =
				finding.severity === "critical"
					? "❌"
					: finding.severity === "warning"
						? "⚠️"
						: "ℹ️";
			lines.push(`  ${icon} [${finding.severity}] ${finding.description}`);
		}
		lines.push("");
	}
	return lines.join("\n");
}

/**
 * CLI argument parser and output wrapper for tooling-audit.
 */
export async function runToolingAuditCLI(args: string[]): Promise<{
	exitCode: number;
	output?: string;
}> {
	const flagsWithValues = new Set(["--path", "--base", "--format"]);
	const booleanFlags = new Set(["--include-missing", "--json"]);
	for (let i = 0; i < args.length; i += 1) {
		const arg = args[i];
		if (!arg) continue;
		if (!arg.startsWith("-")) {
			console.error(`Error: Unexpected positional argument '${arg}'`);
			return { exitCode: EXIT_CODES.INVALID_ARGUMENT };
		}
		if (flagsWithValues.has(arg)) {
			const next = args[i + 1];
			if (!next || next.startsWith("-")) {
				console.error(`Error: ${arg} requires a value`);
				return { exitCode: EXIT_CODES.INVALID_ARGUMENT };
			}
			i += 1;
			continue;
		}
		if (booleanFlags.has(arg)) {
			continue;
		}
		console.error(`Error: Unknown flag '${arg}'`);
		return { exitCode: EXIT_CODES.INVALID_ARGUMENT };
	}

	const pathIndex = args.indexOf("--path");
	const baseIndex = args.indexOf("--base");
	const formatIndex = args.indexOf("--format");
	const includeMissing = args.includes("--include-missing");
	const jsonFlag = args.includes("--json");
	let scanPath = pathIndex === -1 ? process.cwd() : args[pathIndex + 1];
	if (!scanPath) {
		scanPath = process.cwd();
	}
	const pathValidation = validatePathInput(scanPath, "--path");
	if (!pathValidation.ok) {
		console.error(`Error: ${pathValidation.error.message}`);
		return { exitCode: EXIT_CODES.INVALID_ARGUMENT };
	}
	scanPath = pathValidation.value.absolutePath;
	if (!existsSync(scanPath)) {
		console.error(`Error: Path does not exist: ${scanPath}`);
		return { exitCode: EXIT_CODES.INVALID_ARGUMENT };
	}
	if (!statSync(scanPath).isDirectory()) {
		console.error(`Error: Path is not a directory: ${scanPath}`);
		return { exitCode: EXIT_CODES.INVALID_ARGUMENT };
	}

	let baseContract: HarnessContract | undefined;
	if (baseIndex !== -1) {
		const rawBasePath = args[baseIndex + 1];
		if (!rawBasePath) {
			console.error("Error: --base requires a path argument");
			return { exitCode: EXIT_CODES.INVALID_ARGUMENT };
		}
		const baseValidation = validatePathInput(rawBasePath, "--base");
		if (!baseValidation.ok) {
			console.error(`Error: ${baseValidation.error.message}`);
			return { exitCode: EXIT_CODES.INVALID_ARGUMENT };
		}
		try {
			baseContract = loadContract(
				baseValidation.value.safePath,
				dirname(baseValidation.value.safePath),
			);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			console.error(`Error loading base contract: ${message}`);
			return { exitCode: EXIT_CODES.INVALID_ARGUMENT };
		}
	}

	let format: OutputFormat = "table";
	if (jsonFlag || formatIndex !== -1) {
		const formatArg = jsonFlag ? "json" : args[formatIndex + 1];
		if (
			formatArg === "json" ||
			formatArg === "markdown" ||
			formatArg === "table"
		) {
			format = formatArg;
		}
	}

	const auditResult = await runToolingAudit({
		path: scanPath,
		baseContract,
		format,
		includeMissing,
	});
	if (!auditResult.ok) {
		console.error(`Error: ${auditResult.error.message}`);
		return { exitCode: EXIT_CODES.INVALID_ARGUMENT };
	}

	const { result, exitCode } = auditResult.value;
	const output =
		format === "json"
			? formatJson(result)
			: format === "markdown"
				? formatMarkdown(result)
				: formatTable(result);
	console.info(output);
	return { exitCode, output };
}

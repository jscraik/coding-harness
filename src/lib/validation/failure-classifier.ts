/** Class emitted for one validation command observation. */
export type ValidationFailureClassification =
	| "passed"
	| "introduced_regression"
	| "pre_existing_drift"
	| "environment_tooling_failure"
	| "unrelated_dirty_worktree"
	| "missing_credential"
	| "expected_fixture_stderr"
	| "unknown_failure";

/** Confidence level for a validation failure classification. */
export type ValidationFailureConfidence = "high" | "medium" | "low";

/** Dirty worktree file context supplied by a caller that inspected git state. */
export interface ValidationDirtyFile {
	/** Repo-relative file path. */
	path: string;
	/** Whether this dirty file belongs to the current patch scope. */
	ownedByCurrentChange?: boolean;
}

/** Evidence for one validation command run. */
export interface ValidationCommandObservation {
	/** Exact validation command that ran. */
	command: string;
	/** Process exit code returned by the command. */
	exitCode: number;
	/** Captured stdout, if available. */
	stdout?: string;
	/** Captured stderr, if available. */
	stderr?: string;
	/** Files intentionally changed by the current patch, repo-relative. */
	changedFiles?: readonly string[];
	/** Dirty worktree files visible when the command ran. */
	dirtyFiles?: readonly ValidationDirtyFile[];
	/** Explicit caller evidence that the failure existed before this patch. */
	preExistingFailure?: boolean;
	/** Explicit caller evidence that failure-looking output is expected fixture output. */
	expectedFixtureOutput?: boolean;
	/** Credential names known to be required for this command. */
	requiredCredentialNames?: readonly string[];
}

/** Deterministic result for one validation command observation. */
export interface ValidationFailureClassifierResult {
	/** Failure class assigned to the command observation. */
	classification: ValidationFailureClassification;
	/** Whether the classification should block closeout or merge-readiness claims. */
	blocking: boolean;
	/** Confidence in the selected classification. */
	confidence: ValidationFailureConfidence;
	/** Short operator action to take next. */
	nextAction: string;
	/** Human-readable reasons that explain the selected class. */
	reasons: string[];
	/** Output paths or tokens that influenced classification. */
	evidenceRefs: string[];
}

const CREDENTIAL_PATTERNS = [
	/\b(?:NPM_TOKEN|GITHUB_TOKEN|GH_TOKEN|CIRCLECI_TOKEN|OPENAI_API_KEY)\b/i,
	/auth(?:entication)? required/i,
	/bad credentials/i,
	/not authenticated/i,
	/could not read username/i,
	/permission denied.*(?:publickey|token|credential)/i,
] as const;

const ENVIRONMENT_PATTERNS = [
	/\b(?:command not found|ENOENT|MODULE_NOT_FOUND)\b/i,
	/\b(?:EAI_AGAIN|ECONNRESET|ETIMEDOUT|ENOTFOUND)\b/i,
	/\b(?:timed out|timeout|network error|transport error)\b/i,
	/\b(?:502|503|429)\b/i,
	/temporar(?:y|ily unavailable)/i,
	/operation not permitted/i,
	/mise .*trust/i,
] as const;

const PRE_EXISTING_PATTERNS = [
	/"baseline"\s*:\s*true/i,
	/\bbaseline\b/i,
	/\bpre[- ]existing\b/i,
	/already (?:known|the active mode)/i,
	/checksum mismatch: codestyle\//i,
] as const;

const FIXTURE_PATTERNS = [
	/\bTest Files\s+\d+\s+passed/i,
	/\bTests\s+\d+\s+passed/i,
	/"status"\s*:\s*"fail"/i,
	/"verdict"\s*:\s*"fail"/i,
	/fixture/i,
] as const;

const PATH_PATTERN =
	/(?:^|[\s"'(])((?:\.?[\w.-]+\/)*(?:[\w.@:+-]+)(?:\.[\w+-]+)?)/g;

/**
 * Concatenates an observation's stdout and stderr into a single output string.
 *
 * @param observation - The validation command observation whose `stdout` and `stderr` should be combined
 * @returns The combined output: `stdout` and `stderr` joined with a single newline; empty or missing parts are omitted. */
function combinedOutput(observation: ValidationCommandObservation): string {
	return [observation.stdout ?? "", observation.stderr ?? ""]
		.filter((part) => part.length > 0)
		.join("\n");
}

/**
 * Normalizes a path-like token by removing common surrounding and trailing artifacts.
 *
 * Removes a leading "./", strips trailing ":<line>" or ":<line>:<column>" suffixes, and trims trailing punctuation or closing delimiters such as commas, colons, semicolons, parentheses, and greater-than signs.
 *
 * @param path - The extracted path-like token to normalize
 * @returns The cleaned, normalized path
 */
function normalizePath(path: string): string {
	return path
		.replace(/^\.\//, "")
		.replace(/:\d+(?::\d+)?$/u, "")
		.replace(/[,:;)>]+$/g, "");
}

/**
 * Normalize a list of file paths and return them as a set of unique normalized paths.
 *
 * @param paths - An optional array of file path strings; undefined is treated as an empty list.
 * @returns A Set containing each input path after `normalizePath` has been applied, with duplicates removed.
 */
function normalizePaths(paths: readonly string[] | undefined): Set<string> {
	return new Set((paths ?? []).map((path) => normalizePath(path)));
}

/**
 * Escapes special regular expression characters in a string so it can be used literally in a RegExp.
 *
 * @param value - The string to escape
 * @returns The input with all RegExp metacharacters escaped
 */
function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Checks whether any regular expression in `patterns` matches the provided `output`.
 *
 * @param output - The text to test against the patterns
 * @param patterns - An array of regular expressions to test
 * @returns `true` if any pattern matches `output`, `false` otherwise
 */
function matchesAny(output: string, patterns: readonly RegExp[]): boolean {
	return patterns.some((pattern) => pattern.test(output));
}

/**
 * Checks whether any of the observation's required credential names appear in the provided output.
 *
 * @param observation - Observation containing optional `requiredCredentialNames` to search for
 * @param output - Text to search for credential names
 * @returns The first credential name from `observation.requiredCredentialNames` that matches `output` using a case-insensitive, word-boundary match, or `undefined` if none match
 */
function requiredCredentialSeen(
	observation: ValidationCommandObservation,
	output: string,
): string | undefined {
	for (const credential of observation.requiredCredentialNames ?? []) {
		const pattern = new RegExp(`\\b${escapeRegExp(credential)}\\b`, "i");
		if (pattern.test(output)) {
			return credential;
		}
	}
	return undefined;
}

/**
 * Extracts unique normalized file or path tokens from a text blob.
 *
 * Scans `output` for path-like tokens, ignores tokens that start with "http", normalizes each extracted path (e.g., removing leading `./` and trimming trailing line/column and punctuation), and returns the unique normalized paths.
 *
 * @param output - The text to scan for path-like tokens
 * @returns An array of unique normalized path strings extracted from `output` (URLs starting with "http" are ignored)
 */
function extractOutputPaths(output: string): string[] {
	const paths = new Set<string>();
	for (const match of output.matchAll(PATH_PATTERN)) {
		const path = match[1];
		if (path && !path.startsWith("http")) {
			paths.add(normalizePath(path));
		}
	}
	return [...paths];
}

/**
 * Returns the unique normalized entries from `left` that are present in `right`.
 *
 * Each value from `left` is normalized before comparison.
 *
 * @param left - Array of path-like strings to check; each entry is normalized before matching
 * @param right - Set of normalized strings to intersect against
 * @returns The unique normalized entries from `left` that are present in `right`
 */
function intersect(left: readonly string[], right: Set<string>): string[] {
	const matches = new Set<string>();
	for (const value of left) {
		const normalized = normalizePath(value);
		if (right.has(normalized)) {
			matches.add(normalized);
		}
	}
	return [...matches];
}

/**
 * Builds a map from normalized repository-relative paths to their corresponding dirty-file entries.
 *
 * @param dirtyFiles - Optional list of dirty worktree files to index
 * @returns A Map whose keys are normalized paths and whose values are the corresponding `ValidationDirtyFile` entries
 */
function dirtyPathIndex(
	dirtyFiles: readonly ValidationDirtyFile[] | undefined,
): Map<string, ValidationDirtyFile> {
	const index = new Map<string, ValidationDirtyFile>();
	for (const file of dirtyFiles ?? []) {
		index.set(normalizePath(file.path), file);
	}
	return index;
}

/**
 * Constructs a ValidationFailureClassifierResult from the provided classification details.
 *
 * @param classification - The classification label for the validation outcome
 * @param blocking - Whether the classification should block further progress
 * @param confidence - Confidence level for the classification
 * @param nextAction - Suggested next action for the caller (human-readable)
 * @param reasons - Short human-readable reasons that justify the classification
 * @param evidenceRefs - Optional list of evidence references (for example, normalized file paths) supporting the classification
 * @returns The assembled ValidationFailureClassifierResult populated with the provided fields
 */
function result(
	classification: ValidationFailureClassification,
	blocking: boolean,
	confidence: ValidationFailureConfidence,
	nextAction: string,
	reasons: string[],
	evidenceRefs: string[] = [],
): ValidationFailureClassifierResult {
	return {
		classification,
		blocking,
		confidence,
		nextAction,
		reasons,
		evidenceRefs,
	};
}

/**
 * Determine the classifier result for an observation whose command exited with code 0.
 *
 * @returns A ValidationFailureClassifierResult classifying the observation as `"expected_fixture_stderr"` when the caller explicitly marked expected fixture output or when output matches fixture patterns (confidence `"high"` for explicit marker, `"medium"` for pattern match), otherwise as `"passed"` with confidence `"high"`. The result includes explanatory reasons and any provided output path evidence.
 */
function classifyZeroExit(
	observation: ValidationCommandObservation,
	output: string,
	outputPaths: string[],
): ValidationFailureClassifierResult {
	if (
		observation.expectedFixtureOutput === true ||
		(output.length > 0 && matchesAny(output, FIXTURE_PATTERNS))
	) {
		return result(
			"expected_fixture_stderr",
			false,
			observation.expectedFixtureOutput === true ? "high" : "medium",
			"Record the command as passed; failure-looking output came from expected fixture output.",
			["command exited 0 while output contained expected fixture failure text"],
			outputPaths,
		);
	}
	return result(
		"passed",
		false,
		"high",
		"Record the command as passed.",
		["command exited 0"],
		outputPaths,
	);
}

/**
 * Classifies a single validation command observation into a deterministic failure classification and remediation guidance.
 *
 * @param observation - Observation containing the command text, exit code, captured stdout/stderr, and optional changed/dirty file context and metadata
 * @returns The classifier result including `classification`, `blocking`, `confidence`, `nextAction`, `reasons`, and `evidenceRefs`
 */
export function classifyValidationFailure(
	observation: ValidationCommandObservation,
): ValidationFailureClassifierResult {
	const output = combinedOutput(observation);
	const outputPaths = extractOutputPaths(output);
	const commandPaths = extractOutputPaths(observation.command);
	const changedFiles = normalizePaths(observation.changedFiles);
	const dirtyFiles = dirtyPathIndex(observation.dirtyFiles);
	const changedEvidencePaths = intersect(
		[...outputPaths, ...commandPaths],
		changedFiles,
	);
	const dirtyOutputPaths = outputPaths.filter((path) => dirtyFiles.has(path));
	const unrelatedDirtyOutputPaths = dirtyOutputPaths.filter(
		(path) => dirtyFiles.get(path)?.ownedByCurrentChange !== true,
	);

	if (observation.exitCode === 0) {
		return classifyZeroExit(observation, output, outputPaths);
	}

	const credential = requiredCredentialSeen(observation, output);
	if (credential || matchesAny(output, CREDENTIAL_PATTERNS)) {
		return result(
			"missing_credential",
			true,
			credential ? "high" : "medium",
			"Provide or refresh the required credential, then rerun the command.",
			[
				credential
					? `output referenced required credential ${credential}`
					: "output matched a credential/authentication failure signal",
			],
			outputPaths,
		);
	}

	if (matchesAny(output, ENVIRONMENT_PATTERNS)) {
		return result(
			"environment_tooling_failure",
			true,
			"medium",
			"Fix the local environment or transient tooling blocker, then rerun the command.",
			["output matched an environment, network, or tooling failure signal"],
			outputPaths,
		);
	}

	if (
		unrelatedDirtyOutputPaths.length > 0 &&
		changedEvidencePaths.length === 0 &&
		observation.dirtyFiles &&
		observation.dirtyFiles.length > 0
	) {
		return result(
			"unrelated_dirty_worktree",
			true,
			"high",
			"Pause and separate or resolve unrelated dirty worktree changes before rerunning.",
			["failure output referenced dirty files outside the current patch scope"],
			unrelatedDirtyOutputPaths,
		);
	}

	if (
		observation.preExistingFailure === true ||
		matchesAny(output, PRE_EXISTING_PATTERNS)
	) {
		return result(
			"pre_existing_drift",
			true,
			observation.preExistingFailure === true ? "high" : "medium",
			"Record the drift as pre-existing and route it separately from the current patch.",
			[
				observation.preExistingFailure === true
					? "caller marked the failure as pre-existing"
					: "output matched baseline or pre-existing drift evidence",
			],
			outputPaths,
		);
	}

	if (changedEvidencePaths.length > 0) {
		return result(
			"introduced_regression",
			true,
			"high",
			"Fix the regression in the current patch, then rerun the command.",
			["failure output referenced files changed by the current patch"],
			changedEvidencePaths,
		);
	}

	return result(
		"unknown_failure",
		true,
		"low",
		"Inspect the command output, add stronger context, and rerun classification.",
		["non-zero exit without enough evidence for a narrower class"],
		outputPaths,
	);
}

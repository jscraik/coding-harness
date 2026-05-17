import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { cwd } from "node:process";
import { sanitizeError } from "../lib/input/sanitize.js";
import {
	buildPrCloseoutReport,
	type PrCloseoutCheckInput,
	type PrCloseoutInput,
	type PrCloseoutPullRequestInput,
	type PrCloseoutTraceabilityInput,
	type PrCloseoutToolInput,
} from "../lib/pr-closeout.js";

interface PrCloseoutCLIOptions {
	json: boolean;
	repoRoot: string;
	inputPath?: string;
	prNumber?: number;
	envFilePath?: string;
}

type PrCloseoutParseResult =
	| { options: PrCloseoutCLIOptions }
	| { exitCode: number };

type CommandRunner = (
	command: string,
	args: readonly string[],
	options: { cwd: string; env?: NodeJS.ProcessEnv },
) => string;

const DEFAULT_ENV_FILE = resolve(homedir(), ".codex/.env");

/**
 * Prints usage information and a brief description for the `harness pr-closeout` CLI.
 */
function printUsage(): void {
	console.info(
		"Usage: harness pr-closeout [--json] [--repo <path>] [--input <path> | --pr <number>] [--env-file <path>]",
	);
	console.info("");
	console.info(
		"Build a read-only pr-closeout/v1 report from normalized evidence or live GitHub CLI state.",
	);
}

/**
 * Read the token immediately after a flag position in an argv-style list, treating missing or flag-like next tokens as absent.
 *
 * @param args - The argument list (e.g., process.argv slice)
 * @param index - The index of the flag within `args`
 * @returns The token following the flag, or `undefined` if there is no following token or the next token starts with `--`
 */
function readFlagValue(
	args: readonly string[],
	index: number,
): string | undefined {
	const value = args[index + 1];
	if (value === undefined || value.startsWith("--")) return undefined;
	return value;
}

/**
 * Parse a decimal digit string and return its integer value when greater than zero.
 *
 * @param value - The input string to parse; must consist only of ASCII digits (`0-9`).
 * @returns The parsed integer greater than zero, or `undefined` if `value` is missing, contains non-digit characters, or does not represent an integer greater than zero.
 */
function parsePositiveInteger(value: string | undefined): number | undefined {
	if (!value) return undefined;
	if (!/^\d+$/u.test(value)) return undefined;
	const parsed = Number.parseInt(value, 10);
	if (!Number.isInteger(parsed) || parsed <= 0) return undefined;
	return parsed;
}

/**
 * Parse command-line tokens for the pr-closeout CLI and validate required flags.
 *
 * @param args - The command-line argument tokens to parse (e.g., process.argv.slice(2)).
 * @returns An object containing `options` when parsing succeeds; otherwise an object with `exitCode` set to `0` for help or `2` for invalid usage.
function parseArgs(args: readonly string[]): PrCloseoutParseResult {
	if (args.includes("--help") || args.includes("-h")) {
		printUsage();
		return { exitCode: 0 };
	}
	const options: PrCloseoutCLIOptions = {
		json: args.includes("--json"),
		repoRoot: cwd(),
	};
	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];
		if (arg === "--json") continue;
		if (arg === "--repo") {
			const value = readFlagValue(args, index);
			if (!value) {
				console.error("pr-closeout: --repo requires a path");
				return { exitCode: 2 };
			}
			options.repoRoot = resolve(value);
			index += 1;
			continue;
		}
		if (arg === "--input") {
			const value = readFlagValue(args, index);
			if (!value) {
				console.error("pr-closeout: --input requires a path");
				return { exitCode: 2 };
			}
			options.inputPath = value;
			index += 1;
			continue;
		}
		if (arg === "--pr") {
			const value = parsePositiveInteger(readFlagValue(args, index));
			if (!value) {
				console.error("pr-closeout: --pr requires a positive integer");
				return { exitCode: 2 };
			}
			options.prNumber = value;
			index += 1;
			continue;
		}
		if (arg === "--env-file") {
			const value = readFlagValue(args, index);
			if (!value) {
				console.error("pr-closeout: --env-file requires a path");
				return { exitCode: 2 };
			}
			options.envFilePath = resolve(value);
			index += 1;
			continue;
		}
		console.error(`pr-closeout: unknown argument ${String(arg)}`);
		return { exitCode: 2 };
	}
	if (options.inputPath && options.prNumber !== undefined) {
		console.error("pr-closeout: use either --input or --pr, not both");
		return { exitCode: 2 };
	}
	if (!options.inputPath && options.prNumber === undefined) {
		console.error("pr-closeout: either --input or --pr is required");
		return { exitCode: 2 };
	}
	return { options };
}

/**
 * Executes an external command and returns its stdout trimmed of surrounding whitespace.
 *
 * @param command - The command to execute.
 * @param args - Arguments to pass to the command.
 * @param options.cwd - Working directory in which to run the command.
 * @param options.env - Optional environment variables for the command; if omitted the current process environment is used.
 * @returns The command's stdout with leading and trailing whitespace removed.
 */
function defaultRunner(
	command: string,
	args: readonly string[],
	options: { cwd: string; env?: NodeJS.ProcessEnv },
): string {
	return execFileSync(command, [...args], {
		cwd: options.cwd,
		env: options.env,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
		timeout: 15_000,
	}).trim();
}

/**
 * Loads environment variables from the specified env file (or the default) and reports the env-file tool status.
 *
 * If `envFilePath` is not provided the default path is used. The returned `env` starts as a shallow copy of
 * `process.env` with additional entries parsed from the file when present. The parser accepts lines of the form
 * `KEY=VALUE`, ignores blank lines and `#` comments, strips surrounding single or double quotes from values,
 * and only imports entries whose keys match the pattern `^[A-Z_][A-Z0-9_]*$` and whose values are non-empty.
 *
 * The returned `tool` describes the evaluated env-file state:
 * - status `missing` when the resolved path does not exist,
 * - status `usable` when the file was read successfully or when the path is a FIFO,
 * - status `blocked` with `failureClass: "env_file_not_regular"` when the path exists but is not a regular file,
 * - status `blocked` with `failureClass` prefixed by `env_file_unreadable:` when an I/O or parsing error occurs (the error is sanitized).
 *
 * @param envFilePath - Path to the env file to load; when undefined the default env file path is used.
 * @returns An object with the merged `env` and a `tool` entry describing the env-file availability and status.
 */
function loadEnvFile(envFilePath: string | undefined): {
	env: NodeJS.ProcessEnv;
	tool: PrCloseoutToolInput;
} {
	const resolvedPath = envFilePath ?? DEFAULT_ENV_FILE;
	const env = { ...process.env };
	try {
		if (!existsSync(resolvedPath)) {
			return {
				env,
				tool: {
					name: "codex_env",
					available: true,
					ref: `env:${resolvedPath}`,
					status: "missing",
					failureClass: "env_file_missing",
				},
			};
		}
		const stat = lstatSync(resolvedPath);
		if (stat.isFIFO()) {
			return {
				env,
				tool: {
					name: "codex_env",
					available: true,
					ref: `env:${resolvedPath}`,
					status: "usable",
					failureClass: null,
				},
			};
		}
		if (!stat.isFile()) {
			return {
				env,
				tool: {
					name: "codex_env",
					available: true,
					ref: `env:${resolvedPath}`,
					status: "blocked",
					failureClass: "env_file_not_regular",
				},
			};
		}
		for (const line of readFileSync(resolvedPath, "utf8").split(/\r?\n/u)) {
			const trimmed = line.trim();
			if (trimmed.length === 0 || trimmed.startsWith("#")) continue;
			const eqIndex = trimmed.indexOf("=");
			if (eqIndex < 1) continue;
			const key = trimmed.slice(0, eqIndex).trim();
			const value = trimmed
				.slice(eqIndex + 1)
				.trim()
				.replace(/^["']|["']$/g, "");
			if (/^[A-Z_][A-Z0-9_]*$/u.test(key) && value.length > 0) {
				env[key] = value;
			}
		}
		return {
			env,
			tool: {
				name: "codex_env",
				available: true,
				ref: `env:${resolvedPath}`,
				status: "usable",
				failureClass: null,
			},
		};
	} catch (error) {
		return {
			env,
			tool: {
				name: "codex_env",
				available: true,
				ref: `env:${resolvedPath}`,
				status: "blocked",
				failureClass: `env_file_unreadable:${sanitizeError(error)}`,
			},
		};
	}
}

/**
 * Parse a JSON string and validate that the result is a plain object.
 *
 * @param value - The JSON string to parse
 * @param source - Human-readable name of the source used in error messages
 * @returns The parsed value as a plain object
 * @throws Error if `value` is not valid JSON or if the parsed value is not a non-array object
 */
function parseJsonObject(
	value: string,
	source: string,
): Record<string, unknown> {
	const parsed = JSON.parse(value) as unknown;
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
		throw new Error(`${source} must contain a JSON object`);
	}
	return parsed as Record<string, unknown>;
}

/**
 * Parse and validate a JSON string into a `PrCloseoutInput`.
 *
 * @param value - The JSON text to parse.
 * @param source - Human-readable source identifier used in error messages.
 * @returns The parsed value cast to `PrCloseoutInput`.
 * @throws Error if the parsed value does not contain a `pullRequest` object or if `pullRequest.number` is not a positive integer.
 */
function parseInput(value: string, source: string): PrCloseoutInput {
	const parsed = parseJsonObject(value, source);
	const pullRequest = parsed.pullRequest;
	if (
		!pullRequest ||
		typeof pullRequest !== "object" ||
		Array.isArray(pullRequest)
	) {
		throw new Error(`${source} must include a pullRequest object`);
	}
	const prNumber = (pullRequest as Record<string, unknown>).number;
	if (
		typeof prNumber !== "number" ||
		!Number.isInteger(prNumber) ||
		prNumber <= 0
	) {
		throw new Error(`${source} pullRequest.number must be a positive integer`);
	}
	return parsed as unknown as PrCloseoutInput;
}

/**
 * Produce the input string when `value` is a string, otherwise `null`.
 *
 * @param value - The value to coerce to a string
 * @returns The original string when `value` is a string, or `null` otherwise
 */
function asString(value: unknown): string | null {
	return typeof value === "string" ? value : null;
}

/**
 * Return the input when it is an integer number, otherwise `null`.
 *
 * @param value - The value to test.
 * @returns The input value if it is an integer number, `null` otherwise.
 */
function asNumber(value: unknown): number | null {
	return typeof value === "number" && Number.isInteger(value) ? value : null;
}

/**
 * Preserves a boolean input, returning it unchanged, or returns `null` for non-boolean inputs.
 *
 * @returns The original boolean value if `value` is a boolean, `null` otherwise.
 */
function asBoolean(value: unknown): boolean | null {
	return typeof value === "boolean" ? value : null;
}

/**
 * Build a normalized PrCloseoutPullRequestInput from a raw GitHub PR object.
 *
 * @param value - The raw parsed GitHub PR object
 * @param prNumber - Fallback pull request number to use when `value.number` is missing or invalid
 * @returns A `PrCloseoutPullRequestInput` whose fields are extracted from `value`; `number` will be `value.number` when valid, otherwise `prNumber`
 */
function normalizeGhPr(
	value: Record<string, unknown>,
	prNumber: number,
): PrCloseoutPullRequestInput {
	return {
		number: asNumber(value.number) ?? prNumber,
		title: asString(value.title),
		state: asString(value.state),
		isDraft: asBoolean(value.isDraft),
		mergeStateStatus: asString(value.mergeStateStatus),
		url: asString(value.url),
		headRefName: asString(value.headRefName),
		baseRefName: asString(value.baseRefName),
		reviewDecision: asString(value.reviewDecision),
		body: asString(value.body),
	};
}

/**
 * Convert a GitHub checks payload into a list of normalized check records.
 *
 * @param value - The raw value to normalize (typically the parsed JSON from `gh pr checks`).
 * @returns An array of check records with `name`, `state`, `url`, and `source` fields; returns an empty array if `value` is not an array or contains no object entries.
 */
function normalizeGhChecks(value: unknown): PrCloseoutCheckInput[] {
	if (!Array.isArray(value)) return [];
	return value
		.filter(
			(item): item is Record<string, unknown> =>
				Boolean(item) && typeof item === "object" && !Array.isArray(item),
		)
		.map((item) => ({
			name: asString(item.name) ?? "unknown",
			state: asString(item.state),
			url: asString(item.link),
			source: "github",
		}));
}

/**
 * Probes a command by running it and returns a tool status entry describing its availability.
 *
 * @param name - Logical tool name to include in the returned entry
 * @param command - Executable to run
 * @param args - Arguments to pass to the command
 * @param options - Execution options
 * @param options.repoRoot - Working directory used when running the command
 * @param options.env - Environment variables supplied to the command
 * @param options.runner - Function used to invoke the command
 * @returns A `PrCloseoutToolInput` describing whether the command is available (`available`, `status`) and a `ref` for the executed command; when the command fails `failureClass` contains a sanitized error string, otherwise it is `null`
 */
function inspectCommand(
	name: PrCloseoutToolInput["name"],
	command: string,
	args: readonly string[],
	options: { repoRoot: string; env: NodeJS.ProcessEnv; runner: CommandRunner },
): PrCloseoutToolInput {
	try {
		options.runner(command, args, { cwd: options.repoRoot, env: options.env });
		return {
			name,
			available: true,
			ref: `command:${[command, ...args].join(" ")}`,
			status: "usable",
			failureClass: null,
		};
	} catch (error) {
		return {
			name,
			available: false,
			ref: `command:${[command, ...args].join(" ")}`,
			status: "missing",
			failureClass: sanitizeError(error),
		};
	}
}

/**
 * Checks whether the git working tree at the given repository root is clean.
 *
 * @param repoRoot - Path to the repository root to inspect
 * @returns `true` if there are no changes according to `git status --porcelain`, `false` if there are unstaged or uncommitted changes, `null` if the git command could not be executed
 */
function inspectGitClean(
	repoRoot: string,
	runner: CommandRunner,
): boolean | null {
	try {
		return (
			runner("git", ["status", "--porcelain"], {
				cwd: repoRoot,
			}).length === 0
		);
	} catch {
		return null;
	}
}

/**
 * Load and parse a PR closeout JSON file from the given filesystem path.
 *
 * @param path - Filesystem path to the JSON input file
 * @returns The parsed `PrCloseoutInput`
 */
function loadInput(path: string): PrCloseoutInput {
	return parseInput(readFileSync(path, "utf8"), path);
}

/**
 * Detects whether a pull-request body field value is a placeholder marker.
 *
 * @param value - The field text to inspect
 * @returns `true` if the trimmed value is a placeholder (`list`, `map`, `pending`, or an angle-bracket token like `<...>`), `false` otherwise
 */
function isPlaceholderBodyField(value: string): boolean {
	return /^(?:list\b|map\b|pending\b|<[^>]+>\s*$)/iu.test(value.trim());
}

/**
 * Extracts the text value for a labeled bullet field from a markdown-like PR body.
 *
 * Searches for a top-level list item formatted as "- <Label>: <value>" and returns the trimmed
 * value if present and not considered a placeholder. Returns `null` when the body is missing,
 * the labeled field is not found, or the extracted value is empty or a recognized placeholder.
 *
 * @param body - The full PR/body text to search
 * @param label - The label name to locate (case-sensitive, without surrounding punctuation)
 * @returns The trimmed field value if found and meaningful, `null` otherwise
 */
function bodyField(
	body: string | null | undefined,
	label: string,
): string | null {
	if (!body) return null;
	const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const pattern = new RegExp(
		`^- ${escapedLabel}:\\s*(.*?)(?=\\n- [A-Z][^:]*:|\\n## |$)`,
		"imsu",
	);
	const match = pattern.exec(body);
	const value = match?.[1]?.trim();
	if (!value || isPlaceholderBodyField(value)) return null;
	return value;
}

/**
 * Parses a body field containing evidence references into a list of trimmed identifiers.
 *
 * Treats `null`, empty strings, or strings beginning with "n.a." (case-insensitive) as no evidence and returns an empty array. Otherwise splits the string on newlines or commas, removes leading list markers (`-` or `*`) and surrounding whitespace, and omits empty entries.
 *
 * @param value - The raw field text from the PR body (may be `null`)
 * @returns An array of evidence reference strings (empty if none were found)
 */
function splitEvidenceRefs(value: string | null): string[] {
	if (!value || /^n\.a\./iu.test(value)) return [];
	return value
		.split(/[\n,]/u)
		.map((item) => item.replace(/^[-*]\s*/u, "").trim())
		.filter((item) => item.length > 0);
}

/**
 * Extracts traceability information (session IDs, trace IDs, and AI session notes) from a pull request body.
 *
 * @param body - The full pull request body text; may be `null` or `undefined`.
 * @returns An object with `sessionIds` (array of parsed evidence references), `traceIds` (array of parsed evidence references), and `aiSessionTraceability` (the AI session / traceability text or `null`).
 */
function traceabilityFromBody(
	body: string | null | undefined,
): PrCloseoutTraceabilityInput {
	return {
		sessionIds: splitEvidenceRefs(bodyField(body, "Session IDs")),
		traceIds: splitEvidenceRefs(bodyField(body, "Trace IDs")),
		aiSessionTraceability: bodyField(body, "AI session / traceability"),
	};
}

/**
 * Build a live `PrCloseoutInput` by probing the repository and external tools for the given pull request.
 *
 * Loads environment variables from the configured env file, inspects a set of CLI tools for availability,
 * attempts to fetch the pull request and its checks via the GitHub CLI, and collects branch cleanliness,
 * traceability extracted from the PR body, and discovered tools into a `PrCloseoutInput`.
 *
 * @param options - CLI options; `prNumber` must be provided for live input.
 * @param runner - Command runner used to execute external commands (e.g., `gh`, `git`).
 * @returns A fully populated `PrCloseoutInput` representing the live state of the specified pull request and related tooling.
 * @throws Error if `options.prNumber` is not provided.
 */
function buildLiveInput(
	options: PrCloseoutCLIOptions,
	runner: CommandRunner,
): PrCloseoutInput {
	if (options.prNumber === undefined) {
		throw new Error("--pr is required for live closeout input");
	}
	const envLoad = loadEnvFile(options.envFilePath);
	const tools: PrCloseoutToolInput[] = [envLoad.tool];
	tools.push(
		inspectCommand("github_cli", "gh", ["--version"], {
			repoRoot: options.repoRoot,
			env: envLoad.env,
			runner,
		}),
	);
	tools.push(
		inspectCommand("circleci_cli", "circleci", ["version"], {
			repoRoot: options.repoRoot,
			env: envLoad.env,
			runner,
		}),
	);
	tools.push(
		inspectCommand("coderabbit_cli", "coderabbit", ["--version"], {
			repoRoot: options.repoRoot,
			env: envLoad.env,
			runner,
		}),
	);
	tools.push(
		inspectCommand("snyk_cli", "snyk", ["--version"], {
			repoRoot: options.repoRoot,
			env: envLoad.env,
			runner,
		}),
	);
	let pullRequest: PrCloseoutPullRequestInput;
	try {
		const prRaw = runner(
			"gh",
			[
				"pr",
				"view",
				String(options.prNumber),
				"--json",
				"number,title,state,isDraft,mergeStateStatus,url,headRefName,baseRefName,reviewDecision,body",
			],
			{ cwd: options.repoRoot, env: envLoad.env },
		);
		pullRequest = normalizeGhPr(
			parseJsonObject(prRaw, "gh pr view"),
			options.prNumber,
		);
	} catch (error) {
		tools.push({
			name: "github_cli",
			available: false,
			ref: `command:gh pr view ${String(options.prNumber)} --json number,title,state,isDraft,mergeStateStatus,url,headRefName,baseRefName,reviewDecision,body`,
			status: "blocked",
			failureClass: `pr_view_unreadable:${sanitizeError(error)}`,
		});
		pullRequest = {
			number: options.prNumber,
			state: null,
			isDraft: null,
			mergeStateStatus: null,
			body: null,
		};
	}
	let checks: PrCloseoutCheckInput[] = [];
	try {
		const checksRaw = runner(
			"gh",
			["pr", "checks", String(options.prNumber), "--json", "name,state,link"],
			{ cwd: options.repoRoot, env: envLoad.env },
		);
		checks = normalizeGhChecks(JSON.parse(checksRaw) as unknown);
	} catch (error) {
		tools.push({
			name: "github_cli",
			available: true,
			ref: `command:gh pr checks ${String(options.prNumber)} --json name,state,link`,
			status: "blocked",
			failureClass: `pr_checks_unreadable:${sanitizeError(error)}`,
		});
	}
	return {
		pullRequest,
		branch: {
			clean: inspectGitClean(options.repoRoot, runner),
		},
		checks,
		reviewThreads: {
			unresolved: null,
			needsHuman: null,
			autofixable: null,
		},
		traceability: traceabilityFromBody(pullRequest.body),
		tools,
	};
}

/**
 * Execute the PR closeout CLI flow and print the resulting report.
 *
 * Parses CLI arguments, loads or builds a normalized PR closeout input (from an input file or by
 * probing the repository and external tools), generates a closeout report, and writes either a
 * pretty JSON report or a human-readable summary to stdout.
 *
 * @param args - The raw command-line arguments to parse (typically process.argv.slice(2))
 * @param options.runner - Optional command runner used to execute external commands when
 * constructing live input; defaults to the internal runner that invokes system commands.
 * @returns The process exit code: `0` on success, `1` on runtime error, `2` for argument parsing errors.
 */
export async function runPrCloseoutCLI(
	args: readonly string[],
	options: { runner?: CommandRunner } = {},
): Promise<number> {
	const parsed = parseArgs(args);
	if ("exitCode" in parsed) return parsed.exitCode;
	try {
		const input = parsed.options.inputPath
			? loadInput(parsed.options.inputPath)
			: buildLiveInput(parsed.options, options.runner ?? defaultRunner);
		const report = buildPrCloseoutReport(input);
		if (parsed.options.json) {
			console.info(JSON.stringify(report, null, 2));
		} else {
			console.info(
				`PR #${String(report.pr)}: ${report.status} -> ${report.nextAction}`,
			);
			for (const blocker of report.blockers) {
				console.info(`- ${blocker.surface}: ${blocker.reason}`);
			}
		}
		return 0;
	} catch (error) {
		if (parsed.options.json) {
			console.info(
				JSON.stringify(
					{
						schemaVersion: "pr-closeout-error/v1",
						status: "fail",
						error: sanitizeError(error),
					},
					null,
					2,
				),
			);
		} else {
			console.error(`pr-closeout: ${sanitizeError(error)}`);
		}
		return 1;
	}
}

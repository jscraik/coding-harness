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

function printUsage(): void {
	console.info(
		"Usage: harness pr-closeout [--json] [--repo <path>] [--input <path> | --pr <number>] [--env-file <path>]",
	);
	console.info("");
	console.info(
		"Build a read-only pr-closeout/v1 report from normalized evidence or live GitHub CLI state.",
	);
}

function readFlagValue(
	args: readonly string[],
	index: number,
): string | undefined {
	const value = args[index + 1];
	if (value === undefined || value.startsWith("--")) return undefined;
	return value;
}

function parsePositiveInteger(value: string | undefined): number | undefined {
	if (!value) return undefined;
	if (!/^\d+$/u.test(value)) return undefined;
	const parsed = Number.parseInt(value, 10);
	if (!Number.isInteger(parsed) || parsed <= 0) return undefined;
	return parsed;
}

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

function asString(value: unknown): string | null {
	return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number | null {
	return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function asBoolean(value: unknown): boolean | null {
	return typeof value === "boolean" ? value : null;
}

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

function loadInput(path: string): PrCloseoutInput {
	return parseInput(readFileSync(path, "utf8"), path);
}

function isPlaceholderBodyField(value: string): boolean {
	return /^(?:list\b|map\b|pending\b|<[^>]+>\s*$)/iu.test(value.trim());
}

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

function splitEvidenceRefs(value: string | null): string[] {
	if (!value || /^n\.a\./iu.test(value)) return [];
	return value
		.split(/[\n,]/u)
		.map((item) => item.replace(/^[-*]\s*/u, "").trim())
		.filter((item) => item.length > 0);
}

function traceabilityFromBody(
	body: string | null | undefined,
): PrCloseoutTraceabilityInput {
	return {
		sessionIds: splitEvidenceRefs(bodyField(body, "Session IDs")),
		traceIds: splitEvidenceRefs(bodyField(body, "Trace IDs")),
		aiSessionTraceability: bodyField(body, "AI session / traceability"),
	};
}

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

/** Run the read-only PR closeout command. */
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

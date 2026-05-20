import { execFileSync } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { sanitizeError } from "../lib/input/sanitize.js";
import {
	HARNESS_CLOSEOUT_GATES_SCHEMA_VERSION,
	HE_PHASE_EXIT_SCHEMA_VERSION,
	type HePhaseExit,
	validateHePhaseExit,
} from "../lib/decision/he-phase-exit.js";
import {
	buildPrCloseoutReport,
	type PrCloseoutInput,
} from "../lib/pr-closeout.js";
import { parsePrCloseoutArgs } from "./pr-closeout/args.js";
import { buildLivePrCloseoutInput } from "./pr-closeout/live.js";
import type { CommandRunner } from "./pr-closeout/types.js";

export type { PrCloseoutCLIOptions } from "./pr-closeout/args.js";
export type { CommandRunner } from "./pr-closeout/types.js";

const ACCEPTED_CLOSEOUT_GATES_SCHEMA_VERSIONS = [
	HARNESS_CLOSEOUT_GATES_SCHEMA_VERSION,
	HE_PHASE_EXIT_SCHEMA_VERSION,
] as const;

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
	if (parsed.closeoutGates !== undefined && parsed.phaseExit !== undefined) {
		throw new Error(
			`${source} must include either closeoutGates or phaseExit, not both`,
		);
	}
	if (parsed.closeoutGates !== undefined) {
		parsed.closeoutGates = normalizeCloseoutGatesArtifact(
			parsed.closeoutGates,
			`${source} closeoutGates`,
		);
	}
	if (parsed.phaseExit !== undefined) {
		parsed.phaseExit = normalizeCloseoutGatesArtifact(
			parsed.phaseExit,
			`${source} phaseExit`,
		);
	}
	return parsed as unknown as PrCloseoutInput;
}

function closeoutGatesSchemaList(): string {
	return ACCEPTED_CLOSEOUT_GATES_SCHEMA_VERSIONS.join(" or ");
}

function normalizeCloseoutGatesArtifact(
	value: unknown,
	source: string,
): HePhaseExit {
	const record =
		value && typeof value === "object" && !Array.isArray(value)
			? (value as Record<string, unknown>)
			: null;
	const normalized =
		record?.schemaVersion === HARNESS_CLOSEOUT_GATES_SCHEMA_VERSION
			? { ...record, schemaVersion: HE_PHASE_EXIT_SCHEMA_VERSION }
			: value;
	const validation = validateHePhaseExit(normalized);
	if (!validation.valid) {
		throw new Error(
			`${source} must be a valid Coding Harness closeout-gates artifact (${closeoutGatesSchemaList()}): ${validation.errors.map((error) => error.code).join(", ")}`,
		);
	}
	return normalized as HePhaseExit;
}

function loadInput(path: string): PrCloseoutInput {
	return parseInput(readFileSync(path, "utf8"), path);
}

function resolveRepoScopedPath(path: string, repoRoot: string): string {
	const lexicalRoot = resolve(repoRoot);
	const resolvedPath = resolve(lexicalRoot, path);
	const lexicalRelativePath = relative(lexicalRoot, resolvedPath);
	const lexicallyInsideRepo =
		lexicalRelativePath === "" ||
		(!lexicalRelativePath.startsWith("..") && !isAbsolute(lexicalRelativePath));
	if (!lexicallyInsideRepo) {
		throw new Error(
			`Closeout gates path must stay within the repository root: ${path}`,
		);
	}
	const resolvedRoot = realpathSync(lexicalRoot);
	const canonicalPath = realpathSync(resolvedPath);
	const relativePath = relative(resolvedRoot, canonicalPath);
	const isInsideRepo =
		relativePath === "" ||
		(!relativePath.startsWith("..") && !isAbsolute(relativePath));
	if (!isInsideRepo) {
		throw new Error(
			`Closeout gates path must stay within the repository root: ${path}`,
		);
	}
	return canonicalPath;
}

function loadCloseoutGates(path: string, repoRoot: string): HePhaseExit {
	const resolvedPath = resolveRepoScopedPath(path, repoRoot);
	const parsed = JSON.parse(readFileSync(resolvedPath, "utf8")) as unknown;
	return normalizeCloseoutGatesArtifact(parsed, path);
}

/** Run the read-only PR closeout command. */
export async function runPrCloseoutCLI(
	args: readonly string[],
	options: { runner?: CommandRunner } = {},
): Promise<number> {
	const parsed = parsePrCloseoutArgs(args);
	if ("exitCode" in parsed) return parsed.exitCode;
	try {
		const input = parsed.options.inputPath
			? loadInput(parsed.options.inputPath)
			: buildLivePrCloseoutInput(
					parsed.options,
					options.runner ?? defaultRunner,
				);
		const closeoutGatesPath =
			parsed.options.closeoutGatesPath ?? parsed.options.phaseExitPath;
		if (
			closeoutGatesPath &&
			("closeoutGates" in input || "phaseExit" in input)
		) {
			throw new Error(
				"Closeout evidence must come from either --input or --gates/--phase-exit, not both",
			);
		}
		const inputWithCloseoutGates = closeoutGatesPath
			? {
					...input,
					closeoutGates: loadCloseoutGates(
						closeoutGatesPath,
						parsed.options.repoRoot,
					),
				}
			: input;
		const report = buildPrCloseoutReport(inputWithCloseoutGates);
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

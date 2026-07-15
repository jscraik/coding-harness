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
	buildPrCloseoutSnapshot,
	type PrCloseoutInput,
} from "../lib/pr-closeout.js";
import type { HarnessAssuranceEntry } from "../lib/harness-assurance.js";
import type { RuntimeEvidenceContract } from "../lib/runtime/runtime-evidence-contract.js";
import {
	parsePrCloseoutArgs,
	type PrCloseoutCLIOptions,
} from "./pr-closeout/args.js";
import {
	normalizeAssuranceEntries,
	normalizeRuntimeEvidenceContract,
} from "./pr-closeout/input-validation.js";
import { buildLivePrCloseoutInput } from "./pr-closeout/live.js";
import type { CommandRunner } from "./pr-closeout/types.js";
import { assertPrCloseoutStackState } from "../lib/pr-closeout/stack-state.js";

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

/** Parse and validate one normalized PR closeout input document. */
function parseInput(value: string, source: string): PrCloseoutInput {
	const parsed = parseJsonObject(value, source);
	assertPrCloseoutInputShape(parsed, source);
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
	if (parsed.assurance !== undefined) {
		parsed.assurance = normalizeAssuranceEntries(
			parsed.assurance,
			`${source} assurance`,
		);
	}
	if (parsed.runtimeEvidence !== undefined) {
		parsed.runtimeEvidence = normalizeRuntimeEvidenceContract(
			parsed.runtimeEvidence,
			`${source} runtimeEvidence`,
		);
	}
	assertPrCloseoutStackState(parsed.stackState, `${source} stackState`);
	return parsed;
}

function assertPrCloseoutInputShape(
	parsed: Record<string, unknown>,
	source: string,
): asserts parsed is PrCloseoutInput & Record<string, unknown> {
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

function resolveRepoScopedPath(
	path: string,
	repoRoot: string,
	artifactLabel: string,
): string {
	const lexicalRoot = resolve(repoRoot);
	const resolvedPath = resolve(lexicalRoot, path);
	const lexicalRelativePath = relative(lexicalRoot, resolvedPath);
	const lexicallyInsideRepo =
		lexicalRelativePath === "" ||
		(!lexicalRelativePath.startsWith("..") && !isAbsolute(lexicalRelativePath));
	if (!lexicallyInsideRepo) {
		throw new Error(
			`${artifactLabel} path must stay within the repository root: ${path}`,
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
			`${artifactLabel} path must stay within the repository root: ${path}`,
		);
	}
	return canonicalPath;
}

function loadCloseoutGates(path: string, repoRoot: string): HePhaseExit {
	const resolvedPath = resolveRepoScopedPath(path, repoRoot, "Closeout gates");
	const parsed = JSON.parse(readFileSync(resolvedPath, "utf8")) as unknown;
	return normalizeCloseoutGatesArtifact(parsed, path);
}

function loadAssuranceEntries(
	path: string,
	repoRoot: string,
): HarnessAssuranceEntry[] {
	const resolvedPath = resolveRepoScopedPath(
		path,
		repoRoot,
		"Assurance matrix",
	);
	const parsed = JSON.parse(readFileSync(resolvedPath, "utf8")) as unknown;
	return normalizeAssuranceEntries(parsed, path);
}

function loadRuntimeEvidenceContract(
	path: string,
	repoRoot: string,
): RuntimeEvidenceContract {
	const resolvedPath = resolveRepoScopedPath(
		path,
		repoRoot,
		"Runtime evidence",
	);
	const parsed = JSON.parse(readFileSync(resolvedPath, "utf8")) as unknown;
	return normalizeRuntimeEvidenceContract(parsed, path);
}

function loadBasePrCloseoutInput(
	options: PrCloseoutCLIOptions,
	runner: CommandRunner,
): PrCloseoutInput {
	const loadedInput = options.inputPath
		? loadInput(options.inputPath)
		: buildLivePrCloseoutInput(options, runner);
	if (!options.inputPath || options.releaseReadinessImpact === undefined) {
		return loadedInput;
	}
	return {
		...loadedInput,
		releaseReadinessImpact: options.releaseReadinessImpact,
	};
}

function assertEvidenceSourceAvailable(
	hasInputEvidence: boolean,
	message: string,
): void {
	if (hasInputEvidence) {
		throw new Error(message);
	}
}

function withCloseoutGates(
	input: PrCloseoutInput,
	options: PrCloseoutCLIOptions,
): PrCloseoutInput {
	const closeoutGatesPath = options.closeoutGatesPath ?? options.phaseExitPath;
	if (!closeoutGatesPath) return input;
	assertEvidenceSourceAvailable(
		"closeoutGates" in input || "phaseExit" in input,
		"Closeout evidence must come from either --input or --gates/--phase-exit, not both",
	);
	return {
		...input,
		closeoutGates: loadCloseoutGates(closeoutGatesPath, options.repoRoot),
	};
}

function withAssurance(
	input: PrCloseoutInput,
	options: PrCloseoutCLIOptions,
): PrCloseoutInput {
	if (!options.assurancePath) return input;
	assertEvidenceSourceAvailable(
		"assurance" in input,
		"Assurance evidence must come from either --input or --assurance, not both",
	);
	return {
		...input,
		assurance: loadAssuranceEntries(options.assurancePath, options.repoRoot),
	};
}

function withRuntimeEvidence(
	input: PrCloseoutInput,
	options: PrCloseoutCLIOptions,
): PrCloseoutInput {
	if (!options.runtimeEvidencePath) return input;
	assertEvidenceSourceAvailable(
		"runtimeEvidence" in input,
		"Runtime evidence must come from either --input or --runtime-evidence, not both",
	);
	return {
		...input,
		runtimeEvidence: loadRuntimeEvidenceContract(
			options.runtimeEvidencePath,
			options.repoRoot,
		),
	};
}

function loadPrCloseoutInput(
	options: PrCloseoutCLIOptions,
	runner: CommandRunner,
): PrCloseoutInput {
	const baseInput = loadBasePrCloseoutInput(options, runner);
	const inputWithCloseoutGates = withCloseoutGates(baseInput, options);
	const inputWithAssurance = withAssurance(inputWithCloseoutGates, options);
	return withRuntimeEvidence(inputWithAssurance, options);
}

function printPrCloseoutReport(
	report: ReturnType<typeof buildPrCloseoutReport>,
	snapshot: boolean | undefined,
): void {
	if (snapshot) {
		console.info(
			JSON.stringify(
				buildPrCloseoutSnapshot({
					generatedAt: report.generatedAt,
					pr: report.pr,
					url: report.url,
					status: report.status,
					nextAction: report.nextAction,
					claims: report.claims,
					blockers: report.blockers,
				}),
				null,
				2,
			),
		);
		return;
	}
	console.info(JSON.stringify(report, null, 2));
}

function printPrCloseoutSummary(
	report: ReturnType<typeof buildPrCloseoutReport>,
): void {
	console.info(
		`PR #${String(report.pr)}: ${report.status} -> ${report.nextAction}`,
	);
	for (const blocker of report.blockers) {
		console.info(`- ${blocker.surface}: ${blocker.reason}`);
	}
}

function printPrCloseoutError(error: unknown, json: boolean): void {
	if (json) {
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
		return;
	}
	console.error(`pr-closeout: ${sanitizeError(error)}`);
}

/** Run the read-only PR closeout command. */
export async function runPrCloseoutCLI(
	args: readonly string[],
	options: { runner?: CommandRunner } = {},
): Promise<number> {
	const parsed = parsePrCloseoutArgs(args);
	if ("exitCode" in parsed) return parsed.exitCode;
	try {
		const input = loadPrCloseoutInput(
			parsed.options,
			options.runner ?? defaultRunner,
		);
		const report = buildPrCloseoutReport(input);
		if (parsed.options.json) {
			printPrCloseoutReport(report, parsed.options.snapshot);
		} else {
			printPrCloseoutSummary(report);
		}
		return 0;
	} catch (error) {
		printPrCloseoutError(error, parsed.options.json);
		return 1;
	}
}

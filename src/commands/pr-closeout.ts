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
import type { HarnessAssuranceEntry } from "../lib/harness-assurance.js";
import type { RuntimeEvidenceContract } from "../lib/runtime/runtime-evidence-contract.js";
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

function normalizeAssuranceEntries(
	value: unknown,
	source: string,
): HarnessAssuranceEntry[] {
	const normalize = (entries: unknown): HarnessAssuranceEntry[] => {
		if (!Array.isArray(entries)) {
			throw new Error(
				`${source} must be a seven-layer assurance matrix array or an object with an entries array`,
			);
		}
		if (entries.length !== 7) {
			throw new Error(`${source} must contain exactly 7 assurance entries`);
		}
		return entries as HarnessAssuranceEntry[];
	};
	if (Array.isArray(value)) return normalize(value);
	if (value && typeof value === "object" && !Array.isArray(value)) {
		const entries = (value as Record<string, unknown>).entries;
		return normalize(entries);
	}
	throw new Error(
		`${source} must be a seven-layer assurance matrix array or an object with an entries array`,
	);
}

function normalizeRuntimeEvidenceContract(
	value: unknown,
	source: string,
): RuntimeEvidenceContract {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error(
			`${source} must be a runtime-evidence-contract/v1 JSON object`,
		);
	}
	return value as RuntimeEvidenceContract;
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
		if (parsed.options.assurancePath && "assurance" in inputWithCloseoutGates) {
			throw new Error(
				"Assurance evidence must come from either --input or --assurance, not both",
			);
		}
		const inputWithAssurance = parsed.options.assurancePath
			? {
					...inputWithCloseoutGates,
					assurance: loadAssuranceEntries(
						parsed.options.assurancePath,
						parsed.options.repoRoot,
					),
				}
			: inputWithCloseoutGates;
		if (
			parsed.options.runtimeEvidencePath &&
			"runtimeEvidence" in inputWithAssurance
		) {
			throw new Error(
				"Runtime evidence must come from either --input or --runtime-evidence, not both",
			);
		}
		const inputWithRuntimeEvidence = parsed.options.runtimeEvidencePath
			? {
					...inputWithAssurance,
					runtimeEvidence: loadRuntimeEvidenceContract(
						parsed.options.runtimeEvidencePath,
						parsed.options.repoRoot,
					),
				}
			: inputWithAssurance;
		const report = buildPrCloseoutReport(inputWithRuntimeEvidence);
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

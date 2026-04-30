import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
	DEFAULT_CODERABBIT_LOCAL_ARTIFACT,
	buildCodeRabbitLearningArtifact,
	writeLearningArtifact,
} from "../lib/learnings/artifact-io.js";
import { runLearningsGate } from "../lib/learnings/gate.js";
import {
	parseLearningLiveCompanion,
	sanitizeLearningLiveCompanionDiagnostic,
} from "../lib/learnings/live-companion.js";
import { buildLearningPromotionCandidates } from "../lib/learnings/promote.js";
import {
	LEARNING_IMPORT_RESULT_SCHEMA_VERSION,
	type LearningImportResult,
} from "../lib/learnings/types.js";

const EXIT_CODES = {
	SUCCESS: 0,
	FAILURE: 1,
	USAGE: 2,
} as const;

/**
 * Dispatches the `harness learnings` CLI to the appropriate subcommand handler.
 *
 * Parses the first element of `args` as the subcommand (`import`, `gate`, or `promote`)
 * and delegates execution to the corresponding subcommand CLI function. Emits a
 * usage error when the subcommand is missing or unrecognized.
 *
 * @param args - The command-line arguments following `harness learnings`
 * @returns A numeric process exit code: `0` for success, `1` for failure, or `2` for usage errors
 */
export function runLearningsCLI(args: string[]): number {
	const subcommand = args[0];
	if (subcommand === undefined) {
		return emitError({
			json: args.includes("--json"),
			errorCode: "learnings.subcommand_required",
			message:
				"harness learnings requires subcommand `import`, `gate`, or `promote`.",
			exitCode: EXIT_CODES.USAGE,
		});
	}
	if (subcommand === "gate") {
		return runLearningsGateCLI(args.slice(1));
	}
	if (subcommand === "promote") {
		return runLearningsPromoteCLI(args.slice(1));
	}
	if (subcommand !== "import") {
		return emitError({
			json: args.includes("--json"),
			errorCode: "learnings.unknown_subcommand",
			message: `Unknown learnings subcommand: ${subcommand}. Available: import, gate, promote.`,
			exitCode: EXIT_CODES.USAGE,
		});
	}
	return runLearningsImportCLI(args.slice(1));
}

/**
 * Execute the Phase 1B exact-file learning gate subcommand using provided CLI arguments.
 *
 * @returns Exit code: `0` on success, `1` if the gate result is `fail`, `2` for usage errors (e.g., missing or invalid flags)
 */
export function runLearningsGateCLI(args: string[]): number {
	const json = args.includes("--json");
	const source = readOptionalFlag(args, "--source").value;
	const overrides = readOptionalFlag(args, "--overrides").value;
	const overrideMode = readOverrideMode(args);
	if (!overrideMode.ok) {
		return emitError({
			json,
			errorCode: "learnings.override_mode_invalid",
			message: overrideMode.message,
			exitCode: EXIT_CODES.USAGE,
		});
	}
	const files = readRequiredFlag(args, "--files");
	if (!files.ok) {
		return emitError({
			json,
			errorCode: "learnings.files_required",
			message: "harness learnings gate requires --files.",
			exitCode: EXIT_CODES.USAGE,
		});
	}
	const gateResult = runLearningsGate({
		...(source ? { source } : {}),
		...(overrides ? { overrides } : {}),
		overrideMode: overrideMode.value,
		files: files.value.split(","),
	});
	if (json) {
		console.info(JSON.stringify(gateResult, null, 2));
	} else {
		console.info(`${gateResult.gate} ${gateResult.status}`);
		console.info(gateResult.reason);
	}
	return gateResult.status === "fail" ? EXIT_CODES.FAILURE : EXIT_CODES.SUCCESS;
}

/**
 * Execute the Phase 1C "learnings promote" CLI subcommand.
 *
 * @param args - Command-line arguments passed to the subcommand
 * @returns EXIT_CODES.FAILURE if the promotion result has status "error", otherwise EXIT_CODES.SUCCESS
 */
export function runLearningsPromoteCLI(args: string[]): number {
	const json = args.includes("--json");
	const source = readOptionalFlag(args, "--source").value;
	const enforcementStatusPath = readOptionalFlag(
		args,
		"--enforcement-status",
	).value;
	const minUsageResult = readMinUsage(args);
	if (!minUsageResult.ok) {
		return emitError({
			json,
			errorCode: "learnings.min_usage_invalid",
			message: minUsageResult.message,
			exitCode: EXIT_CODES.USAGE,
		});
	}
	const result = buildLearningPromotionCandidates({
		...(source ? { source } : {}),
		...(enforcementStatusPath ? { enforcementStatusPath } : {}),
		...(minUsageResult.value === undefined
			? {}
			: { minUsage: minUsageResult.value }),
		includeEnforced: args.includes("--include-enforced"),
	});
	if (json) {
		console.info(JSON.stringify(result, null, 2));
	} else if (result.status === "error") {
		console.error(`Error: ${result.error?.message ?? "Promotion failed."}`);
	} else {
		console.info(
			[
				`Promotion candidates: ${result.summary.eligible}`,
				`Deferred learnings: ${result.summary.deferred}`,
				`Minimum usage: ${result.minUsage}`,
			].join("\n"),
		);
	}
	return result.status === "error" ? EXIT_CODES.FAILURE : EXIT_CODES.SUCCESS;
}

/**
 * Execute the "harness learnings import" subcommand: validate flags, build a CodeRabbit CSV learning artifact, write it to disk, and print the import result.
 *
 * The function accepts CLI-style arguments (including --provider, --source, --repo, optional --output, optional --live-companion, and --json),
 * validates required inputs, optionally loads a live companion JSON, constructs and writes the artifact, and prints either JSON or a human-readable summary.
 *
 * @param args - Array of command-line arguments for the subcommand (e.g., process.argv slice)
 * @returns The process exit code: `0` for success, `1` for failure, or `2` for usage/validation errors
 */
export function runLearningsImportCLI(args: string[]): number {
	const json = args.includes("--json");
	const provider = readRequiredFlag(args, "--provider");
	const source = readRequiredFlag(args, "--source");
	const repo = readRequiredFlag(args, "--repo");
	const output = readOptionalFlag(args, "--output");
	const liveCompanionPath = readOptionalFlag(args, "--live-companion").value;
	const missing = [
		provider.ok ? undefined : "--provider",
		source.ok ? undefined : "--source",
		repo.ok ? undefined : "--repo",
	].filter((value): value is string => value !== undefined);
	if (missing.length > 0) {
		return emitError({
			json,
			errorCode: "learnings.missing_required_flags",
			message: `Missing required flags for harness learnings import: ${missing.join(", ")}.`,
			exitCode: EXIT_CODES.USAGE,
		});
	}
	if (!provider.ok || !source.ok || !repo.ok) {
		return EXIT_CODES.USAGE;
	}
	if (provider.value !== "coderabbit-csv") {
		return emitError({
			json,
			errorCode: "learnings.unsupported_provider",
			message: "Phase 1A supports only --provider coderabbit-csv.",
			exitCode: EXIT_CODES.USAGE,
		});
	}
	const liveCompanion = liveCompanionPath
		? loadLearningLiveCompanion(liveCompanionPath)
		: undefined;
	if (liveCompanion && !liveCompanion.ok) {
		return emitError({
			json,
			errorCode: liveCompanion.code,
			message: liveCompanion.message,
			exitCode: EXIT_CODES.USAGE,
		});
	}
	const outputPath = output.value ?? DEFAULT_CODERABBIT_LOCAL_ARTIFACT;
	const artifactResult = buildCodeRabbitLearningArtifact({
		sourcePath: resolve(source.value),
		repository: repo.value,
		previousArtifactPath: resolve(outputPath),
		...(liveCompanion?.ok ? { liveCompanion: liveCompanion.companion } : {}),
	});
	if (!artifactResult.ok) {
		return emitError({
			json,
			errorCode: artifactResult.errorCode,
			message: artifactResult.message,
			warnings: artifactResult.warnings,
			exitCode: EXIT_CODES.FAILURE,
		});
	}
	const writeResult = writeLearningArtifact({
		artifact: artifactResult.artifact,
		outputPath,
	});
	if (!writeResult.ok) {
		const exitCode =
			writeResult.errorCode === "learnings.snapshot_deferred"
				? EXIT_CODES.USAGE
				: EXIT_CODES.FAILURE;
		return emitError({
			json,
			errorCode: writeResult.errorCode,
			message: writeResult.message,
			warnings: writeResult.warnings,
			exitCode,
		});
	}
	const result: LearningImportResult = {
		schemaVersion: LEARNING_IMPORT_RESULT_SCHEMA_VERSION,
		status: artifactResult.artifact.warnings.length > 0 ? "partial" : "success",
		artifactPath: writeResult.artifactPath,
		repository: artifactResult.artifact.repository,
		summary: artifactResult.artifact.summary,
		warnings: artifactResult.artifact.warnings,
	};
	if (json) {
		console.info(JSON.stringify(result, null, 2));
	} else {
		console.info(
			[
				`Imported ${result.summary?.imported ?? 0} CodeRabbit learning${result.summary?.imported === 1 ? "" : "s"} for ${result.repository}.`,
				`Artifact: ${result.artifactPath}`,
				`Skipped: ${result.summary?.skipped ?? 0}`,
				`Warnings: ${result.summary?.warnings ?? 0}`,
			].join("\n"),
		);
	}
	return EXIT_CODES.SUCCESS;
}

/**
 * Loads and parses a live-companion JSON file used for learning imports.
 *
 * @param path - Filesystem path to the live-companion JSON file
 * @returns The parsed result from `parseLearningLiveCompanion` on success; otherwise an object with `ok: false`, `code: "learnings.live_companion.read_failed"`, a `message` describing the read/parse problem, and a `fix` suggesting to provide a readable `live-companion/v1` JSON object or omit `--live-companion`
 */
function loadLearningLiveCompanion(
	path: string,
): ReturnType<typeof parseLearningLiveCompanion> {
	try {
		return parseLearningLiveCompanion(readFileSync(resolve(path), "utf-8"));
	} catch (error) {
		return {
			ok: false,
			code: "learnings.live_companion.read_failed",
			message: `Failed to read live companion metadata: ${sanitizeLearningLiveCompanionDiagnostic(error instanceof Error ? error.message : String(error))}`,
			fix: "Provide a readable live-companion/v1 JSON object, or omit --live-companion.",
		};
	}
}

/**
 * Reads the value for a required CLI flag from the provided arguments.
 *
 * @returns `{ ok: true; value: string }` if the flag is present with a value, `{ ok: false }` if the flag is absent.
 */
function readRequiredFlag(
	args: string[],
	flag: string,
): { ok: true; value: string } | { ok: false } {
	const value = readOptionalFlag(args, flag).value;
	return value === undefined ? { ok: false } : { ok: true, value };
}

/**
 * Reads an optional flag's value from an argv-style string array.
 *
 * @param args - The argument list to search (e.g., process.argv.slice(...)).
 * @param flag - The flag to find (including leading dashes, e.g., `--files`).
 * @returns An object with `value` set to the argument following `flag` if present and not another flag (does not start with `-`); otherwise an empty object.
 */
function readOptionalFlag(args: string[], flag: string): { value?: string } {
	const index = args.indexOf(flag);
	if (index === -1) return {};
	const value = args[index + 1];
	if (value === undefined || value.startsWith("-")) return {};
	return { value };
}

/**
 * Parses the `--min-usage` flag from a CLI argument array and validates it as a non-negative integer.
 *
 * @param args - The command-line arguments to read the flag from.
 * @returns `{ ok: true }` if the flag is absent; `{ ok: true, value: number }` if present and valid; `{ ok: false, message: string }` if present but invalid.
 */
function readMinUsage(
	args: string[],
): { ok: true; value?: number } | { ok: false; message: string } {
	const rawValue = readOptionalFlag(args, "--min-usage").value;
	if (rawValue === undefined) return { ok: true };
	const value = Number(rawValue);
	if (!Number.isInteger(value) || value < 0) {
		return {
			ok: false,
			message: "--min-usage must be a non-negative integer.",
		};
	}
	return { ok: true, value };
}

/**
 * Parses the `--override-mode` flag and validates it as either `strict` or `advisory`.
 *
 * @returns `{ ok: true, value: "strict" | "advisory" }` when the flag is absent or contains a valid mode; `{ ok: false, message: string }` when the flag value is invalid.
 */
function readOverrideMode(
	args: string[],
): { ok: true; value: "strict" | "advisory" } | { ok: false; message: string } {
	const rawValue = readOptionalFlag(args, "--override-mode").value;
	if (rawValue === undefined || rawValue === "strict") {
		return { ok: true, value: "strict" };
	}
	if (rawValue === "advisory") return { ok: true, value: "advisory" };
	return {
		ok: false,
		message: "--override-mode must be strict or advisory.",
	};
}

/**
 * Format and emit an error as either structured JSON or a plain console message, then return the provided exit code.
 *
 * @param options - Configuration for the emitted error
 * @param options.json - If true, output a structured `LearningImportResult` JSON to stdout; otherwise output a plain error message to stderr
 * @param options.errorCode - Machine-readable error code to include in the JSON output
 * @param options.message - Human-readable error message to emit
 * @param options.exitCode - Process exit code to return
 * @param options.warnings - Optional list of warnings to include in the JSON output
 * @returns The `exitCode` passed in `options`
 */
function emitError(options: {
	json: boolean;
	errorCode: string;
	message: string;
	exitCode: number;
	warnings?: LearningImportResult["warnings"];
}): number {
	if (options.json) {
		const result: LearningImportResult = {
			schemaVersion: LEARNING_IMPORT_RESULT_SCHEMA_VERSION,
			status: "error",
			warnings: options.warnings ?? [],
			errorCode: options.errorCode,
			message: options.message,
		};
		console.info(JSON.stringify(result, null, 2));
	} else {
		console.error(`Error: ${options.message}`);
	}
	return options.exitCode;
}

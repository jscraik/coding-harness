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

/** Run the `harness learnings` command family. */
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

/** Run the Phase 1B exact-file learning gate command. */
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

/** Run the Phase 1C learning promotion candidate command. */
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

/** Run the Phase 1A CodeRabbit CSV import command. */
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

function readRequiredFlag(
	args: string[],
	flag: string,
): { ok: true; value: string } | { ok: false } {
	const value = readOptionalFlag(args, flag).value;
	return value === undefined ? { ok: false } : { ok: true, value };
}

function readOptionalFlag(
	args: string[],
	flag: string,
): { value: string | undefined } {
	const index = args.indexOf(flag);
	if (index === -1) return { value: undefined };
	const value = args[index + 1];
	if (value === undefined || value.startsWith("-")) {
		return { value: undefined };
	}
	return { value };
}

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

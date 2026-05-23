import { runArtifactGate } from "../artifact-provenance.js";
import { buildArtifactGateOptionsFromCliArgs } from "./cli-args.js";
import type {
	ArtifactGateCliOptions,
	ArtifactGateUsageError,
} from "./types.js";

const FILES_REQUIRED_ERROR: ArtifactGateUsageError = {
	code: "artifact-gate.files_required",
	message: "Pass at least one changed file with --files.",
	fix: "Use --files path/to/generated-artifact,path/to/source-template.",
};

/**
 * Run Artifact Gate using the provided CLI-style options, print results, and return a process-like exit code.
 *
 * When `options.json` is truthy the function prints the full result as formatted JSON; otherwise it prints a short
 * status line followed by one formatted line per finding (errors go to stderr). If no file paths are provided the
 * function prints a usage error and returns immediately.
 *
 * @param options - CLI-style options including `files`, `repoRoot`, `registryPath`, and `json` output flag
 * @returns `0` when no errors were reported, `1` when one or more errors were reported, `2` when invocation is invalid (e.g., no files supplied)
 */
export function runArtifactGateCLI(options: ArtifactGateCliOptions): number {
	const files = (options.files ?? [])
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);
	if (!files.length) {
		printUsageError(FILES_REQUIRED_ERROR, options.json);
		return 2;
	}

	const result = runArtifactGate({
		repoRoot: options.repoRoot,
		files,
		registryPath: options.registryPath,
	});

	if (options.json) {
		console.info(JSON.stringify(result, null, 2));
	} else {
		console.info(`artifact-gate: ${result.status}`);
		for (const finding of result.findings) {
			const path = finding.path ? ` ${finding.path}` : "";
			const fix = finding.fix ? ` Fix: ${finding.fix}` : "";
			const output = `  - [${finding.severity}]${path} ${finding.message}${fix}`;
			if (finding.severity === "error") console.error(output);
			else console.info(output);
		}
	}

	return result.summary.errors > 0 ? 1 : 0;
}

/**
 * Parse CLI arguments and execute the artifact-gate CLI entry point.
 *
 * @param args - Raw command-line arguments (e.g., `process.argv.slice(2)`)
 * @returns `0` on success, `1` if artifact-gate reported errors, `2` for usage or parsing errors
 */
export function runArtifactGateFromCliArgs(args: string[]): number {
	const parsed = buildArtifactGateOptionsFromCliArgs(args);
	if (!parsed.ok) {
		printUsageError(parsed.error, parsed.json);
		return 2;
	}

	return runArtifactGateCLI(parsed.options);
}

/**
 * Print a usage error either as a structured JSON object or as a human-readable message.
 *
 * @param error - The usage error to report, including message and metadata.
 * @param json - If truthy, output a JSON object with `schemaVersion: "artifact-gate/v1"`, `status: "error"`, and the provided `error`; otherwise print a concise human-readable message to stderr.
 */
function printUsageError(
	error: ArtifactGateUsageError,
	json: boolean | undefined,
): void {
	if (json) {
		console.info(
			JSON.stringify(
				{
					schemaVersion: "artifact-gate/v1",
					status: "error",
					error,
				},
				null,
				2,
			),
		);
		return;
	}

	console.error(`Artifact Gate Error: ${error.message}`);
}

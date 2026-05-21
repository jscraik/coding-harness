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

/** Execute artifact-gate with typed CLI options and formatted output. */
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

/** Run artifact-gate from raw CLI arguments. */
export function runArtifactGateFromCliArgs(args: string[]): number {
	const parsed = buildArtifactGateOptionsFromCliArgs(args);
	if (!parsed.ok) {
		printUsageError(parsed.error, parsed.json);
		return 2;
	}

	return runArtifactGateCLI(parsed.options);
}

function printUsageError(
	error: ArtifactGateUsageError,
	json: boolean | undefined,
): void {
	if (error.code === "artifact-gate.files_required" && json) {
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

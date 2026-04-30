import { runArtifactGate } from "../lib/artifact-provenance.js";

interface ArtifactGateCliOptions {
	repoRoot?: string | undefined;
	files?: string[] | undefined;
	registryPath?: string | undefined;
	json?: boolean | undefined;
}

/**
 * Execute the artifact provenance gate command using the supplied CLI options.
 *
 * When `options.json` is true the full result is printed as pretty JSON; otherwise the command prints a status line
 * and a line per finding, routing findings with severity `"error"` to stderr and others to stdout.
 *
 * @param options - CLI options including `repoRoot`, `files`, `registryPath`, and `json`
 * @returns `0` when the gate reports no errors, `1` when any finding has severity `"error"`, `2` when no files were provided via `options.files`
 */
export function runArtifactGateCLI(options: ArtifactGateCliOptions): number {
	const files = (options.files ?? [])
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);
	if (!files.length) {
		const result = {
			schemaVersion: "artifact-gate/v1",
			status: "error",
			error: {
				code: "artifact-gate.files_required",
				message: "Pass at least one changed file with --files.",
				fix: "Use --files path/to/generated-artifact,path/to/source-template.",
			},
		};
		if (options.json) {
			console.info(JSON.stringify(result, null, 2));
		} else {
			console.error("Artifact Gate Error: --files is required.");
		}
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

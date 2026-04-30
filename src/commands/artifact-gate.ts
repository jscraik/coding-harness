import { runArtifactGate } from "../lib/artifact-provenance.js";

interface ArtifactGateCliOptions {
	repoRoot?: string | undefined;
	files?: string[] | undefined;
	registryPath?: string | undefined;
	json?: boolean | undefined;
}

/** Run the artifact provenance gate command and return the process exit code. */
export function runArtifactGateCLI(options: ArtifactGateCliOptions): number {
	if (!options.files?.length) {
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
		files: options.files,
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

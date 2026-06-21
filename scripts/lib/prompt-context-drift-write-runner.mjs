import { renameSync, rmSync, writeFileSync } from "node:fs";
import {
	buildPromptContextDriftReport,
	validatePromptContextDriftReport,
} from "../../src/lib/prompt-context-drift/index.ts";

const outputPath = process.env.PROMPT_CONTEXT_DRIFT_OUTPUT_PATH;
const tempOutputPath = process.env.PROMPT_CONTEXT_DRIFT_TEMP_OUTPUT_PATH;
const repoRoot = process.env.PROMPT_CONTEXT_DRIFT_REPO_ROOT;
const relativeOutputPath =
	process.env.PROMPT_CONTEXT_DRIFT_RELATIVE_OUTPUT_PATH;

if (!outputPath || !tempOutputPath || !repoRoot || !relativeOutputPath) {
	finish("fail", null, ["runner: missing required environment"], 2);
}

function finish(status, reportOutputPath, errors, exitCode) {
	console.log(
		JSON.stringify(
			{
				schemaVersion: "prompt-context-drift-write/v1",
				status,
				outputPath: reportOutputPath,
				errors,
			},
			null,
			2,
		),
	);
	process.exit(exitCode);
}

try {
	const report = buildPromptContextDriftReport({ repoRoot });
	const validation = validatePromptContextDriftReport(report, { repoRoot });
	if (validation.status !== "pass") {
		finish(validation.status, null, validation.errors, 1);
	}

	try {
		rmSync(tempOutputPath, { force: true });
	} catch {
		// Best-effort cleanup before the exclusive write below.
	}

	writeFileSync(tempOutputPath, `${JSON.stringify(report, null, 2)}\n`, {
		flag: "wx",
	});
	renameSync(tempOutputPath, outputPath);

	finish(validation.status, relativeOutputPath, validation.errors, 0);
} catch {
	finish("fail", null, ["runner: failed to build or write report"], 1);
}

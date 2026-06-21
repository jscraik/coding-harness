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
	console.log(
		JSON.stringify(
			{
				schemaVersion: "prompt-context-drift-write/v1",
				status: "fail",
				outputPath: null,
				errors: ["runner: missing required environment"],
			},
			null,
			2,
		),
	);
	process.exit(2);
}

const report = buildPromptContextDriftReport({ repoRoot });
const validation = validatePromptContextDriftReport(report, { repoRoot });
if (validation.status !== "pass") {
	console.log(
		JSON.stringify(
			{
				schemaVersion: "prompt-context-drift-write/v1",
				status: validation.status,
				outputPath: null,
				errors: validation.errors,
			},
			null,
			2,
		),
	);
	process.exit(1);
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

console.log(
	JSON.stringify(
		{
			schemaVersion: "prompt-context-drift-write/v1",
			status: validation.status,
			outputPath: relativeOutputPath,
			errors: validation.errors,
		},
		null,
		2,
	),
);

process.exit(validation.status === "pass" ? 0 : 1);

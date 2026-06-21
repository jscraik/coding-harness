import { readFileSync } from "node:fs";
import { validatePromptContextDriftReport } from "../../src/lib/prompt-context-drift/index.ts";

const reportPath = process.env.PROMPT_CONTEXT_DRIFT_REPORT_PATH;
const repoRoot = process.env.PROMPT_CONTEXT_DRIFT_REPO_ROOT;

if (!reportPath || !repoRoot) {
	console.log(
		JSON.stringify(
			{
				schemaVersion: "prompt-context-drift-validation/v1",
				status: "fail",
				errors: ["runner: missing required environment"],
			},
			null,
			2,
		),
	);
	process.exit(2);
}

let report;
try {
	report = JSON.parse(readFileSync(reportPath, "utf8"));
} catch (error) {
	console.log(
		JSON.stringify(
			{
				schemaVersion: "prompt-context-drift-validation/v1",
				status: "fail",
				errors: [
					`report: cannot read JSON: ${error instanceof Error ? error.message : "unknown error"}`,
				],
			},
			null,
			2,
		),
	);
	process.exit(1);
}

const result = validatePromptContextDriftReport(report, { repoRoot });
console.log(
	JSON.stringify(
		{ schemaVersion: "prompt-context-drift-validation/v1", ...result },
		null,
		2,
	),
);
process.exit(result.status === "pass" ? 0 : 1);

import { spawnSync } from "node:child_process";
import { validatePromptContextDriftReport } from "../../src/lib/prompt-context-drift/index.ts";

const reportPath = process.env.PROMPT_CONTEXT_DRIFT_REPORT_PATH;
const repoRoot = process.env.PROMPT_CONTEXT_DRIFT_REPO_ROOT;

function finish(status, errors, exitCode) {
	console.log(
		JSON.stringify(
			{
				schemaVersion: "prompt-context-drift-validation/v1",
				status,
				errors,
			},
			null,
			2,
		),
	);
	process.exit(exitCode);
}

if (!reportPath || !repoRoot) {
	finish("fail", ["runner: missing required environment"], 2);
}

function readReport(path) {
	const result = spawnSync("/bin/cat", [path], {
		encoding: "utf8",
		maxBuffer: 1024 * 1024,
		stdio: ["ignore", "pipe", "ignore"],
	});
	if (result.status !== 0) {
		finish("fail", ["report: cannot read JSON: read failed"], 1);
	}
	try {
		return JSON.parse(result.stdout);
	} catch (error) {
		finish(
			"fail",
			[
				`report: cannot read JSON: ${error instanceof Error ? error.message : "unknown error"}`,
			],
			1,
		);
	}
}

const result = validatePromptContextDriftReport(readReport(reportPath), {
	repoRoot,
});
finish(result.status, result.errors, result.status === "pass" ? 0 : 1);

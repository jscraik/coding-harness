#!/usr/bin/env node
import {
	formatDocsTaskEvalText,
	runDocsTaskEval,
} from "../src/lib/docs-surface/docs-task-eval.js";

const json = process.argv.includes("--json");

try {
	const report = runDocsTaskEval({ repoRoot: process.cwd() });

	if (json) {
		console.log(JSON.stringify(report, null, 2));
	} else {
		const output = formatDocsTaskEvalText(report);
		if (report.status === "pass") {
			console.log(output);
		} else {
			console.error(output);
		}
	}

	process.exit(report.status === "pass" ? 0 : 1);
} catch (error) {
	if (json) {
		const errorReport = {
			version: "docs-task-eval-report/v1",
			status: "error",
			error: {
				message: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
			},
		};
		console.log(JSON.stringify(errorReport, null, 2));
	} else {
		console.error(
			`Error running docs-task eval: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
	process.exit(1);
}

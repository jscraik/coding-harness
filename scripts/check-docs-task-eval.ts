#!/usr/bin/env node
import {
	formatDocsTaskEvalText,
	runDocsTaskEval,
} from "../src/lib/docs-surface/docs-task-eval.js";

const json = process.argv.includes("--json");
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

#!/usr/bin/env node
import { validateDocLifecycle } from "../src/lib/docs-surface/doc-lifecycle.js";

const json = process.argv.includes("--json");
const report = validateDocLifecycle({ repoRoot: process.cwd() });
const errors = report.violations.filter(
	(violation) => violation.severity === "error",
);

if (json) {
	console.log(JSON.stringify(report, null, 2));
} else if (report.violations.length === 0) {
	console.log(
		"[check-doc-lifecycle] pass (" +
			report.checkedDocuments.length +
			" governed docs)",
	);
} else {
	for (const violation of report.violations) {
		console.error(
			[
				"[check-doc-lifecycle]",
				violation.severity,
				violation.path,
				violation.message,
				`Fix: ${violation.fix}`,
			].join(" "),
		);
	}
}

process.exit(errors.length > 0 ? 1 : 0);

#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const gitignore = readFileSync(".gitignore", "utf8");
const readme = readFileSync(".harness/README.md", "utf8");

function gitCheckIgnorePattern(path) {
	const result = spawnSync(
		"git",
		["check-ignore", "-v", "--no-index", "--", path],
		{
			encoding: "utf8",
		},
	);
	return result.stdout.trim();
}

const feedbackLoopIndexIgnoreRule = gitCheckIgnorePattern(
	".harness/feedback-loops/index.json",
);
const feedbackLoopSiblingIgnoreRule = gitCheckIgnorePattern(
	".harness/feedback-loops/local-output.json",
);

const requirements = [
	{
		name: ".harness/audits gitignore allowlist",
		ok:
			gitignore.includes("!.harness/audits/") &&
			gitignore.includes(".harness/audits/*") &&
			gitignore.includes("!.harness/audits/**/*.md"),
	},
	{
		name: ".harness/audits control-plane map",
		ok:
			(readme.includes(".harness/audits/YYYY-MM-DD-...-audit.md") ||
				readme.includes(".harness/audits/YYYY-MM-DD-<type>-audit.md")) &&
			readme.includes(".harness/research/audits/"),
	},
	{
		name: ".harness/feedback-loops gitignore allowlist",
		ok:
			gitignore.includes("!.harness/feedback-loops/") &&
			gitignore.includes(".harness/feedback-loops/*") &&
			gitignore.includes("!.harness/feedback-loops/index.json") &&
			feedbackLoopIndexIgnoreRule.includes(
				":!.harness/feedback-loops/index.json\t.harness/feedback-loops/index.json",
			) &&
			feedbackLoopSiblingIgnoreRule.includes(
				":.harness/feedback-loops/*\t.harness/feedback-loops/local-output.json",
			),
	},
	{
		name: ".harness/feedback-loops control-plane map",
		ok:
			readme.includes(".harness/feedback-loops/index.json") &&
			readme.includes("feedback-loop-audit"),
	},
	{
		name: "audit destination distinction",
		ok:
			readme.includes("Operator-requested audits belong in") &&
			readme.includes("`.harness/audits/`") &&
			readme.includes("Research-discovery") &&
			readme.includes("`.harness/research/audits/`"),
	},
];

const failures = requirements.filter((requirement) => !requirement.ok);
if (failures.length > 0) {
	console.error("[harness-audit-tracking] missing audit tracking contract:");
	for (const failure of failures) {
		console.error(`  - ${failure.name}`);
	}
	process.exit(1);
}

console.log(
	"[harness-audit-tracking] verified .harness audit tracking contract",
);

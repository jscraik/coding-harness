#!/usr/bin/env node
import { readFileSync } from "node:fs";

const gitignore = readFileSync(".gitignore", "utf8");
const readme = readFileSync(".harness/README.md", "utf8");

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
			readme.includes(".harness/audits/YYYY-MM-DD-<type>-audit.md") &&
			readme.includes(".harness/research/audits/"),
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

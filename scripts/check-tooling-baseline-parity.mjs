#!/usr/bin/env node
import { readFileSync } from "node:fs";

const activeSurfacePaths = [
	".circleci/config.yml",
	".codex/environments/environment.toml",
	".mise.toml",
	"package.json",
	"scripts/check-environment.sh",
	"src/lib/policy/tooling-baseline.ts",
	"src/lib/init/scaffold-environment-templates.ts",
];

const removedToolTerms = [
	{
		term: "ralph",
		reason:
			"Ralph is not required for coding-harness and must not reappear in required readiness lanes.",
	},
	{
		term: "ralph-gold",
		reason:
			"Ralph is not required for coding-harness and must not be installed by CI.",
	},
];

const envPath = ".codex/environments/environment.toml";
const baselinePath = "src/lib/policy/tooling-baseline.ts";

const readText = (path) => readFileSync(path, "utf8");

const violations = [];

for (const path of activeSurfacePaths) {
	const content = readText(path);
	for (const { term, reason } of removedToolTerms) {
		const pattern = new RegExp(
			`\\b${term.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\b`,
			"i",
		);
		if (pattern.test(content)) {
			violations.push({
				path,
				term,
				reason,
			});
		}
	}
}

const baseline = readText(baselinePath);
const environment = readText(envPath);
const codexActionsBlock =
	/export const REQUIRED_CODEX_TOOL_ACTIONS = \[([\s\S]*?)\] as const;/m.exec(
		baseline,
	)?.[1] ?? "";
const requiredActionNames = [
	...codexActionsBlock.matchAll(/name:\s*"([^"]+)"/g),
].map((match) => match[1]);
const environmentActionNames = [
	...environment.matchAll(/^name\s*=\s*"([^"]+)"$/gm),
].map((match) => match[1]);

const environmentActionSet = new Set(environmentActionNames);
for (const actionName of requiredActionNames) {
	if (!environmentActionSet.has(actionName)) {
		violations.push({
			path: envPath,
			term: actionName,
			reason:
				"Required Codex tooling action is declared in the canonical baseline but missing from the checked-in environment.",
		});
	}
}

const result = {
	schemaVersion: "tooling-baseline-parity/v1",
	status: violations.length === 0 ? "pass" : "fail",
	checkedSurfaces: activeSurfacePaths,
	removedToolTerms: removedToolTerms.map(({ term }) => term),
	requiredActionCount: requiredActionNames.length,
	environmentActionCount: environmentActionNames.length,
	violations,
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
process.exit(violations.length === 0 ? 0 : 1);

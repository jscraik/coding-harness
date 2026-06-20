#!/usr/bin/env node
import { readFileSync } from "node:fs";

const activeSurfacePaths = [
	".circleci/config.yml",
	".codex/environments/environment.toml",
	".mise.toml",
	"package.json",
	"scripts/check-environment.sh",
	"src/lib/policy/tooling-baseline.ts",
	"src/lib/policy/tooling-paths.ts",
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

const violations = [];

const writeFailureAndExit = (
	requiredActionNames = [],
	environmentActionNames = [],
) => {
	const result = {
		schemaVersion: "tooling-baseline-parity/v1",
		status: "fail",
		checkedSurfaces: activeSurfacePaths,
		removedToolTerms: removedToolTerms.map(({ term }) => term),
		requiredActionCount: requiredActionNames.length,
		environmentActionCount: environmentActionNames.length,
		violations,
	};

	process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
	process.exit(1);
};

const readText = (path) => {
	try {
		return readFileSync(path, "utf8");
	} catch (error) {
		violations.push({
			path,
			term: "read_error",
			reason: error instanceof Error ? error.message : String(error),
		});
		writeFailureAndExit();
	}
};

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
const codexActionsMatch =
	/export const REQUIRED_CODEX_TOOL_ACTIONS = \[([\s\S]*?)\] as const;/m.exec(
		baseline,
	);
if (!codexActionsMatch) {
	violations.push({
		path: baselinePath,
		term: "REQUIRED_CODEX_TOOL_ACTIONS",
		reason:
			"Failed to parse REQUIRED_CODEX_TOOL_ACTIONS from canonical tooling baseline.",
	});
	writeFailureAndExit();
}
const codexActionsBlock = codexActionsMatch[1];
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

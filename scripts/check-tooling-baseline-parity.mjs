#!/usr/bin/env node
import { readFileSync } from "node:fs";

const activeSurfacePaths = [
	".circleci/config.yml",
	".codex/environments/environment.toml",
	".mise.toml",
	"package.json",
	"scripts/check-environment.sh",
	"scripts/run-uv-python.sh",
	"src/lib/policy/tooling-baseline.ts",
	"src/lib/policy/tooling-paths.ts",
	"src/lib/init/scaffold-config-templates.ts",
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
const misePath = ".mise.toml";
const uvWrapperPath = "scripts/run-uv-python.sh";
const scaffoldMiseTemplatePath = "src/lib/init/scaffold-config-templates.ts";
const minimumMalwareCheckUvVersion = [0, 11, 16];

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

const parseVersionTuple = (value) => {
	const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value);
	return match ? match.slice(1).map(Number) : null;
};

const isVersionAtLeast = (actual, minimum) => {
	for (let index = 0; index < minimum.length; index += 1) {
		if (actual[index] > minimum[index]) return true;
		if (actual[index] < minimum[index]) return false;
	}
	return true;
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

const mise = readText(misePath);
const uvPinMatch = /^"?uv"?\s*=\s*"([^"]+)"$/m.exec(mise);
const uvPin = uvPinMatch?.[1];
const uvVersionTuple = uvPin ? parseVersionTuple(uvPin) : null;
if (
	!uvVersionTuple ||
	!isVersionAtLeast(uvVersionTuple, minimumMalwareCheckUvVersion)
) {
	violations.push({
		path: misePath,
		term: "uv_malware_check_version",
		reason:
			"Pin uv to version 0.11.16 or newer so UV_MALWARE_CHECK=1 is recognized.",
	});
}
if (!/^UV_MALWARE_CHECK\s*=\s*"1"$/m.test(mise)) {
	violations.push({
		path: misePath,
		term: "UV_MALWARE_CHECK",
		reason:
			'Repository mise environments must default UV_MALWARE_CHECK to "1".',
	});
}

const uvWrapper = readText(uvWrapperPath);
if (!/^export UV_MALWARE_CHECK=1$/m.test(uvWrapper)) {
	violations.push({
		path: uvWrapperPath,
		term: "UV_MALWARE_CHECK",
		reason:
			"The canonical uv wrapper must force UV_MALWARE_CHECK=1 before uv can install locked remote-registry packages.",
	});
}

const scaffoldMiseTemplate = readText(scaffoldMiseTemplatePath);
if (!/UV_MALWARE_CHECK = "1"/.test(scaffoldMiseTemplate)) {
	violations.push({
		path: scaffoldMiseTemplatePath,
		term: "UV_MALWARE_CHECK",
		reason:
			'Repository scaffolds must default UV_MALWARE_CHECK to "1" in generated .mise.toml files.',
	});
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
	uvMalwareCheck: {
		minimumUvVersion: minimumMalwareCheckUvVersion.join("."),
		pinnedUvVersion: uvPin ?? null,
		environmentDefault: /^UV_MALWARE_CHECK\s*=\s*"1"$/m.test(mise),
		wrapperEnforced: /^export UV_MALWARE_CHECK=1$/m.test(uvWrapper),
		scaffoldDefault: /UV_MALWARE_CHECK = "1"/.test(scaffoldMiseTemplate),
	},
	requiredActionCount: requiredActionNames.length,
	environmentActionCount: environmentActionNames.length,
	violations,
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
process.exit(violations.length === 0 ? 0 : 1);

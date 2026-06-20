#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { sanitizeGitEnvironment } from "./lib/safe-git-env.mjs";

const repoRoot = process.cwd();
const gitEnv = sanitizeGitEnvironment(process.env, { policy: "minimal" });
const json = new Set(process.argv.slice(2)).has("--json");
const operationalFailures = [];

function emitResult(status, failures) {
	if (json) {
		console.info(
			JSON.stringify(
				{
					schemaVersion: "harness-audit-tracking/v1",
					status,
					failures,
				},
				null,
				2,
			),
		);
		return;
	}
	if (status === "pass") {
		console.log(
			"[harness-audit-tracking] verified .harness audit tracking contract",
		);
		return;
	}
	console.error("[harness-audit-tracking] missing audit tracking contract:");
	for (const failure of failures) {
		console.error(`  - ${failure.message}`);
	}
}

function readRequiredFile(path) {
	try {
		return readFileSync(path, "utf8");
	} catch (error) {
		operationalFailures.push({
			name: "audit-tracking input read failure",
			message:
				error instanceof Error
					? `Unable to read ${path}: ${error.message}`
					: `Unable to read ${path}: ${String(error)}`,
		});
		return "";
	}
}

const gitignore = readRequiredFile(".gitignore");
const readme = readRequiredFile(".harness/README.md");

function gitCheckIgnorePattern(path) {
	const result = spawnSync(
		"git",
		["check-ignore", "-v", "--no-index", "--", path],
		{
			cwd: repoRoot,
			encoding: "utf8",
			env: gitEnv,
		},
	);
	if (result.error || result.status === null) {
		operationalFailures.push({
			name: "git check-ignore execution failure",
			message:
				result.error?.message ??
				`git check-ignore did not exit cleanly for ${path}`,
		});
		return "";
	}
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

const failures = [
	...operationalFailures,
	...requirements
		.filter((requirement) => !requirement.ok)
		.map((failure) => ({
			name: failure.name,
			message: failure.name,
		})),
];
if (failures.length > 0) {
	emitResult("fail", failures);
	process.exitCode = 1;
} else {
	emitResult("pass", []);
}

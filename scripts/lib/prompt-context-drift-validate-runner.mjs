import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { validatePromptContextDriftReport } from "../../src/lib/prompt-context-drift/index.ts";

const repoRoot = process.env.PROMPT_CONTEXT_DRIFT_REPO_ROOT;
const bindToLiveHead =
	process.env.PROMPT_CONTEXT_DRIFT_BIND_LIVE_HEAD === "true";
const HEAD_SHA = /^[0-9a-f]{40}$/u;

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

if (!repoRoot) {
	finish("fail", ["runner: missing required environment"], 2);
}

function readReport() {
	try {
		return JSON.parse(readFileSync(0, "utf8"));
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

function liveHeadSha() {
	const result = spawnSync("git", ["rev-parse", "HEAD"], {
		cwd: repoRoot,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "ignore"],
	});
	const value = result.status === 0 ? result.stdout.trim() : "";
	return HEAD_SHA.test(value) ? value : null;
}

function validateLiveHeadBinding(report) {
	if (!bindToLiveHead) return [];
	const liveHead = liveHeadSha();
	if (liveHead === null) {
		return ["currentHeadSha: cannot verify live repository HEAD"];
	}
	return report?.currentHeadSha === liveHead
		? []
		: ["currentHeadSha: must match live repository HEAD"];
}

const report = readReport();
const result = validatePromptContextDriftReport(report, {
	repoRoot,
});
const errors = [...result.errors, ...validateLiveHeadBinding(report)];
finish(
	errors.length > 0 ? "fail" : result.status,
	errors,
	errors.length > 0 ? 1 : 0,
);

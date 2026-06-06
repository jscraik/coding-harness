import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "vitest";
import { expectBehavior } from "../lib/testing/expect-behavior.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const repoRootName = basename(repoRoot);

function runPreflight(
	args: string[],
	forcedStatus: string,
	options: { ci?: boolean; enableTestOverrides?: boolean } = {},
) {
	const env = { ...process.env };
	delete env.BASH_ENV;
	delete env.CIRCLECI;
	delete env.CIRCLE_BRANCH;
	delete env.CIRCLE_BUILD_NUM;
	delete env.CIRCLE_JOB;
	delete env.CIRCLE_NODE_INDEX;
	delete env.CIRCLE_NODE_TOTAL;
	delete env.CIRCLE_SHA1;
	delete env.CIRCLE_WORKFLOW_ID;
	delete env.CIRCLE_WORKING_DIRECTORY;

	return spawnSync("bash", ["scripts/codex-preflight.sh", ...args], {
		cwd: repoRoot,
		encoding: "utf-8",
		env: {
			...env,
			CI: options.ci ? "true" : "",
			CODEX_PREFLIGHT_ENABLE_TEST_OVERRIDES:
				options.enableTestOverrides === false ? "" : "1",
			CODEX_PREFLIGHT_REQUIRE_PROJECT_BRAIN: "never",
			CODEX_PREFLIGHT_TEST_FORCE_LOCAL_MEMORY_STATUS: forcedStatus,
		},
	});
}

function combinedOutput(result: ReturnType<typeof runPreflight>): string {
	return (result.stdout ?? "") + (result.stderr ?? "");
}

function resolveTool(tool: string): string {
	const result = spawnSync("bash", ["-lc", `command -v ${tool}`], {
		cwd: repoRoot,
		encoding: "utf-8",
	});
	if (result.status !== 0) {
		throw new Error(`Unable to resolve tool for preflight test: ${tool}`);
	}
	return result.stdout.trim();
}

function pathWithoutLocalMemory(): string {
	const binDir = mkdtempSync(join(tmpdir(), "codex-preflight-bin-"));
	for (const tool of ["bash", "git", "sed", "rg", "jq", "curl", "python3"]) {
		mkdirSync(binDir, { recursive: true });
		symlinkSync(resolveTool(tool), join(binDir, tool));
	}
	return `${binDir}:/usr/bin:/bin`;
}

describe("codex-preflight Local Memory legacy routing", () => {
	it("fails closed for flag-style required mode when Local Memory is unavailable", () => {
		const result = runPreflight(
			["--stack", "auto", "--mode", "required"],
			"unavailable",
		);

		expectBehavior({
			given: "flag-style required preflight with unavailable Local Memory",
			should: "return a failing exit code with a named Local Memory blocker",
			actual: {
				status: result.status,
				outputIncludesBlocker: combinedOutput(result).includes(
					"blocker=local_memory_unavailable",
				),
			},
			expected: {
				status: 2,
				outputIncludesBlocker: true,
			},
		});
	});

	it("rejects deterministic Local Memory overrides unless test overrides are enabled", () => {
		const result = runPreflight(
			["--stack", "auto", "--mode", "required"],
			"pass",
			{ enableTestOverrides: false },
		);

		expectBehavior({
			given:
				"a forced Local Memory status without the explicit test override gate",
			should: "fail required preflight instead of honoring the forced result",
			actual: {
				status: result.status,
				outputIncludesGateError: combinedOutput(result).includes(
					"requires CODEX_PREFLIGHT_ENABLE_TEST_OVERRIDES=1",
				),
			},
			expected: {
				status: 2,
				outputIncludesGateError: true,
			},
		});
	});

	it("rejects deterministic Local Memory overrides in CI", () => {
		const result = runPreflight(
			["--stack", "auto", "--mode", "required"],
			"pass",
			{ ci: true },
		);

		expectBehavior({
			given: "a forced Local Memory status under CI",
			should: "fail required preflight instead of allowing a CI bypass",
			actual: {
				status: result.status,
				outputIncludesCiError: combinedOutput(result).includes(
					"is not allowed in CI",
				),
			},
			expected: {
				status: 2,
				outputIncludesCiError: true,
			},
		});
	});

	it("fails closed for legacy positional mode by default", () => {
		const result = runPreflight(
			[repoRootName, "git,bash", "CODESTYLE.md"],
			"unavailable",
		);

		expectBehavior({
			given: "legacy positional preflight without an explicit optional mode",
			should:
				"run required Local Memory preflight instead of silently disabling it",
			actual: {
				status: result.status,
				outputIncludesRequiredFailure: combinedOutput(result).includes(
					"local-memory preflight failed (required mode)",
				),
			},
			expected: {
				status: 2,
				outputIncludesRequiredFailure: true,
			},
		});
	});

	it("keeps legacy optional mode explicit and non-blocking", () => {
		const result = runPreflight(
			[repoRootName, "git,bash", "CODESTYLE.md", "optional"],
			"unavailable",
		);

		expectBehavior({
			given: "legacy positional preflight with explicit optional mode",
			should: "continue only with an optional-mode warning",
			actual: {
				status: result.status,
				outputIncludesOptionalWarning: combinedOutput(result).includes(
					"local-memory preflight failed (optional mode)",
				),
			},
			expected: {
				status: 0,
				outputIncludesOptionalWarning: true,
			},
		});
	});

	it("fails closed when a real Local Memory helper reports a missing binary", () => {
		const result = spawnSync(
			"bash",
			["scripts/codex-preflight.sh", repoRootName, "git,bash", "CODESTYLE.md"],
			{
				cwd: repoRoot,
				encoding: "utf-8",
				env: {
					...process.env,
					BASH_ENV: "",
					CI: "",
					CODEX_PREFLIGHT_REQUIRE_PROJECT_BRAIN: "never",
					CODEX_PREFLIGHT_TEST_FORCE_LOCAL_MEMORY_STATUS: "",
					PATH: pathWithoutLocalMemory(),
				},
			},
		);

		expectBehavior({
			given:
				"legacy positional required preflight with the helper available but local-memory missing from PATH",
			should:
				"propagate the helper failure instead of normalizing the failed command to success",
			actual: {
				status: result.status,
				outputIncludesMissingBinary: combinedOutput(result).includes(
					"missing binary: local-memory",
				),
				outputIncludesRequiredFailure: combinedOutput(result).includes(
					"local-memory preflight failed (required mode)",
				),
			},
			expected: {
				status: 2,
				outputIncludesMissingBinary: true,
				outputIncludesRequiredFailure: true,
			},
		});
	});

	it("normalizes legacy stack and mode shorthand to the required preflight lane", () => {
		const result = runPreflight(["auto", "required"], "pass");

		expectBehavior({
			given: "legacy stack/mode shorthand with required mode",
			should: "run the Local Memory preflight lane",
			actual: {
				status: result.status,
				outputIncludesForcedPass: combinedOutput(result).includes(
					"local-memory preflight forced pass",
				),
			},
			expected: {
				status: 0,
				outputIncludesForcedPass: true,
			},
		});
	});

	it("keeps ambiguous repo/mode pairs in legacy positional parsing", () => {
		const result = runPreflight(["repo", "required"], "pass");

		expectBehavior({
			given: "an ambiguous two-argument legacy positional call",
			should:
				"preserve legacy repo-fragment parsing instead of treating it as stack shorthand",
			actual: {
				status: result.status,
				outputIncludesForcedPass: combinedOutput(result).includes(
					"local-memory preflight forced pass",
				),
			},
			expected: {
				status: 2,
				outputIncludesForcedPass: false,
			},
		});
	});
});

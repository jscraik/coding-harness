import { spawnSync } from "node:child_process";
import {
	chmodSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { expectBehavior } from "../lib/testing/expect-behavior.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const repoRootName = basename(repoRoot);

function runPreflight(
	args: string[],
	forcedStatus: string,
	options: {
		ci?: boolean;
		enableTestOverrides?: boolean;
		env?: NodeJS.ProcessEnv;
		skipHarnessRunners?: boolean;
	} = {},
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
			...options.env,
			CI: options.ci ? "true" : "",
			CODEX_PREFLIGHT_ENABLE_TEST_OVERRIDES:
				options.enableTestOverrides === false ? "" : "1",
			CODEX_PREFLIGHT_REQUIRE_PROJECT_BRAIN: "never",
			CODEX_PREFLIGHT_TEST_FORCE_LOCAL_MEMORY_STATUS: forcedStatus,
			CODEX_PREFLIGHT_TEST_SKIP_HARNESS_RUNNERS: options.skipHarnessRunners
				? "1"
				: "",
		},
	});
}

function writeExecutable(path: string, source: string): void {
	writeFileSync(path, source, "utf-8");
	chmodSync(path, 0o755);
}

function createSetupChecksFixture(manifestErrorCode?: string): {
	binDir: string;
	homeDir: string;
	helperInvocationPath: string;
	localMemoryInvocationPath: string;
	cleanup: () => void;
} {
	const root = mkdtempSync(join(tmpdir(), "codex-preflight-setup-checks-"));
	const binDir = join(root, "bin");
	const homeDir = join(root, "home");
	const helperInvocationPath = join(root, "helper-invocation.txt");
	const localMemoryInvocationPath = join(root, "local-memory-invocation.txt");
	mkdirSync(binDir, { recursive: true });

	writeExecutable(
		join(binDir, "pnpm"),
		`#!/usr/bin/env bash
set -euo pipefail
if [[ "$1" == "exec" && "$2" == "tsx" ]]; then
  printf '%s\\n' "$*" > "${helperInvocationPath}"
  printf '%s\\n' 'fixture source-helper failure' >&2
  exit 1
fi
exit 0
`,
	);
	writeExecutable(
		join(binDir, "node"),
		`#!/usr/bin/env bash
set -euo pipefail
case "$*" in
  *"init --check-updates --json"*) printf '%s\\n' '${
		manifestErrorCode
			? `{"error":{"code":"${manifestErrorCode}"}}`
			: '{"updateCheck":{"updateAvailable":false}}'
	}'; ${manifestErrorCode ? "exit 1" : ":"} ;;
  *) printf '%s\\n' '{}' ;;
esac
`,
	);
	writeExecutable(
		join(binDir, "local-memory"),
		`#!/usr/bin/env bash
printf '%s\\n' "$*" > "${localMemoryInvocationPath}"
exit 66
`,
	);

	return {
		binDir,
		homeDir,
		helperInvocationPath,
		localMemoryInvocationPath,
		cleanup: () => rmSync(root, { force: true, recursive: true }),
	};
}

function combinedOutput(result: ReturnType<typeof runPreflight>): string {
	return (result.stdout ?? "") + (result.stderr ?? "");
}

function resolveTool(tool: string): string {
	if (tool === "node") {
		// A managed-runtime shim can repopulate PATH and make local-memory visible.
		return process.execPath;
	}
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
	// Omit pnpm and tsx so the source helper cannot re-enter the managed runtime
	// and recover the local-memory binary this fixture deliberately removes.
	for (const tool of [
		"bash",
		"git",
		"sed",
		"rg",
		"jq",
		"curl",
		"python3",
		"node",
	]) {
		mkdirSync(binDir, { recursive: true });
		symlinkSync(resolveTool(tool), join(binDir, tool));
	}
	return `${binDir}:/usr/bin:/bin`;
}

describe("codex-preflight Local Memory legacy routing", () => {
	it("keeps setup checks non-mutating in optional mode", () => {
		const fixture = createSetupChecksFixture();
		try {
			const result = spawnSync(
				"bash",
				["scripts/run-harness-setup-checks.sh"],
				{
					cwd: repoRoot,
					encoding: "utf-8",
					env: {
						...process.env,
						BASH_ENV: "",
						CI: "",
						CODEX_PREFLIGHT_ENABLE_TEST_OVERRIDES: "1",
						CODEX_PREFLIGHT_REQUIRE_PROJECT_BRAIN: "never",
						CODEX_PREFLIGHT_TEST_FORCE_LOCAL_MEMORY_STATUS: "",
						CODEX_PREFLIGHT_TEST_SKIP_HARNESS_RUNNERS: "",
						HOME: fixture.homeDir,
						PATH: `${fixture.binDir}:${process.env.PATH}`,
					},
				},
			);
			const output = (result.stdout ?? "") + (result.stderr ?? "");
			const helperInvocation = existsSync(fixture.helperInvocationPath)
				? readFileSync(fixture.helperInvocationPath, "utf-8").trim()
				: null;

			expectBehavior({
				given: "routine setup checks with a Local Memory helper available",
				should: "skip Local Memory execution and never start a user daemon",
				actual: {
					status: result.status,
					helperInvocation,
					output,
					outputIncludesSkippedDiagnostic: output.includes(
						"local-memory diagnostics skipped in optional mode",
					),
					localMemoryStartInvoked: readFileSync(
						fixture.localMemoryInvocationPath,
						{ encoding: "utf-8", flag: "a+" },
					).includes("start"),
				},
				expected: {
					status: 0,
					helperInvocation: null,
					output: expect.stringContaining(
						"local-memory diagnostics skipped in optional mode",
					),
					outputIncludesSkippedDiagnostic: true,
					localMemoryStartInvoked: false,
				},
			});
		} finally {
			fixture.cleanup();
		}
	});

	it("keeps unavailable Local Memory as a warning in the default routine lane", () => {
		const result = runPreflight(["--stack", "auto"], "unavailable");

		expectBehavior({
			given: "the default routine preflight with unavailable Local Memory",
			should:
				"continue with a named optional diagnostic instead of blocking admission",
			actual: {
				status: result.status,
				outputIncludesOptionalWarning: combinedOutput(result).includes(
					"local-memory preflight failed (optional mode)",
				),
			},
			expected: { status: 0, outputIncludesOptionalWarning: true },
		});
	});

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

	it("rejects deterministic Local Memory overrides in CI before optional-mode normalization", () => {
		const result = runPreflight(
			["--stack", "auto", "--mode", "optional"],
			"pass",
			{
				ci: true,
			},
		);

		expectBehavior({
			given: "a forced Local Memory status under CI with optional mode",
			should: "fail before optional-mode normalization can hide the bypass",
			actual: {
				status: result.status,
				outputIncludesCiError: combinedOutput(result).includes(
					"is not allowed in CI",
				),
			},
			expected: { status: 2, outputIncludesCiError: true },
		});
	});

	it("rejects Harness runner isolation unless test overrides are enabled", () => {
		const result = runPreflight(["--stack", "auto", "--mode", "required"], "", {
			enableTestOverrides: false,
			skipHarnessRunners: true,
		});

		expectBehavior({
			given: "Harness runner isolation without the explicit test override gate",
			should: "fail required preflight instead of bypassing available runners",
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

	it("rejects Harness runner isolation in CI", () => {
		const result = runPreflight(["--stack", "auto", "--mode", "required"], "", {
			ci: true,
			skipHarnessRunners: true,
		});

		expectBehavior({
			given: "Harness runner isolation under CI",
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

	it("rejects Harness runner isolation in CI under optional mode", () => {
		const result = runPreflight(["--stack", "auto", "--mode", "optional"], "", {
			ci: true,
			skipHarnessRunners: true,
		});

		expectBehavior({
			given: "Harness runner isolation under CI with optional Local Memory",
			should: "fail before optional-mode normalization can hide the bypass",
			actual: {
				status: result.status,
				outputIncludesAuthorizationError: combinedOutput(result).includes(
					"is not allowed in CI",
				),
			},
			expected: { status: 2, outputIncludesAuthorizationError: true },
		});
	});

	it("keeps legacy positional mode non-blocking by default", () => {
		const result = runPreflight(
			[repoRootName, "git,bash", "CODESTYLE.md"],
			"unavailable",
		);

		expectBehavior({
			given:
				"legacy positional preflight without an explicit Local Memory mode",
			should:
				"continue with an optional diagnostic while preserving the strict explicit mode",
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

	it("skips Local Memory execution in the routine legacy lane", () => {
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
					CODEX_PREFLIGHT_ENABLE_TEST_OVERRIDES: "1",
					CODEX_PREFLIGHT_TEST_SKIP_HARNESS_RUNNERS: "1",
					PATH: pathWithoutLocalMemory(),
				},
			},
		);
		expectBehavior({
			given:
				"legacy positional routine preflight with local-memory missing from PATH",
			should: "preserve routine admission without invoking Local Memory",
			actual: {
				status: result.status,
				outputIncludesMissingBinary: combinedOutput(result).includes(
					"missing binary: local-memory",
				),
				outputIncludesSkippedDiagnostic: combinedOutput(result).includes(
					"local-memory diagnostics skipped in optional mode",
				),
			},
			expected: {
				status: 0,
				outputIncludesMissingBinary: false,
				outputIncludesSkippedDiagnostic: true,
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

	it("keeps setup checks runnable when the retired manifest is absent", () => {
		const fixture = createSetupChecksFixture("MANIFEST_NOT_FOUND");
		try {
			const result = spawnSync(
				"bash",
				["scripts/run-harness-setup-checks.sh"],
				{
					cwd: repoRoot,
					encoding: "utf-8",
					env: {
						...process.env,
						BASH_ENV: "",
						CI: "",
						CODEX_PREFLIGHT_ENABLE_TEST_OVERRIDES: "1",
						CODEX_PREFLIGHT_REQUIRE_PROJECT_BRAIN: "never",
						CODEX_PREFLIGHT_TEST_FORCE_LOCAL_MEMORY_STATUS: "",
						CODEX_PREFLIGHT_TEST_SKIP_HARNESS_RUNNERS: "",
						HOME: fixture.homeDir,
						PATH: `${fixture.binDir}:${process.env.PATH}`,
					},
				},
			);

			expectBehavior({
				given: "setup checks with no tracked legacy manifest",
				should: "warn and continue to the remaining setup gates",
				actual: {
					status: result.status,
					output: combinedOutput(result),
				},
				expected: {
					status: 0,
					output: expect.stringContaining(
						"continuing with remaining setup gates",
					),
				},
			});
		} finally {
			fixture.cleanup();
		}
	});
});

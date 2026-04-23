import { spawnSync } from "node:child_process";
import {
	chmodSync,
	copyFileSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	readdirSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as verifyWorkCommand from "./verify-work.js";
import { EXIT_CODES, runVerifyWorkCLI } from "./verify-work.js";

describe("verify-work command", () => {
	let repoRoot = "";

	beforeEach(() => {
		repoRoot = mkdtempSync(join(tmpdir(), "harness-verify-work-command-"));
	});

	afterEach(() => {
		if (repoRoot) {
			rmSync(repoRoot, { recursive: true, force: true });
		}
	});

	it("returns PRECONDITION_FAILED when scripts/verify-work.sh is missing", () => {
		const exitCode = runVerifyWorkCLI({ repoRoot, fast: true });
		expect(exitCode).toBe(EXIT_CODES.PRECONDITION_FAILED);
	});

	it("executes wrapper with passthrough flags and no-delegate env", () => {
		const scriptsDir = join(repoRoot, "scripts");
		mkdirSync(scriptsDir, { recursive: true });

		const wrapperPath = join(scriptsDir, "verify-work.sh");
		const argsLogPath = join(repoRoot, "verify-work-args.log");
		const envLogPath = join(repoRoot, "verify-work-env.log");

		writeFileSync(
			wrapperPath,
			`#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$@" > "${argsLogPath}"
printf '%s\\n' "$HARNESS_VERIFY_WORK_NO_DELEGATE" > "${envLogPath}"
`,
			"utf-8",
		);
		chmodSync(wrapperPath, 0o755);

		const exitCode = runVerifyWorkCLI({
			repoRoot,
			fast: true,
			strict: true,
			changedOnly: true,
			workspaceGovernance: true,
			resumeFrom: "validate-codestyle-fast",
			json: true,
		});

		expect(exitCode).toBe(EXIT_CODES.SUCCESS);
		expect(readFileSync(envLogPath, "utf-8").trim()).toBe("1");
		const args = readFileSync(argsLogPath, "utf-8").trim().split("\n");
		expect(args).toContain("--changed-only");
		expect(args).toContain("--fast");
		expect(args).toContain("--strict");
		expect(args).toContain("--json");
		expect(args).toContain("--workspace-governance");
		const resumeFromFlagIndex = args.indexOf("--resume-from");
		expect(resumeFromFlagIndex).toBeGreaterThanOrEqual(0);
		expect(args[resumeFromFlagIndex + 1]).toBe("validate-codestyle-fast");
		const repoRootFlagIndex = args.indexOf("--repo-root");
		expect(repoRootFlagIndex).toBeGreaterThanOrEqual(0);
		expect(args[repoRootFlagIndex + 1]).toBe(repoRoot);
	});

	it("maps SIGTERM termination to the conventional signal exit code", () => {
		const scriptsDir = join(repoRoot, "scripts");
		mkdirSync(scriptsDir, { recursive: true });
		const wrapperPath = join(scriptsDir, "verify-work.sh");

		writeFileSync(
			wrapperPath,
			`#!/usr/bin/env bash
kill -TERM $$
`,
			"utf-8",
		);
		chmodSync(wrapperPath, 0o755);

		const exitCode = runVerifyWorkCLI({ repoRoot });
		expect(exitCode).toBe(143);
	});

	it("maps SIGKILL termination to the conventional signal exit code", () => {
		const scriptsDir = join(repoRoot, "scripts");
		mkdirSync(scriptsDir, { recursive: true });
		const wrapperPath = join(scriptsDir, "verify-work.sh");

		writeFileSync(
			wrapperPath,
			`#!/usr/bin/env bash
kill -KILL $$
`,
			"utf-8",
		);
		chmodSync(wrapperPath, 0o755);

		const exitCode = runVerifyWorkCLI({ repoRoot });
		expect(exitCode).toBe(137);
	});

	it("returns USAGE_ERROR and does not execute wrapper when both --all and --changed-only are set", () => {
		const consoleErrorSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		try {
			const exitCode = runVerifyWorkCLI({
				repoRoot,
				all: true,
				changedOnly: true,
			});

			expect(exitCode).toBe(EXIT_CODES.USAGE_ERROR);
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				"Error: --all and --changed-only are mutually exclusive",
			);
		} finally {
			consoleErrorSpy.mockRestore();
		}
	});

	it("returns USAGE_ERROR when both governance scopes are set", () => {
		const consoleErrorSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		try {
			const exitCode = runVerifyWorkCLI({
				repoRoot,
				projectGovernance: true,
				workspaceGovernance: true,
			});
			expect(exitCode).toBe(EXIT_CODES.USAGE_ERROR);
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				"Error: --project-governance and --workspace-governance are mutually exclusive",
			);
		} finally {
			consoleErrorSpy.mockRestore();
		}
	});

	it("does not pass --json when json option is false", () => {
		const scriptsDir = join(repoRoot, "scripts");
		mkdirSync(scriptsDir, { recursive: true });

		const wrapperPath = join(scriptsDir, "verify-work.sh");
		const argsLogPath = join(repoRoot, "args-nojson.log");

		writeFileSync(
			wrapperPath,
			`#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$@" > "${argsLogPath}"
`,
			"utf-8",
		);
		chmodSync(wrapperPath, 0o755);

		runVerifyWorkCLI({ repoRoot, fast: true, json: false });

		const argsLog = readFileSync(argsLogPath, "utf-8");
		expect(argsLog).not.toContain("--json");
		expect(argsLog).toContain("--fast");
	});

	it("returns the wrapper script exit code when it exits non-zero", () => {
		const scriptsDir = join(repoRoot, "scripts");
		mkdirSync(scriptsDir, { recursive: true });

		const wrapperPath = join(scriptsDir, "verify-work.sh");
		writeFileSync(
			wrapperPath,
			`#!/usr/bin/env bash
exit 42
`,
			"utf-8",
		);
		chmodSync(wrapperPath, 0o755);

		const exitCode = runVerifyWorkCLI({ repoRoot });
		expect(exitCode).toBe(42);
	});

	it("returns FAILED when spawnSync returns an execution error", () => {
		const scriptsDir = join(repoRoot, "scripts");
		mkdirSync(scriptsDir, { recursive: true });
		writeExecutable(
			join(scriptsDir, "verify-work.sh"),
			"#!/usr/bin/env bash\n",
		);

		const errorSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		const spawnSpy = vi
			.spyOn(verifyWorkCommand.verifyWorkRuntime, "executeVerifyWorkWrapper")
			.mockReturnValueOnce({
				pid: 1,
				output: [null, Buffer.from(""), Buffer.from("")],
				stdout: Buffer.from(""),
				stderr: Buffer.from(""),
				status: null,
				signal: null,
				error: new Error("spawn failed"),
			});
		try {
			const exitCode = runVerifyWorkCLI({ repoRoot });
			expect(exitCode).toBe(EXIT_CODES.FAILED);
			expect(errorSpy).toHaveBeenCalledWith(
				expect.stringContaining("failed to run verify-work wrapper"),
			);
		} finally {
			spawnSpy.mockRestore();
			errorSpy.mockRestore();
		}
	});

	it("returns SIGNAL_TERMINATED when a signal cannot be mapped", () => {
		const scriptsDir = join(repoRoot, "scripts");
		mkdirSync(scriptsDir, { recursive: true });
		writeExecutable(
			join(scriptsDir, "verify-work.sh"),
			"#!/usr/bin/env bash\n",
		);

		const errorSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		const spawnSpy = vi
			.spyOn(verifyWorkCommand.verifyWorkRuntime, "executeVerifyWorkWrapper")
			.mockReturnValueOnce({
				pid: 1,
				output: [null, Buffer.from(""), Buffer.from("")],
				stdout: Buffer.from(""),
				stderr: Buffer.from(""),
				status: null,
				signal: "NOT_A_REAL_SIGNAL" as NodeJS.Signals,
			});
		try {
			const exitCode = runVerifyWorkCLI({ repoRoot });
			expect(exitCode).toBe(EXIT_CODES.SIGNAL_TERMINATED);
			expect(errorSpy).toHaveBeenCalledWith(
				"verify-work terminated by signal: NOT_A_REAL_SIGNAL",
			);
		} finally {
			spawnSpy.mockRestore();
			errorSpy.mockRestore();
		}
	});

	it("returns SUCCESS (0) when the wrapper exits zero", () => {
		const scriptsDir = join(repoRoot, "scripts");
		mkdirSync(scriptsDir, { recursive: true });

		const wrapperPath = join(scriptsDir, "verify-work.sh");
		writeFileSync(
			wrapperPath,
			`#!/usr/bin/env bash
exit 0
`,
			"utf-8",
		);
		chmodSync(wrapperPath, 0o755);

		const exitCode = runVerifyWorkCLI({ repoRoot });
		expect(exitCode).toBe(EXIT_CODES.SUCCESS);
	});

	it("does not pass --resume-from when resumeFrom is not set", () => {
		const scriptsDir = join(repoRoot, "scripts");
		mkdirSync(scriptsDir, { recursive: true });

		const wrapperPath = join(scriptsDir, "verify-work.sh");
		const argsLogPath = join(repoRoot, "args-noresume.log");

		writeFileSync(
			wrapperPath,
			`#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$@" > "${argsLogPath}"
`,
			"utf-8",
		);
		chmodSync(wrapperPath, 0o755);

		runVerifyWorkCLI({ repoRoot, fast: true });

		const argsLog = readFileSync(argsLogPath, "utf-8");
		expect(argsLog).not.toContain("--resume-from");
	});

	it("does not pass --all or --changed-only when neither is set", () => {
		const scriptsDir = join(repoRoot, "scripts");
		mkdirSync(scriptsDir, { recursive: true });

		const wrapperPath = join(scriptsDir, "verify-work.sh");
		const argsLogPath = join(repoRoot, "args-noscope.log");

		writeFileSync(
			wrapperPath,
			`#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$@" > "${argsLogPath}"
`,
			"utf-8",
		);
		chmodSync(wrapperPath, 0o755);

		runVerifyWorkCLI({ repoRoot });

		const argsLog = readFileSync(argsLogPath, "utf-8");
		expect(argsLog).not.toContain("--all");
		expect(argsLog).not.toContain("--changed-only");
	});
});

function writeExecutable(path: string, content: string): void {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, content, "utf-8");
	chmodSync(path, 0o755);
}

function writeBinExecutable(
	binDir: string,
	name: string,
	content: string,
): string {
	const scriptPath = join(binDir, name);
	writeExecutable(scriptPath, content);
	return scriptPath;
}

function scaffoldVerifyWorkScriptRepo(options: {
	repoRoot: string;
	manifest: Record<string, unknown>;
	normalizedOutput?: Record<string, unknown>;
}): void {
	const { repoRoot, manifest, normalizedOutput } = options;
	mkdirSync(join(repoRoot, "scripts"), { recursive: true });
	mkdirSync(join(repoRoot, ".harness"), { recursive: true });

	writeFileSync(
		join(repoRoot, "package.json"),
		JSON.stringify({ name: "verify-work-script-test", private: true }),
		"utf-8",
	);
	writeFileSync(join(repoRoot, "CODESTYLE.md"), "# codestyle\n", "utf-8");
	writeFileSync(join(repoRoot, "CONTRIBUTING.md"), "# contributing\n", "utf-8");
	writeFileSync(join(repoRoot, "Makefile"), "all:\n\t@true\n", "utf-8");
	writeFileSync(
		join(repoRoot, ".harness/ci-required-checks.json"),
		`${JSON.stringify(manifest, null, 2)}\n`,
		"utf-8",
	);

	const sourceVerifyWorkPath = join(process.cwd(), "scripts/verify-work.sh");
	const targetVerifyWorkPath = join(repoRoot, "scripts/verify-work.sh");
	copyFileSync(sourceVerifyWorkPath, targetVerifyWorkPath);
	chmodSync(targetVerifyWorkPath, 0o755);

	writeExecutable(
		join(repoRoot, "scripts/codex-preflight.sh"),
		`#!/usr/bin/env bash
set -euo pipefail
exit 0
`,
	);
	writeExecutable(
		join(repoRoot, "scripts/validate-codestyle.sh"),
		`#!/usr/bin/env bash
set -euo pipefail
exit 0
`,
	);

	if (normalizedOutput) {
		writeExecutable(
			join(repoRoot, "dist/cli.js"),
			`#!/usr/bin/env node
const args = process.argv.slice(2);
if (args[0] === "contract" && args[1] === "normalize-required-checks") {
  const payload = ${JSON.stringify(normalizedOutput)};
  process.stdout.write(JSON.stringify(payload) + "\\n");
  process.exit(0);
}
process.exit(1);
`,
		);
	}
}

function runVerifyWorkScript(
	repoRoot: string,
	extraArgs: string[] = [],
	options: {
		env?: NodeJS.ProcessEnv;
		json?: boolean;
		inheritEnv?: boolean;
	} = {},
) {
	const includeJson = options.json ?? true;
	const parentEnv = options.inheritEnv === false ? {} : process.env;
	const args = [
		join(repoRoot, "scripts/verify-work.sh"),
		"--fast",
		"--repo-root",
		repoRoot,
		...extraArgs,
	];
	if (includeJson) {
		args.push("--json");
	}
	return spawnSync("bash", args, {
		cwd: repoRoot,
		encoding: "utf-8",
		maxBuffer: 8 * 1024 * 1024,
		env: {
			...parentEnv,
			HARNESS_VERIFY_WORK_NO_DELEGATE: "1",
			...options.env,
		},
	});
}

function makeDeterministicScriptEnv(pathValue: string): NodeJS.ProcessEnv {
	return {
		PATH: pathValue,
		HOME: process.env.HOME ?? tmpdir(),
		TMPDIR: process.env.TMPDIR ?? tmpdir(),
		LANG: process.env.LANG ?? "C.UTF-8",
		LC_ALL: process.env.LC_ALL ?? "C.UTF-8",
	};
}

function writePriorRun(options: {
	repoRoot: string;
	runId: string;
	lane: { fastMode: boolean; changedOnly: boolean; strictMode: boolean };
	gates: Record<string, { status: "passed" | "failed" }>;
	contractVersion?: string;
	contractFingerprint?: string;
	omitContractFingerprint?: boolean;
	providerClass?: string;
	schemaVersion?: string;
}): void {
	const {
		repoRoot,
		runId,
		lane,
		gates,
		contractVersion = "1",
		contractFingerprint = "missing",
		omitContractFingerprint = false,
		providerClass = "github-actions",
		schemaVersion = "1",
	} = options;

	const runDir = join(repoRoot, ".harness/runs", runId);
	mkdirSync(join(runDir, "gates"), { recursive: true });

	writeFileSync(
		join(runDir, "run.json"),
		JSON.stringify(
			{
				runId,
				mode: "fresh",
				sourceRunId: null,
				status: "passed",
				startedAt: "2026-04-21T00:00:00Z",
				finishedAt: "2026-04-21T00:00:01Z",
				resumeFromGateId: null,
				repoRoot,
				providerClass,
				schemaVersion,
				contractVersion,
				...(omitContractFingerprint ? {} : { contractFingerprint }),
				lane,
			},
			null,
			2,
		),
		"utf-8",
	);
	writeFileSync(
		join(runDir, "summary.json"),
		JSON.stringify(
			{
				runId,
				overallStatus: "passed",
				failedGateId: null,
				freshVsResumed: "fresh",
				durationMs: 1000,
			},
			null,
			2,
		),
		"utf-8",
	);

	for (const [gateId, gate] of Object.entries(gates)) {
		writeFileSync(
			join(runDir, "gates", `${gateId}.json`),
			JSON.stringify(
				{
					gateId,
					executionClass: "serial_guarded",
					attempt: 1,
					status: gate.status,
					failureClass:
						gate.status === "passed" ? "internal_unknown" : "contract_policy",
					startedAt: "2026-04-21T00:00:00Z",
					finishedAt: "2026-04-21T00:00:01Z",
					nextAction: gate.status === "passed" ? "none" : "fix and rerun",
					exitCode: gate.status === "passed" ? 0 : 1,
				},
				null,
				2,
			),
			"utf-8",
		);
	}
}

function readLatestRunDir(repoRoot: string): string {
	const runIds = readdirSync(join(repoRoot, ".harness/runs")).sort();
	const latestRunId = runIds.at(-1);
	if (!latestRunId) {
		throw new Error("No run directories found");
	}
	return join(repoRoot, ".harness/runs", latestRunId);
}

describe("scripts/verify-work.sh ci-check-alignment", () => {
	let repoRoot = "";

	beforeEach(() => {
		repoRoot = mkdtempSync(join(tmpdir(), "harness-verify-work-script-"));
	});

	afterEach(() => {
		if (repoRoot) {
			rmSync(repoRoot, { recursive: true, force: true });
		}
	});

	it("passes in normalized mode when githubCheckName values are aligned", () => {
		scaffoldVerifyWorkScriptRepo({
			repoRoot,
			manifest: { activeProvider: "github-actions" },
			normalizedOutput: {
				schemaVersion: 1,
				contractVersion: "1",
				activeProvider: "github-actions",
				gates: [{ provider: "github-actions", githubCheckName: "ci / test" }],
			},
		});

		const result = runVerifyWorkScript(repoRoot);
		const combinedOutput = `${result.stdout}${result.stderr}`;

		expect(result.status).toBe(0);
		expect(combinedOutput).toContain(
			"ci-check-alignment: manifest check names look aligned",
		);
	});

	it("passes in raw fallback mode when requiredChecks include githubCheckName", () => {
		scaffoldVerifyWorkScriptRepo({
			repoRoot,
			manifest: {
				activeProvider: "github-actions",
				requiredChecks: [
					{
						sourceAppSlug: "github-actions",
						githubCheckName: "ci / test",
					},
				],
			},
		});

		const result = runVerifyWorkScript(repoRoot);
		const combinedOutput = `${result.stdout}${result.stderr}`;

		expect(result.status).toBe(0);
		expect(combinedOutput).toContain(
			"required checks normalization unavailable; using raw manifest fallback",
		);
		expect(combinedOutput).toContain(
			"ci-check-alignment: manifest check names look aligned",
		);
	});

	it("passes in raw fallback mode when provider is inferred from requiredChecks", () => {
		scaffoldVerifyWorkScriptRepo({
			repoRoot,
			manifest: {
				requiredChecks: [
					{
						provider: "github-actions",
						sourceAppSlug: "github-actions",
						githubCheckName: "ci / test",
					},
				],
			},
		});

		const result = runVerifyWorkScript(repoRoot);
		const combinedOutput = `${result.stdout}${result.stderr}`;

		expect(result.status).toBe(0);
		expect(combinedOutput).toContain(
			"ci-check-alignment: manifest check names look aligned",
		);
	});

	it("blocks in raw fallback mode when provider identity is unavailable", () => {
		scaffoldVerifyWorkScriptRepo({
			repoRoot,
			manifest: {
				requiredChecks: [
					{
						githubCheckName: "ci / test",
					},
				],
			},
		});

		const result = runVerifyWorkScript(repoRoot);
		const combinedOutput = `${result.stdout}${result.stderr}`;

		expect(result.status).toBe(1);
		expect(combinedOutput).toContain(
			"ci-check-alignment: active provider identity is required in required checks manifest",
		);
		expect(combinedOutput).toContain(
			"ci-check-alignment: blocking due to missing canonical provider identity",
		);
	});

	it("passes in raw fallback mode when provider match is expressed via sourceAppId", () => {
		scaffoldVerifyWorkScriptRepo({
			repoRoot,
			manifest: {
				activeProvider: "circleci",
				requiredChecks: [
					{
						sourceAppId: "circleci",
						githubCheckName: "ci / verify",
					},
				],
			},
		});

		const result = runVerifyWorkScript(repoRoot);
		const combinedOutput = `${result.stdout}${result.stderr}`;

		expect(result.status).toBe(0);
		expect(combinedOutput).toContain(
			"ci-check-alignment: manifest check names look aligned",
		);
	});

	it("prefers sourceAppSlug over sourceAppId when both are present in raw fallback entries", () => {
		scaffoldVerifyWorkScriptRepo({
			repoRoot,
			manifest: {
				activeProvider: "circleci",
				requiredChecks: [
					{
						sourceAppSlug: "github-actions",
						sourceAppId: "circleci",
						githubCheckName: "ci / verify",
					},
				],
			},
		});

		const result = runVerifyWorkScript(repoRoot);
		const combinedOutput = `${result.stdout}${result.stderr}`;

		expect(result.status).toBe(1);
		expect(combinedOutput).toContain(
			"ci-check-alignment: no githubCheckName values found for active provider",
		);
	});

	it("uses repo tsx runner when dist normalization fails", () => {
		scaffoldVerifyWorkScriptRepo({
			repoRoot,
			manifest: {
				activeProvider: "github-actions",
				requiredChecks: [],
			},
		});
		writeExecutable(
			join(repoRoot, "dist/cli.js"),
			`#!/usr/bin/env node
process.exit(1);
`,
		);
		mkdirSync(join(repoRoot, "src"), { recursive: true });
		// Force repo-runner normalization to fail deterministically even if an
		// environment-provided pnpm function bypasses our PATH stub.
		writeFileSync(join(repoRoot, "src/cli.ts"), "process.exit(1);\n", "utf-8");

		const payload = JSON.stringify({
			schemaVersion: 1,
			contractVersion: "1",
			activeProvider: "github-actions",
			gates: [{ provider: "github-actions", githubCheckName: "ci / test" }],
		});
		const binDir = mkdtempSync(join(tmpdir(), "verify-work-bin-"));
		writeBinExecutable(
			binDir,
			"pnpm",
			`#!/usr/bin/env bash
set -euo pipefail
echo '${payload}'
`,
		);

		const result = runVerifyWorkScript(repoRoot, [], {
			env: { PATH: `${binDir}:${process.env.PATH ?? ""}` },
		});
		const combinedOutput = `${result.stdout}${result.stderr}`;

		expect(result.status).toBe(0);
		expect(combinedOutput).toContain(
			"required checks normalization via dist CLI failed, trying fallback runners",
		);
		rmSync(binDir, { recursive: true, force: true });
	});

	it("uses mise-resolved harness when dist and repo runners fail", () => {
		scaffoldVerifyWorkScriptRepo({
			repoRoot,
			manifest: {
				activeProvider: "github-actions",
				requiredChecks: [],
			},
		});
		writeExecutable(
			join(repoRoot, "dist/cli.js"),
			`#!/usr/bin/env node
process.exit(1);
`,
		);
		mkdirSync(join(repoRoot, "src"), { recursive: true });
		// Force repo-runner normalization to fail deterministically even if an
		// environment-provided pnpm function bypasses our PATH stub.
		writeFileSync(join(repoRoot, "src/cli.ts"), "process.exit(1);\n", "utf-8");

		const payload = JSON.stringify({
			schemaVersion: 1,
			contractVersion: "1",
			activeProvider: "github-actions",
			gates: [{ provider: "github-actions", githubCheckName: "ci / test" }],
		});
		const binDir = mkdtempSync(join(tmpdir(), "verify-work-bin-"));
		const miseHarnessPath = writeBinExecutable(
			binDir,
			"harness-from-mise",
			`#!/usr/bin/env bash
set -euo pipefail
echo '${payload}'
`,
		);
		writeBinExecutable(
			binDir,
			"pnpm",
			`#!/usr/bin/env bash
set -euo pipefail
exit 1
`,
		);
		writeBinExecutable(
			binDir,
			"mise",
			`#!/usr/bin/env bash
set -euo pipefail
if [[ "$#" -ge 2 && "$1" == "which" && "$2" == "harness" ]]; then
	echo "${miseHarnessPath}"
	exit 0
fi
exit 1
`,
		);

		const sandboxedEnv = makeDeterministicScriptEnv(
			`${binDir}:${process.env.PATH ?? ""}`,
		);

		const result = runVerifyWorkScript(repoRoot, [], {
			inheritEnv: false,
			env: sandboxedEnv,
		});
		const combinedOutput = `${result.stdout}${result.stderr}`;

		expect(result.status).toBe(0);
		expect(combinedOutput).toContain(
			"required checks normalization via dist CLI failed, trying fallback runners",
		);
		expect(combinedOutput).toContain(
			"required checks normalization via repo runner failed, trying fallback runners",
		);
		rmSync(binDir, { recursive: true, force: true });
	});

	it("uses PATH harness when dist, repo runner, and mise resolution fail", () => {
		scaffoldVerifyWorkScriptRepo({
			repoRoot,
			manifest: {
				activeProvider: "github-actions",
				requiredChecks: [],
			},
		});
		writeExecutable(
			join(repoRoot, "dist/cli.js"),
			`#!/usr/bin/env node
process.exit(1);
`,
		);
		mkdirSync(join(repoRoot, "src"), { recursive: true });
		writeFileSync(join(repoRoot, "src/cli.ts"), "export {};\n", "utf-8");

		const payload = JSON.stringify({
			schemaVersion: 1,
			contractVersion: "1",
			activeProvider: "github-actions",
			gates: [{ provider: "github-actions", githubCheckName: "ci / test" }],
		});
		const binDir = mkdtempSync(join(tmpdir(), "verify-work-bin-"));
		writeBinExecutable(
			binDir,
			"pnpm",
			`#!/usr/bin/env bash
set -euo pipefail
exit 1
`,
		);
		writeBinExecutable(
			binDir,
			"mise",
			`#!/usr/bin/env bash
set -euo pipefail
exit 1
`,
		);
		writeBinExecutable(
			binDir,
			"harness",
			`#!/usr/bin/env bash
set -euo pipefail
echo '${payload}'
`,
		);

		const result = runVerifyWorkScript(repoRoot, [], {
			env: { PATH: `${binDir}:${process.env.PATH ?? ""}` },
		});
		const combinedOutput = `${result.stdout}${result.stderr}`;

		expect(result.status).toBe(0);
		expect(combinedOutput).toContain(
			"required checks normalization via dist CLI failed, trying fallback runners",
		);
		expect(combinedOutput).toContain(
			"required checks normalization via repo runner failed, trying fallback runners",
		);
		rmSync(binDir, { recursive: true, force: true });
	});

	it("fails closed when normalization cannot produce a valid manifest object", () => {
		scaffoldVerifyWorkScriptRepo({
			repoRoot,
			manifest: {
				activeProvider: "github-actions",
				requiredChecks: [
					{
						sourceAppSlug: "github-actions",
						githubCheckName: "ci / test",
					},
				],
			},
		});
		writeFileSync(
			join(repoRoot, ".harness/ci-required-checks.json"),
			'["not-an-object"]\n',
			"utf-8",
		);

		const binDir = mkdtempSync(join(tmpdir(), "verify-work-no-normalize-"));
		writeBinExecutable(
			binDir,
			"mise",
			`#!/usr/bin/env bash
set -euo pipefail
exit 1
`,
		);
		writeBinExecutable(
			binDir,
			"harness",
			`#!/usr/bin/env bash
set -euo pipefail
exit 1
`,
		);

		const result = runVerifyWorkScript(repoRoot, [], {
			env: { PATH: `${binDir}:${process.env.PATH ?? ""}` },
		});
		const combinedOutput = `${result.stdout}${result.stderr}`;

		expect(result.status).toBe(1);
		expect(combinedOutput).toContain(
			"required checks normalization failed for",
		);
		expect(combinedOutput).toContain(".harness/ci-required-checks.json");
		rmSync(binDir, { recursive: true, force: true });
	});

	it("blocks in raw fallback mode when githubCheckName is missing", () => {
		scaffoldVerifyWorkScriptRepo({
			repoRoot,
			manifest: {
				activeProvider: "github-actions",
				requiredChecks: [{ sourceAppSlug: "github-actions" }],
			},
		});

		const result = runVerifyWorkScript(repoRoot);
		const combinedOutput = `${result.stdout}${result.stderr}`;

		expect(result.status).toBe(1);
		expect(combinedOutput).toContain(
			"ci-check-alignment: no githubCheckName values found for active provider",
		);
		expect(combinedOutput).toContain(
			"ci-check-alignment: blocking due to missing canonical check identity",
		);
	});

	it("blocks when normalized checks exist only for non-active providers", () => {
		scaffoldVerifyWorkScriptRepo({
			repoRoot,
			manifest: { activeProvider: "circleci" },
			normalizedOutput: {
				schemaVersion: 1,
				contractVersion: "1",
				activeProvider: "circleci",
				gates: [{ provider: "github-actions", githubCheckName: "ci / test" }],
			},
		});

		const result = runVerifyWorkScript(repoRoot);
		const combinedOutput = `${result.stdout}${result.stderr}`;

		expect(result.status).toBe(1);
		expect(combinedOutput).toContain(
			"ci-check-alignment: no githubCheckName values found for active provider",
		);
		expect(combinedOutput).toContain(
			"ci-check-alignment: blocking due to missing canonical check identity",
		);
	});

	it("blocks when raw fallback checks exist only for non-active providers", () => {
		scaffoldVerifyWorkScriptRepo({
			repoRoot,
			manifest: {
				activeProvider: "circleci",
				requiredChecks: [
					{
						sourceAppSlug: "github-actions",
						githubCheckName: "ci / test",
					},
				],
			},
		});

		const result = runVerifyWorkScript(repoRoot);
		const combinedOutput = `${result.stdout}${result.stderr}`;

		expect(result.status).toBe(1);
		expect(combinedOutput).toContain(
			"ci-check-alignment: no githubCheckName values found for active provider",
		);
		expect(combinedOutput).toContain(
			"ci-check-alignment: blocking due to missing canonical check identity",
		);
	});

	it("blocks suspicious CircleCI names in normalized mode", () => {
		scaffoldVerifyWorkScriptRepo({
			repoRoot,
			manifest: { activeProvider: "circleci" },
			normalizedOutput: {
				schemaVersion: 1,
				contractVersion: "1",
				activeProvider: "circleci",
				gates: [{ provider: "circleci", githubCheckName: "lint" }],
			},
		});

		const result = runVerifyWorkScript(repoRoot);
		const combinedOutput = `${result.stdout}${result.stderr}`;

		expect(result.status).toBe(1);
		expect(combinedOutput).toContain(
			"ci-check-alignment: CircleCI job-like githubCheckName values detected: lint",
		);
	});

	it("blocks suspicious CircleCI names in raw fallback mode", () => {
		scaffoldVerifyWorkScriptRepo({
			repoRoot,
			manifest: {
				activeProvider: "circleci",
				requiredChecks: [
					{
						sourceAppSlug: "circleci",
						githubCheckName: "lint",
					},
				],
			},
		});

		const result = runVerifyWorkScript(repoRoot);
		const combinedOutput = `${result.stdout}${result.stderr}`;

		expect(result.status).toBe(1);
		expect(combinedOutput).toContain(
			"ci-check-alignment: CircleCI job-like githubCheckName values detected: lint",
		);
	});

	it("blocks missing githubCheckName values in strict mode even with normalized manifest output", () => {
		scaffoldVerifyWorkScriptRepo({
			repoRoot,
			manifest: { activeProvider: "github-actions" },
			normalizedOutput: {
				schemaVersion: 1,
				contractVersion: "1",
				activeProvider: "github-actions",
				gates: [],
			},
		});

		const result = runVerifyWorkScript(repoRoot, ["--strict"]);
		const combinedOutput = `${result.stdout}${result.stderr}`;

		expect(result.status).toBe(1);
		expect(combinedOutput).toContain(
			"ci-check-alignment: no githubCheckName values found for active provider",
		);
		expect(combinedOutput).toContain(
			"ci-check-alignment: blocking due to missing canonical check identity",
		);
	});

	it("uses project-local governance scope when requested", () => {
		scaffoldVerifyWorkScriptRepo({
			repoRoot,
			manifest: {
				activeProvider: "github-actions",
				requiredChecks: [
					{
						sourceAppSlug: "github-actions",
						githubCheckName: "ci / test",
					},
				],
			},
		});

		const result = runVerifyWorkScript(repoRoot, ["--project-governance"], {
			json: false,
		});
		const combinedOutput = `${result.stdout}${result.stderr}`;

		expect(result.status).toBe(0);
		expect(combinedOutput).toContain("hook-governance scope: project-local");
		expect(combinedOutput).not.toContain("hook-governance scope: workspace");
	});

	it("uses workspace governance scope when requested", () => {
		scaffoldVerifyWorkScriptRepo({
			repoRoot,
			manifest: {
				activeProvider: "github-actions",
				requiredChecks: [
					{
						sourceAppSlug: "github-actions",
						githubCheckName: "ci / test",
					},
				],
			},
		});

		const result = runVerifyWorkScript(repoRoot, ["--workspace-governance"], {
			json: false,
		});
		const combinedOutput = `${result.stdout}${result.stderr}`;

		expect(result.status).toBe(0);
		expect(combinedOutput).toContain("hook-governance scope: workspace");
		expect(combinedOutput).not.toContain(
			"hook-governance scope: project-local",
		);
	});

	it("fails with usage error when both governance scope flags are provided", () => {
		scaffoldVerifyWorkScriptRepo({
			repoRoot,
			manifest: {
				activeProvider: "github-actions",
				requiredChecks: [
					{
						sourceAppSlug: "github-actions",
						githubCheckName: "ci / test",
					},
				],
			},
		});

		const result = runVerifyWorkScript(repoRoot, [
			"--project-governance",
			"--workspace-governance",
		]);
		expect(result.status).toBe(2);
		expect(`${result.stdout}${result.stderr}`).toContain(
			"--project-governance and --workspace-governance are mutually exclusive",
		);
	});

	it("fails workspace report formatting when pnpm is unavailable", () => {
		scaffoldVerifyWorkScriptRepo({
			repoRoot,
			manifest: {
				activeProvider: "github-actions",
				requiredChecks: [
					{
						sourceAppSlug: "github-actions",
						githubCheckName: "ci / test",
					},
				],
			},
		});
		mkdirSync(join(repoRoot, "docs/hooks-governance"), { recursive: true });
		writeFileSync(
			join(repoRoot, "docs/hooks-governance/repo-scope.manifest.json"),
			JSON.stringify({
				workspace_root: repoRoot,
				repos: { in_scope: ["verify-work-script-test"], excluded: [] },
			}),
			"utf-8",
		);
		writeFileSync(
			join(repoRoot, "docs/hooks-governance/repo-profile-matrix.json"),
			"{}\n",
			"utf-8",
		);
		writeFileSync(
			join(repoRoot, "docs/hooks-governance/rollout-check-report.json"),
			"{}\n",
			"utf-8",
		);
		writeFileSync(
			join(repoRoot, "docs/hooks-governance/docstring-ratchet-report.json"),
			"{}\n",
			"utf-8",
		);

		const jqLookup = spawnSync("bash", ["-lc", "command -v jq"], {
			encoding: "utf-8",
		});
		expect(jqLookup.status).toBe(0);
		const jqPath = (jqLookup.stdout ?? "").trim();
		expect(jqPath.length).toBeGreaterThan(0);
		const binDir = mkdtempSync(join(tmpdir(), "verify-work-no-pnpm-"));
		writeBinExecutable(
			binDir,
			"jq",
			`#!/usr/bin/env bash
set -euo pipefail
exec "${jqPath}" "$@"
`,
		);

		const result = runVerifyWorkScript(repoRoot, ["--workspace-governance"], {
			json: false,
			env: { PATH: `${binDir}:/usr/bin:/bin:/usr/sbin:/sbin` },
		});
		expect(result.status).toBe(1);
		expect(`${result.stdout}${result.stderr}`).toContain(
			"pnpm is required to format hook-governance workspace reports",
		);
		rmSync(binDir, { recursive: true, force: true });
	});

	it("blocks resume when deterministic contract fingerprint is unavailable", () => {
		scaffoldVerifyWorkScriptRepo({
			repoRoot,
			manifest: {
				activeProvider: "github-actions",
				requiredChecks: [
					{ sourceAppSlug: "github-actions", githubCheckName: "ci / test" },
				],
			},
		});
		writeFileSync(
			join(repoRoot, "harness.contract.json"),
			JSON.stringify({ version: "1.0", marker: "current" }),
			"utf-8",
		);
		const binDir = mkdtempSync(join(tmpdir(), "verify-work-no-hash-tools-"));
		writeBinExecutable(
			binDir,
			"node",
			`#!/usr/bin/env bash
set -euo pipefail
exit 127
`,
		);
		writeBinExecutable(
			binDir,
			"shasum",
			`#!/usr/bin/env bash
set -euo pipefail
exit 127
`,
		);
		writeBinExecutable(
			binDir,
			"openssl",
			`#!/usr/bin/env bash
set -euo pipefail
exit 127
`,
		);

		const result = runVerifyWorkScript(
			repoRoot,
			["--resume-from", "hook-governance-inventory"],
			{ env: { PATH: `${binDir}:${process.env.PATH ?? ""}` } },
		);
		const combinedOutput = `${result.stdout}${result.stderr}`;

		expect(result.status).toBe(1);
		expect(combinedOutput).toContain(
			"resume blocked: deterministic contract fingerprint is unavailable",
		);
		expect(combinedOutput).toContain(
			"install node, shasum, or openssl to enable safe resume matching",
		);
		rmSync(binDir, { recursive: true, force: true });
	});

	it("allows fresh runs when contract fingerprint tooling is unavailable", () => {
		scaffoldVerifyWorkScriptRepo({
			repoRoot,
			manifest: {
				activeProvider: "github-actions",
				requiredChecks: [
					{ sourceAppSlug: "github-actions", githubCheckName: "ci / test" },
				],
			},
		});
		writeFileSync(
			join(repoRoot, "harness.contract.json"),
			JSON.stringify({ version: "1.0", marker: "current" }),
			"utf-8",
		);
		const binDir = mkdtempSync(join(tmpdir(), "verify-work-no-hash-tools-"));
		writeBinExecutable(
			binDir,
			"node",
			`#!/usr/bin/env bash
set -euo pipefail
exit 127
`,
		);
		writeBinExecutable(
			binDir,
			"shasum",
			`#!/usr/bin/env bash
set -euo pipefail
exit 127
`,
		);
		writeBinExecutable(
			binDir,
			"openssl",
			`#!/usr/bin/env bash
set -euo pipefail
exit 127
`,
		);

		const result = runVerifyWorkScript(repoRoot, [], {
			env: { PATH: `${binDir}:${process.env.PATH ?? ""}` },
		});
		expect(result.status).toBe(0);
		const summary = JSON.parse(result.stdout) as { runId: string };
		const runJson = JSON.parse(
			readFileSync(
				join(repoRoot, ".harness/runs", summary.runId, "run.json"),
				"utf-8",
			),
		) as { contractFingerprint?: string };
		expect(runJson.contractFingerprint).toBe("unknown");
		rmSync(binDir, { recursive: true, force: true });
	});

	it("resumes from most recent compatible run and hydrates prior passed gates", () => {
		scaffoldVerifyWorkScriptRepo({
			repoRoot,
			manifest: {
				activeProvider: "github-actions",
				requiredChecks: [
					{ sourceAppSlug: "github-actions", githubCheckName: "ci / test" },
				],
			},
		});
		writePriorRun({
			repoRoot,
			runId: "run-newer-incompatible",
			lane: { fastMode: true, changedOnly: false, strictMode: false },
			gates: {
				preflight: { status: "passed" },
				"ci-check-alignment": { status: "passed" },
			},
		});
		writePriorRun({
			repoRoot,
			runId: "run-older-compatible",
			lane: { fastMode: true, changedOnly: true, strictMode: false },
			gates: {
				preflight: { status: "passed" },
				"ci-check-alignment": { status: "passed" },
			},
		});

		const result = runVerifyWorkScript(
			repoRoot,
			["--resume-from", "hook-governance-inventory"],
			{
				inheritEnv: false,
				env: makeDeterministicScriptEnv(process.env.PATH ?? ""),
			},
		);
		expect(result.status).toBe(0);
		const summary = JSON.parse(result.stdout) as {
			runId: string;
			overallStatus: string;
			freshVsResumed: string;
		};
		expect(summary.overallStatus).toBe("passed");
		expect(summary.freshVsResumed).toBe("resume");

		const runDir = join(repoRoot, ".harness/runs", summary.runId);
		const runJson = JSON.parse(
			readFileSync(join(runDir, "run.json"), "utf-8"),
		) as {
			sourceRunId: string | null;
			resumeFromGateId: string | null;
		};
		expect(runJson.sourceRunId).toBe("run-older-compatible");
		expect(runJson.resumeFromGateId).toBe("hook-governance-inventory");

		const preflightGate = JSON.parse(
			readFileSync(join(runDir, "gates/preflight.json"), "utf-8"),
		) as { reused?: boolean; sourceRunId?: string };
		const ciCheckGate = JSON.parse(
			readFileSync(join(runDir, "gates/ci-check-alignment.json"), "utf-8"),
		) as { reused?: boolean; sourceRunId?: string };
		expect(preflightGate.reused).toBe(true);
		expect(preflightGate.sourceRunId).toBe("run-older-compatible");
		expect(ciCheckGate.reused).toBe(true);
		expect(ciCheckGate.sourceRunId).toBe("run-older-compatible");
	});

	it("blocks resume when required prior gate in source run is not passed", () => {
		scaffoldVerifyWorkScriptRepo({
			repoRoot,
			manifest: {
				activeProvider: "github-actions",
				requiredChecks: [
					{ sourceAppSlug: "github-actions", githubCheckName: "ci / test" },
				],
			},
		});
		writePriorRun({
			repoRoot,
			runId: "run-compatible-failing-prior",
			lane: { fastMode: true, changedOnly: true, strictMode: false },
			gates: {
				preflight: { status: "passed" },
				"ci-check-alignment": { status: "failed" },
			},
		});

		const result = runVerifyWorkScript(repoRoot, [
			"--resume-from",
			"hook-governance-inventory",
		]);
		expect(result.status).toBe(1);
		expect(`${result.stdout}${result.stderr}`).toContain(
			"resume blocked: gate 'ci-check-alignment' is not passed in source run",
		);
	});

	it("returns usage error when --resume-from references an unknown gate id", () => {
		scaffoldVerifyWorkScriptRepo({
			repoRoot,
			manifest: {
				activeProvider: "github-actions",
				requiredChecks: [
					{ sourceAppSlug: "github-actions", githubCheckName: "ci / test" },
				],
			},
		});

		const result = runVerifyWorkScript(repoRoot, [
			"--resume-from",
			"not-a-real-gate",
		]);
		expect(result.status).toBe(2);
		expect(`${result.stdout}${result.stderr}`).toContain(
			"unknown gate id for --resume-from: not-a-real-gate",
		);
	});

	it("fails resume when only incompatible prior runs exist", () => {
		scaffoldVerifyWorkScriptRepo({
			repoRoot,
			manifest: {
				activeProvider: "github-actions",
				requiredChecks: [
					{ sourceAppSlug: "github-actions", githubCheckName: "ci / test" },
				],
			},
		});
		writePriorRun({
			repoRoot,
			runId: "run-only-provider-mismatch",
			providerClass: "circleci",
			lane: { fastMode: true, changedOnly: true, strictMode: false },
			gates: {
				preflight: { status: "passed" },
				"ci-check-alignment": { status: "passed" },
			},
		});

		const result = runVerifyWorkScript(repoRoot, [
			"--resume-from",
			"hook-governance-inventory",
		]);
		expect(result.status).toBe(1);
		expect(`${result.stdout}${result.stderr}`).toContain(
			"no compatible prior run found for resume (contract/provider/root/fingerprint must match)",
		);
	});

	it("fails resume when prior run schemaVersion differs", () => {
		scaffoldVerifyWorkScriptRepo({
			repoRoot,
			manifest: {
				activeProvider: "github-actions",
				requiredChecks: [
					{ sourceAppSlug: "github-actions", githubCheckName: "ci / test" },
				],
			},
		});
		writePriorRun({
			repoRoot,
			runId: "run-schema-version-mismatch",
			schemaVersion: "2",
			lane: { fastMode: true, changedOnly: true, strictMode: false },
			gates: {
				preflight: { status: "passed" },
				"ci-check-alignment": { status: "passed" },
			},
		});

		const result = runVerifyWorkScript(repoRoot, [
			"--resume-from",
			"hook-governance-inventory",
		]);
		expect(result.status).toBe(1);
		expect(`${result.stdout}${result.stderr}`).toContain(
			"no compatible prior run found for resume (contract/provider/root/fingerprint must match)",
		);
	});

	it("fails resume when prior run contractVersion differs", () => {
		scaffoldVerifyWorkScriptRepo({
			repoRoot,
			manifest: {
				activeProvider: "github-actions",
				requiredChecks: [
					{ sourceAppSlug: "github-actions", githubCheckName: "ci / test" },
				],
			},
		});
		writePriorRun({
			repoRoot,
			runId: "run-contract-version-mismatch",
			contractVersion: "2",
			lane: { fastMode: true, changedOnly: true, strictMode: false },
			gates: {
				preflight: { status: "passed" },
				"ci-check-alignment": { status: "passed" },
			},
		});

		const result = runVerifyWorkScript(repoRoot, [
			"--resume-from",
			"hook-governance-inventory",
		]);
		expect(result.status).toBe(1);
		expect(`${result.stdout}${result.stderr}`).toContain(
			"no compatible prior run found for resume (contract/provider/root/fingerprint must match)",
		);
	});

	it("fails resume when prior run contract fingerprint differs", () => {
		scaffoldVerifyWorkScriptRepo({
			repoRoot,
			manifest: {
				activeProvider: "github-actions",
				requiredChecks: [
					{ sourceAppSlug: "github-actions", githubCheckName: "ci / test" },
				],
			},
		});
		writePriorRun({
			repoRoot,
			runId: "run-fingerprint-mismatch",
			contractFingerprint: "not-the-current-fingerprint",
			lane: { fastMode: true, changedOnly: true, strictMode: false },
			gates: {
				preflight: { status: "passed" },
				"ci-check-alignment": { status: "passed" },
			},
		});

		const result = runVerifyWorkScript(repoRoot, [
			"--resume-from",
			"hook-governance-inventory",
		]);
		expect(result.status).toBe(1);
		expect(`${result.stdout}${result.stderr}`).toContain(
			"no compatible prior run found for resume (contract/provider/root/fingerprint must match)",
		);
	});

	it("allows resume from legacy runs that do not have contract fingerprint metadata", () => {
		scaffoldVerifyWorkScriptRepo({
			repoRoot,
			manifest: {
				activeProvider: "github-actions",
				requiredChecks: [
					{ sourceAppSlug: "github-actions", githubCheckName: "ci / test" },
				],
			},
		});
		writePriorRun({
			repoRoot,
			runId: "run-legacy-no-fingerprint",
			omitContractFingerprint: true,
			lane: { fastMode: true, changedOnly: true, strictMode: false },
			gates: {
				preflight: { status: "passed" },
				"ci-check-alignment": { status: "passed" },
			},
		});

		const result = runVerifyWorkScript(repoRoot, [
			"--resume-from",
			"hook-governance-inventory",
		]);
		expect(result.status).toBe(0);
		const summary = JSON.parse(result.stdout) as { runId: string };
		const runJson = JSON.parse(
			readFileSync(
				join(repoRoot, ".harness/runs", summary.runId, "run.json"),
				"utf-8",
			),
		) as { sourceRunId: string | null };
		expect(runJson.sourceRunId).toBe("run-legacy-no-fingerprint");
	});

	it("blocks legacy resume without fingerprint metadata when current contract fingerprint is available", () => {
		scaffoldVerifyWorkScriptRepo({
			repoRoot,
			manifest: {
				activeProvider: "github-actions",
				requiredChecks: [
					{ sourceAppSlug: "github-actions", githubCheckName: "ci / test" },
				],
			},
		});
		writePriorRun({
			repoRoot,
			runId: "run-legacy-no-fingerprint",
			omitContractFingerprint: true,
			lane: { fastMode: true, changedOnly: true, strictMode: false },
			gates: {
				preflight: { status: "passed" },
				"ci-check-alignment": { status: "passed" },
			},
		});
		writeFileSync(
			join(repoRoot, "harness.contract.json"),
			JSON.stringify({ version: "1.0", marker: "current" }),
			"utf-8",
		);

		const result = runVerifyWorkScript(repoRoot, [
			"--resume-from",
			"hook-governance-inventory",
		]);
		expect(result.status).toBe(1);
		expect(`${result.stdout}${result.stderr}`).toContain(
			"no compatible prior run found for resume (contract/provider/root/fingerprint must match)",
		);
	});

	it("blocks resume when contract file hash changes between runs", () => {
		scaffoldVerifyWorkScriptRepo({
			repoRoot,
			manifest: {
				activeProvider: "github-actions",
				requiredChecks: [
					{ sourceAppSlug: "github-actions", githubCheckName: "ci / test" },
				],
			},
		});
		writeFileSync(
			join(repoRoot, "harness.contract.json"),
			JSON.stringify({ version: "1.0", marker: "before" }),
			"utf-8",
		);

		const firstRun = runVerifyWorkScript(repoRoot);
		expect(firstRun.status).toBe(0);

		writeFileSync(
			join(repoRoot, "harness.contract.json"),
			JSON.stringify({ version: "1.0", marker: "after" }),
			"utf-8",
		);

		const resumeRun = runVerifyWorkScript(repoRoot, [
			"--resume-from",
			"hook-governance-inventory",
		]);
		expect(resumeRun.status).toBe(1);
		expect(`${resumeRun.stdout}${resumeRun.stderr}`).toContain(
			"no compatible prior run found for resume (contract/provider/root/fingerprint must match)",
		);
	});

	it("chooses earliest failed read_only_parallel gate and prints resume hint", () => {
		scaffoldVerifyWorkScriptRepo({
			repoRoot,
			manifest: {
				activeProvider: "github-actions",
				requiredChecks: [{ sourceAppSlug: "github-actions" }],
			},
		});
		writeExecutable(
			join(repoRoot, "scripts/validate-codestyle.sh"),
			`#!/usr/bin/env bash
set -euo pipefail
echo "non transient validation failure" >&2
exit 1
`,
		);
		const result = runVerifyWorkScript(repoRoot, [], { json: false });
		const combinedOutput = `${result.stdout}${result.stderr}`;

		expect(result.status).toBe(1);
		expect(combinedOutput).toContain("status: fail (gate: ci-check-alignment)");
		expect(combinedOutput).toContain(
			"to resume: bash scripts/verify-work.sh --resume-from ci-check-alignment --fast --changed-only",
		);

		const latestRunDir = readLatestRunDir(repoRoot);
		const summary = JSON.parse(
			readFileSync(join(latestRunDir, "summary.json"), "utf-8"),
		) as { failedGateId: string | null };
		expect(summary.failedGateId).toBe("ci-check-alignment");
	});

	it("returns usage error when --repo-root is missing its value", () => {
		scaffoldVerifyWorkScriptRepo({
			repoRoot,
			manifest: {
				activeProvider: "github-actions",
				requiredChecks: [
					{ sourceAppSlug: "github-actions", githubCheckName: "ci / test" },
				],
			},
		});

		const result = spawnSync(
			"bash",
			[join(repoRoot, "scripts/verify-work.sh"), "--repo-root", "--json"],
			{
				cwd: repoRoot,
				encoding: "utf-8",
				env: {
					...process.env,
					HARNESS_VERIFY_WORK_NO_DELEGATE: "1",
				},
			},
		);
		expect(result.status).toBe(2);
		expect(`${result.stdout}${result.stderr}`).toContain(
			"--repo-root requires a path",
		);
	});

	it("retries validate-codestyle-fast once on transient failure and succeeds", () => {
		scaffoldVerifyWorkScriptRepo({
			repoRoot,
			manifest: {
				activeProvider: "github-actions",
				requiredChecks: [
					{ sourceAppSlug: "github-actions", githubCheckName: "ci / test" },
				],
			},
		});
		const attemptFile = join(repoRoot, ".harness/validate-attempt.txt");
		writeExecutable(
			join(repoRoot, "scripts/validate-codestyle.sh"),
			`#!/usr/bin/env bash
set -euo pipefail
attempt_file="${attemptFile}"
if [[ ! -f "$attempt_file" ]]; then
  echo 1 > "$attempt_file"
  echo "timeout while contacting registry" >&2
  exit 1
fi
echo 2 > "$attempt_file"
exit 0
`,
		);

		const result = runVerifyWorkScript(repoRoot);
		expect(result.status).toBe(0);
		const expectedRetryAttempts = process.env.CI ? 4 : 3;
		const expectedRetryDelay = process.env.CI ? "3s" : "1s";
		expect(`${result.stdout}${result.stderr}`).toContain(
			`transient failure on attempt 1/${expectedRetryAttempts}; retrying in ${expectedRetryDelay}`,
		);

		const summary = JSON.parse(result.stdout) as { runId: string };
		const gate = JSON.parse(
			readFileSync(
				join(
					repoRoot,
					".harness/runs",
					summary.runId,
					"gates/validate-codestyle-fast.json",
				),
				"utf-8",
			),
		) as { attempt: number; status: string };
		expect(gate.attempt).toBe(2);
		expect(gate.status).toBe("passed");
	});

	it("writes contract_policy failure taxonomy for ci-check-alignment gate artifacts", () => {
		scaffoldVerifyWorkScriptRepo({
			repoRoot,
			manifest: {},
		});

		const result = runVerifyWorkScript(repoRoot);
		expect(result.status).toBe(1);

		const summary = JSON.parse(result.stdout) as { runId: string };
		const gate = JSON.parse(
			readFileSync(
				join(
					repoRoot,
					".harness/runs",
					summary.runId,
					"gates/ci-check-alignment.json",
				),
				"utf-8",
			),
		) as { status: string; failureClass: string; nextAction: string };

		expect(gate.status).toBe("failed");
		expect(gate.failureClass).toBe("contract_policy");
		expect(gate.nextAction).toBe(
			"fix contract/policy mismatch, then rerun from this gate",
		);
	});

	it("writes transient_infra failure taxonomy when retry budget is exhausted", () => {
		scaffoldVerifyWorkScriptRepo({
			repoRoot,
			manifest: {
				activeProvider: "github-actions",
				requiredChecks: [
					{ sourceAppSlug: "github-actions", githubCheckName: "ci / test" },
				],
			},
		});
		writeExecutable(
			join(repoRoot, "scripts/validate-codestyle.sh"),
			`#!/usr/bin/env bash
set -euo pipefail
echo "timeout while contacting registry" >&2
exit 1
`,
		);

		const result = runVerifyWorkScript(repoRoot);
		expect(result.status).toBe(1);

		const summary = JSON.parse(result.stdout) as { runId: string };
		const gate = JSON.parse(
			readFileSync(
				join(
					repoRoot,
					".harness/runs",
					summary.runId,
					"gates/validate-codestyle-fast.json",
				),
				"utf-8",
			),
		) as {
			attempt: number;
			status: string;
			failureClass: string;
			nextAction: string;
		};

		const expectedRetryAttempts = process.env.CI ? 4 : 3;
		expect(gate.attempt).toBe(expectedRetryAttempts);
		expect(gate.status).toBe("failed");
		expect(gate.failureClass).toBe("transient_infra");
		expect(gate.nextAction).toBe(
			"retry budget exhausted; fix infrastructure blocker and resume",
		);
	});

	it("writes internal_unknown failure taxonomy for non-transient codestyle failures", () => {
		scaffoldVerifyWorkScriptRepo({
			repoRoot,
			manifest: {
				activeProvider: "github-actions",
				requiredChecks: [
					{ sourceAppSlug: "github-actions", githubCheckName: "ci / test" },
				],
			},
		});
		writeExecutable(
			join(repoRoot, "scripts/validate-codestyle.sh"),
			`#!/usr/bin/env bash
set -euo pipefail
echo "formatting mismatch" >&2
exit 1
`,
		);

		const result = runVerifyWorkScript(repoRoot);
		expect(result.status).toBe(1);

		const summary = JSON.parse(result.stdout) as { runId: string };
		const gate = JSON.parse(
			readFileSync(
				join(
					repoRoot,
					".harness/runs",
					summary.runId,
					"gates/validate-codestyle-fast.json",
				),
				"utf-8",
			),
		) as { status: string; failureClass: string; nextAction: string };

		expect(gate.status).toBe("failed");
		expect(gate.failureClass).toBe("internal_unknown");
		expect(gate.nextAction).toBe(
			"inspect gate output, fix root cause, and rerun",
		);
	});
});

import {
	chmodSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
		const resumeFromFlagIndex = args.indexOf("--resume-from");
		expect(resumeFromFlagIndex).toBeGreaterThanOrEqual(0);
		expect(args[resumeFromFlagIndex + 1]).toBe("validate-codestyle-fast");
		const repoRootFlagIndex = args.indexOf("--repo-root");
		expect(repoRootFlagIndex).toBeGreaterThanOrEqual(0);
		expect(args[repoRootFlagIndex + 1]).toBe(repoRoot);
	});

	it("returns USAGE_ERROR when --all and --changed-only are both set", () => {
		const exitCode = runVerifyWorkCLI({
			repoRoot,
			all: true,
			changedOnly: true,
		});
		expect(exitCode).toBe(EXIT_CODES.USAGE_ERROR);
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

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
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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
		expect(readFileSync(argsLogPath, "utf-8")).toContain("--changed-only");
		expect(readFileSync(argsLogPath, "utf-8")).toContain("--fast");
		expect(readFileSync(argsLogPath, "utf-8")).toContain("--strict");
		expect(readFileSync(argsLogPath, "utf-8")).toContain(
			"--resume-from\nvalidate-codestyle-fast",
		);
		expect(readFileSync(argsLogPath, "utf-8")).toContain("--json");
		expect(readFileSync(argsLogPath, "utf-8")).toContain("--repo-root");
	});
});

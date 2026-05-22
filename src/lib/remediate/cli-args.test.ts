import { describe, expect, it, vi } from "vitest";
import { buildRemediateOptionsFromCliArgs } from "./cli-args.js";

describe("buildRemediateOptionsFromCliArgs", () => {
	it("returns a usage error when the remediate subcommand is missing", () => {
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		const result = buildRemediateOptionsFromCliArgs([]);

		expect(result).toEqual({ ok: false, exitCode: 2 });
		expect(errorSpy).toHaveBeenCalledWith(
			"Error: remediate command requires subcommand `run` or `apply`",
		);
		errorSpy.mockRestore();
	});

	it("projects run flags into typed remediate options", () => {
		const result = buildRemediateOptionsFromCliArgs([
			"run",
			"--owner",
			"jscraik",
			"--repo",
			"coding-harness",
			"--pr",
			"270",
			"--provider",
			"codex",
			"--findings",
			"findings.json",
			"--head-sha",
			"abc123",
			"--mode",
			"manual",
			"--max-auto-tier",
			"medium",
			"--contract",
			"harness.contract.json",
			"--completion-marker",
			".harness/complete",
			"--dry-run",
			"--no-input",
			"--force",
			"--json",
		]);

		expect(result).toEqual({
			ok: true,
			options: {
				subcommand: "run",
				owner: "jscraik",
				repo: "coding-harness",
				prNumber: 270,
				headSha: "abc123",
				provider: "codex",
				dryRun: true,
				noInput: true,
				force: true,
				json: true,
				contractPath: "harness.contract.json",
				findings: "findings.json",
				mode: "manual",
				completionMarkerPath: ".harness/complete",
				maxAutoTier: "medium",
			},
		});
	});

	it("returns a usage error when --pr is missing or invalid", () => {
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		const missingResult = buildRemediateOptionsFromCliArgs(["run"]);
		const invalidResult = buildRemediateOptionsFromCliArgs([
			"run",
			"--pr",
			"abc",
		]);

		expect(missingResult).toEqual({ ok: false, exitCode: 2 });
		expect(invalidResult).toEqual({ ok: false, exitCode: 2 });
		expect(errorSpy).toHaveBeenCalledWith(
			"Error: --pr must be a positive integer",
		);
		errorSpy.mockRestore();
	});

	it("returns a usage error when --provider is unsupported", () => {
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		const result = buildRemediateOptionsFromCliArgs([
			"run",
			"--pr",
			"270",
			"--provider",
			"semgrep",
		]);

		expect(result).toEqual({ ok: false, exitCode: 2 });
		expect(errorSpy).toHaveBeenCalledWith(
			"Error: --provider must be one of: codeql, codex",
		);
		errorSpy.mockRestore();
	});
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { buildVerifyWorkOptionsFromCliArgs } from "./cli-args.js";
import { EXIT_CODES } from "./types.js";

describe("buildVerifyWorkOptionsFromCliArgs", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("projects raw verify-work flags into the typed command contract", () => {
		expect(
			buildVerifyWorkOptionsFromCliArgs([
				"--all",
				"--strict",
				"--fast",
				"--project-governance",
				"--resume-from",
				"ci-check-alignment",
				"--repo-root",
				"/tmp/repo",
				"--json",
			]),
		).toEqual({
			all: true,
			changedOnly: false,
			strict: true,
			fast: true,
			projectGovernance: true,
			workspaceGovernance: false,
			json: true,
			resumeFrom: "ci-check-alignment",
			repoRoot: "/tmp/repo",
		});
	});

	it("rejects missing value flags before wrapper execution", () => {
		const errorSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);

		expect(buildVerifyWorkOptionsFromCliArgs(["--resume-from"])).toBe(
			EXIT_CODES.USAGE_ERROR,
		);
		expect(buildVerifyWorkOptionsFromCliArgs(["--repo-root"])).toBe(
			EXIT_CODES.USAGE_ERROR,
		);
		expect(errorSpy).toHaveBeenCalledWith(
			"Error: --resume-from requires a gate id",
		);
		expect(errorSpy).toHaveBeenCalledWith("Error: --repo-root requires a path");
	});

	it("rejects unknown resume gates and conflicting governance scopes", () => {
		const errorSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);

		expect(
			buildVerifyWorkOptionsFromCliArgs(["--resume-from", "missing-gate"]),
		).toBe(EXIT_CODES.USAGE_ERROR);
		expect(
			buildVerifyWorkOptionsFromCliArgs([
				"--project-governance",
				"--workspace-governance",
			]),
		).toBe(EXIT_CODES.USAGE_ERROR);
		expect(errorSpy).toHaveBeenCalledWith(
			"[verify-work] unknown gate id for --resume-from: missing-gate",
		);
		expect(errorSpy).toHaveBeenCalledWith(
			"Error: --project-governance and --workspace-governance are mutually exclusive",
		);
	});
});

import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("validate-prompt-context-drift script", () => {
	it("validates the checked-in example through the public script wrapper", () => {
		const result = spawnSync(
			process.execPath,
			[
				"scripts/validate-prompt-context-drift.cjs",
				"contracts/examples/prompt-context-drift-report.example.json",
				"--repo-root",
				".",
			],
			{ encoding: "utf8" },
		);
		const output = JSON.parse(result.stdout) as {
			schemaVersion: string;
			status: string;
			errors: string[];
		};

		expect(result.status).toBe(0);
		expect(output).toEqual({
			schemaVersion: "prompt-context-drift-validation/v1",
			status: "pass",
			errors: [],
		});
	});

	it("returns structured usage JSON when --repo-root has no value", () => {
		const result = spawnSync(
			process.execPath,
			[
				"scripts/validate-prompt-context-drift.cjs",
				"contracts/examples/prompt-context-drift-report.example.json",
				"--repo-root",
			],
			{ encoding: "utf8" },
		);
		const output = JSON.parse(result.stdout) as {
			schemaVersion: string;
			status: string;
			errors: string[];
		};

		expect(result.status).toBe(2);
		expect(output).toEqual({
			schemaVersion: "prompt-context-drift-validation/v1",
			status: "fail",
			errors: ["--repo-root: requires a value"],
		});
	});

	it("returns structured usage JSON for extra positional arguments", () => {
		const result = spawnSync(
			process.execPath,
			[
				"scripts/validate-prompt-context-drift.cjs",
				"contracts/examples/prompt-context-drift-report.example.json",
				"unexpected.json",
			],
			{ encoding: "utf8" },
		);
		const output = JSON.parse(result.stdout) as {
			schemaVersion: string;
			status: string;
			errors: string[];
		};

		expect(result.status).toBe(2);
		expect(output).toEqual({
			schemaVersion: "prompt-context-drift-validation/v1",
			status: "fail",
			errors: ["unexpected.json: unexpected positional argument"],
		});
	});
});

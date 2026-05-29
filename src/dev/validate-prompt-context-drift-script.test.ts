import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

	it("keeps child runtime failures inside the structured JSON envelope", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "prompt-context-drift-script-"));
		const invalidReportPath = join(tempDir, "invalid-report.json");
		writeFileSync(invalidReportPath, "{not-json", "utf8");

		const result = spawnSync(
			process.execPath,
			[
				"scripts/validate-prompt-context-drift.cjs",
				invalidReportPath,
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

		expect(result.status).toBe(1);
		expect(result.stderr).toBe("");
		expect(output.schemaVersion).toBe("prompt-context-drift-validation/v1");
		expect(output.status).toBe("fail");
		expect(output.errors).toEqual([
			expect.stringContaining("runtime failure:"),
		]);
	});
});

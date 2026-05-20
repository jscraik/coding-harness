import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadPrCloseoutEnvFile } from "./env.js";

describe("loadPrCloseoutEnvFile", () => {
	it("loads uppercase credential values and records usable evidence", () => {
		const dir = mkdtempSync(join(tmpdir(), "pr-closeout-env-"));
		const envPath = join(dir, ".env");
		writeFileSync(
			envPath,
			[
				"# local credentials",
				"GITHUB_PERSONAL_ACCESS_TOKEN=github-token",
				'LINEAR_API_KEY="linear-token"',
				"lowercase_ignored=nope",
				"EMPTY_IGNORED=",
			].join("\n"),
		);

		const result = loadPrCloseoutEnvFile(envPath);

		expect(result.env.GITHUB_PERSONAL_ACCESS_TOKEN).toBe("github-token");
		expect(result.env.LINEAR_API_KEY).toBe("linear-token");
		expect(result.env.lowercase_ignored).toBeUndefined();
		expect(result.env.EMPTY_IGNORED).toBeUndefined();
		expect(result.tool).toMatchObject({
			name: "codex_env",
			available: true,
			ref: `env:${envPath}`,
			status: "usable",
			failureClass: null,
		});
	});

	it("records missing env files as non-fatal evidence", () => {
		const dir = mkdtempSync(join(tmpdir(), "pr-closeout-env-"));
		const envPath = join(dir, "missing.env");

		const result = loadPrCloseoutEnvFile(envPath);

		expect(result.tool).toMatchObject({
			name: "codex_env",
			available: true,
			ref: `env:${envPath}`,
			status: "missing",
			failureClass: "env_file_missing",
		});
	});

	it("blocks directory env paths with a named failure class", () => {
		const dir = mkdtempSync(join(tmpdir(), "pr-closeout-env-"));
		const envPath = join(dir, "env-dir");
		mkdirSync(envPath);

		const result = loadPrCloseoutEnvFile(envPath);

		expect(result.tool).toMatchObject({
			name: "codex_env",
			available: true,
			ref: `env:${envPath}`,
			status: "blocked",
			failureClass: "env_file_not_regular",
		});
	});
});

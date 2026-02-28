import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runPreflightGate } from "./validator.js";

describe("runPreflightGate", () => {
	let tempDir: string;
	let originalCwd: string;

	beforeEach(() => {
		originalCwd = process.cwd();
		tempDir = join(
			tmpdir(),
			`harness-preflight-validator-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
		);
		mkdirSync(tempDir, { recursive: true });
		process.chdir(tempDir);
		mkdirSync(".git", { recursive: true });
	});

	afterEach(() => {
		process.chdir(originalCwd);
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("uses default harness.contract.json when contractPath is omitted", async () => {
		writeFileSync(
			"harness.contract.json",
			JSON.stringify({
				version: "1.0",
				riskTierRules: {
					"src/auth/**": "high",
				},
			}),
		);
		mkdirSync("src/auth", { recursive: true });
		writeFileSync("src/auth/login.ts", "export const login = true;\n");

		const result = await runPreflightGate({
			files: ["src/auth/login.ts"],
		});
		const riskTierCheck = result.checks.find(
			(check) => check.id === "risk-tier",
		);

		expect(riskTierCheck?.passed).toBe(true);
		expect(riskTierCheck?.message).toBe("Current tier: high");
		expect(result.riskTier).toBe("high");
	});

	it("skips risk-tier when no default contract exists", async () => {
		mkdirSync("src/auth", { recursive: true });
		writeFileSync("src/auth/login.ts", "export const login = true;\n");

		const result = await runPreflightGate({
			files: ["src/auth/login.ts"],
		});
		const riskTierCheck = result.checks.find(
			(check) => check.id === "risk-tier",
		);

		expect(riskTierCheck?.passed).toBe(true);
		expect(riskTierCheck?.message).toBe(
			"Skipped: no contract or files provided",
		);
		expect(result.riskTier).toBeUndefined();
	});
});

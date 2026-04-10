import { chmodSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runPreflightGate } from "./validator.js";

describe("runPreflightGate", () => {
	let tempDir: string;
	let originalCwd: string;
	const originalPath = process.env.PATH ?? "";
	const cleanupPaths: string[] = [];

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
		for (const path of cleanupPaths.splice(0, cleanupPaths.length)) {
			rmSync(path, { recursive: true, force: true });
		}
		process.env.PATH = originalPath;
	});

	function writeExecutable(path: string, content: string): void {
		writeFileSync(path, content, { encoding: "utf-8" });
		chmodSync(path, 0o755);
	}

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

	it("fails closed when contract exists but is invalid", async () => {
		writeFileSync("harness.contract.json", "{invalid-json");
		mkdirSync("src/auth", { recursive: true });
		writeFileSync("src/auth/login.ts", "export const login = true;\n");

		const result = await runPreflightGate({
			files: ["src/auth/login.ts"],
		});
		const contractLoadCheck = result.checks.find(
			(check) => check.id === "contract-load",
		);

		expect(result.passed).toBe(false);
		expect(contractLoadCheck?.passed).toBe(false);
		expect(contractLoadCheck?.message).toContain("Invalid contract:");
		expect(result.riskTier).toBeUndefined();
	});

	it("skips risk-tier when files option is omitted", async () => {
		writeFileSync(
			"harness.contract.json",
			JSON.stringify({
				version: "1.0",
				riskTierRules: {
					"src/auth/**": "high",
				},
			}),
		);

		const result = await runPreflightGate({
			maxTier: "low",
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

	it("short-circuits native checks when pre hook skip-all-checks is enabled", async () => {
		writeFileSync(
			"harness.contract.json",
			JSON.stringify({
				version: "1.0",
				gateExtensions: {
					preflightGate: {
						pre: [{ id: "skip-all-checks" }],
					},
				},
			}),
		);
		mkdirSync("src/auth", { recursive: true });
		writeFileSync("src/auth/login.ts", "export const login = true;\n");

		const result = await runPreflightGate({
			files: ["src/auth/login.ts"],
		});

		expect(result.passed).toBe(true);
		expect(result.checks.some((check) => check.id === "risk-tier")).toBe(false);
		expect(
			result.checks.some((check) => check.id === "hook:pre:skip-all-checks"),
		).toBe(true);
		expect(result.hookDecisions?.[0]?.action).toBe("short-circuit");
	});

	it("applies pre hooks when files option is omitted", async () => {
		writeFileSync(
			"harness.contract.json",
			JSON.stringify({
				version: "1.0",
				gateExtensions: {
					preflightGate: {
						pre: [{ id: "force-fail" }],
					},
				},
			}),
		);

		const result = await runPreflightGate({});
		const hookCheck = result.checks.find(
			(check) => check.id === "hook:pre:force-fail",
		);

		expect(result.passed).toBe(false);
		expect(hookCheck?.passed).toBe(false);
		expect(result.hookDecisions?.[0]?.action).toBe("override");
	});

	it("blocks successful runs when post hook fail-on-warnings sees warning findings", async () => {
		writeFileSync(
			"harness.contract.json",
			JSON.stringify({
				version: "1.0",
				gateExtensions: {
					preflightGate: {
						post: [{ id: "fail-on-warnings" }],
					},
				},
			}),
		);
		mkdirSync("src", { recursive: true });
		writeFileSync("src/debug.ts", "console.log('debug');\n");

		const result = await runPreflightGate({
			files: ["src/debug.ts"],
		});
		const hookCheck = result.checks.find(
			(check) => check.id === "hook:post:fail-on-warnings",
		);

		expect(result.passed).toBe(false);
		expect(hookCheck?.passed).toBe(false);
		expect(
			result.hookDecisions?.some((decision) => decision.action === "block"),
		).toBe(true);
	});

	it("fails when global and repo-local harness versions drift", async () => {
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
		mkdirSync("scripts", { recursive: true });
		writeExecutable(
			"scripts/harness-cli.sh",
			"#!/usr/bin/env bash\necho 'harness v0.12.0'\n",
		);

		const fakeBinDir = join(
			tmpdir(),
			`harness-preflight-bin-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
		);
		mkdirSync(fakeBinDir, { recursive: true });
		cleanupPaths.push(fakeBinDir);
		writeExecutable(
			join(fakeBinDir, "harness"),
			"#!/usr/bin/env bash\necho 'harness v0.6.0'\n",
		);
		process.env.PATH = `${fakeBinDir}${delimiter}${originalPath}`;

		const result = await runPreflightGate({
			files: ["src/auth/login.ts"],
		});
		const coherenceCheck = result.checks.find(
			(check) => check.id === "harness-version-coherence",
		);

		expect(coherenceCheck?.passed).toBe(false);
		expect(coherenceCheck?.severity).toBe("error");
		expect(coherenceCheck?.message).toContain("Version drift detected");
		expect(result.passed).toBe(false);
	});

	it("passes harness-version-coherence when no repo-local runner found (skip)", async () => {
		// No scripts/harness-cli.sh in cwd — coherence returns skip → passed=true
		writeFileSync("harness.contract.json", JSON.stringify({ version: "1.0" }));

		const result = await runPreflightGate({ files: [] });
		const coherenceCheck = result.checks.find(
			(check) => check.id === "harness-version-coherence",
		);

		expect(coherenceCheck).toBeDefined();
		expect(coherenceCheck?.passed).toBe(true);
	});

	it("fails with warning severity when repo-local runner outputs unparseable version", async () => {
		writeFileSync("harness.contract.json", JSON.stringify({ version: "1.0" }));
		mkdirSync("scripts", { recursive: true });
		writeExecutable(
			"scripts/harness-cli.sh",
			"#!/usr/bin/env bash\necho 'not-a-version'\n",
		);

		const result = await runPreflightGate({ files: [] });
		const coherenceCheck = result.checks.find(
			(check) => check.id === "harness-version-coherence",
		);

		expect(coherenceCheck?.passed).toBe(false);
		expect(coherenceCheck?.severity).toBe("warning");
		expect(coherenceCheck?.message).toContain("Could not parse");
	});

	it("harness-version-coherence check is registered in PREFLIGHT_CHECKS", async () => {
		const { PREFLIGHT_CHECKS } = await import("./validator.js");
		expect(PREFLIGHT_CHECKS).toHaveProperty("harness-version-coherence");
		const entry = PREFLIGHT_CHECKS["harness-version-coherence"];
		expect(entry?.name).toBe("Harness Version Coherence");
		expect(entry?.severity).toBe("error");
		expect(typeof entry?.fn).toBe("function");
	});

	it("harness-version-coherence check can be skipped via options.skip", async () => {
		writeFileSync("harness.contract.json", JSON.stringify({ version: "1.0" }));
		mkdirSync("scripts", { recursive: true });
		writeExecutable(
			"scripts/harness-cli.sh",
			"#!/usr/bin/env bash\necho 'not-a-version'\n",
		);

		const result = await runPreflightGate({
			files: [],
			skip: ["harness-version-coherence"],
		});
		const coherenceCheck = result.checks.find(
			(check) => check.id === "harness-version-coherence",
		);

		expect(coherenceCheck).toBeUndefined();
	});
});

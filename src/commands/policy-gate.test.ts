import {
	type MockInstance,
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { expectBehavior } from "../lib/testing/expect-behavior.js";
import { EXIT_CODES, runPolicyGate, runPolicyGateCLI } from "./policy-gate.js";

describe("runPolicyGate", () => {
	const contractPath = "test-fixtures/contract.json";
	const contractWithExtendsPath = "test-fixtures/contract-with-extends.json";

	describe("with max-tier", () => {
		it("passes when tier equals max-tier", () => {
			const result = runPolicyGate({
				contractPath,
				files: ["src/lib/utils.ts"], // medium tier (default)
				maxTier: "medium",
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expectBehavior({
					given: "a medium-risk file with max-tier set to medium",
					should: "pass without blocking the policy gate",
					actual: result.output.passed,
					expected: true,
				});
				expect(result.output.tier).toBe("medium");
				expect(result.output.action).toBe("warn");
				expect(result.output.verdict).toBe("pass");
			}
		});

		it("passes when tier is lower than max-tier", () => {
			const result = runPolicyGate({
				contractPath,
				files: ["tests/utils.test.ts"], // low tier (matches **/*.test.ts)
				maxTier: "medium",
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.passed).toBe(true);
				expect(result.output.tier).toBe("low");
				expect(result.output.action).toBe("allow");
				expect(result.output.verdict).toBe("pass");
			}
		});

		it("fails when tier exceeds max-tier", () => {
			const result = runPolicyGate({
				contractPath,
				files: ["src/auth/login.ts"], // high tier
				maxTier: "medium",
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.passed).toBe(false);
				expect(result.output.tier).toBe("high");
				expect(result.output.action).toBe("block");
				expect(result.output.verdict).toBe("fail");
				expect(result.output.maxAllowed).toBe("medium");
				expect(result.output.violatingFiles).toContain("src/auth/login.ts");
			}
		});

		it("fails high-tier files when max-tier is high and the policy chain blocks high risk", () => {
			const result = runPolicyGate({
				contractPath,
				files: ["src/auth/login.ts"],
				maxTier: "high",
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.passed).toBe(false);
				expect(result.output.action).toBe("block");
				expect(result.output.verdict).toBe("fail");
				expect(result.output.maxAllowed).toBeUndefined();
				expect(result.output.violatingFiles).toContain("src/auth/login.ts");
			}
		});
	});

	describe("without max-tier", () => {
		it("fails omitted-policyChain high-tier files when no max-tier is specified because defaults block high risk", () => {
			const result = runPolicyGate({
				contractPath,
				files: ["src/auth/login.ts"], // high tier
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.passed).toBe(false);
				expect(result.output.tier).toBe("high");
				expect(result.output.action).toBe("block");
				expect(result.output.verdict).toBe("fail");
				expect(result.output.maxAllowed).toBeUndefined();
				expect(result.output.violatingFiles).toContain("src/auth/login.ts");
			}
		});
	});

	describe("empty file list", () => {
		it("passes with low tier when no files are provided", () => {
			const result = runPolicyGate({
				contractPath,
				files: [],
				maxTier: "low",
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.passed).toBe(true);
				expect(result.output.tier).toBe("low");
				expect(result.output.action).toBe("allow");
				expect(result.output.verdict).toBe("pass");
				expect(result.output.violatingFiles).toEqual([]);
			}
		});
	});

	describe("tier-threshold invariants", () => {
		it("keeps max-tier thresholds monotonic without overriding policy-chain blocks", () => {
			const corpus = [
				"src/auth/login.ts",
				"src/lib/cache.ts",
				"tests/policy.test.ts",
				"README.md",
			];

			for (let i = 0; i < corpus.length; i++) {
				const files = corpus.slice(0, i + 1);

				const low = runPolicyGate({ contractPath, files, maxTier: "low" });
				const medium = runPolicyGate({
					contractPath,
					files,
					maxTier: "medium",
				});
				const high = runPolicyGate({ contractPath, files, maxTier: "high" });

				expect(low.ok).toBe(true);
				expect(medium.ok).toBe(true);
				expect(high.ok).toBe(true);

				if (!low.ok || !medium.ok || !high.ok) {
					throw new Error("Expected successful policy gate result");
				}

				if (low.output.passed) {
					expect(medium.output.passed).toBe(true);
				}
				if (medium.output.passed) {
					expect(high.output.passed).toBe(true);
				}
				if (high.output.tier === "high") {
					expect(high.output.passed).toBe(false);
					expect(high.output.action).toBe("block");
					expect(high.output.verdict).toBe("fail");
				}
			}
		});
	});

	describe("validation", () => {
		it("rejects invalid max-tier value", () => {
			const result = runPolicyGate({
				contractPath,
				files: ["src/lib/utils.ts"],
				maxTier: "critical" as "high", // Invalid value
			});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("VALIDATION_ERROR");
				expect(result.error.message).toContain("Invalid max-tier");
			}
		});

		it("returns error for missing contract", () => {
			const result = runPolicyGate({
				contractPath: "nonexistent.json",
				files: ["src/lib/utils.ts"],
				maxTier: "medium",
			});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				// File not found throws system error (ENOENT)
				expect(result.error.code).toBe("SYSTEM_ERROR");
			}
		});

		it("fails closed when contract uses extends", () => {
			const result = runPolicyGate({
				contractPath: contractWithExtendsPath,
				files: ["src/lib/utils.ts"],
				maxTier: "medium",
			});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("VALIDATION_ERROR");
				expect(result.error.message).toContain("extends");
			}
		});

		it("rejects contracts that remap block actions to pass", () => {
			const result = runPolicyGate({
				contractPath: "test-fixtures/contract-block-pass.json",
				files: ["src/auth/login.ts"],
			});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("VALIDATION_ERROR");
				expect(JSON.stringify(result.error.details)).toContain("policyChain");
			}
		});
	});
});

describe("runPolicyGateCLI", () => {
	const contractPath = "test-fixtures/contract.json";

	it("returns SUCCESS (0) when gate passes", () => {
		const exitCode = runPolicyGateCLI({
			contractPath,
			files: ["src/lib/utils.ts"],
			maxTier: "medium",
			json: true,
		});
		expect(exitCode).toBe(EXIT_CODES.SUCCESS);
	});

	it("returns POLICY_VIOLATION (1) when gate fails", () => {
		const exitCode = runPolicyGateCLI({
			contractPath,
			files: ["src/auth/login.ts"],
			maxTier: "medium",
			json: true,
		});
		expect(exitCode).toBe(EXIT_CODES.POLICY_VIOLATION);
	});

	it("returns POLICY_VIOLATION (1) for high-risk policy-chain blocks without max-tier", () => {
		const exitCode = runPolicyGateCLI({
			contractPath,
			files: ["src/auth/login.ts"],
			json: true,
		});
		expect(exitCode).toBe(EXIT_CODES.POLICY_VIOLATION);
	});

	it("returns VALIDATION_ERROR (1) for invalid max-tier", () => {
		const exitCode = runPolicyGateCLI({
			contractPath,
			files: ["src/lib/utils.ts"],
			maxTier: "invalid" as "high",
			json: true,
		});
		expect(exitCode).toBe(EXIT_CODES.VALIDATION_ERROR);
	});
});

describe("runPolicyGateCLI (non-JSON output format from PR)", () => {
	const contractPath = "test-fixtures/contract.json";
	let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
	let stdoutSpy: MockInstance<typeof process.stdout.write>;

	beforeEach(() => {
		consoleInfoSpy = vi
			.spyOn(console, "info")
			.mockImplementation(() => undefined);
		consoleErrorSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		stdoutSpy = vi
			.spyOn(process.stdout, "write")
			.mockImplementation(() => true);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("human-readable pass output contains ✓ icon and status=pass", () => {
		runPolicyGateCLI({
			contractPath,
			files: ["src/lib/utils.ts"],
			maxTier: "medium",
			json: false,
		});

		const allCalls: string[] = consoleInfoSpy.mock.calls.map((c: unknown[]) =>
			String(c[0]),
		);
		expect(allCalls.some((line) => line.includes("✓"))).toBe(true);
		expect(allCalls.some((line) => line.includes("pass"))).toBe(true);
	});

	it("human-readable pass output prints Reason line", () => {
		runPolicyGateCLI({
			contractPath,
			files: ["src/lib/utils.ts"],
			maxTier: "medium",
			json: false,
		});

		const allCalls: string[] = consoleInfoSpy.mock.calls.map((c: unknown[]) =>
			String(c[0]),
		);
		expect(allCalls.some((line) => line.startsWith("Reason:"))).toBe(true);
	});

	it("human-readable fail output contains ✗ icon and status=fail", () => {
		runPolicyGateCLI({
			contractPath,
			files: ["src/auth/login.ts"],
			maxTier: "medium",
			json: false,
		});

		const allCalls: string[] = consoleInfoSpy.mock.calls.map((c: unknown[]) =>
			String(c[0]),
		);
		expect(allCalls.some((line) => line.includes("✗"))).toBe(true);
		expect(allCalls.some((line) => line.includes("fail"))).toBe(true);
	});

	it("human-readable fail output prints Action now section when there are actions", () => {
		runPolicyGateCLI({
			contractPath,
			files: ["src/auth/login.ts"],
			maxTier: "medium",
			json: false,
		});

		const allCalls: string[] = consoleInfoSpy.mock.calls.map((c: unknown[]) =>
			String(c[0]),
		);
		// Action now section appears because there are blocking findings
		expect(allCalls.some((line) => line.includes("Action"))).toBe(true);
	});

	it("json=true outputs valid JSON to stdout, not console.info", () => {
		runPolicyGateCLI({
			contractPath,
			files: ["src/lib/utils.ts"],
			maxTier: "medium",
			json: true,
		});

		expect(stdoutSpy).toHaveBeenCalled();
		const written = stdoutSpy.mock.calls[0]?.[0] as string;
		const parsed = JSON.parse(written) as Record<string, unknown>;
		expect(parsed.gate).toBe("policy-gate");
		expect(parsed.status).toBe("pass");
		expect(parsed).toHaveProperty("reason");
		expect(parsed).toHaveProperty("action_now");
		expect(parsed).toHaveProperty("action_later");
		expect(parsed).toHaveProperty("evidence_ref");
	});

	it("json=true fail output has findings with evidence_ref", () => {
		runPolicyGateCLI({
			contractPath,
			files: ["src/auth/login.ts"],
			maxTier: "medium",
			json: true,
		});

		const written = stdoutSpy.mock.calls[0]?.[0] as string;
		const parsed = JSON.parse(written) as Record<string, unknown>;
		expect(parsed.status).toBe("fail");
		expect(Array.isArray(parsed.findings)).toBe(true);
		expect((parsed.findings as unknown[]).length).toBeGreaterThan(0);
		expect(Array.isArray(parsed.evidence_ref)).toBe(true);
	});

	it("ok:false error path outputs reason to stderr in non-JSON mode", () => {
		runPolicyGateCLI({
			contractPath,
			files: ["src/lib/utils.ts"],
			maxTier: "invalid" as "high",
			json: false,
		});

		const errorCalls: string[] = consoleErrorSpy.mock.calls.map(
			(c: unknown[]) => String(c[0]),
		);
		// Error message goes to stderr, then Reason line also goes to stderr
		expect(errorCalls.some((line) => line.startsWith("Reason:"))).toBe(true);
	});
});

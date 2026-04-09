import { describe, expect, it } from "vitest";
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
				expect(result.output.passed).toBe(true);
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

		it("passes high-tier files when max-tier is high", () => {
			const result = runPolicyGate({
				contractPath,
				files: ["src/auth/login.ts"],
				maxTier: "high",
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.passed).toBe(true);
				expect(result.output.action).toBe("warn");
				expect(result.output.verdict).toBe("pass");
			}
		});
	});

	describe("without max-tier", () => {
		it("passes all files when no max-tier specified", () => {
			const result = runPolicyGate({
				contractPath,
				files: ["src/auth/login.ts"], // high tier
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.passed).toBe(true);
				expect(result.output.tier).toBe("high");
				expect(result.output.action).toBe("warn");
				expect(result.output.verdict).toBe("pass");
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
		it("is monotonic across max-tier thresholds", () => {
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

				expect(high.output.passed).toBe(true);
				if (low.output.passed) {
					expect(medium.output.passed).toBe(true);
				}
				if (medium.output.passed) {
					expect(high.output.passed).toBe(true);
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

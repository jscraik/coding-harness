import { describe, expect, it } from "vitest";
import { MergeError } from "./errors.js";
import {
	contractsEqual,
	isDangerousKey,
	mergeContracts,
	validateNoDangerousKeys,
} from "./merger.js";
import {
	DEFAULT_CONTRACT,
	type HarnessContract,
	type ReviewPolicy,
} from "./types.js";

describe("merger", () => {
	describe("isDangerousKey", () => {
		it("identifies __proto__ as dangerous", () => {
			expect(isDangerousKey("__proto__")).toBe(true);
		});

		it("identifies constructor as dangerous", () => {
			expect(isDangerousKey("constructor")).toBe(true);
		});

		it("identifies prototype as dangerous", () => {
			expect(isDangerousKey("prototype")).toBe(true);
		});

		it("identifies hasOwnProperty as dangerous", () => {
			expect(isDangerousKey("hasOwnProperty")).toBe(true);
		});

		it("identifies legacy accessor methods as dangerous", () => {
			expect(isDangerousKey("__defineGetter__")).toBe(true);
			expect(isDangerousKey("__defineSetter__")).toBe(true);
			expect(isDangerousKey("__lookupGetter__")).toBe(true);
			expect(isDangerousKey("__lookupSetter__")).toBe(true);
		});

		it("identifies type coercion methods as dangerous", () => {
			expect(isDangerousKey("toString")).toBe(true);
			expect(isDangerousKey("valueOf")).toBe(true);
			expect(isDangerousKey("toLocaleString")).toBe(true);
		});

		it("identifies promise-like injection as dangerous", () => {
			expect(isDangerousKey("then")).toBe(true);
		});

		it("allows normal keys", () => {
			expect(isDangerousKey("version")).toBe(false);
			expect(isDangerousKey("riskTierRules")).toBe(false);
			expect(isDangerousKey("reviewPolicy")).toBe(false);
		});
	});

	describe("validateNoDangerousKeys", () => {
		it("allows valid objects", () => {
			expect(() =>
				validateNoDangerousKeys({
					version: "1.0",
					riskTierRules: {},
				}),
			).not.toThrow();
		});

		it("allows nested objects", () => {
			expect(() =>
				validateNoDangerousKeys({
					reviewPolicy: {
						timeoutSeconds: 600,
						timeoutAction: "fail",
						requiredChecks: ["lint"],
					},
				}),
			).not.toThrow();
		});

		it("allows arrays", () => {
			expect(() =>
				validateNoDangerousKeys({
					requiredChecks: ["lint", "test"],
				}),
			).not.toThrow();
		});

		it("throws on constructor key", () => {
			const obj: Record<string, unknown> = {};
			Object.defineProperty(obj, "constructor", {
				value: "malicious",
				enumerable: true,
				writable: true,
			});

			expect(() => validateNoDangerousKeys(obj)).toThrow(MergeError);
		});

		it("throws on prototype key", () => {
			const obj: Record<string, unknown> = {};
			Object.defineProperty(obj, "prototype", {
				value: { malicious: true },
				enumerable: true,
				writable: true,
			});

			expect(() => validateNoDangerousKeys(obj)).toThrow(MergeError);
		});

		it("throws on nested dangerous keys", () => {
			const nestedObj: Record<string, unknown> = {};
			Object.defineProperty(nestedObj, "constructor", {
				value: "malicious",
				enumerable: true,
				writable: true,
			});

			expect(() =>
				validateNoDangerousKeys({
					reviewPolicy: nestedObj,
				}),
			).toThrow(MergeError);
		});

		it("throws on dangerous keys in arrays", () => {
			const objWithDangerousKey: Record<string, unknown> = {};
			Object.defineProperty(objWithDangerousKey, "constructor", {
				value: "malicious",
				enumerable: true,
				writable: true,
			});

			expect(() => validateNoDangerousKeys([objWithDangerousKey])).toThrow(
				MergeError,
			);
		});
	});

	describe("mergeContracts", () => {
		it("merges simple contracts", () => {
			const parent = { ...DEFAULT_CONTRACT };
			const child = {
				version: "1.1",
				riskTierRules: { "src/**": "medium" as const },
			};

			const result = mergeContracts(parent, child);

			expect(result.version).toBe("1.1");
			expect(result.riskTierRules["src/**"]).toBe("medium");
		});

		it("child overrides parent values", () => {
			const parent: HarnessContract = {
				...DEFAULT_CONTRACT,
				reviewPolicy: {
					...DEFAULT_CONTRACT.reviewPolicy,
					timeoutSeconds: 600,
				} as ReviewPolicy,
			};
			const child: Partial<HarnessContract> = {
				reviewPolicy: {
					timeoutSeconds: 900,
					timeoutAction: "fail",
					requiredChecks: ["lint"],
					enforceReviewerIndependence: true,
				} as ReviewPolicy,
			};

			const result = mergeContracts(parent, child);

			expect(result.reviewPolicy?.timeoutSeconds).toBe(900);
			expect(result.reviewPolicy?.requiredChecks).toEqual(["lint"]);
		});

		it("replaces arrays by default", () => {
			const parent: HarnessContract = {
				...DEFAULT_CONTRACT,
				reviewPolicy: {
					...DEFAULT_CONTRACT.reviewPolicy,
					requiredChecks: ["lint", "test", "security-scan"],
				} as ReviewPolicy,
			};
			const child: Partial<HarnessContract> = {
				reviewPolicy: {
					timeoutSeconds: 600,
					timeoutAction: "fail",
					requiredChecks: ["lint"],
					enforceReviewerIndependence: true,
				} as ReviewPolicy,
			};

			const result = mergeContracts(parent, child);

			expect(result.reviewPolicy?.requiredChecks).toEqual(["lint"]);
		});

		it("concatenates arrays with concat strategy", () => {
			const parent: HarnessContract = {
				...DEFAULT_CONTRACT,
				reviewPolicy: {
					...DEFAULT_CONTRACT.reviewPolicy,
					requiredChecks: ["lint", "test"],
				} as ReviewPolicy,
			};
			const child: Partial<HarnessContract> = {
				reviewPolicy: {
					timeoutSeconds: 600,
					timeoutAction: "fail",
					requiredChecks: ["security-scan"],
					enforceReviewerIndependence: true,
				} as ReviewPolicy,
			};

			const result = mergeContracts(parent, child, {
				arrayMergeStrategy: "concat",
			});

			expect(result.reviewPolicy?.requiredChecks).toEqual([
				"lint",
				"test",
				"security-scan",
			]);
		});

		it("throws on dangerous keys in child", () => {
			const parent = { ...DEFAULT_CONTRACT };
			const child: Record<string, unknown> = {};
			Object.defineProperty(child, "constructor", {
				value: { malicious: true },
				enumerable: true,
				writable: true,
			});

			expect(() =>
				mergeContracts(parent, child as unknown as Partial<HarnessContract>),
			).toThrow(MergeError);
		});

		it("preserves parent values not overridden", () => {
			const parent: HarnessContract = {
				...DEFAULT_CONTRACT,
				branchProtection: {
					requiredChecks: ["lint", "test"],
				},
			};
			const child: Partial<HarnessContract> = {
				reviewPolicy: {
					timeoutSeconds: 900,
					timeoutAction: "fail",
					requiredChecks: ["security-scan"],
					enforceReviewerIndependence: true,
				} as ReviewPolicy,
			};

			const result = mergeContracts(parent, child);

			expect(result.branchProtection?.requiredChecks).toEqual(["lint", "test"]);
		});
	});

	describe("contractsEqual", () => {
		it("returns true for identical contracts", () => {
			const a = { ...DEFAULT_CONTRACT };
			const b = { ...DEFAULT_CONTRACT };

			expect(contractsEqual(a, b)).toBe(true);
		});

		it("returns true for same contract with different key order", () => {
			const a = {
				version: "1.0",
				riskTierRules: { "src/**": "medium" as const },
			};
			const b = {
				riskTierRules: { "src/**": "medium" as const },
				version: "1.0",
			};

			expect(contractsEqual(a, b)).toBe(true);
		});

		it("returns false for different contracts", () => {
			const a = { ...DEFAULT_CONTRACT };
			const b = {
				...DEFAULT_CONTRACT,
				version: "1.1",
			};

			expect(contractsEqual(a, b)).toBe(false);
		});

		it("returns false when values differ", () => {
			const a = {
				...DEFAULT_CONTRACT,
				riskTierRules: { "src/**": "medium" as const },
			};
			const b = {
				...DEFAULT_CONTRACT,
				riskTierRules: { "src/**": "high" as const },
			};

			expect(contractsEqual(a, b)).toBe(false);
		});
	});
});

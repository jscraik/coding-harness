import { describe, expect, it } from "vitest";
import { createResolver, resolveOverallTier } from "./risk-tier.js";

describe("createResolver", () => {
	const rules = {
		"src/auth/**": "high",
		"src/api/**": "high",
		"src/lib/**": "medium",
		"**/*.test.ts": "low",
	} as const;

	it("classifies auth files as high-risk", () => {
		const resolve = createResolver(rules);
		expect(resolve("src/auth/login.ts")).toBe("high");
	});

	it("classifies test files as low-risk", () => {
		const resolve = createResolver(rules);
		expect(resolve("src/auth/login.test.ts")).toBe("low");
	});

	it("defaults to medium for unknown paths", () => {
		const resolve = createResolver(rules);
		expect(resolve("README.md")).toBe("medium");
	});

	it("handles nested paths with **", () => {
		const resolve = createResolver(rules);
		expect(resolve("src/auth/oauth/handler.ts")).toBe("high");
	});
});

describe("resolveOverallTier", () => {
	const contract = {
		version: "1.0",
		riskTierRules: {
			"src/auth/**": "high",
			"src/lib/**": "medium",
		} as const,
	};

	it("returns high when any file is high-risk", () => {
		expect(
			resolveOverallTier(["src/lib/utils.ts", "src/auth/login.ts"], contract),
		).toBe("high");
	});

	it("returns medium when all files are medium or lower", () => {
		expect(resolveOverallTier(["src/lib/a.ts", "src/lib/b.ts"], contract)).toBe(
			"medium",
		);
	});

	it("returns medium for empty file list", () => {
		expect(resolveOverallTier([], contract)).toBe("medium");
	});
});

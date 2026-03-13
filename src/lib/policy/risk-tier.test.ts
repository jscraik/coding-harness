import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	clearMatcherCache,
	createResolver,
	resolveOverallTier,
} from "./risk-tier.js";

beforeEach(() => {
	clearMatcherCache();
});

afterEach(() => {
	clearMatcherCache();
});

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

	it("prioritizes specific auth scope over generic test suffix", () => {
		const resolve = createResolver(rules);
		expect(resolve("src/auth/login.test.ts")).toBe("high");
	});

	it("defaults to medium for unknown paths", () => {
		const resolve = createResolver(rules);
		expect(resolve("README.md")).toBe("medium");
	});

	it("handles nested paths with **", () => {
		const resolve = createResolver(rules);
		expect(resolve("src/auth/oauth/handler.ts")).toBe("high");
	});

	it("prefers specific subtree patterns over generic suffix globs", () => {
		const resolve = createResolver({
			"src/**": "medium",
			"src/auth/**": "high",
			"**/*.test.ts": "low",
		});

		expect(resolve("src/auth/session.test.ts")).toBe("high");
		expect(resolve("src/misc/util.test.ts")).toBe("medium");
		expect(resolve("scripts/setup.test.ts")).toBe("low");
	});

	it("prefers exact file matches over wildcard patterns", () => {
		const resolve = createResolver({
			"src/auth/**": "high",
			"src/auth/login.ts": "low",
		});

		expect(resolve("src/auth/login.ts")).toBe("low");
		expect(resolve("src/auth/logout.ts")).toBe("high");
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

	it("is order-invariant and equals highest severity of per-file resolution", () => {
		const resolve = createResolver(contract.riskTierRules);
		const tierRank = { high: 0, medium: 1, low: 2 } as const;
		const corpus = [
			"src/auth/login.ts",
			"src/auth/oauth/callback.ts",
			"src/lib/a.ts",
			"src/lib/b.test.ts",
			"scripts/setup.ts",
			"README.md",
		];

		let seed = 1337;
		const rand = () => {
			seed = (seed * 1103515245 + 12345) & 0x7fffffff;
			return seed / 0x80000000;
		};

		for (let i = 0; i < 120; i++) {
			const sampleSize = 1 + Math.floor(rand() * corpus.length);
			const picked: string[] = [];
			for (let j = 0; j < sampleSize; j++) {
				const choice =
					corpus[Math.floor(rand() * corpus.length)] ?? "README.md";
				picked.push(choice);
			}

			const expected = picked
				.map(resolve)
				.sort((a, b) => tierRank[a] - tierRank[b])[0];
			expect(expected).toBeDefined();
			expect(resolveOverallTier(picked, contract)).toBe(expected);
			expect(resolveOverallTier([...picked].reverse(), contract)).toBe(
				expected,
			);
		}
	});

	it("handles fuzzed glob patterns without crashing resolver", () => {
		let seed = 777;
		const rand = (): number => {
			seed = (seed * 1103515245 + 12345) & 0x7fffffff;
			return seed / 0x80000000;
		};

		const alphabet = "abcABC0123*?[]{}()!./_\\-";
		for (let i = 0; i < 120; i++) {
			const len = 1 + Math.floor(rand() * 12);
			let pattern = "";
			for (let j = 0; j < len; j++) {
				pattern +=
					alphabet[Math.floor(rand() * alphabet.length)] ?? alphabet[0] ?? "a";
			}

			const tier = (["high", "medium", "low"] as const)[i % 3] ?? "medium";
			expect(() =>
				createResolver({
					[pattern]: tier,
				}),
			).not.toThrow();

			const resolver = createResolver({ [pattern]: tier });
			expect(() => resolver("src/example.ts")).not.toThrow();
			const resolved = resolver("src/example.ts");
			expect(["high", "medium", "low"]).toContain(resolved);
		}
	});
});

import { describe, expect, it } from "vitest";
import { mapFilesToDomains } from "./domain-mapper.js";

describe("domain-mapper", () => {
	it("maps test files to testing domain", () => {
		const result = mapFilesToDomains(["src/commands/brain.test.ts"]);
		expect(result.length).toBeGreaterThanOrEqual(1);
		const testingDomain = result.find((d) => d.domain === "testing");
		expect(testingDomain).toBeDefined();
		expect(testingDomain?.relevance).toBeGreaterThan(0);
	});

	it("maps CI config files to ci-migrate domain", () => {
		const result = mapFilesToDomains([".circleci/config.yml"]);
		const ciDomain = result.find((d) => d.domain === "ci-migrate");
		expect(ciDomain).toBeDefined();
		expect(ciDomain?.relevance).toBeGreaterThanOrEqual(0.8);
	});

	it("maps command files to api domain", () => {
		const result = mapFilesToDomains(["src/commands/brain.ts"]);
		const apiDomain = result.find((d) => d.domain === "api");
		expect(apiDomain).toBeDefined();
	});

	it("returns all domains with low relevance for unknown files", () => {
		const result = mapFilesToDomains(["README.md"]);
		expect(result.length).toBeGreaterThanOrEqual(1);
		for (const mapping of result) {
			expect(mapping.relevance).toBeLessThan(0.5);
		}
	});

	it("returns results sorted by relevance", () => {
		const result = mapFilesToDomains([
			"src/commands/brain.test.ts",
			".circleci/config.yml",
			"README.md",
		]);
		for (let i = 1; i < result.length; i++) {
			expect(result[i - 1].relevance).toBeGreaterThanOrEqual(
				result[i].relevance,
			);
		}
	});

	it("provides reasons for each mapping", () => {
		const result = mapFilesToDomains(["src/commands/brain.test.ts"]);
		for (const mapping of result) {
			expect(mapping.reason.length).toBeGreaterThan(0);
		}
	});
});

import { describe, expect, it } from "vitest";
import {
	DEFAULT_BLAST_RADIUS_RULES,
	DEFAULT_CHECKS,
	getBlastRadiusInfo,
	getChecksForFile,
	resolveBlastRadiusRules,
	resolveChecks,
	summarizeBlastRadius,
} from "./resolver.js";

describe("getChecksForFile", () => {
	it("returns auth checks for auth paths", () => {
		const checks = getChecksForFile("src/auth/login.ts");
		expect(checks).toContain("auth-flows");
		expect(checks).toContain("security-scan");
	});

	it("returns UI checks for component paths", () => {
		const checks = getChecksForFile("src/components/Button.tsx");
		expect(checks).toContain("component-tests");
		expect(checks).toContain("visual-regression");
	});

	it("returns empty array for unknown paths", () => {
		const checks = getChecksForFile("unknown/file.xyz");
		expect(checks).toHaveLength(0);
	});

	it("matches CSS files", () => {
		const checks = getChecksForFile("src/styles/main.css");
		expect(checks).toContain("stylelint");
		expect(checks).toContain("visual-regression");
	});
});

describe("resolveChecks", () => {
	it("aggregates checks for multiple files", () => {
		const result = resolveChecks([
			"src/auth/login.ts",
			"src/components/Button.tsx",
		]);

		expect(result.checks).toContain("auth-flows");
		expect(result.checks).toContain("component-tests");
		expect(result.useDefaults).toBe(false);
	});

	it("deduplicates checks", () => {
		const result = resolveChecks(["src/auth/login.ts", "src/auth/logout.ts"]);

		const authChecks = result.checks.filter((c) => c.includes("auth"));
		// Should not have duplicates
		expect(new Set(authChecks).size).toBe(authChecks.length);
	});

	it("uses defaults when no patterns match", () => {
		const result = resolveChecks(["unknown/file.xyz"]);

		expect(result.useDefaults).toBe(true);
		expect(result.checks).toEqual(expect.arrayContaining(DEFAULT_CHECKS));
	});

	it("returns empty for empty file list", () => {
		const result = resolveChecks([]);

		expect(result.checks).toHaveLength(0);
		expect(result.useDefaults).toBe(false);
	});

	it("maps files to their checks", () => {
		const result = resolveChecks(["src/auth/login.ts"]);

		expect(result.fileChecks.has("src/auth/login.ts")).toBe(true);
		expect(result.fileChecks.get("src/auth/login.ts")).toContain("auth-flows");
	});
});

describe("resolveBlastRadiusRules", () => {
	it("returns defaults when no custom rules are provided", () => {
		const rules = resolveBlastRadiusRules();
		expect(rules.length).toBeGreaterThan(0);
		expect(rules[0]).toEqual(
			expect.objectContaining({
				pattern: "src/auth/**",
				checks: expect.arrayContaining(["auth-flows"]),
			}),
		);
	});

	it("merges default and custom rules in merge mode", () => {
		const rules = resolveBlastRadiusRules(
			[
				{
					pattern: "**/*.sh",
					checks: ["shellcheck"],
				},
			],
			"merge",
		);

		expect(rules).toHaveLength(DEFAULT_BLAST_RADIUS_RULES.length + 1);
		expect(rules[0]).toEqual(
			expect.objectContaining({
				pattern: "src/auth/**",
				checks: expect.arrayContaining(["auth-flows"]),
			}),
		);
		expect(rules.at(-1)).toEqual(
			expect.objectContaining({ pattern: "**/*.sh", checks: ["shellcheck"] }),
		);
	});

	it("replaces defaults with custom rules in replace mode", () => {
		const rules = resolveBlastRadiusRules(
			[
				{
					pattern: "**/*.sh",
					checks: ["shellcheck", "bash-syntax"],
				},
			],
			"replace",
		);

		expect(rules).toHaveLength(1);
		expect(rules[0]).toEqual(
			expect.objectContaining({
				pattern: "**/*.sh",
				checks: ["shellcheck", "bash-syntax"],
			}),
		);
	});

	it("returns empty rules when mode is replace and custom rules are omitted", () => {
		const rules = resolveBlastRadiusRules(undefined, "replace");
		expect(rules).toEqual([]);
	});
});

describe("getBlastRadiusInfo", () => {
	it("identifies matched rules", () => {
		const result = getBlastRadiusInfo(["src/auth/login.ts"]);

		expect(result.matchedRules.length).toBeGreaterThan(0);
		expect(result.matchedRules[0]?.pattern).toBe("src/auth/**");
	});

	it("counts total unique checks", () => {
		const result = getBlastRadiusInfo([
			"src/auth/login.ts",
			"src/auth/signup.ts",
		]);

		// Should count unique checks, not total
		expect(result.totalChecks).toBeGreaterThan(0);
	});

	it("identifies highest impact files", () => {
		const result = getBlastRadiusInfo([
			"src/auth/login.ts", // Many checks
			"docs/readme.md", // Few checks
		]);

		expect(result.highestImpactFiles.length).toBeGreaterThan(0);
		expect(result.highestImpactFiles[0]).toBe("src/auth/login.ts");
	});
});

describe("summarizeBlastRadius", () => {
	it("includes file count", () => {
		const summary = summarizeBlastRadius(["src/auth/login.ts"]);
		expect(summary).toContain("Changed files: 1");
	});

	it("includes matched patterns", () => {
		const summary = summarizeBlastRadius(["src/auth/login.ts"]);
		expect(summary).toContain("Matched patterns:");
		expect(summary).toContain("src/auth/**");
	});

	it("includes required checks", () => {
		const summary = summarizeBlastRadius(["src/auth/login.ts"]);
		expect(summary).toContain("Required checks");
		expect(summary).toContain("auth-flows");
	});

	it("mentions defaults when used", () => {
		const summary = summarizeBlastRadius(["unknown.xyz"]);
		expect(summary).toContain("Using default checks");
	});
});

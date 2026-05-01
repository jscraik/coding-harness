import {
	existsSync,
	mkdirSync,
	readdirSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
	EXIT_CODES,
	runBrainAdd,
	runBrainCLI,
	runBrainPreflight,
	runBrainQuery,
	runBrainStatus,
} from "./brain.js";

function createTempHarness(): string {
	const dir = mkdtempSync(join("/tmp", "brain-test-"));
	const harnessDir = join(dir, ".harness");
	mkdirSync(harnessDir, { recursive: true });
	mkdirSync(join(harnessDir, "knowledge"), { recursive: true });
	mkdirSync(join(harnessDir, "knowledge", "api"), { recursive: true });
	mkdirSync(join(harnessDir, "memory"), { recursive: true });
	mkdirSync(join(harnessDir, "decisions"), { recursive: true });
	mkdirSync(join(harnessDir, "quality"), { recursive: true });

	// Write minimal valid files
	writeFileSync(
		join(harnessDir, "knowledge", "INDEX.md"),
		"# Knowledge Index\n\n**Last updated:** 2026-04-16\n\n| Domain | Focus | Last updated | Key rules |\n|--------|-------|--------------|-----------|\n| [api](./api/) | API surface | 2026-04-16 | 1 rule |\n",
	);
	writeFileSync(
		join(harnessDir, "knowledge", "api", "knowledge.md"),
		"# Api Knowledge\n\n**Last verified:** 2026-04-16\n**Verification source:** manual\n**Confidence:** high\n**Owner:** test\n\n## Confirmed facts\n\n- Vitest is the test runner\n",
	);
	writeFileSync(
		join(harnessDir, "knowledge", "api", "hypotheses.md"),
		"# Api Hypotheses\n\n## Active hypotheses\n\nNo active hypotheses.\n",
	);
	writeFileSync(
		join(harnessDir, "knowledge", "api", "rules.md"),
		"# Api Rules\n\n**Rule count:** 1\n\n## Active rules\n\n- **R-001**: Test rule\n",
	);
	writeFileSync(
		join(harnessDir, "quality", "criteria.md"),
		"# Quality Criteria\n\n**Last updated:** 2026-04-16\n**Total criteria:** 1\n\n### Testing\n| ID | Criterion | Severity | Source | Last triggered |\n|----|-----------|----------|--------|----------------|\n| Q-001 | Tests required | must | convention | (not yet) |\n",
	);
	writeFileSync(
		join(harnessDir, "review-log.md"),
		"# Review Log\n\n| Date | Reviewer | Scope | Findings | Actions |\n|------|----------|-------|----------|---------|\n| 2026-04-16 | test | initial | none | none |\n",
	);
	writeFileSync(
		join(harnessDir, "memory", "LEARNINGS.md"),
		"# Learnings\n\nRepo-specific agent knowledge base.\n",
	);

	return dir;
}

describe("brain status", () => {
	it("returns valid status for a well-formed brain", () => {
		const dir = createTempHarness();
		try {
			const result = runBrainStatus(join(dir, ".harness"));
			expect(result.valid).toBe(true);
			expect(result.validation.summary.errors).toBe(0);
			expect(result.maturity.level).toBe("mature");
			expect(result.maturity.placeholderDomains).toEqual([]);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("returns errors for missing harness directory", () => {
		const result = runBrainStatus("/nonexistent/path/.harness");
		expect(result.valid).toBe(false);
		expect(result.validation.summary.errors).toBeGreaterThan(0);
	});

	it("reports warnings for placeholder content", () => {
		const dir = createTempHarness();
		try {
			// Write a file with placeholder content
			writeFileSync(
				join(dir, ".harness", "knowledge", "api", "knowledge.md"),
				"# Api Knowledge\n\n(none yet)\n",
			);
			const result = runBrainStatus(join(dir, ".harness"));
			expect(result.validation.summary.warnings).toBeGreaterThan(0);
			expect(result.validation.summary.placeholderDomains.api).toBeGreaterThan(
				0,
			);
			expect(result.maturity.level).toBe("partial");
			expect(result.maturity.placeholderDomains).toContain("api");
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});

describe("brain query", () => {
	it("finds matching lines across files", () => {
		const dir = createTempHarness();
		try {
			const result = runBrainQuery(join(dir, ".harness"), "vitest");
			expect(result.total).toBeGreaterThanOrEqual(1);
			const match = result.matches[0];
			expect(match).toBeDefined();
			if (match) {
				expect(match.path).toContain("knowledge");
			}
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("returns empty results for no matches", () => {
		const dir = createTempHarness();
		try {
			const result = runBrainQuery(
				join(dir, ".harness"),
				"nonexistent-query-term-xyz",
			);
			expect(result.total).toBe(0);
			expect(result.matches).toHaveLength(0);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("searches across domain files", () => {
		const dir = createTempHarness();
		try {
			const result = runBrainQuery(join(dir, ".harness"), "test rule");
			expect(result.total).toBeGreaterThanOrEqual(1);
			const domainMatches = result.matches.filter((m) => m.domain === "api");
			expect(domainMatches.length).toBeGreaterThanOrEqual(1);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});

describe("brain add", () => {
	it("appends a learning to LEARNINGS.md", () => {
		const dir = createTempHarness();
		try {
			const result = runBrainAdd(
				join(dir, ".harness"),
				"learning",
				"general",
				"Test learning entry",
			);
			expect(result.appended).toBe(true);
			expect(result.path).toBe("memory/LEARNINGS.md");
			expect(result.content).toContain("Test learning entry");
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("appends a rule to domain rules.md", () => {
		const dir = createTempHarness();
		try {
			const result = runBrainAdd(
				join(dir, ".harness"),
				"rule",
				"api",
				"All commands must have --help",
				{ severity: "must" },
			);
			expect(result.appended).toBe(true);
			expect(result.path).toBe("knowledge/api/rules.md");
			expect(result.content).toContain("All commands must have --help");
			expect(result.content).toContain("must");
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("appends a hypothesis to domain hypotheses.md", () => {
		const dir = createTempHarness();
		try {
			const result = runBrainAdd(
				join(dir, ".harness"),
				"hypothesis",
				"api",
				"Maybe we should use zod for validation",
			);
			expect(result.appended).toBe(true);
			expect(result.path).toBe("knowledge/api/hypotheses.md");
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("rejects path traversal domains before composing knowledge paths", () => {
		const dir = createTempHarness();
		try {
			expect(() =>
				runBrainAdd(
					join(dir, ".harness"),
					"rule",
					"../../outside",
					"escape attempt",
				),
			).toThrow(/Invalid domain/);
			expect(existsSync(join(dir, "outside"))).toBe(false);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("creates a new decision file", () => {
		const dir = createTempHarness();
		try {
			const result = runBrainAdd(
				join(dir, ".harness"),
				"decision",
				"general",
				"We will use vitest for all testing",
			);
			expect(result.appended).toBe(true);
			expect(result.path).toContain("decisions/");
			expect(result.path).toContain("we-will-use-vitest-for-all-testing");
			expect(existsSync(join(dir, ".harness", result.path))).toBe(true);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});

describe("brain CLI", () => {
	it("shows help and returns success", () => {
		const exitCode = runBrainCLI(["--help"]);
		expect(exitCode).toBe(EXIT_CODES.SUCCESS);
	});

	it("rejects unknown subcommands", () => {
		const exitCode = runBrainCLI(["unknown"]);
		expect(exitCode).toBe(EXIT_CODES.INVALID_ARGS);
	});

	it("allows decision additions without a domain", () => {
		const dir = createTempHarness();
		try {
			const exitCode = runBrainCLI([
				"add",
				"--type",
				"decision",
				"--content",
				"Adopt review-context evidence",
				"--dir",
				dir,
				"--json",
			]);
			expect(exitCode).toBe(EXIT_CODES.SUCCESS);
			expect(
				readdirSync(join(dir, ".harness", "decisions")).some((entry) =>
					entry.endsWith("adopt-review-context-evidence.md"),
				),
			).toBe(true);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("runs status subcommand", () => {
		const dir = createTempHarness();
		try {
			const exitCode = runBrainCLI(["status", "--dir", dir, "--json"]);
			expect(exitCode).toBe(EXIT_CODES.SUCCESS);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("runs preflight subcommand", () => {
		const dir = createTempHarness();
		try {
			const exitCode = runBrainCLI([
				"preflight",
				"--dir",
				dir,
				"--files",
				"src/commands/brain.test.ts",
				"--json",
			]);
			expect(exitCode).toBe(EXIT_CODES.SUCCESS);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("rejects preflight when --files is present without values", () => {
		const dir = createTempHarness();
		try {
			const exitCode = runBrainCLI([
				"preflight",
				"--dir",
				dir,
				"--files",
				"--json",
			]);
			expect(exitCode).toBe(EXIT_CODES.INVALID_ARGS);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("accepts multiple preflight --files tokens without dropping later paths", () => {
		const dir = createTempHarness();
		const info = vi.spyOn(console, "info").mockImplementation(() => {});
		const write = vi
			.spyOn(process.stdout, "write")
			.mockImplementation(() => true);
		try {
			const exitCode = runBrainCLI([
				"preflight",
				"--dir",
				dir,
				"--files",
				"AGENTS.md",
				"src/commands/brain.test.ts",
				"--json",
			]);
			expect(exitCode).toBe(EXIT_CODES.SUCCESS);
			const output = write.mock.calls.map((call) => call[0]).join("");
			const result = JSON.parse(output);
			expect(result.files).toEqual(["AGENTS.md", "src/commands/brain.test.ts"]);
		} finally {
			info.mockRestore();
			write.mockRestore();
			rmSync(dir, { recursive: true, force: true });
		}
	});
});

describe("brain preflight", () => {
	it("returns relevant context for test files", () => {
		const dir = createTempHarness();
		try {
			const result = runBrainPreflight(join(dir, ".harness"), [
				"src/commands/brain.test.ts",
			]);
			expect(result.files).toHaveLength(1);
			expect(result.domainMappings.length).toBeGreaterThanOrEqual(1);
			const testingCtx = result.contexts.find((c) => c.domain === "testing");
			expect(testingCtx).toBeDefined();
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("handles sparse brain data gracefully", () => {
		const dir = createTempHarness();
		try {
			const result = runBrainPreflight(join(dir, ".harness"), [
				"unknown-file.xyz",
			]);
			expect(result.files).toHaveLength(1);
			expect(result.domainMappings.length).toBeGreaterThanOrEqual(1);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});

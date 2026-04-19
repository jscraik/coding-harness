import { describe, expect, it } from "vitest";
import {
	type BootstrapSummary,
	formatBootstrapSummary,
	generateBootstrapSummary,
} from "./post-bootstrap-summary.js";
import type { InitOutput } from "./types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeOutput(overrides: Partial<InitOutput> = {}): InitOutput {
	return {
		packageManager: "pnpm",
		created: [],
		skipped: [],
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("generateBootstrapSummary", () => {
	it("returns detection info from output", () => {
		const summary = generateBootstrapSummary(
			makeOutput({
				projectTypeDetection: {
					projectType: "cli",
					matchedRule: null,
					confidence: "high",
					signals: [],
				},
			}),
			"pnpm",
		);
		expect(summary.detected.projectType).toBe("cli");
		expect(summary.detected.confidence).toBe("high");
		expect(summary.detected.packageManager).toBe("pnpm");
	});

	it("defaults to unknown when no detection", () => {
		const summary = generateBootstrapSummary(makeOutput(), "npm");
		expect(summary.detected.projectType).toBe("unknown");
		expect(summary.detected.confidence).toBe("none");
	});

	it("describes created files by category", () => {
		const summary = generateBootstrapSummary(
			makeOutput({
				created: [
					"harness.contract.json",
					"WORKFLOW.md",
					".github/workflows/ci.yml",
					".github/workflows/release-private-npm.yml",
					"CHANGELOG.md",
				],
			}),
			"pnpm",
		);
		expect(summary.created).toContain("Governance contract");
		expect(summary.created).toContain("Workflow documentation");
		expect(summary.created).toContain("CI pipeline");
		expect(summary.created).toContain("Release pipeline");
		expect(summary.created).toContain("Release changelog");
	});

	it("does not match category labels with broad substring checks", () => {
		const summary = generateBootstrapSummary(
			makeOutput({
				created: ["docs/AGENTS.md.backup"],
			}),
			"pnpm",
		);
		expect(summary.created).toContain("docs/AGENTS.md.backup");
	});

	it("normalizes leading dot-slash and backslash paths", () => {
		const summary = generateBootstrapSummary(
			makeOutput({
				created: [".\\AGENTS.md", "./harness.contract.json"],
			}),
			"pnpm",
		);
		expect(summary.created).toContain("Agent instructions");
		expect(summary.created).toContain("Governance contract");
	});

	it("describes protected files from skipped", () => {
		const summary = generateBootstrapSummary(
			makeOutput({
				skipped: ["AGENTS.md", "CONTRIBUTING.md"],
			}),
			"pnpm",
		);
		expect(summary.protected).toContain("Agent instructions");
		expect(summary.protected).toContain("Contributor guide");
	});

	it("deduplicates labeled created and protected entries", () => {
		const summary = generateBootstrapSummary(
			makeOutput({
				created: [".\\AGENTS.md", "AGENTS.md"],
				skipped: ["./CONTRIBUTING.md", "CONTRIBUTING.md"],
			}),
			"pnpm",
		);
		expect(
			summary.created.filter((v) => v === "Agent instructions"),
		).toHaveLength(1);
		expect(
			summary.protected.filter((v) => v === "Contributor guide"),
		).toHaveLength(1);
	});

	it("recommends contract validation when contract was created", () => {
		const summary = generateBootstrapSummary(
			makeOutput({ created: ["harness.contract.json"] }),
			"pnpm",
		);
		const hasContract = summary.nextCommands.some((cmd) =>
			cmd.includes("contract validate"),
		);
		expect(hasContract).toBe(true);
	});

	it("recommends contract validation for normalized contract paths", () => {
		const summary = generateBootstrapSummary(
			makeOutput({
				created: ["./harness.contract.json", ".\\harness.contract.json"],
			}),
			"pnpm",
		);
		const hasContract = summary.nextCommands.some((cmd) =>
			cmd.includes("contract validate"),
		);
		expect(hasContract).toBe(true);
	});

	it("recommends branch-protect when CI files created", () => {
		const summary = generateBootstrapSummary(
			makeOutput({ created: [".github/workflows/ci.yml"] }),
			"pnpm",
		);
		const hasBranchProtect = summary.nextCommands.some((cmd) =>
			cmd.includes("branch-protect"),
		);
		expect(hasBranchProtect).toBe(true);
	});

	it("does not recommend branch-protect for non-CI workflow-like paths", () => {
		const summary = generateBootstrapSummary(
			makeOutput({ created: ["docs/workflows/guide.md"] }),
			"pnpm",
		);
		const hasBranchProtect = summary.nextCommands.some((cmd) =>
			cmd.includes("branch-protect"),
		);
		expect(hasBranchProtect).toBe(false);
	});

	it("recommends docs-gate when governance docs created", () => {
		const summary = generateBootstrapSummary(
			makeOutput({ created: ["AGENTS.md"] }),
			"pnpm",
		);
		const hasDocsGate = summary.nextCommands.some((cmd) =>
			cmd.includes("docs-gate"),
		);
		expect(hasDocsGate).toBe(true);
	});

	it("recommends index-context on fresh install", () => {
		const summary = generateBootstrapSummary(
			makeOutput({
				created: [
					"harness.contract.json",
					"WORKFLOW.md",
					"AGENTS.md",
					"CONTRIBUTING.md",
				],
			}),
			"pnpm",
		);
		const hasIndex = summary.nextCommands.some((cmd) =>
			cmd.includes("index-context --json --lexical-fallback"),
		);
		expect(hasIndex).toBe(true);
	});

	it("does not recommend index-context for unrelated created files", () => {
		const summary = generateBootstrapSummary(
			makeOutput({
				created: ["a.txt", "b.txt", "c.txt", "d.txt"],
			}),
			"pnpm",
		);
		const hasIndex = summary.nextCommands.some((cmd) =>
			cmd.includes("index-context --json --lexical-fallback"),
		);
		expect(hasIndex).toBe(false);
	});

	it("always recommends health check", () => {
		const summary = generateBootstrapSummary(makeOutput(), "pnpm");
		const hasCheck = summary.nextCommands.some((cmd) =>
			cmd.includes("harness check"),
		);
		expect(hasCheck).toBe(true);
	});

	it("passes through unknown file paths", () => {
		const summary = generateBootstrapSummary(
			makeOutput({ created: ["unknown-file.txt"] }),
			"pnpm",
		);
		expect(summary.created).toContain("unknown-file.txt");
	});
});

describe("formatBootstrapSummary", () => {
	it("formats all sections", () => {
		const summary: BootstrapSummary = {
			detected: {
				projectType: "cli",
				confidence: "high",
				packageManager: "pnpm",
			},
			created: ["Governance contract"],
			protected: ["Agent instructions"],
			nextCommands: ["harness check  — quick health snapshot"],
		};
		const output = formatBootstrapSummary(summary);
		expect(output).toContain("What we found");
		expect(output).toContain("cli");
		expect(output).toContain("What we created");
		expect(output).toContain("Governance contract");
		expect(output).toContain("What we protected");
		expect(output).toContain("Agent instructions");
		expect(output).toContain("Recommended next commands");
		expect(output).toContain("harness check");
	});

	it("omits empty sections", () => {
		const summary: BootstrapSummary = {
			detected: {
				projectType: "unknown",
				confidence: "none",
				packageManager: "npm",
			},
			created: [],
			protected: [],
			nextCommands: [],
		};
		const output = formatBootstrapSummary(summary);
		expect(output).toContain("What we found");
		expect(output).not.toContain("What we created");
		expect(output).not.toContain("What we protected");
	});
});

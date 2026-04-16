import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	AGENT_SURFACES,
	detectPresentSurfaces,
	generateDerivedHeader,
	validateInstructionConsistency,
} from "./instruction-compat.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTempRepo(): string {
	return mkdtempSync(join(tmpdir(), "instr-compat-test-"));
}

const CANONICAL_AGENTS = `# AGENTS.md

## Project Description
This is a test project.

## Required Essentials
- Use pnpm
- Run tests before merge
`;

const DERIVED_CLAUDE = `# CLAUDE.md

## Canonical source
- Use AGENTS.md as the canonical source for repo-wide, cross-tool instructions.

## Operator defaults
- Run shell commands with zsh
`;

const DERIVED_NO_REF = `# CLAUDE.md

## Operator defaults
- Run shell commands with zsh
`;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("detectPresentSurfaces", () => {
	it("returns empty when no surfaces exist", () => {
		const dir = createTempRepo();
		try {
			const surfaces = detectPresentSurfaces(dir);
			expect(surfaces).toEqual([]);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("detects AGENTS.md", () => {
		const dir = createTempRepo();
		try {
			writeFileSync(join(dir, "AGENTS.md"), CANONICAL_AGENTS);
			const surfaces = detectPresentSurfaces(dir);
			expect(surfaces.length).toBe(1);
			expect(surfaces[0]!.agent).toBe("codex");
			expect(surfaces[0]!.role).toBe("canonical");
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("detects multiple surfaces", () => {
		const dir = createTempRepo();
		try {
			writeFileSync(join(dir, "AGENTS.md"), CANONICAL_AGENTS);
			writeFileSync(join(dir, "CLAUDE.md"), DERIVED_CLAUDE);
			const surfaces = detectPresentSurfaces(dir);
			expect(surfaces.length).toBe(2);
			const agents = surfaces.map((s) => s.agent);
			expect(agents).toContain("codex");
			expect(agents).toContain("claude");
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});

describe("validateInstructionConsistency", () => {
	it("reports error when AGENTS.md is missing", () => {
		const dir = createTempRepo();
		try {
			const report = validateInstructionConsistency(dir);
			expect(report.consistent).toBe(false);
			expect(report.findings.length).toBeGreaterThan(0);
			expect(report.findings[0]!.severity).toBe("error");
			expect(report.findings[0]!.file).toBe("AGENTS.md");
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("passes when only AGENTS.md exists", () => {
		const dir = createTempRepo();
		try {
			writeFileSync(join(dir, "AGENTS.md"), CANONICAL_AGENTS);
			const report = validateInstructionConsistency(dir);
			expect(report.consistent).toBe(true);
			expect(report.surfacesChecked).toBe(1);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("passes when derived file references canonical source", () => {
		const dir = createTempRepo();
		try {
			writeFileSync(join(dir, "AGENTS.md"), CANONICAL_AGENTS);
			writeFileSync(join(dir, "CLAUDE.md"), DERIVED_CLAUDE);
			const report = validateInstructionConsistency(dir);
			expect(report.consistent).toBe(true);
			const warnings = report.findings.filter((f) => f.severity === "warning");
			expect(warnings.length).toBe(0);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("warns when derived file does not reference canonical source", () => {
		const dir = createTempRepo();
		try {
			writeFileSync(join(dir, "AGENTS.md"), CANONICAL_AGENTS);
			writeFileSync(join(dir, "CLAUDE.md"), DERIVED_NO_REF);
			const report = validateInstructionConsistency(dir);
			const refWarning = report.findings.find(
				(f) =>
					f.file === "CLAUDE.md" &&
					f.message.includes("does not reference canonical source"),
			);
			expect(refWarning).toBeDefined();
			expect(refWarning!.severity).toBe("warning");
			expect(refWarning!.fix).toBeTruthy();
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("warns when derived file duplicates canonical content", () => {
		const dir = createTempRepo();
		try {
			writeFileSync(join(dir, "AGENTS.md"), CANONICAL_AGENTS);
			// Exact copy of canonical — 100% overlap
			writeFileSync(join(dir, "CLAUDE.md"), CANONICAL_AGENTS);
			const report = validateInstructionConsistency(dir);
			const dupWarning = report.findings.find(
				(f) => f.file === "CLAUDE.md" && f.message.includes("line overlap"),
			);
			expect(dupWarning).toBeDefined();
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("reports info for missing derived surfaces", () => {
		const dir = createTempRepo();
		try {
			writeFileSync(join(dir, "AGENTS.md"), CANONICAL_AGENTS);
			const report = validateInstructionConsistency(dir);
			const infoFinding = report.findings.find(
				(f) => f.severity === "info" && f.message.includes("not present"),
			);
			expect(infoFinding).toBeDefined();
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("counts surfaces checked", () => {
		const dir = createTempRepo();
		try {
			writeFileSync(join(dir, "AGENTS.md"), CANONICAL_AGENTS);
			writeFileSync(join(dir, "CLAUDE.md"), DERIVED_CLAUDE);
			const report = validateInstructionConsistency(dir);
			expect(report.surfacesChecked).toBe(2);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});

describe("generateDerivedHeader", () => {
	it("generates header for claude", () => {
		const header = generateDerivedHeader("claude");
		expect(header).toContain("# Claude Instructions");
		expect(header).toContain("Canonical source");
		expect(header).toContain("AGENTS.md");
		expect(header).toContain("@./AGENTS.md");
	});

	it("generates header for cursor", () => {
		const header = generateDerivedHeader("cursor");
		expect(header).toContain("# Cursor Instructions");
	});

	it("generates header for copilot", () => {
		const header = generateDerivedHeader("copilot");
		expect(header).toContain("# Copilot Instructions");
	});
});

describe("AGENT_SURFACES", () => {
	it("has exactly one canonical surface", () => {
		const canonical = AGENT_SURFACES.filter((s) => s.role === "canonical");
		expect(canonical.length).toBe(1);
		expect(canonical[0]!.filePath).toBe("AGENTS.md");
	});

	it("has derived surfaces for all major agents", () => {
		const derived = AGENT_SURFACES.filter((s) => s.role === "derived");
		const agents = derived.map((s) => s.agent);
		expect(agents).toContain("claude");
		expect(agents).toContain("gemini");
		expect(agents).toContain("cursor");
	});
});

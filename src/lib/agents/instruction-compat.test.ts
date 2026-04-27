import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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

const DERIVED_CURSOR = `# .cursorrules

## Canonical source
- Use AGENTS.md as the canonical source for repo-wide, cross-tool instructions.

## Operator defaults
- Run shell commands with zsh
`;

const DERIVED_NO_REF = `# .cursorrules

## Operator defaults
- Run shell commands with zsh
`;

const DERIVED_WRONG_REF = `# .cursorrules

## Canonical source
- README.md
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
			writeFileSync(join(dir, ".cursorrules"), DERIVED_CURSOR);
			const surfaces = detectPresentSurfaces(dir);
			expect(surfaces.length).toBe(2);
			const agents = surfaces.map((s) => s.agent);
			expect(agents).toContain("codex");
			expect(agents).toContain("cursor");
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

	it("reports error when AGENTS.md is unreadable", () => {
		const dir = createTempRepo();
		try {
			mkdirSync(join(dir, "AGENTS.md"));
			const report = validateInstructionConsistency(dir);
			const canonicalError = report.findings.find(
				(f) =>
					f.file === "AGENTS.md" && f.message.includes("missing or unreadable"),
			);
			expect(report.consistent).toBe(false);
			expect(canonicalError).toBeDefined();
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("passes when derived file references canonical source", () => {
		const dir = createTempRepo();
		try {
			writeFileSync(join(dir, "AGENTS.md"), CANONICAL_AGENTS);
			writeFileSync(join(dir, ".cursorrules"), DERIVED_CURSOR);
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
			writeFileSync(join(dir, ".cursorrules"), DERIVED_NO_REF);
			const report = validateInstructionConsistency(dir);
			const refWarning = report.findings.find(
				(f) =>
					f.file === ".cursorrules" &&
					f.message.includes("does not reference canonical source"),
			);
			expect(report.consistent).toBe(false);
			expect(refWarning).toBeDefined();
			expect(refWarning!.severity).toBe("warning");
			expect(refWarning!.fix).toBeTruthy();
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("warns when derived file references wrong canonical source", () => {
		const dir = createTempRepo();
		try {
			writeFileSync(join(dir, "AGENTS.md"), CANONICAL_AGENTS);
			writeFileSync(join(dir, ".cursorrules"), DERIVED_WRONG_REF);
			const report = validateInstructionConsistency(dir);
			const refWarning = report.findings.find(
				(f) =>
					f.file === ".cursorrules" &&
					f.message.includes("does not reference canonical source"),
			);
			expect(report.consistent).toBe(false);
			expect(refWarning).toBeDefined();
			expect(refWarning?.severity).toBe("warning");
			expect(refWarning?.fix).toBeTruthy();
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("warns when derived file duplicates canonical content", () => {
		const dir = createTempRepo();
		try {
			writeFileSync(join(dir, "AGENTS.md"), CANONICAL_AGENTS);
			// Exact copy of canonical — 100% overlap
			writeFileSync(join(dir, ".cursorrules"), CANONICAL_AGENTS);
			const report = validateInstructionConsistency(dir);
			const dupWarning = report.findings.find(
				(f) => f.file === ".cursorrules" && f.message.includes("line overlap"),
			);
			expect(dupWarning).toBeDefined();
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("warns when canonical content is fully duplicated with extra lines", () => {
		const dir = createTempRepo();
		try {
			writeFileSync(join(dir, "AGENTS.md"), CANONICAL_AGENTS);
			writeFileSync(
				join(dir, ".cursorrules"),
				`${CANONICAL_AGENTS}\n## Extra\n- Agent-specific addendum`,
			);
			const report = validateInstructionConsistency(dir);
			const dupWarning = report.findings.find(
				(f) => f.file === ".cursorrules" && f.message.includes("line overlap"),
			);
			expect(report.consistent).toBe(false);
			expect(dupWarning).toBeDefined();
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("reports error when a derived surface is unreadable", () => {
		const dir = createTempRepo();
		try {
			writeFileSync(join(dir, "AGENTS.md"), CANONICAL_AGENTS);
			mkdirSync(join(dir, ".cursorrules"));
			const report = validateInstructionConsistency(dir);
			const derivedReadError = report.findings.find(
				(f) =>
					f.file === ".cursorrules" && f.message.includes("could not be read"),
			);
			expect(report.consistent).toBe(false);
			expect(derivedReadError).toBeDefined();
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("reports info for optional missing derived surfaces", () => {
		const dir = createTempRepo();
		try {
			writeFileSync(join(dir, "AGENTS.md"), CANONICAL_AGENTS);
			const report = validateInstructionConsistency(dir);
			const infoFinding = report.findings.find(
				(f) =>
					f.severity === "info" &&
					f.message.includes("Optional derived instruction surface"),
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
			writeFileSync(join(dir, ".cursorrules"), DERIVED_CURSOR);
			const report = validateInstructionConsistency(dir);
			expect(report.surfacesChecked).toBe(2);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});

describe("generateDerivedHeader", () => {
	it("rejects canonical surface header generation", () => {
		expect(() => generateDerivedHeader("codex")).toThrow(
			"generateDerivedHeader only supports derived surfaces",
		);
	});

	it("generates header for cursor", () => {
		const header = generateDerivedHeader("cursor");
		expect(header).toContain("# Cursor Instructions");
		expect(header).toContain("Canonical source");
		expect(header).toContain("AGENTS.md");
		expect(header).toContain("@./AGENTS.md");
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

	it("has derived surfaces for supported agents", () => {
		const derived = AGENT_SURFACES.filter((s) => s.role === "derived");
		const agents = derived.map((s) => s.agent);
		expect(agents).toContain("cursor");
		expect(agents).toContain("copilot");
	});
});

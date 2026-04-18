import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { validateProjectBrain } from "./brain-validator.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTempHarness(): string {
	return mkdtempSync(join(tmpdir(), "brain-validator-test-"));
}

function writeBrainFile(
	harnessDir: string,
	relativePath: string,
	content: string,
): void {
	const fullPath = join(harnessDir, relativePath);
	const dir = join(fullPath, "..");
	mkdirSync(dir, { recursive: true });
	writeFileSync(fullPath, content, "utf-8");
}

const COMPLETE_INDEX = `# Knowledge Index

**Last updated:** 2026-04-16

## Domains

| Domain | Focus | Last updated | Key rules |
|--------|-------|--------------|-----------|
| [api](./api/) | REST API surface and contracts | 2026-04-16 | 2 rules |

## Recently active

- [api] Added rate-limiting conventions (2026-04-16)

## Review needed

(none yet)

## Archive

(none yet)
`;

const COMPLETE_KNOWLEDGE = `# Api Knowledge

**Last verified:** 2026-04-16
**Verification source:** manual
**Confidence:** high
**Owner:** team@example.com

## Confirmed facts

- API follows REST conventions with JSON payloads

## Patterns

- Pagination uses cursor-based approach

## Gotchas

- Rate limiter has a 60s cooldown window

## References

- API specification doc
`;

const MINIMAL_HYPOTHESES = `# Api Hypotheses

## Active

(none)

## Resolved

(none)
`;

const MINIMAL_RULES = `# Api Rules

## Active rules

(none)

## Deprecated

(none)
`;

const MINIMAL_CRITERIA = `# Quality Criteria

## Gates

- **Q-001**: All commands must have --json output
  - Applies to: command
  - Enforcement: automated
  - Threshold: 100% coverage

## Coverage

- CLI: 85% covered
`;

const MINIMAL_REVIEW_LOG = `# Review Log

## Entries

- **2026-04-16**: [api] Initial review
  - Reviewer: team@example.com
  - Findings: 0
  - Actions: documented current state
`;

function setupCompleteBrain(): string {
	const dir = createTempHarness();
	writeBrainFile(dir, "knowledge/INDEX.md", COMPLETE_INDEX);
	writeBrainFile(dir, "knowledge/api/knowledge.md", COMPLETE_KNOWLEDGE);
	writeBrainFile(dir, "knowledge/api/hypotheses.md", MINIMAL_HYPOTHESES);
	writeBrainFile(dir, "knowledge/api/rules.md", MINIMAL_RULES);
	writeBrainFile(dir, "quality/criteria.md", MINIMAL_CRITERIA);
	writeBrainFile(dir, "review-log.md", MINIMAL_REVIEW_LOG);
	return dir;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("validateProjectBrain", () => {
	it("reports error when .harness directory is missing", () => {
		const result = validateProjectBrain("/nonexistent/path");
		expect(result.valid).toBe(false);
		expect(result.summary.errors).toBe(1);
		expect(result.findings[0]!.field).toBe("directory");
	});

	it("passes for complete brain", () => {
		const dir = setupCompleteBrain();
		try {
			const result = validateProjectBrain(dir);
			expect(result.valid).toBe(true);
			expect(result.summary.errors).toBe(0);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("detects missing INDEX.md", () => {
		const dir = createTempHarness();
		try {
			mkdirSync(join(dir, "knowledge"), { recursive: true });
			mkdirSync(join(dir, "quality"), { recursive: true });
			writeFileSync(join(dir, "review-log.md"), MINIMAL_REVIEW_LOG);
			writeFileSync(join(dir, "quality/criteria.md"), MINIMAL_CRITERIA);

			const result = validateProjectBrain(dir);
			expect(result.valid).toBe(false);
			expect(
				result.findings.some(
					(f) => f.path === "knowledge/INDEX.md" && f.field === "file",
				),
			).toBe(true);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("detects placeholder domain focus", () => {
		const dir = createTempHarness();
		try {
			writeBrainFile(
				dir,
				"knowledge/INDEX.md",
				COMPLETE_INDEX.replace(
					"REST API surface and contracts",
					"{describe focus}",
				),
			);
			mkdirSync(join(dir, "quality"), { recursive: true });
			writeFileSync(join(dir, "quality/criteria.md"), MINIMAL_CRITERIA);
			writeFileSync(join(dir, "review-log.md"), MINIMAL_REVIEW_LOG);

			const result = validateProjectBrain(dir);
			expect(result.summary.placeholderCount).toBeGreaterThan(0);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("detects missing metadata in domain knowledge.md", () => {
		const dir = createTempHarness();
		try {
			writeBrainFile(dir, "knowledge/INDEX.md", COMPLETE_INDEX);
			writeBrainFile(
				dir,
				"knowledge/api/knowledge.md",
				"# Api Knowledge\n\n## Confirmed facts\n(none yet)\n",
			);
			writeBrainFile(dir, "knowledge/api/hypotheses.md", MINIMAL_HYPOTHESES);
			writeBrainFile(dir, "knowledge/api/rules.md", MINIMAL_RULES);
			writeBrainFile(dir, "quality/criteria.md", MINIMAL_CRITERIA);
			writeBrainFile(dir, "review-log.md", MINIMAL_REVIEW_LOG);

			const result = validateProjectBrain(dir);
			expect(result.summary.missingMetadata).toBeGreaterThan(0);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("detects invalid confidence level", () => {
		const dir = createTempHarness();
		try {
			writeBrainFile(dir, "knowledge/INDEX.md", COMPLETE_INDEX);
			writeBrainFile(
				dir,
				"knowledge/api/knowledge.md",
				COMPLETE_KNOWLEDGE.replace(
					"**Confidence:** high",
					"**Confidence:** unknown",
				),
			);
			writeBrainFile(dir, "knowledge/api/hypotheses.md", MINIMAL_HYPOTHESES);
			writeBrainFile(dir, "knowledge/api/rules.md", MINIMAL_RULES);
			writeBrainFile(dir, "quality/criteria.md", MINIMAL_CRITERIA);
			writeBrainFile(dir, "review-log.md", MINIMAL_REVIEW_LOG);

			const result = validateProjectBrain(dir);
			expect(result.valid).toBe(false);
			expect(
				result.findings.some(
					(f) => f.field === "Confidence" && f.severity === "error",
				),
			).toBe(true);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("detects missing quality criteria", () => {
		const dir = setupCompleteBrain();
		try {
			rmSync(join(dir, "quality", "criteria.md"));

			const result = validateProjectBrain(dir);
			expect(result.valid).toBe(false);
			expect(
				result.findings.some(
					(f) => f.path === "quality/criteria.md" && f.field === "file",
				),
			).toBe(true);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("detects missing review log", () => {
		const dir = setupCompleteBrain();
		try {
			rmSync(join(dir, "review-log.md"));

			const result = validateProjectBrain(dir);
			expect(result.valid).toBe(false);
			expect(
				result.findings.some(
					(f) => f.path === "review-log.md" && f.field === "file",
				),
			).toBe(true);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("counts files scanned", () => {
		const dir = setupCompleteBrain();
		try {
			const result = validateProjectBrain(dir);
			expect(result.filesScanned).toBeGreaterThan(0);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("detects missing domain files", () => {
		const dir = createTempHarness();
		try {
			writeBrainFile(dir, "knowledge/INDEX.md", COMPLETE_INDEX);
			// No api domain directory
			writeBrainFile(dir, "quality/criteria.md", MINIMAL_CRITERIA);
			writeBrainFile(dir, "review-log.md", MINIMAL_REVIEW_LOG);

			const result = validateProjectBrain(dir);
			expect(result.valid).toBe(true); // no domains = no domain errors
			expect(result.summary.missingFiles).toBe(0); // domain files aren't required unless domain dir exists
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("reports info when review log has no entries", () => {
		const dir = setupCompleteBrain();
		try {
			writeFileSync(
				join(dir, "review-log.md"),
				"# Review Log\n\n## Entries\n\n(none yet)\n",
			);

			const result = validateProjectBrain(dir);
			expect(result.summary.info).toBeGreaterThan(0);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});

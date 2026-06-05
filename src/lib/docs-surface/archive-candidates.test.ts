import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	formatDocsArchiveCandidatesText,
	runDocsArchiveCandidates,
} from "./archive-candidates.js";

describe("runDocsArchiveCandidates", () => {
	it("protects canonical docs and reports superseded supporting docs", () => {
		const repoRoot = createFixture({
			"README.md": "# Product\n",
			"docs/old.md": frontmatter({
				authority: "supporting",
				canon_class: "supporting",
				lifecycle_state: "superseded",
				last_reviewed: "2025-01-01",
			}),
		});

		const report = runDocsArchiveCandidates({
			repoRoot,
			trackedFiles: ["README.md", "docs/old.md"],
			now: new Date("2026-06-05T00:00:00.000Z"),
			activeArtifactsContent: "",
		});

		expect(report.repoRef).toBe(".");
		expect(report.advisoryOnly).toBe(true);
		expect(report.summary.actionAuthority).toBe("advisory_only");
		expect(report.summary.mutationSupported).toBe(false);
		expect(report.protectedFiles).toContainEqual(
			expect.objectContaining({
				path: "README.md",
				reasons: expect.arrayContaining(["root_entrypoint"]),
			}),
		);
		expect(report.candidates).toContainEqual(
			expect.objectContaining({
				path: "docs/old.md",
				reasons: ["superseded_status"],
				suggestedAction: "create_separate_archive_decision",
				actionAuthority: "advisory_only",
				requiresReviewedDecision: true,
				confidence: "medium",
			}),
		);
	});

	it("treats stale active-artifacts routes as repair-only evidence", () => {
		const repoRoot = createFixture({
			".harness/plan/current.md": frontmatter({
				authority: "execution-input",
				lifecycle_status: "execution-input",
				last_reviewed: "2026-06-04",
			}),
		});

		const report = runDocsArchiveCandidates({
			repoRoot,
			trackedFiles: [".harness/plan/current.md"],
			now: new Date("2026-06-05T00:00:00.000Z"),
			activeArtifactsContent:
				"[Missing](.harness/plan/missing.md) and [current](.harness/plan/current.md)",
		});

		expect(report.repairFindings).toContainEqual(
			expect.objectContaining({
				path: ".harness/active-artifacts.md",
				code: "active_reference_stale_or_unverified",
			}),
		);
		expect(report.protectedFiles).toContainEqual(
			expect.objectContaining({
				path: ".harness/plan/current.md",
				reasons: expect.arrayContaining(["execution_input"]),
			}),
		);
		expect(report.candidates).toEqual([]);
	});

	it("protects active artifact paths listed in Markdown table cells", () => {
		const repoRoot = createFixture({
			".harness/specs/current.md": frontmatter({
				authority: "supporting",
				canon_class: "supporting",
				lifecycle_state: "superseded",
			}),
		});

		const report = runDocsArchiveCandidates({
			repoRoot,
			trackedFiles: [".harness/specs/current.md"],
			now: new Date("2026-06-05T00:00:00.000Z"),
			activeArtifactsContent: [
				"| Route | Artifact |",
				"| --- | --- |",
				"| JSC-395 | .harness/specs/current.md |",
			].join("\n"),
		});

		expect(report.repairFindings).toEqual([]);
		expect(report.protectedFiles).toContainEqual(
			expect.objectContaining({
				path: ".harness/specs/current.md",
				reasons: expect.arrayContaining(["active_artifact_reference"]),
			}),
		);
		expect(report.candidates).toEqual([]);
	});

	it("ignores generated projections and points reviewers at the source", () => {
		const repoRoot = createFixture({
			"AI/context/diagram-context.md": "# Generated\n",
		});

		const report = runDocsArchiveCandidates({
			repoRoot,
			trackedFiles: ["AI/context/diagram-context.md"],
			now: new Date("2026-06-05T00:00:00.000Z"),
			activeArtifactsContent: "",
		});

		expect(report.candidates).toEqual([]);
		expect(report.ignoredFiles).toContainEqual(
			expect.objectContaining({
				path: "AI/context/diagram-context.md",
				reason: "generated_output_do_not_edit",
			}),
		);
		expect(report.repairFindings).toContainEqual(
			expect.objectContaining({
				path: "AI/context/diagram-context.md",
				code: "repair_generated_source_link",
				suggestedAction: "repair_generated_source_link",
			}),
		);
	});

	it("renders bounded human output", () => {
		const repoRoot = createFixture({
			"docs/old.md": frontmatter({
				authority: "supporting",
				canon_class: "supporting",
				lifecycle_state: "superseded",
			}),
		});
		const report = runDocsArchiveCandidates({
			repoRoot,
			trackedFiles: ["docs/old.md"],
			now: new Date("2026-06-05T00:00:00.000Z"),
			activeArtifactsContent: "",
		});

		expect(formatDocsArchiveCandidatesText(report)).toContain(
			"docs archive candidates: advisory-only",
		);
	});
});

function createFixture(files: Record<string, string>): string {
	const repoRoot = mkdtempSync(join(tmpdir(), "archive-candidates-"));
	for (const [path, content] of Object.entries(files)) {
		mkdirSync(dirname(join(repoRoot, path)), { recursive: true });
		writeFileSync(join(repoRoot, path), content, "utf8");
	}
	return repoRoot;
}

function frontmatter(fields: Record<string, string>): string {
	const body = Object.entries(fields)
		.map(([key, value]) => `${key}: ${value}`)
		.join("\n");
	return `---\n${body}\n---\n# Document\n`;
}

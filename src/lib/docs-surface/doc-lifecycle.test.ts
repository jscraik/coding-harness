import { mkdtempSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	DOC_LIFECYCLE_RULE_ID,
	collectDocLifecycleViolations,
	validateDocLifecycle,
} from "./doc-lifecycle.js";

describe("validateDocLifecycle", () => {
	it("passes a governed document that matches the lifecycle manifest", () => {
		const repoRoot = createRepo();
		writeLifecycleManifest(repoRoot, "docs/lifecycle/example.md");
		writeGovernedDoc(repoRoot, "docs/lifecycle/example.md");

		expect(validateDocLifecycle({ repoRoot })).toEqual(
			expect.objectContaining({
				status: "pass",
				checkedDocuments: ["docs/lifecycle/example.md"],
				violations: [],
			}),
		);
	});

	it("blocks downstream templates that reference source-only docs", () => {
		const repoRoot = createRepo();
		writeLifecycleManifest(repoRoot, "docs/lifecycle/example.md");
		writeGovernedDoc(repoRoot, "docs/lifecycle/example.md");
		writeFile(
			repoRoot,
			"src/templates/AGENTS.md",
			"Read docs/lifecycle/example.md before running this template.\n",
		);

		expect(validateDocLifecycle({ repoRoot }).violations).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					path: "src/templates/AGENTS.md",
					severity: "error",
					message:
						"Downstream template references a source-only document: docs/lifecycle/example.md",
				}),
			]),
		);
	});

	it("stays inactive for docs-gate when no lifecycle manifest exists", () => {
		const repoRoot = createRepo();

		expect(
			collectDocLifecycleViolations({
				repoRoot,
				changedFiles: ["README.md"],
			}),
		).toEqual([]);
	});

	it("exposes a stable docs-gate rule id", () => {
		expect(DOC_LIFECYCLE_RULE_ID).toBe("docs.lifecycle.metadata");
	});

	it("blocks touched .harness lifecycle artifacts without metadata", () => {
		const repoRoot = createRepo();
		writeLifecycleManifest(repoRoot, "docs/lifecycle/example.md");
		writeGovernedDoc(repoRoot, "docs/lifecycle/example.md");
		writeFile(
			repoRoot,
			".harness/research/audits/missing-metadata.md",
			"# Missing metadata\n",
		);

		expect(
			collectDocLifecycleViolations({
				repoRoot,
				changedFiles: [".harness/research/audits/missing-metadata.md"],
			}),
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					path: ".harness/research/audits/missing-metadata.md",
					severity: "error",
					classification: "required",
					message: ".harness lifecycle artifact is missing YAML frontmatter.",
				}),
			]),
		);
	});

	it("blocks deleted governed docs even when the file is absent from changed files", () => {
		const repoRoot = createRepo();
		writeLifecycleManifest(repoRoot, "docs/lifecycle/example.md");
		writeGovernedDoc(repoRoot, "docs/lifecycle/example.md");
		unlinkSync(join(repoRoot, "docs/lifecycle/example.md"));

		expect(
			collectDocLifecycleViolations({
				repoRoot,
				changedFiles: [],
				deletedFiles: new Set(["docs/lifecycle/example.md"]),
			}),
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					path: "docs/lifecycle/example.md",
					severity: "error",
					message: "Governed document listed in manifest does not exist.",
				}),
			]),
		);
	});

	it("reports malformed manifest entries instead of throwing", () => {
		const repoRoot = createRepo();
		writeFile(
			repoRoot,
			"docs/doc-lifecycle-manifest.json",
			JSON.stringify({
				schema: "coding-harness-doc-lifecycle-manifest/v1",
				generatedAt: "2026-06-04T00:00:00Z",
				documents: [null],
			}),
		);

		expect(validateDocLifecycle({ repoRoot }).violations).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					path: "docs/doc-lifecycle-manifest.json",
					severity: "error",
					message:
						"Each manifest document entry must be an object with string path.",
				}),
			]),
		);
	});

	it("treats empty required frontmatter scalars as missing metadata", () => {
		const repoRoot = createRepo();
		writeLifecycleManifest(repoRoot, "docs/lifecycle/example.md");
		writeGovernedDoc(repoRoot, "docs/lifecycle/example.md");
		writeFile(
			repoRoot,
			"docs/lifecycle/example.md",
			[
				"---",
				"doc_schema: coding-harness-doc/v1",
				"doc_type: lifecycle",
				"authority: canon",
				"canon_class: canonical",
				"distribution: source-only",
				"audience:",
				"  - codex-agent",
				"lifecycle_state: active",
				"owner:",
				"created: 2026-06-04",
				"last_reviewed: 2026-06-04",
				"review_cadence: quarterly",
				"maintenance_trigger:",
				"  - lifecycle-change",
				"semver_impact: minor",
				"validated_by:",
				"  - pnpm docs:lifecycle",
				"depends_on:",
				"  - AGENTS.md",
				"---",
				"",
				"# Example",
				"",
			].join("\n"),
		);

		expect(validateDocLifecycle({ repoRoot }).violations).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					path: "docs/lifecycle/example.md",
					severity: "error",
					message: "Governed document is missing owner metadata.",
				}),
			]),
		);
	});

	it("accepts touched .harness execution-input metadata", () => {
		const repoRoot = createRepo();
		writeLifecycleManifest(repoRoot, "docs/lifecycle/example.md");
		writeGovernedDoc(repoRoot, "docs/lifecycle/example.md");
		writeHarnessArtifact(repoRoot, ".harness/specs/example-spec.md", {
			authority: "execution-input",
			lifecycleStatus: "execution-input",
			canonicalDestination: "scripts/check-doc-lifecycle.ts",
		});

		expect(
			collectDocLifecycleViolations({
				repoRoot,
				changedFiles: [".harness/specs/example-spec.md"],
			}),
		).toEqual([]);
	});

	it("reports opted-in historical .harness gaps as advisory during full validation", () => {
		const repoRoot = createRepo();
		writeLifecycleManifest(repoRoot, "docs/lifecycle/example.md");
		writeGovernedDoc(repoRoot, "docs/lifecycle/example.md");
		writeFile(
			repoRoot,
			".harness/research/audits/legacy-reviewed.md",
			[
				"---",
				"lifecycle_schema: harness-document-lifecycle/v1",
				"artifact_id: legacy-reviewed",
				"artifact_type: research-audit",
				"source_type: operator-requested-audit",
				"authority: secondary-context",
				"lifecycle_status: reviewed",
				"canonical_destination: none",
				"---",
				"",
				"# Legacy Reviewed",
				"",
			].join("\n"),
		);

		const report = validateDocLifecycle({ repoRoot });

		expect(report.status).toBe("pass");
		expect(report.checkedHarnessArtifacts).toEqual([
			".harness/research/audits/legacy-reviewed.md",
		]);
		expect(report.advisoryFindings).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					path: ".harness/research/audits/legacy-reviewed.md",
					severity: "warning",
					classification: "advisory",
					message: ".harness lifecycle artifact is missing owner metadata.",
				}),
			]),
		);
	});
});

function createRepo(): string {
	return mkdtempSync(join(tmpdir(), "doc-lifecycle-"));
}

function writeLifecycleManifest(repoRoot: string, path: string): void {
	writeFile(
		repoRoot,
		"docs/doc-lifecycle-manifest.json",
		JSON.stringify(
			{
				schema: "coding-harness-doc-lifecycle-manifest/v1",
				generatedAt: "2026-06-04T00:00:00Z",
				documents: [
					{
						path,
						purpose: "Example lifecycle document.",
						audience: ["codex-agent"],
						lifecycleStage: "execute",
						knowledgeCategory: "lifecycle-governance",
						canonicality: "canon",
						docType: "lifecycle",
						distribution: "source-only",
						lifecycleState: "active",
						owner: "coding-harness-maintainers",
						semverDefault: "minor",
						dependsOn: ["AGENTS.md"],
					},
				],
			},
			null,
			2,
		),
	);
	writeFile(repoRoot, "AGENTS.md", "# Agent instructions\n");
}

function writeGovernedDoc(repoRoot: string, path: string): void {
	writeFile(
		repoRoot,
		path,
		[
			"---",
			"doc_schema: coding-harness-doc/v1",
			"doc_type: lifecycle",
			"authority: canon",
			"canon_class: canonical",
			"distribution: source-only",
			"audience:",
			"  - codex-agent",
			"lifecycle_state: active",
			"owner: coding-harness-maintainers",
			"created: 2026-06-04",
			"last_reviewed: 2026-06-04",
			"review_cadence: quarterly",
			"maintenance_trigger:",
			"  - lifecycle-change",
			"semver_impact: minor",
			"validated_by:",
			"  - pnpm docs:lifecycle",
			"depends_on:",
			"  - AGENTS.md",
			"---",
			"",
			"# Example",
			"",
		].join("\n"),
	);
}

function writeHarnessArtifact(
	repoRoot: string,
	path: string,
	options: {
		authority: string;
		lifecycleStatus: string;
		canonicalDestination: string;
	},
): void {
	writeFile(
		repoRoot,
		path,
		[
			"---",
			"lifecycle_schema: harness-document-lifecycle/v1",
			"artifact_id: example-spec",
			"artifact_type: he-spec",
			"source_type: spec",
			`authority: ${options.authority}`,
			`lifecycle_status: ${options.lifecycleStatus}`,
			`canonical_destination: ${options.canonicalDestination}`,
			"owner: coding-harness-maintainers",
			"created: 2026-06-04",
			"last_reviewed: 2026-06-04",
			"review_cadence: event-driven",
			"validated_by:",
			"  - pnpm docs:lifecycle",
			"depends_on:",
			"  - docs/lifecycle/example.md",
			"---",
			"",
			"# Example Spec",
			"",
		].join("\n"),
	);
}

function writeFile(repoRoot: string, path: string, content: string): void {
	mkdirSync(dirname(join(repoRoot, path)), { recursive: true });
	writeFileSync(join(repoRoot, path), content);
}

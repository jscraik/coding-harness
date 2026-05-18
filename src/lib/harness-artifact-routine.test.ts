import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { validateHarnessArtifactRoutine } from "./harness-artifact-routine.js";

describe("validateHarnessArtifactRoutine", () => {
	const tempDirs: string[] = [];

	afterEach(() => {
		for (const tempDir of tempDirs.splice(0)) {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	function makeRepo(
		options: { activeIndex?: string; plan?: string; spec?: string } = {},
	): string {
		const repoRoot = mkdtempSync(join(tmpdir(), "artifact-routine-"));
		tempDirs.push(repoRoot);
		mkdirSync(join(repoRoot, ".harness/plan"), { recursive: true });
		mkdirSync(join(repoRoot, "docs"), { recursive: true });
		writeFileSync(
			join(repoRoot, ".harness/active-artifacts.md"),
			options.activeIndex ?? activeIndexText(".harness/plan/current.md"),
			"utf8",
		);
		writeFileSync(
			join(repoRoot, ".harness/plan/current.md"),
			options.plan ?? activePlanText(),
			"utf8",
		);
		writeFileSync(
			join(repoRoot, "docs/spec.md"),
			options.spec ?? "# Spec\n",
			"utf8",
		);
		return repoRoot;
	}

	it("passes when active artifacts are fresh, owned, tracked, and resolvable", () => {
		const repoRoot = makeRepo();

		const result = validateHarnessArtifactRoutine({
			repoRoot,
			today: "2026-05-18",
		});

		expect(result.status).toBe("pass");
		expect(result.schemaVersion).toBe("artifact-handling-routine/v1");
		expect(result.referencedArtifacts).toEqual([".harness/plan/current.md"]);
		expect(result.findings).toEqual([]);
	});

	it("requires active plans to name a Linear issue or local-only owner", () => {
		const repoRoot = makeRepo({
			plan: activePlanText().replace("linear_issue: JSC-331\n", ""),
		});

		const result = validateHarnessArtifactRoutine({
			repoRoot,
			today: "2026-05-18",
		});

		expect(result.status).toBe("fail");
		expect(result.findings).toContainEqual(
			expect.objectContaining({
				check: "linear_owner",
				code: "linear_owner_missing",
				path: ".harness/plan/current.md",
			}),
		);
	});

	it("returns a structured failure when active index path is a directory", () => {
		const repoRoot = makeRepo();

		const result = validateHarnessArtifactRoutine({
			activeIndexPath: ".harness",
			repoRoot,
			today: "2026-05-18",
		});

		expect(result.status).toBe("fail");
		expect(result.findings).toContainEqual(
			expect.objectContaining({
				check: "active_index",
				code: "active_index_not_file",
				path: ".harness",
			}),
		);
		expect(result.checks.linear_owner).toBe("not_run");
	});

	it("fails when a referenced source artifact is missing", () => {
		const repoRoot = makeRepo({
			plan: activePlanText().replace(
				"source_spec: docs/spec.md",
				"source_spec: docs/missing.md",
			),
		});

		const result = validateHarnessArtifactRoutine({
			repoRoot,
			today: "2026-05-18",
		});

		expect(result.findings).toContainEqual(
			expect.objectContaining({
				check: "reference_integrity",
				code: "referenced_path_missing",
				path: ".harness/plan/current.md",
			}),
		);
	});

	it("returns a structured failure when an active artifact path is a directory", () => {
		const repoRoot = makeRepo();
		rmSync(join(repoRoot, ".harness/plan/current.md"));
		mkdirSync(join(repoRoot, ".harness/plan/current.md"));

		const result = validateHarnessArtifactRoutine({
			repoRoot,
			today: "2026-05-18",
		});

		expect(result.status).toBe("fail");
		expect(result.findings).toContainEqual(
			expect.objectContaining({
				check: "reference_integrity",
				code: "artifact_not_file",
				path: ".harness/plan/current.md",
			}),
		);
	});

	it("ignores glob-style implementation scopes in plan prose", () => {
		const repoRoot = makeRepo({
			plan:
				activePlanText() +
				[
					"",
					"Allowed paths: `src/commands/**`, `src/lib/**/*.test.ts`, and `e2e/**`.",
				].join("\n"),
		});

		const result = validateHarnessArtifactRoutine({
			repoRoot,
			today: "2026-05-18",
		});

		expect(result.status).toBe("pass");
	});

	it("fails when the active index has not been reconciled today", () => {
		const repoRoot = makeRepo({
			activeIndex: activeIndexText(".harness/plan/current.md", "2026-05-17"),
		});

		const result = validateHarnessArtifactRoutine({
			repoRoot,
			today: "2026-05-18",
		});

		expect(result.findings).toContainEqual(
			expect.objectContaining({
				check: "closeout_refresh",
				code: "active_index_stale",
			}),
		);
	});

	it("rejects runtime artifacts as route-driving inputs", () => {
		const repoRoot = makeRepo({
			activeIndex: activeIndexText("artifacts/reviews/testing-reviewer.md"),
		});

		const result = validateHarnessArtifactRoutine({
			repoRoot,
			today: "2026-05-18",
		});

		expect(result.findings).toContainEqual(
			expect.objectContaining({
				check: "runtime_boundary",
				code: "runtime_artifact_is_route_driving",
				path: "artifacts/reviews/testing-reviewer.md",
			}),
		);
	});

	it("rejects traversal artifact references after path normalization", () => {
		const repoRoot = makeRepo({
			activeIndex: activeIndexText("docs/../../outside.md"),
		});

		const result = validateHarnessArtifactRoutine({
			repoRoot,
			today: "2026-05-18",
		});

		expect(result.findings).toContainEqual(
			expect.objectContaining({
				check: "reference_integrity",
				code: "artifact_path_outside_repo",
				path: "docs/../../outside.md",
			}),
		);
	});

	it("flags unclassified artifact-index rows", () => {
		const repoRoot = makeRepo({
			activeIndex: activeIndexText(".harness/plan/current.md").replace(
				"Active assurance",
				"Unknown",
			),
		});

		const result = validateHarnessArtifactRoutine({
			repoRoot,
			today: "2026-05-18",
		});

		expect(result.findings).toContainEqual(
			expect.objectContaining({
				check: "stale_frontmatter_guard",
				code: "artifact_status_unclassified",
			}),
		);
	});

	it("fails when the Artifact Index table is missing", () => {
		const repoRoot = makeRepo({
			activeIndex: activeIndexText(".harness/plan/current.md").replace(
				/\n## Artifact Index[\s\S]*$/,
				"\n",
			),
		});

		const result = validateHarnessArtifactRoutine({
			repoRoot,
			today: "2026-05-18",
		});

		expect(result.findings).toContainEqual(
			expect.objectContaining({
				check: "stale_frontmatter_guard",
				code: "artifact_index_missing",
			}),
		);
	});

	it("parses CRLF front matter in active plans", () => {
		const repoRoot = makeRepo({
			plan: activePlanText().replace(/\n/g, "\r\n"),
		});

		const result = validateHarnessArtifactRoutine({
			repoRoot,
			today: "2026-05-18",
		});

		expect(result.findings).not.toContainEqual(
			expect.objectContaining({
				check: "linear_owner",
				code: "linear_owner_missing",
			}),
		);
		expect(result.status).toBe("pass");
	});

	it("does not report unexecuted checks as pass on early active-index failures", () => {
		const repoRoot = makeRepo();

		const result = validateHarnessArtifactRoutine({
			activeIndexPath: "../outside.md",
			repoRoot,
			today: "2026-05-18",
		});

		expect(result.status).toBe("fail");
		expect(result.checks.active_index).toBe("fail");
		expect(result.checks.linear_owner).toBe("not_run");
		expect(result.checks.reference_integrity).toBe("not_run");
		expect(result.checks.runtime_boundary).toBe("not_run");
	});

	it("uses the artifact-index header to classify reordered local status cells", () => {
		const tick = String.fromCharCode(96);
		const repoRoot = makeRepo({
			activeIndex: [
				"# Active Harness Specs And Plans",
				"",
				"## Scope",
				"",
				"Last reconciled: 2026-05-18.",
				"",
				"## Current Active Route",
				"",
				"| Route | Linear Key | Canonical Artifacts | Status | Next Safe Action |",
				"| --- | --- | --- | --- | --- |",
				"| Harness assurance | JSC-331 | " +
					tick +
					".harness/plan/current.md" +
					tick +
					" | Active | Run artifact-routine. |",
				"",
				"## Artifact Index",
				"",
				"| Linear Key | Local Status | Canonical Slug | Active Spec | Active Plan | Notes |",
				"| --- | --- | --- | --- | --- | --- |",
				"| JSC-331 | Unknown | harness-assurance | n.a. | " +
					tick +
					".harness/plan/current.md" +
					tick +
					" | Current. |",
				"",
			].join("\n"),
		});

		const result = validateHarnessArtifactRoutine({
			repoRoot,
			today: "2026-05-18",
		});

		expect(result.findings).toContainEqual(
			expect.objectContaining({
				check: "stale_frontmatter_guard",
				code: "artifact_status_unclassified",
			}),
		);
	});
});

function activeIndexText(
	canonicalArtifact: string,
	reconciledDate = "2026-05-18",
): string {
	const tick = String.fromCharCode(96);
	return [
		"# Active Harness Specs And Plans",
		"",
		"## Scope",
		"",
		`Last reconciled: ${reconciledDate}.`,
		"",
		"## Current Active Route",
		"",
		"| Route | Linear Key | Canonical Artifacts | Status | Next Safe Action |",
		"| --- | --- | --- | --- | --- |",
		"| Harness assurance | JSC-331 | " +
			tick +
			canonicalArtifact +
			tick +
			" | Active | Run artifact-routine. |",
		"",
		"## Artifact Index",
		"",
		"| Linear Key | Canonical Slug | Active Spec | Active Plan | Local Status | Notes |",
		"| --- | --- | --- | --- | --- | --- |",
		"| JSC-331 | harness-assurance | n.a. | " +
			tick +
			".harness/plan/current.md" +
			tick +
			" | Active assurance | Current. |",
		"",
	].join("\n");
}

function activePlanText(): string {
	const tick = String.fromCharCode(96);
	return [
		"---",
		"schema_version: 1",
		"status: active",
		"linear_issue: JSC-331",
		"source_spec: docs/spec.md",
		"owner: coding-harness-maintainers",
		"---",
		"",
		"# Plan",
		"",
		`Source: ${tick}docs/spec.md${tick}`,
	].join("\n");
}

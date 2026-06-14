import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { assessActiveRouteRefs } from "./active-route-refs.js";

describe("assessActiveRouteRefs", () => {
	const tempDirs: string[] = [];

	afterEach(() => {
		for (const tempDir of tempDirs.splice(0)) {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	it("resolves shorthand refs relative to the current route file", () => {
		const repoRoot = makeRepo(tempDirs);
		const tick = String.fromCharCode(96);
		writeRepoFile(repoRoot, "docs/goals/demo/current-route.json", "{}\n");
		writeRepoFile(repoRoot, "docs/goals/demo/state.yaml", "status: active\n");
		writeRepoFile(
			repoRoot,
			"docs/goals/demo/notes/execution-tracker.md",
			"# Tracker\n",
		);
		writeRepoFile(repoRoot, "docs/goals/demo/receipts.jsonl", "{}\n");

		const assessment = assessActiveRouteRefs({
			repoRoot,
			activeArtifactsPath: ".harness/active-artifacts.md",
			activeArtifactsText: [
				"# Active",
				"",
				"## Current Active Route",
				"",
				"| Work | Refs |",
				"|---|---|",
				[
					"| Ready | ",
					tick,
					"docs/goals/demo/current-route.json",
					tick,
					", ",
					tick,
					"state.yaml",
					tick,
					", ",
					tick,
					"notes/execution-tracker.md",
					tick,
					", ",
					tick,
					"receipts.jsonl",
					tick,
					", and receipt ",
					tick,
					"abc123",
					tick,
					". |",
				].join(""),
				"",
				"## Artifact Index",
			].join("\n"),
		});

		expect(assessment).toEqual({
			evidenceRefs: [
				"docs/goals/demo/current-route.json",
				"docs/goals/demo/state.yaml",
				"docs/goals/demo/notes/execution-tracker.md",
				"docs/goals/demo/receipts.jsonl",
			],
			staleReasons: [],
			missingRefs: [],
		});
	});

	it("attributes unresolved route refs to the active-artifacts route section", () => {
		const repoRoot = makeRepo(tempDirs);
		const tick = String.fromCharCode(96);
		writeRepoFile(repoRoot, "docs/goals/demo/current-route.json", "{}\n");

		const assessment = assessActiveRouteRefs({
			repoRoot,
			activeArtifactsPath: ".harness/active-artifacts.md",
			activeArtifactsText: [
				"# Active",
				"",
				"## Current Active Route",
				"",
				[
					tick,
					"docs/goals/demo/current-route.json",
					tick,
					" and ",
					tick,
					"docs/goals/demo/missing.md",
					tick,
					".",
				].join(""),
				"",
				"## Artifact Index",
			].join("\n"),
		});

		expect(assessment.evidenceRefs).toEqual([
			"docs/goals/demo/current-route.json",
		]);
		expect(assessment.missingRefs).toEqual([
			{
				ref: "docs/goals/demo/missing.md",
				declaredBy: ".harness/active-artifacts.md#Current Active Route",
				normalizedPath: "docs/goals/demo/missing.md",
				reason: "missing_ref",
			},
		]);
		expect(assessment.staleReasons).toEqual([
			[
				"Active route ref ",
				tick,
				"docs/goals/demo/missing.md",
				tick,
				" declared by .harness/active-artifacts.md#Current Active Route is missing.",
			].join(""),
		]);
	});

	it("warns when the route section has no repo-relative refs", () => {
		const repoRoot = makeRepo(tempDirs);
		const tick = String.fromCharCode(96);
		const assessment = assessActiveRouteRefs({
			repoRoot,
			activeArtifactsPath: ".harness/active-artifacts.md",
			activeArtifactsText: [
				"# Active",
				"",
				"## Current Active Route",
				"",
				[tick, "abc123", tick, " and ", tick, "tracker_scope", tick, "."].join(
					"",
				),
				"",
				"## Artifact Index",
			].join("\n"),
		});

		expect(assessment).toEqual({
			evidenceRefs: [],
			missingRefs: [],
			staleReasons: [
				"Current Active Route does not contain repo-relative artifact refs.",
			],
		});
	});
});

function makeRepo(tempDirs: string[]): string {
	const repoRoot = mkdtempSync(join(tmpdir(), "active-route-refs-"));
	tempDirs.push(repoRoot);
	return repoRoot;
}

function writeRepoFile(repoRoot: string, path: string, content: string): void {
	const fullPath = join(repoRoot, path);
	mkdirSync(dirname(fullPath), { recursive: true });
	writeFileSync(fullPath, content, "utf8");
}

import { describe, expect, it } from "vitest";
import {
	renderCheckDiagramFreshnessScript,
	renderDiagramRcTemplate,
	renderInitialDiagramContextTemplate,
	renderRefreshDiagramContextScript,
} from "./scaffold-diagram-templates.js";

describe("scaffold diagram templates", () => {
	it("loads the canonical diagram refresh script", () => {
		const script = renderRefreshDiagramContextScript();

		expect(script).toContain("#!/usr/bin/env bash");
		expect(script).toContain("pnpm exec diagram all .");
		expect(script).toContain('MAX_FILES="${DIAGRAM_REFRESH_MAX_FILES:-1000}"');
		expect(script).toContain("const sourceManifest = (() => {");
		expect(script).toContain("...sourceManifest,");

		expect(script).toContain("normalizedRawNodeKey(node.rawId)");

		expect(script).toContain("artifacts/tmp-*/**");
		expect(script).toContain('cp "$TMP_DIR/diagrams/manifest.json"');
	});

	it("loads the canonical diagram freshness checker", () => {
		const script = renderCheckDiagramFreshnessScript();

		expect(script).toContain("is_architecture_sensitive_change()");
		expect(script).toContain("TRACKED_ARTIFACT_PATHS=(");
		expect(script).toContain(".diagram/context/diagram-context.meta.json");
		expect(script).toContain("Normalize volatile Mermaid node identifiers");
		expect(script).toContain("tracked_files=()");
		expect(script).toContain(
			'bash "$REPO_ROOT/scripts/refresh-diagram-context.sh" --force --quiet',
		);
	});

	it("renders the initial diagram context placeholder", () => {
		const context = renderInitialDiagramContextTemplate();

		expect(context).toContain("# Diagram Context Pack");
		expect(context).toContain("Reference this file to understand:");

		expect(context).toContain("Database and ERD relationships");
		expect(context).toContain("harness source-outline <path>");
		expect(context).toContain(
			"bash scripts/harness-cli.sh source-outline <path> --json",
		);
		expect(context).toContain(
			"bash scripts/refresh-diagram-context.sh --dry-run",
		);
		expect(context).toContain("pnpm exec diagram all . --output-dir .diagram");
		expect(context).toContain(
			"bash scripts/refresh-diagram-context.sh --force",
		);
		expect(context).toContain("jq '.generatedAt' .diagram/manifest.json");
	});

	it("renders the default diagram CLI config", () => {
		const config = JSON.parse(renderDiagramRcTemplate());

		expect(config.ignore).toEqual([
			"node_modules",
			"dist",
			"coverage",
			"artifacts",
			".git",
			".diagram",
		]);
	});
});

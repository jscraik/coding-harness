import { describe, expect, it } from "vitest";
import { GITBOOK_TEMPLATES } from "./scaffold-gitbook-templates.js";

describe("GitBook and context-reference scaffolds", () => {
	it("emits a private-safe public docs surface and logical context reference", () => {
		const paths = GITBOOK_TEMPLATES.map((template) => template.path);
		expect(paths).toContain(".gitbook.yaml");
		expect(paths).toContain("docs/public/SUMMARY.md");
		expect(paths).toContain("scripts/check-gitbook-readiness.mjs");
		expect(paths).toContain(".harness/project-context-ref.json");
		const reference = GITBOOK_TEMPLATES.find((template) =>
			template.path.endsWith("project-context-ref.json"),
		);
		expect(
			reference?.render("pnpm", {
				targetDir: "/tmp/demo",
				projectName: "demo",
				packageScripts: [],
			}),
		).toContain('"project_id": "demo"');
	});
});

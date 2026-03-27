import { describe, expect, it } from "vitest";
import { getTemplatesForProvider } from "./scaffold.js";

describe("scaffold templates resolution", () => {
	it("includes .greptile by default", () => {
		const templates = getTemplatesForProvider("circleci");
		const greptileTemplates = templates.filter((t) =>
			t.path.includes(".greptile"),
		);
		expect(greptileTemplates.length).toBeGreaterThan(0);
	});

	it("omits .greptile when greptile option is explicitly false", () => {
		const templates = getTemplatesForProvider("circleci", {
			dryRun: false,
			force: false,
			greptile: false,
		});
		const greptileTemplates = templates.filter((t) =>
			t.path.includes(".greptile"),
		);
		expect(greptileTemplates.length).toBe(0);
	});

	it("omits .greptile and non-essential templates when minimal mode is enabled", () => {
		const templates = getTemplatesForProvider("circleci", {
			dryRun: false,
			force: false,
			minimal: true,
		});
		const greptileTemplates = templates.filter((t) =>
			t.path.includes(".greptile"),
		);
		const codeownersTemplates = templates.filter((t) =>
			t.path.includes("CODEOWNERS"),
		);

		expect(greptileTemplates.length).toBe(0);
		expect(codeownersTemplates.length).toBe(0);

		// .github/workflows/pr-pipeline.yml is omitted in minimal mode
		// Let's just check `.github` related stuff except issue templates which are removed
		// We expect strict reduction in templates
		expect(templates.length).toBeLessThan(
			getTemplatesForProvider("circleci").length,
		);
	});

	it("includes issue tracker templates when explicitly set to github", () => {
		const templates = getTemplatesForProvider("circleci", {
			dryRun: false,
			force: false,
			issueTracker: "github",
		});
		const issueTemplates = templates.filter((t) =>
			t.path.includes("ISSUE_TEMPLATE"),
		);
		expect(issueTemplates.length).toBeGreaterThan(0);
	});

	it("omits issue tracker templates when explicitly set to none", () => {
		const templates = getTemplatesForProvider("circleci", {
			dryRun: false,
			force: false,
			issueTracker: "none",
		});
		const issueTemplates = templates.filter((t) =>
			t.path.includes("ISSUE_TEMPLATE"),
		);
		expect(issueTemplates.length).toBe(0);
	});
});

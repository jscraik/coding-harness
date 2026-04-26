import { describe, expect, it } from "vitest";
import {
	selectTemplatesForProvider,
	shouldEmitTemplateForInit,
} from "./scaffold-template-selection.js";
import type { Template } from "./types.js";

const templates: Template[] = [
	{ path: "harness.contract.json", render: () => "" },
	{ path: ".harness/ci-required-checks.json", render: () => "" },
	{ path: ".circleci/config.yml", render: () => "" },
	{ path: ".github/workflows/pr-pipeline.yml", render: () => "" },
	{ path: ".github/workflows/release-private-npm.yml", render: () => "" },
	{ path: ".github/CODEOWNERS", render: () => "" },
	{ path: ".github/ISSUE_TEMPLATE/config.yml", render: () => "" },
	{ path: ".linear/settings.json", render: () => "" },
];

function selectedPaths(
	options?: Parameters<typeof selectTemplatesForProvider>[2],
) {
	return selectTemplatesForProvider(templates, "circleci", options).map(
		(template) => template.path,
	);
}

describe("scaffold template selection", () => {
	it("applies provider-specific CI template rules", () => {
		expect(shouldEmitTemplateForInit(".circleci/config.yml", "circleci")).toBe(
			true,
		);
		expect(
			shouldEmitTemplateForInit(".circleci/config.yml", "github-actions"),
		).toBe(false);
		expect(
			shouldEmitTemplateForInit(
				".github/workflows/pr-pipeline.yml",
				"github-actions",
			),
		).toBe(true);
		expect(
			shouldEmitTemplateForInit(
				".github/workflows/pr-pipeline.yml",
				"circleci",
			),
		).toBe(false);
	});

	it("keeps the private release workflow provider-neutral", () => {
		expect(
			shouldEmitTemplateForInit(
				".github/workflows/release-private-npm.yml",
				"circleci",
			),
		).toBe(true);
		expect(
			shouldEmitTemplateForInit(
				".github/workflows/release-private-npm.yml",
				"github-actions",
			),
		).toBe(true);
	});

	it("omits enterprise governance templates in minimal mode", () => {
		const paths = selectedPaths({ dryRun: false, force: false, minimal: true });

		expect(paths).not.toContain(".github/CODEOWNERS");
		expect(paths).not.toContain(".harness/ci-required-checks.json");
		expect(paths).toContain("harness.contract.json");
	});

	it("omits Linear templates when issue tracking is not Linear-backed", () => {
		expect(
			selectedPaths({
				dryRun: false,
				force: false,
				issueTracker: "github",
			}),
		).not.toContain(".linear/settings.json");
		expect(
			selectedPaths({
				dryRun: false,
				force: false,
				issueTracker: "none",
			}),
		).not.toContain(".linear/settings.json");
		expect(
			selectedPaths({ dryRun: false, force: false, minimal: true }),
		).not.toContain(".linear/settings.json");
	});

	it("omits issue templates only when issue tracking is disabled", () => {
		expect(
			selectedPaths({
				dryRun: false,
				force: false,
				issueTracker: "github",
			}),
		).toContain(".github/ISSUE_TEMPLATE/config.yml");
		expect(
			selectedPaths({
				dryRun: false,
				force: false,
				issueTracker: "none",
			}),
		).not.toContain(".github/ISSUE_TEMPLATE/config.yml");
	});
});

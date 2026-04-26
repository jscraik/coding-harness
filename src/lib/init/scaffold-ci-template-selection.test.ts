import { describe, expect, it } from "vitest";
import {
	DEFAULT_CI_PROVIDER,
	isTemplateEnabledForProvider,
} from "./scaffold-ci-template-selection.js";

describe("scaffold CI template selection", () => {
	it("uses CircleCI as the default scaffold provider", () => {
		expect(DEFAULT_CI_PROVIDER).toBe("circleci");
	});

	it("always emits the private npm release workflow", () => {
		expect(
			isTemplateEnabledForProvider(
				".github/workflows/release-private-npm.yml",
				"circleci",
			),
		).toBe(true);
	});

	it("emits GitHub Actions workflows only when GitHub Actions is selected", () => {
		expect(
			isTemplateEnabledForProvider(
				".github/workflows/pr-pipeline.yml",
				"circleci",
			),
		).toBe(false);
		expect(
			isTemplateEnabledForProvider(
				".github/workflows/pr-pipeline.yml",
				"github-actions",
			),
		).toBe(true);
	});

	it("emits CircleCI config only when CircleCI is selected", () => {
		expect(
			isTemplateEnabledForProvider(".circleci/config.yml", "circleci"),
		).toBe(true);
		expect(
			isTemplateEnabledForProvider(".circleci/config.yml", "github-actions"),
		).toBe(false);
	});

	it("emits provider-neutral templates for every provider", () => {
		expect(
			isTemplateEnabledForProvider("harness.contract.json", "circleci"),
		).toBe(true);
		expect(
			isTemplateEnabledForProvider("harness.contract.json", "github-actions"),
		).toBe(true);
	});
});

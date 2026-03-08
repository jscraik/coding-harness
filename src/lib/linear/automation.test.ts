import { describe, expect, it } from "vitest";
import {
	buildLinearAutomationMetadata,
	validateLinearAutomationBranch,
} from "./automation.js";

describe("buildLinearAutomationMetadata", () => {
	it("replaces the default Linear git prefix with codex while keeping the issue key", () => {
		const result = buildLinearAutomationMetadata({
			identifier: "JSC-37",
			title:
				"Enable GitHub to Linear branch and PR automation for the coding-harness workflow",
			url: "https://linear.app/jscraik/issue/JSC-37/example",
			branchName:
				"jscraik/jsc-37-enable-github-to-linear-branch-and-pr-automation-for-the",
		});

		expect(result.branchName).toBe(
			"codex/jsc-37-enable-github-to-linear-branch-and-pr-automation-for-the",
		);
		expect(result.prTitle).toBe(
			"JSC-37: Enable GitHub to Linear branch and PR automation for the coding-harness workflow",
		);
		expect(result.linkLine).toBe("Refs JSC-37");
		expect(result.closingLine).toBe("Fixes JSC-37");
		expect(result.prBody).toContain(
			"Linear: https://linear.app/jscraik/issue/JSC-37/example",
		);
	});

	it("falls back to a slugified title when Linear branch metadata is unavailable", () => {
		const result = buildLinearAutomationMetadata({
			identifier: "JSC-99",
			title: "Ship a Better Branch Helper!",
			url: "https://linear.app/jscraik/issue/JSC-99/example",
		});

		expect(result.branchName).toBe("codex/jsc-99-ship-a-better-branch-helper");
	});
});

describe("validateLinearAutomationBranch", () => {
	it("accepts branches that start with codex/ and include the issue key", () => {
		expect(
			validateLinearAutomationBranch({
				branch:
					"codex/jsc-37-enable-github-to-linear-branch-and-pr-automation-for-the",
				issueIdentifier: "JSC-37",
			}),
		).toEqual({ ok: true, errors: [] });
	});

	it("rejects branches that omit the codex prefix or issue key", () => {
		expect(
			validateLinearAutomationBranch({
				branch: "feature/automation-cleanup",
				issueIdentifier: "JSC-37",
			}),
		).toEqual({
			ok: false,
			errors: [
				"Branch must start with codex/.",
				"Branch must include the Linear issue key JSC-37 to enable branch and PR linking.",
			],
		});
	});
});

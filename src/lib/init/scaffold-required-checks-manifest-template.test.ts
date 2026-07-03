import { describe, expect, it } from "vitest";
import {
	getBranchProtectionRequiredChecks,
	getNormalizedRequiredChecks,
	renderRequiredChecksManifest,
} from "./scaffold-required-checks-manifest-template.js";

interface RenderedRequiredCheck {
	displayName: string;
	sourceAppSlug: string;
	externalIdPattern: string;
	githubCheckName: string;
}

function getRenderedRequiredCheck(
	checks: RenderedRequiredCheck[],
	displayName: string,
): RenderedRequiredCheck {
	const check = checks.find(
		(candidate) => candidate.displayName === displayName,
	);
	if (!check) {
		throw new Error(`Missing rendered required check: ${displayName}`);
	}
	return check;
}

describe("scaffold required-checks manifest template", () => {
	it("omits Linear checks when issue tracking is not Linear-backed", () => {
		expect(
			getBranchProtectionRequiredChecks({ issueTracker: "github" }),
		).not.toContain("linear-gate");
		expect(
			getBranchProtectionRequiredChecks({ issueTracker: "none" }),
		).not.toContain("linear-gate");
	});

	it("keeps security-scan immediately before CodeRabbit for CircleCI checks", () => {
		const checks = getNormalizedRequiredChecks("circleci");
		const securityScanIndex = checks.indexOf("security-scan");
		const codeRabbitIndex = checks.indexOf("CodeRabbit");

		expect(securityScanIndex).toBeGreaterThanOrEqual(0);
		expect(codeRabbitIndex).toBeGreaterThanOrEqual(0);
		expect(securityScanIndex).toBe(codeRabbitIndex - 1);
		expect(checks).not.toContain("semgrep-cloud-platform/scan");
	});

	it("keeps CircleCI fan-out gates distinct from GitHub required check names", () => {
		const manifest = JSON.parse(renderRequiredChecksManifest("circleci"));
		const requiredChecks = manifest.requiredChecks as RenderedRequiredCheck[];

		expect(
			new Set(requiredChecks.map((check) => check.githubCheckName)),
		).toEqual(new Set(["pr-pipeline", "security-scan", "CodeRabbit"]));

		for (const displayName of [
			"pr-template",
			"linear-gate",
			"risk-policy-gate",
			"dependency-scan",
			"orb-pinning",
			"consistency-drift-health",
			"docs-gate",
			"lint",
			"typecheck",
			"test",
			"audit",
			"check",
			"memory",
		]) {
			expect(
				getRenderedRequiredCheck(requiredChecks, displayName),
			).toMatchObject({
				sourceAppSlug: "circleci",
				externalIdPattern: "^pr-pipeline$",
				githubCheckName: "pr-pipeline",
			});
		}

		expect(
			getRenderedRequiredCheck(requiredChecks, "security-scan"),
		).toMatchObject({
			sourceAppSlug: "circleci",
			externalIdPattern: "^security-scan$",
			githubCheckName: "security-scan",
		});
		expect(
			getRenderedRequiredCheck(requiredChecks, "CodeRabbit"),
		).toMatchObject({
			sourceAppSlug: "coderabbit",
			externalIdPattern: "^CodeRabbit$",
			githubCheckName: "CodeRabbit",
		});
		expect(
			requiredChecks.some(
				(check) => check.displayName === "semgrep-cloud-platform/scan",
			),
		).toBe(false);
	});

	it("renders provider metadata into required-check manifest", () => {
		const manifest = JSON.parse(renderRequiredChecksManifest("circleci"));

		expect(manifest.activeProvider).toBe("circleci");
		expect(manifest.requiredChecks).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					displayName: "security-scan",
					githubCheckName: "security-scan",
					requiredOnEvents: ["pull_request", "merge_group"],
				}),
			]),
		);
		expect(
			manifest.requiredChecks.some(
				(check: RenderedRequiredCheck) =>
					check.displayName === "semgrep-cloud-platform/scan",
			),
		).toBe(false);
	});
});

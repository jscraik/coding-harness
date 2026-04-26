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

	it("injects external security checks around CodeRabbit for CircleCI checks", () => {
		const checks = getNormalizedRequiredChecks("circleci");
		const securityScanIndex = checks.indexOf("security-scan");
		const codeRabbitIndex = checks.indexOf("CodeRabbit");
		const semgrepCloudIndex = checks.indexOf("semgrep-cloud-platform/scan");

		expect(securityScanIndex).toBeGreaterThanOrEqual(0);
		expect(codeRabbitIndex).toBeGreaterThanOrEqual(0);
		expect(semgrepCloudIndex).toBeGreaterThanOrEqual(0);
		expect(securityScanIndex).toBe(codeRabbitIndex - 1);
		expect(semgrepCloudIndex).toBe(codeRabbitIndex + 1);
	});

	it("keeps CircleCI fan-out gates distinct from GitHub required check names", () => {
		const manifest = JSON.parse(renderRequiredChecksManifest("circleci"));
		const requiredChecks = manifest.requiredChecks as RenderedRequiredCheck[];

		expect(
			new Set(requiredChecks.map((check) => check.githubCheckName)),
		).toEqual(
			new Set([
				"pr-pipeline",
				"security-scan",
				"CodeRabbit",
				"semgrep-cloud-platform/scan",
			]),
		);

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
			getRenderedRequiredCheck(requiredChecks, "semgrep-cloud-platform/scan"),
		).toMatchObject({
			sourceAppSlug: "semgrep-cloud-platform",
			externalIdPattern: "^semgrep-cloud-platform/scan$",
			githubCheckName: "semgrep-cloud-platform/scan",
		});
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
				expect.objectContaining({
					displayName: "semgrep-cloud-platform/scan",
					sourceAppSlug: "semgrep-cloud-platform",
					githubCheckName: "semgrep-cloud-platform/scan",
					requiredOnEvents: ["pull_request", "merge_group"],
				}),
			]),
		);
	});
});

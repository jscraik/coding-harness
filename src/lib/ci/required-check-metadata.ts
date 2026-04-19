import type { CIProvider } from "../init/types.js";
import { CIRCLECI_PRIMARY_CHECK } from "./branch-protect-sync.js";

export interface RequiredCheckMetadata {
	sourceAppSlug: string;
	sourceAppId: string;
	githubCheckName: string;
	class: "required" | "informational";
	enabled?: boolean;
}

const CIRCLECI_WORKFLOW_OWNED_CHECKS = new Set<string>([
	"pr-pipeline",
	"harness-gates",
	"lint",
	"typecheck",
	"test",
	"audit",
	"check",
	"build",
	"memory",
	"dependency-scan",
	"orb-pinning",
	"docs-gate",
	"linear-gate",
	"risk-policy-gate",
	"consistency-drift-health",
	"pr-template",
]);

/**
 * Derive canonical required-check metadata for scaffold and migration flows.
 *
 * @param provider - CI provider context for non-external checks
 * @param displayName - Required check display name
 * @returns Normalized source ownership, GitHub check identity, and active class metadata
 */
export function deriveRequiredCheckMetadata(
	provider: CIProvider,
	displayName: string,
): RequiredCheckMetadata {
	if (displayName === "CodeRabbit") {
		return {
			sourceAppSlug: "coderabbit",
			sourceAppId: "coderabbit",
			githubCheckName: "CodeRabbit",
			class: "required",
		};
	}
	if (displayName === "security-scan") {
		const isCircleCiSecurityScan = provider === "circleci";
		return {
			sourceAppSlug: "github-actions",
			sourceAppId: "github-actions",
			githubCheckName: "security-scan",
			class: isCircleCiSecurityScan ? "informational" : "required",
			...(isCircleCiSecurityScan ? { enabled: false } : {}),
		};
	}
	if (provider === "circleci") {
		if (CIRCLECI_WORKFLOW_OWNED_CHECKS.has(displayName)) {
			return {
				sourceAppSlug: "circleci",
				sourceAppId: "circleci",
				githubCheckName: CIRCLECI_PRIMARY_CHECK,
				class: "required",
			};
		}
		return {
			sourceAppSlug: "external",
			sourceAppId: "external",
			githubCheckName: displayName,
			class: "required",
		};
	}
	return {
		sourceAppSlug: provider,
		sourceAppId: provider,
		githubCheckName: displayName,
		class: "required",
	};
}

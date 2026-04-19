import type { CIProvider } from "../init/types.js";
import { CIRCLECI_PRIMARY_CHECK } from "./branch-protect-sync.js";

export interface RequiredCheckMetadata {
	sourceAppSlug: string;
	sourceAppId: string;
	githubCheckName: string;
	class: "required" | "informational";
	enabled?: boolean;
}

export interface DeriveRequiredCheckMetadataOptions {
	circleciPrimaryCheckName?: string;
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
	options?: DeriveRequiredCheckMetadataOptions,
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
		const circleciPrimaryCheckName =
			typeof options?.circleciPrimaryCheckName === "string" &&
			options.circleciPrimaryCheckName.trim().length > 0
				? options.circleciPrimaryCheckName.trim()
				: CIRCLECI_PRIMARY_CHECK;
		if (CIRCLECI_WORKFLOW_OWNED_CHECKS.has(displayName)) {
			return {
				sourceAppSlug: "circleci",
				sourceAppId: "circleci",
				githubCheckName: circleciPrimaryCheckName,
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

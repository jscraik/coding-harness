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
	CIRCLECI_PRIMARY_CHECK,
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
	"security-scan",
]);

/**
 * Produce normalized required-check metadata (source ownership, GitHub check name, class, and optional enabled) from a CI provider and display name.
 *
 * @param provider - The CI provider identifier used to determine source ownership (e.g., `"circleci"`, `"github-actions"`, or other provider slugs`)
 * @param displayName - The display name of the required check; certain names (e.g., `"CodeRabbit"`, `"security-scan"`) are handled specially
 * @param options - Optional derivation flags
 * @param options.circleciPrimaryCheckName - When present and non-empty, overrides the CircleCI primary check name used to map workflow-owned CircleCI checks
 * @returns A `RequiredCheckMetadata` object with `sourceAppSlug`, `sourceAppId`, `githubCheckName`, `class` (`"required"` | `"informational"`), and optionally `enabled` when a check should be disabled by default
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
		if (provider === "circleci") {
			return {
				sourceAppSlug: "circleci",
				sourceAppId: "circleci",
				githubCheckName:
					options?.circleciPrimaryCheckName?.trim() || CIRCLECI_PRIMARY_CHECK,
				class: "required",
			};
		}
		return {
			sourceAppSlug: "github-actions",
			sourceAppId: "github-actions",
			githubCheckName: "security-scan",
			class: "required",
		};
	}
	if (provider === "circleci") {
		const circleciPrimaryCheckName =
			typeof options?.circleciPrimaryCheckName === "string" &&
			options.circleciPrimaryCheckName.trim().length > 0
				? options.circleciPrimaryCheckName.trim()
				: CIRCLECI_PRIMARY_CHECK;
		const normalizedDisplayName = displayName.trim();
		const isCircleCiWorkflowOwnedCheck =
			CIRCLECI_WORKFLOW_OWNED_CHECKS.has(normalizedDisplayName) ||
			normalizedDisplayName === CIRCLECI_PRIMARY_CHECK ||
			normalizedDisplayName === circleciPrimaryCheckName;
		if (isCircleCiWorkflowOwnedCheck) {
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
			githubCheckName: normalizedDisplayName,
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

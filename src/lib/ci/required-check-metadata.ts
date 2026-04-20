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
 * Derive normalized required-check metadata (source ownership, GitHub check name, and class) for a given CI provider and check display name.
 *
 * Special handling:
 * - A display name of `"CodeRabbit"` maps to the `coderabbit` source and `CodeRabbit` GitHub check name.
 * - A display name of `"security-scan"` maps to CircleCI primary check metadata when `provider` is `"circleci"`, otherwise to the `github-actions` source with GitHub check name `"security-scan"`.
 * - For CircleCI, certain workflow-owned check names (including the configured primary check) are mapped to the CircleCI primary check name; other CircleCI names are treated as external checks.
 *
 * @param provider - CI provider slug used to determine source ownership (for example, `"circleci"` or `"github-actions"`)
 * @param displayName - The display name of the required check; some display names are treated specially as described above
 * @param options - Optional derivation flags
 * @param options.circleciPrimaryCheckName - When present and non-empty, overrides the CircleCI primary check name used to represent workflow-owned CircleCI checks
 * @returns A `RequiredCheckMetadata` object containing `sourceAppSlug`, `sourceAppId`, `githubCheckName`, and `class` (`"required"` or `"informational"`)
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

import { deriveRequiredCheckMetadata } from "../ci/required-check-metadata.js";
import { ECOSYSTEM_PROFILES } from "../policy/required-checks.js";
import type { CIProvider, TemplateRenderContext } from "./types.js";

/**
 * Determine which branch-protection required check identifiers apply for a render context.
 *
 * @param context - Optional render context subset; only `issueTracker` is consulted.
 * @returns Required check identifiers with `linear-gate` removed when Linear tracking is disabled.
 */
export function getBranchProtectionRequiredChecks(
	context?: Pick<TemplateRenderContext, "issueTracker">,
): readonly string[] {
	if (context?.issueTracker === "github" || context?.issueTracker === "none") {
		return ECOSYSTEM_PROFILES.harness.filter(
			(check) => check !== "linear-gate",
		);
	}

	return ECOSYSTEM_PROFILES.harness;
}

/**
 * Get the canonical list of required branch-check identifiers for a CI provider and context.
 *
 * @param ciProvider - CI provider used to normalize required checks.
 * @param context - Optional render context whose `issueTracker` can alter check selection.
 * @returns Normalized, ordered required-check identifiers for scaffold outputs.
 */
export function getNormalizedRequiredChecks(
	ciProvider: CIProvider,
	context?: Pick<TemplateRenderContext, "issueTracker">,
): readonly string[] {
	const baseChecks = getBranchProtectionRequiredChecks(context);
	return ciProvider === "circleci"
		? insertSecurityScanBeforeCodeRabbit(baseChecks)
		: baseChecks;
}

function insertSecurityScanBeforeCodeRabbit(
	checks: readonly string[],
): readonly string[] {
	if (checks.includes("security-scan")) {
		return checks;
	}
	const codeRabbitIndex = checks.indexOf("CodeRabbit");
	if (codeRabbitIndex === -1) {
		return [...checks, "security-scan"];
	}
	return [
		...checks.slice(0, codeRabbitIndex),
		"security-scan",
		...checks.slice(codeRabbitIndex),
	];
}

/**
 * Generate the JSON manifest describing required CI checks for branch protection.
 *
 * @param ciProvider - Target CI provider for provider-specific check metadata.
 * @param context - Optional render context; only `issueTracker` is consulted for check selection.
 * @returns Pretty-printed JSON manifest with provider metadata and required checks.
 */
export function renderRequiredChecksManifest(
	ciProvider: CIProvider,
	context?: Pick<TemplateRenderContext, "issueTracker">,
): string {
	const checksWithSecurityScan = getNormalizedRequiredChecks(
		ciProvider,
		context,
	);

	const requiredChecks = checksWithSecurityScan.map((displayName, index) => {
		const metadata = deriveRequiredCheckMetadata(ciProvider, displayName);
		return {
			policyId: `required-check-${index + 1}`,
			displayName,
			sourceAppSlug: metadata.sourceAppSlug,
			sourceAppId: metadata.sourceAppId,
			externalIdPattern: `^${escapeRegexLiteral(metadata.githubCheckName)}$`,
			requiredOnEvents: ["pull_request", "merge_group"] as const,
			freshnessWindowDays: 7,
			class: metadata.class,
			enabled: metadata.enabled,
			githubCheckName: metadata.githubCheckName,
		};
	});

	return JSON.stringify(
		{
			version: 1,
			activeProvider: ciProvider,
			requiredChecks,
		},
		null,
		2,
	);
}

function escapeRegexLiteral(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

import { SECURITY_SCAN_CHECK_NAME } from "./required-check-names.js";

/**
 * Ecosystem profiles for branch protection required checks.
 *
 * These profiles provide sensible defaults for different technology stacks.
 * Use --ecosystem flag with harness branch-protect to select a profile.
 */
export type EcosystemProfile = keyof typeof ECOSYSTEM_PROFILES;

export const ECOSYSTEM_PROFILES = {
	/**
	 * coding-harness itself - full governance suite with all checks.
	 */
	harness: [
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
		SECURITY_SCAN_CHECK_NAME,
		"CodeRabbit",
	] as const,

	/**
	 * TypeScript/Node.js projects using pnpm.
	 */
	typescript: [
		"lint",
		"typecheck",
		"test",
		"audit",
		"dependency-scan",
		SECURITY_SCAN_CHECK_NAME,
	] as const,

	/**
	 * Python projects using uv/pytest.
	 */
	python: [
		"lint",
		"test",
		"dependency-scan",
		SECURITY_SCAN_CHECK_NAME,
	] as const,

	/**
	 * Rust projects using cargo.
	 */
	rust: ["lint", "test", SECURITY_SCAN_CHECK_NAME] as const,

	/**
	 * Swift/iOS/macOS projects.
	 */
	swift: ["lint", "test", SECURITY_SCAN_CHECK_NAME] as const,

	/**
	 * Go projects.
	 */
	go: ["lint", "test", SECURITY_SCAN_CHECK_NAME] as const,

	/**
	 * Minimal profile - just security and basic checks.
	 * Use for experiments, docs, or custom setups.
	 */
	minimal: ["lint", SECURITY_SCAN_CHECK_NAME] as const,
} as const;

/**
 * Default required checks for backwards compatibility.
 * Maps to the "harness" profile.
 */
export const BRANCH_PROTECTION_REQUIRED_CHECKS = [
	"pr-pipeline",
	SECURITY_SCAN_CHECK_NAME,
	"CodeRabbit",
] as const;

/** Format required checks as an inline Markdown list. */
export function formatRequiredChecksInline(
	checks: readonly string[] = BRANCH_PROTECTION_REQUIRED_CHECKS,
): string {
	return checks.map((check) => `\`${check}\``).join(", ");
}

/** Format required checks as Markdown bullet lines with a configurable prefix. */
export function formatRequiredChecksBulleted(
	checks: readonly string[] = BRANCH_PROTECTION_REQUIRED_CHECKS,
	indent = "  - ",
): string {
	return checks.map((check) => `${indent}\`${check}\``).join("\n");
}

/**
 * Get required checks for an ecosystem profile.
 * Returns undefined if the profile doesn't exist.
 */
export function getEcosystemChecks(
	ecosystem: string,
): readonly string[] | undefined {
	if (!Object.hasOwn(ECOSYSTEM_PROFILES, ecosystem)) return undefined;
	return ECOSYSTEM_PROFILES[ecosystem as EcosystemProfile];
}

/**
 * List available ecosystem profiles.
 */
export function listEcosystemProfiles(): string[] {
	return Object.keys(ECOSYSTEM_PROFILES);
}

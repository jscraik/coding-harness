export const REVIEW_POLICY_REQUIRED_CHECKS = [
	"security-scan",
	"dependency-review",
	"actions-pinning",
] as const;

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
		"dependency-review",
		"actions-pinning",
		"consistency-drift-health",
		"docs-gate",
		"lint",
		"typecheck",
		"test",
		"audit",
		"check",
		"memory",
		"security-scan",
		"Greptile Review",
	] as const,

	/**
	 * TypeScript/Node.js projects using pnpm.
	 */
	typescript: [
		"lint",
		"typecheck",
		"test",
		"audit",
		"security-scan",
		"dependency-review",
	] as const,

	/**
	 * Python projects using uv/pytest.
	 */
	python: ["lint", "test", "security-scan", "dependency-review"] as const,

	/**
	 * Rust projects using cargo.
	 */
	rust: ["lint", "test", "security-scan"] as const,

	/**
	 * Swift/iOS/macOS projects.
	 */
	swift: ["lint", "test", "security-scan"] as const,

	/**
	 * Go projects.
	 */
	go: ["lint", "test", "security-scan"] as const,

	/**
	 * Minimal profile - just security and basic checks.
	 * Use for experiments, docs, or custom setups.
	 */
	minimal: ["security-scan"] as const,
} as const;

/**
 * Default required checks for backwards compatibility.
 * Maps to the "harness" profile.
 */
export const BRANCH_PROTECTION_REQUIRED_CHECKS = ECOSYSTEM_PROFILES.harness;

export function formatRequiredChecksInline(
	checks: readonly string[] = BRANCH_PROTECTION_REQUIRED_CHECKS,
): string {
	return checks.map((check) => `\`${check}\``).join(", ");
}

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
	return ECOSYSTEM_PROFILES[ecosystem as EcosystemProfile];
}

/**
 * List available ecosystem profiles.
 */
export function listEcosystemProfiles(): string[] {
	return Object.keys(ECOSYSTEM_PROFILES);
}

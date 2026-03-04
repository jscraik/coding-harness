export const REVIEW_POLICY_REQUIRED_CHECKS = [
	"security-scan",
	"dependency-review",
	"actions-pinning",
] as const;

export const BRANCH_PROTECTION_REQUIRED_CHECKS = [
	"pr-template",
	"risk-policy-gate",
	"dependency-review",
	"actions-pinning",
	"lint",
	"typecheck",
	"test",
	"audit",
	"check",
	"memory",
	"security-scan",
	"Greptile Review",
] as const;

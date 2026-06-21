export const EXPECTED_ARTIFACTS_BY_NAME: Partial<Record<string, string[]>> = {
	"check-environment": ["artifacts/policy/environment-attestation.json"],
	"context-health": ["artifacts/context-integrity/index-source-inventory.json"],
	"prompt-context-drift:write": [
		"artifacts/context-integrity/prompt-context-drift-report.json",
	],
	"prompt-context-drift:validate": [
		"artifacts/context-integrity/prompt-context-drift-report.json",
	],
	"ci-migrate": [".harness/ci-provider-transition-status.json"],
	"fleet-plan": ["artifacts/harness-upgrade-matrix-dev.json"],
	"artifact-gate": [".harness/artifact-provenance.json"],
	"artifact-routine": [".harness/active-artifacts.md"],
	"ci-ownership-gate": ["harness.contract.json"],
	"review-context": ["artifacts/review-context/pr-context.json"],
	"pattern-scope": ["artifacts/pattern-scope/pattern-scope.json"],
	"pr-closeout": ["artifacts/pr-closeout/pr-closeout.json"],
	"feedback-loop-audit": [".harness/feedback-loops/index.json"],
};

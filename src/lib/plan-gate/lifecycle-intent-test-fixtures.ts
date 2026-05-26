import {
	CODEX_RUNTIME_EVIDENCE_ACCEPTANCE_IDS,
	CODEX_RUNTIME_EVIDENCE_LIFECYCLE_UNITS,
	LIFECYCLE_INTENT_UNKNOWN_RUNTIME_PATH_POLICY,
} from "./lifecycle-intent-types.js";
import type { AcceptanceCoverageEntry } from "./lifecycle-intent.js";

/** Build a valid reviewed lifecycle implementation intent fixture. */
export function validLifecycleIntent(): Record<string, unknown> {
	return {
		schemaVersion: "implementation-intent/v1",
		intentId: "codex-runtime-evidence-verifier-cockpit-pu-000",
		createdAt: "2026-05-24T21:39:40Z",
		objective: "Prove implementation is gated by reviewed lifecycle intent.",
		sourcePlan:
			".harness/plan/2026-05-24-codex-runtime-evidence-verifier-cockpit-plan.md",
		sourceSpec:
			".harness/specs/2026-05-24-codex-runtime-evidence-verifier-cockpit-spec.md",
		linearIssue: "JSC-363",
		ownedAcceptanceIds: ["SA-017", "SA-018"],
		deepModuleBoundary: "src/lib/plan-gate/lifecycle-intent*",
		lifecycleUnit: "PU-000",
		inScope: [
			"src/lib/plan-gate/lifecycle-intent*.ts",
			"src/lib/plan-gate/lifecycle-intent*.test.ts",
			".harness/intent/codex-runtime-evidence-verifier-cockpit-implementation-intent.json",
			".harness/intent/codex-runtime-evidence-verifier-cockpit-contract-baseline.json",
		],
		outOfScope: [
			"Runtime evidence implementation files for PU-001 through PU-016 before this intent is reviewed",
		],
		guardedPathGlobs: [
			"src/lib/evidence/**",
			"src/lib/runtime/**",
			"src/lib/delivery-truth/**",
			"src/lib/review-state/**",
			"src/lib/external-state/**",
			"src/lib/pr-closeout/**",
			"src/commands/runtime-card.ts",
			"src/commands/next*.ts",
			"scripts/**",
			"docs/agents/**",
			"AGENTS.md",
			"README.md",
			"harness.contract.json",
		],
		unknownRuntimePathPolicy: LIFECYCLE_INTENT_UNKNOWN_RUNTIME_PATH_POLICY,
		mechanicalAcceptanceIds: [...CODEX_RUNTIME_EVIDENCE_ACCEPTANCE_IDS],
		nonMechanicalAcceptanceRationales: [],
		automationPlan: [
			{
				name: "intent artifact validation",
				command:
					"pnpm vitest run src/lib/plan-gate/lifecycle-intent-artifact-validation.test.ts",
				proves: ["SA-017"],
			},
		],
		reviewPlan: {
			requiredBeforeImplementation: true,
			reviewers: [
				"adversarial-reviewer",
				"agent-native-reviewer",
				"best-practices-researcher",
			],
			artifactPaths: [
				"artifacts/reviews/codex-runtime-evidence-pu-000-plan-gate-adversarial.md",
				"artifacts/reviews/codex-runtime-evidence-pu-000-plan-gate-agent-native.md",
				"artifacts/reviews/codex-runtime-evidence-pu-000-plan-gate-best-practices.md",
			],
		},
		reviewStatus: "reviewed",
		reviewedBy: [
			"adversarial-reviewer",
			"agent-native-reviewer",
			"best-practices-researcher",
		],
		reviewReceiptRef:
			".harness/intent/codex-runtime-evidence-verifier-cockpit-pu-000-review-receipt.json",
		reviewedAt: "2026-05-24T22:00:00Z",
		reviewedIntentSha256: "a".repeat(64),
		baselineRef:
			".harness/intent/codex-runtime-evidence-verifier-cockpit-contract-baseline.json",
		reviewReceiptRequirements: {
			intentId: "codex-runtime-evidence-verifier-cockpit-pu-000",
			intentSha256Field: "reviewedIntentSha256",
			requiredReviewerRoles: [
				"adversarial-reviewer",
				"agent-native-reviewer",
				"best-practices-researcher",
			],
			requiredArtifactRefs: [
				"artifacts/reviews/codex-runtime-evidence-pu-000-plan-gate-adversarial.md",
				"artifacts/reviews/codex-runtime-evidence-pu-000-plan-gate-agent-native.md",
				"artifacts/reviews/codex-runtime-evidence-pu-000-plan-gate-best-practices.md",
			],
			requiredStatus: "pass",
			allowedEvidenceUse: ["claim_support", "audit_trail"],
			minimumTimestamp: "2026-05-24T21:39:40Z",
		},
		implementationStartPolicy: "blocked_until_reviewed",
		postReviewMutationPolicy:
			"controlled-field mutations reset reviewStatus to pending",
		stopConditions: ["Stop if reviewed intent evidence is missing."],
		rollback: ["Remove lifecycle intent validator files."],
		assumptions: ["JSC-363 owns this lifecycle."],
	};
}

/** Build a valid review receipt fixture bound to the lifecycle intent fixture. */
export function validReviewReceipt(): Record<string, unknown> {
	return {
		schemaVersion: "evidence-receipt/v1",
		receiptId: "codex-runtime-evidence-verifier-cockpit-pu-000-intent-review",
		kind: "review_artifact",
		intentId: "codex-runtime-evidence-verifier-cockpit-pu-000",
		intentSha256: "a".repeat(64),
		producer: "Codex coordinator",
		producedAt: "2026-05-24T22:00:00Z",
		verifiedAt: "2026-05-24T22:00:00Z",
		status: "pass",
		freshness: "current",
		evidenceUse: "audit_trail",
		headSha: "d4433929d5d69c62db16f2ff1a6ad77a12a20853",
		blockerClass: null,
		reviewerArtifacts: [
			{
				role: "adversarial-reviewer",
				ref: "artifacts/reviews/codex-runtime-evidence-pu-000-plan-gate-adversarial.md",
				sha256: "b".repeat(64),
				status: "pass",
			},
			{
				role: "agent-native-reviewer",
				ref: "artifacts/reviews/codex-runtime-evidence-pu-000-plan-gate-agent-native.md",
				sha256: "c".repeat(64),
				status: "pass",
			},
			{
				role: "best-practices-researcher",
				ref: "artifacts/reviews/codex-runtime-evidence-pu-000-plan-gate-best-practices.md",
				sha256: "d".repeat(64),
				status: "pass",
			},
		],
	};
}

/** Build complete acceptance coverage for every mechanical acceptance ID. */
export function completeAcceptanceCoverage(): AcceptanceCoverageEntry[] {
	return CODEX_RUNTIME_EVIDENCE_ACCEPTANCE_IDS.map((acceptanceId) => ({
		acceptanceId,
		proofKind: "test",
		ref: `src/lib/plan-gate/lifecycle-intent-${acceptanceId}.test.ts`,
	}));
}

/** Build a valid PU-000 contract baseline fixture. */
export function validContractBaseline(): Record<string, unknown> {
	return {
		schemaVersion: "contract-baseline/v1",
		baselineId: "codex-runtime-evidence-verifier-cockpit-pu-000-baseline",
		producer: "Codex",
		capturedAt: "2026-05-24T21:39:40Z",
		sourceArtifacts: [
			{
				path: ".harness/intent/codex-runtime-evidence-verifier-cockpit-implementation-intent.json",
				sha256: "a".repeat(64),
				frozenSections: ["ownedAcceptanceIds", "guardedPathGlobs"],
			},
		],
		acceptanceIds: [...CODEX_RUNTIME_EVIDENCE_ACCEPTANCE_IDS],
		mechanicalAcceptanceIds: [...CODEX_RUNTIME_EVIDENCE_ACCEPTANCE_IDS],
		guardedPathGlobs: [
			"src/lib/evidence/**",
			"src/lib/runtime/**",
			"src/lib/delivery-truth/**",
		],
		unknownRuntimePathPolicy: LIFECYCLE_INTENT_UNKNOWN_RUNTIME_PATH_POLICY,
		lifecycleUnits: [...CODEX_RUNTIME_EVIDENCE_LIFECYCLE_UNITS],
		forbiddenWeakening: [
			"acceptance_ids",
			"phase_labels",
			"forbidden_paths",
			"stop_conditions",
			"validation_gates",
			"rollback_obligations",
		],
		reviewerReceiptRef:
			".harness/intent/codex-runtime-evidence-verifier-cockpit-pu-000-review-receipt.json",
	};
}

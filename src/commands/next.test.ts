import {
	mkdirSync,
	mkdtempSync,
	readdirSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { sanitizeGitEnvironment } from "../lib/git/safe-env.js";
import { passingAgentReadinessContext } from "../lib/agent-readiness/test-fixtures.js";
import {
	validateHarnessDecision,
	validateHarnessDecisionOperationalMeta,
} from "../lib/decision/harness-decision.js";
import {
	blocksDirtyWorktree,
	inspectWorktreeState,
} from "./next-runner-inputs.js";
import {
	HE_GATE_RESULT_SCHEMA_VERSION,
	aggregateHePhaseExit,
	type HeGateId,
	type HeGatePayload,
	type HeGateResult,
} from "../lib/decision/he-phase-exit.js";
import {
	RUNTIME_CARD_SCHEMA_VERSION,
	type RuntimeCard,
	validateRuntimeCard,
} from "../lib/runtime/runtime-card.js";
import { parseGitStatusShort, runHarnessNext, runNextCLI } from "./next.js";

function captureNextCLI(
	args: string[],
	options: Parameters<typeof runNextCLI>[1],
): { exitCode: number; output: string } {
	const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
	const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
	try {
		const exitCode = runNextCLI(args, options);
		const output = String(infoSpy.mock.calls.at(-1)?.[0] ?? "");
		expect(errorSpy).not.toHaveBeenCalled();
		return { exitCode, output };
	} finally {
		infoSpy.mockRestore();
		errorSpy.mockRestore();
	}
}

function parseDecision(output: string): ReturnType<typeof runHarnessNext> {
	const parsed = JSON.parse(output) as ReturnType<typeof runHarnessNext>;
	expect(validateHarnessDecision(parsed)).toEqual({ valid: true, errors: [] });
	return parsed;
}

function createGitRepoWithCommit(): string {
	const repoRoot = mkdtempSync(join(tmpdir(), "harness-next-worktree-"));
	const gitEnv = {
		...sanitizeGitEnvironment({ policy: "strict" }),
		PREK_ALLOW_NO_CONFIG: "1",
	};
	execFileSync("git", ["init", "-q"], {
		cwd: repoRoot,
		encoding: "utf-8",
		env: gitEnv,
	});
	execFileSync("git", ["config", "user.email", "operator@example.com"], {
		cwd: repoRoot,
		encoding: "utf-8",
		env: gitEnv,
	});
	execFileSync("git", ["config", "user.name", "Harness Operator"], {
		cwd: repoRoot,
		encoding: "utf-8",
		env: gitEnv,
	});
	writeFileSync(join(repoRoot, "README.md"), "# harness\n");
	execFileSync("git", ["add", "README.md"], {
		cwd: repoRoot,
		encoding: "utf-8",
		env: gitEnv,
	});
	execFileSync(
		"git",
		["commit", "-m", "initial commit", "--no-gpg-sign", "--no-verify"],
		{
			cwd: repoRoot,
			encoding: "utf-8",
			env: gitEnv,
		},
	);
	return repoRoot;
}

function hePayloadFor(gateId: HeGateId): HeGatePayload {
	switch (gateId) {
		case "simplify":
			return {
				scopeEvidence: ["git diff"],
				reuseReviewed: true,
				qualityReviewed: true,
				efficiencyReviewed: true,
			};
		case "improve_codebase_architecture":
			return {
				scopeEvidence: ["architecture review artifact"],
				complexitySymptomsNamed: true,
				patchVsInterfaceCompared: true,
				tracerProofRecorded: true,
				decisionSurfaceRecorded: true,
			};
		case "unslopify":
			return {
				scopeEvidence: ["unslopify review artifact"],
				cleanupLedgerRecorded: true,
				removalEvidenceRecorded: true,
				validationRecorded: true,
				rollbackAndResidualRiskRecorded: true,
			};
		case "testing_reviewer":
			return {
				scopeEvidence: ["artifacts/reviews/testing-reviewer.md"],
				testAdequacyReviewed: true,
				missingEdgeCases: [],
			};
		case "he_fix_bugs":
			return {
				scopeEvidence: ["validation passed"],
				reproductionEvidence: [],
				rootCause: null,
				regressionProtection: [],
				rollbackNote: null,
			};
		case "he_code_review":
			return {
				scopeEvidence: ["artifacts/reviews/he-code-review.md"],
				findingsFirst: true,
				traceabilityReviewed: true,
				blockerClassification: true,
				safeToContinueReviewed: true,
			};
		case "autofix":
			return {
				scopeEvidence: ["no review feedback"],
				feedbackInventory: [],
				accountedItems: 0,
			};
		case "ubiquitous_language":
			return {
				scopeEvidence: ["UBIQUITOUS_LANGUAGE.md"],
				glossaryReviewed: true,
				canonicalTermsApplied: true,
				promptTranslationsUpdated: true,
				instructionPointerChecked: true,
			};
	}
}

function heGate(gateId: HeGateId): HeGateResult {
	return {
		schemaVersion: HE_GATE_RESULT_SCHEMA_VERSION,
		gateId,
		required: true,
		executionMode:
			gateId === "testing_reviewer" ? "subagent_proxy" : "direct_skill",
		status: "pass",
		payload: hePayloadFor(gateId),
		evidenceRefs: [
			{
				id: `${gateId}-evidence`,
				kind: "artifact",
				ref: `artifact:${gateId}`,
				gateLocal: true,
			},
		],
		findings: [],
		actions: [],
		validation: [],
		requiresHuman: false,
		safeToContinue: true,
		reason: null,
		blockedReason: null,
	};
}

function passingPhaseExit() {
	return aggregateHePhaseExit({
		phaseContext: {
			phase: "closeout",
			failingEvidencePresent: false,
			reviewFeedbackPresent: false,
		},
		requiredGates: [
			"simplify",
			"improve_codebase_architecture",
			"unslopify",
			"testing_reviewer",
			"he_fix_bugs",
			"he_code_review",
		],
		optionalGates: ["ubiquitous_language"],
		gates: [
			heGate("simplify"),
			heGate("improve_codebase_architecture"),
			heGate("unslopify"),
			heGate("testing_reviewer"),
			{
				...heGate("he_fix_bugs"),
				executionMode: "not_applicable",
				status: "not_applicable",
				reason: "No failing validation evidence is present.",
			},
			heGate("he_code_review"),
			{
				...heGate("ubiquitous_language"),
				required: false,
			},
		],
	});
}

function runtimeCard(overrides: Partial<RuntimeCard> = {}): RuntimeCard {
	return {
		schemaVersion: RUNTIME_CARD_SCHEMA_VERSION,
		generatedAt: "2026-05-15T12:00:00.000Z",
		issueKey: "JSC-311",
		lifecycle: "active",
		summary: "Runtime card is current.",
		nextSafeAction: "Run harness next --json.",
		branch: {
			name: "codex/jsc-311-phase-exit-next",
			clean: true,
			ref: "a".repeat(40),
		},
		pullRequest: {
			number: 250,
			state: "OPEN",
			isDraft: false,
			mergeStateStatus: "CLEAN",
			url: "https://github.com/jscraik/coding-harness/pull/250",
		},
		artifacts: {
			activeSpec:
				".harness/specs/2026-05-13-jsc-311-he-phase-exit-evidence-gates-spec.md",
			activePlan:
				".harness/plan/2026-05-13-JSC-311-he-phase-exit-evidence-gates-plan.md",
			status: "current",
			staleRefs: [],
		},
		linear: {
			issueKey: "JSC-311",
			freshness: "current",
			status: "In Review",
			statusType: "started",
			url: "https://linear.app/jscraik/issue/JSC-311/example",
			actionRequired: null,
		},
		phaseExit: {
			status: "pass",
			reason: "Required phase-exit gates passed.",
		},
		sources: [
			{
				kind: "git",
				ref: "git:status",
				freshness: "current",
				status: "usable",
				failureClass: null,
			},
		],
		blockers: [],
		attemptLedger: {
			schemaVersion: "attempt-ledger/v1",
			command: "runtime-card",
			attempt: 1,
			maxAttempts: 1,
			firstFailure: null,
			retryDecision: "none",
			owner: "codex",
			stopReason: null,
			nextAction: "Run harness next --json.",
			evidenceRefs: ["git:status"],
		},
		recoveryEvent: null,
		...overrides,
	};
}

describe("parseGitStatusShort", () => {
	it("parses changed, untracked, and renamed paths", () => {
		expect(
			parseGitStatusShort(
				" M src/commands/next.ts\n?? docs/plan.md\nR  old.ts -> new.ts\n",
			),
		).toEqual(["docs/plan.md", "new.ts", "src/commands/next.ts"]);
	});

	it("uses the final rename marker when old filenames contain arrows", () => {
		expect(parseGitStatusShort('R  "old -> name.ts" -> new.ts\n')).toEqual([
			"new.ts",
		]);
	});

	it("decodes git C-quoted paths before producing file arguments", () => {
		expect(parseGitStatusShort(' M "caf\\303\\251.txt"\n')).toEqual([
			"café.txt",
		]);
	});
});

describe("runHarnessNext", () => {
	it("recommends a safe validation command from changed files", () => {
		const decision = runHarnessNext({
			files: ["src/commands/next.ts"],
			mode: "local",
			worktreeRole: "dirty-with-justification",
		});

		expect(validateHarnessDecision(decision)).toEqual({
			valid: true,
			errors: [],
		});
		expect(decision.status).toBe("action_required");
		expect(decision.failureClass).toBeNull();
		expect(decision.nextAction).toBe(
			"Generate a repo-canonical validation plan for the changed files.",
		);
		expect(decision.nextCommand).toBe(
			"harness validation-plan --files src/commands/next.ts --json",
		);
		expect(decision.phase).toBe("verify");
		expect(decision.cockpitLane).toBe("prove");
		expect(decision.objective).toBe(
			"Produce the repo-canonical validation plan for the changed files.",
		);
		expect(decision.requiredEvidence).toEqual([
			"input:files",
			"command-catalog:harness-command-catalog/v3",
			"harness validation-plan --files src/commands/next.ts --json output",
		]);
		expect(decision.stopConditions).toEqual([
			"Stop if validation-plan cannot produce JSON for the changed files.",
		]);
		expect(decision.followUpCommands).toEqual([
			"harness session-distill --json",
			"harness agent-native-ratchets --json",
			"harness review-context --files src/commands/next.ts --json",
		]);
		const ratchetMeta = decision.meta?.agentNativeRatchets as
			| { commands?: string[] }
			| undefined;
		expect(decision.followUpCommands.slice(0, 2)).toEqual(
			ratchetMeta?.commands,
		);
		expect(decision.hiddenPlumbing).toEqual([
			"git:status",
			"command-catalog",
			"risk-tier",
			"agent-native-ratchets",
		]);
		expect(decision.safeToRun).toBe(true);
		expect(decision.requiresNetwork).toBe(false);
		expect(decision.writesFiles).toBe(false);
		expect(decision.retry).toBe("safe");
		expect(decision.evidenceRef).toContain("input:files");
		expect(validateHarnessDecisionOperationalMeta(decision.meta)).toEqual({
			valid: true,
			errors: [],
		});
		expect(decision.meta).toMatchObject({
			frictionClass: "none",
			delayClass: "normal",
			agentNativeRatchets: {
				schemaVersion: "agent-native-ratchet-discovery/v1",
				commands: [
					"harness session-distill --json",
					"harness agent-native-ratchets --json",
				],
				packets: expect.arrayContaining([
					"session-distill/v1",
					"agent-native-ratchets/v1",
				]),
			},
			agentReadinessContext: {
				schemaVersion: "agent-readiness-context-health/v1",
				evidenceUse: "orientation",
			},
			execution: {
				profile: "read_only",
				startupCost: "low",
				permissionPlan: {
					requiresHuman: false,
					requiresNetwork: false,
					writesFiles: false,
					requiresGitWrite: false,
					filesystemWrite: [],
					commands: [
						"harness validation-plan --files src/commands/next.ts --json",
					],
					secrets: [],
				},
			},
		});
	});

	it("returns a pass decision when no changed files are detected", () => {
		const decision = runHarnessNext({
			inspectChangedFiles: () => [],
			repoRoot: "/tmp/repo",
			agentReadinessContext: passingAgentReadinessContext(),
		});

		expect(decision.status).toBe("pass");
		expect(decision.failureClass).toBeNull();
		expect(decision.nextAction).toBe(
			"Run harness check --json to confirm repo readiness.",
		);
		expect(decision.nextCommand).toBe("harness check --json");
		expect(decision.phase).toBe("handoff");
		expect(decision.cockpitLane).toBe("handoff");
		expect(decision.objective).toBe(
			"Confirm the repository is ready when no changed files are detected.",
		);
		expect(decision.requiredEvidence).toEqual([
			"git:status",
			"harness check --json output",
		]);
		expect(decision.stopConditions).toEqual([
			"Stop if harness check reports a blocked or failed gate.",
		]);
		expect(decision.retry).toBe("safe");
		expect(decision.evidenceRef).toEqual(["git:status"]);
		expect(decision.meta).toMatchObject({
			frictionClass: "none",
			delayClass: "normal",
			agentReadinessContext: {
				schemaVersion: "agent-readiness-context-health/v1",
				evidenceUse: "orientation",
			},
			execution: {
				profile: "read_only",
				startupCost: "low",
				permissionPlan: {
					commands: ["harness check --json"],
					requiresNetwork: false,
					writesFiles: false,
				},
			},
		});
	});

	it("blocks dirty worktrees when default role is clean", () => {
		const repoRoot = createGitRepoWithCommit();
		try {
			writeFileSync(join(repoRoot, "README.md"), "# harness\nchanged\n");
			const decision = runHarnessNext({ repoRoot });
			const meta = decision.meta;

			expect(decision.status).toBe("blocked");
			expect(decision.failureClass).toBe("worktree_state_blocked");
			expect(decision.nextAction).toContain(
				"Use --worktree-role dirty-with-justification",
			);
			expect(meta).not.toBeUndefined();
			expect(meta!.frictionClass).toBe("repo_state");
			expect(meta!.delayClass).toBe("human_needed");
		} finally {
			rmSync(repoRoot, { recursive: true, force: true });
		}
	});

	it("blocks untracked-only worktrees when default role is clean", () => {
		const repoRoot = createGitRepoWithCommit();
		try {
			writeFileSync(join(repoRoot, "scratch.md"), "local scratch\n");
			const decision = runHarnessNext({ repoRoot });

			expect(decision.status).toBe("blocked");
			expect(decision.failureClass).toBe("worktree_state_blocked");
			expect(decision.nextAction).toContain(
				"Use --worktree-role dirty-with-justification",
			);
		} finally {
			rmSync(repoRoot, { recursive: true, force: true });
		}
	});

	it("preserves empty git status output as a clean worktree state", () => {
		const repoRoot = createGitRepoWithCommit();
		try {
			const state = inspectWorktreeState(repoRoot);

			expect(state.clean).toBe(true);
			expect(blocksDirtyWorktree("clean", state)).toBe(false);
		} finally {
			rmSync(repoRoot, { recursive: true, force: true });
		}
	});

	it("blocks explicit file overrides when default role is clean and the worktree is dirty", () => {
		const repoRoot = createGitRepoWithCommit();
		try {
			writeFileSync(join(repoRoot, "README.md"), "# harness\nchanged\n");
			const decision = runHarnessNext({
				repoRoot,
				files: ["README.md"],
			});

			expect(decision.status).toBe("blocked");
			expect(decision.failureClass).toBe("worktree_state_blocked");
			expect(decision.nextAction).toContain(
				"Use --worktree-role dirty-with-justification",
			);
			expect(decision.evidenceRef).toContain("git:status");
		} finally {
			rmSync(repoRoot, { recursive: true, force: true });
		}
	});

	it("blocks clean-role worktrees when sync counts are unknown", () => {
		expect(
			blocksDirtyWorktree("clean", {
				branch: "feature",
				clean: true,
				upstream: "origin/feature",
				ahead: null,
				behind: 0,
			}),
		).toBe(true);
	});

	it("allows dirty worktrees when role is dirty-with-justification", () => {
		const repoRoot = createGitRepoWithCommit();
		try {
			writeFileSync(join(repoRoot, "README.md"), "# harness\nchanged\n");
			const decision = runHarnessNext({
				repoRoot,
				worktreeRole: "dirty-with-justification",
			});

			expect(decision.status).toBe("action_required");
			expect(decision.failureClass).toBeNull();
			expect(decision.nextCommand).toBe(
				"harness validation-plan --files README.md --json",
			);
			expect(decision.phase).toBe("verify");
			expect(decision.cockpitLane).toBe("prove");
		} finally {
			rmSync(repoRoot, { recursive: true, force: true });
		}
	});

	it("blocks fresh-worktree role when no upstream is configured", () => {
		const repoRoot = createGitRepoWithCommit();
		try {
			const decision = runHarnessNext({
				repoRoot,
				worktreeRole: "fresh-worktree",
			});
			const meta = decision.meta;

			expect(decision.status).toBe("blocked");
			expect(decision.failureClass).toBe("worktree_state_blocked");
			expect(meta).not.toBeUndefined();
			expect(meta!.frictionClass).toBe("repo_state");
			expect(meta!.delayClass).toBe("human_needed");
		} finally {
			rmSync(repoRoot, { recursive: true, force: true });
		}
	});

	it("surfaces passing HE phase-exit evidence in operator-visible metadata", () => {
		const decision = runHarnessNext({
			inspectChangedFiles: () => [],
			repoRoot: "/tmp/repo",
			phaseExit: passingPhaseExit(),
			agentReadinessContext: passingAgentReadinessContext(),
		});

		expect(validateHarnessDecision(decision)).toEqual({
			valid: true,
			errors: [],
		});
		expect(decision.status).toBe("pass");
		expect(decision.meta).toMatchObject({
			hePhaseExit: {
				gate: "he-phase-exit",
				status: "pass",
				reason:
					"HE phase exit passed with all required gate evidence satisfied.",
				meta: {
					recommendation: "continue",
					commitAllowed: true,
					exitAllowed: true,
				},
			},
		});
	});

	it("surfaces current runtime-card evidence in operator-visible metadata", () => {
		const card = runtimeCard({
			sources: [
				{
					kind: "validation",
					ref: "artifact:.harness/runtime/validation.json",
					freshness: "current",
					status: "usable",
					failureClass: null,
				},
				{
					kind: "review",
					ref: "artifact:.harness/runtime/review-state.json",
					freshness: "current",
					status: "usable",
					failureClass: null,
				},
				{
					kind: "session",
					ref: "artifact:.harness/runtime/permissions.json",
					freshness: "current",
					status: "usable",
					failureClass: null,
				},
			],
			codexRuntime: {
				provenanceRef: "artifact:.harness/runtime/codex-runtime.json",
				collectedAt: "2026-05-15T12:00:00.000Z",
				sourceCount: 3,
				blockedSourceCount: 0,
				blockerCount: 0,
				receiptRefs: [
					"artifact:.harness/runtime/validation.json",
					"artifact:.harness/runtime/review-state.json",
					"artifact:.harness/runtime/permissions.json",
				],
				validationRefs: ["artifact:.harness/runtime/validation.json"],
				reviewRefs: ["artifact:.harness/runtime/review-state.json"],
				sessionRefs: ["artifact:.harness/runtime/permissions.json"],
				environmentRefs: [],
				staleStateRefs: [],
			},
		});
		expect(validateRuntimeCard(card)).toEqual({ valid: true, errors: [] });
		const decision = runHarnessNext({
			inspectChangedFiles: () => [],
			repoRoot: "/tmp/repo",
			runtimeCard: card,
			agentReadinessContext: passingAgentReadinessContext(),
		});

		expect(validateHarnessDecision(decision)).toEqual({
			valid: true,
			errors: [],
		});
		expect(decision.status).toBe("pass");
		expect(decision.meta).toMatchObject({
			runtimeCard: {
				schemaVersion: "runtime-card/v1",
				issueKey: "JSC-311",
				lifecycle: "active",
				nextSafeAction: "Run harness next --json.",
				codexRuntime: {
					provenanceRef: "artifact:.harness/runtime/codex-runtime.json",
					sourceCount: 3,
				},
				pullRequest: {
					number: 250,
					mergeStateStatus: "CLEAN",
				},
				blockers: [],
				sourceCount: 3,
			},
		});
	});

	it("blocks recommendations when runtime-card evidence reports live blockers", () => {
		const card = runtimeCard({
			lifecycle: "ci_blocked",
			summary: "PR checks are failing.",
			nextSafeAction: "Resolve failing CI before starting the next slice.",
			pullRequest: {
				number: 250,
				state: "OPEN",
				isDraft: true,
				mergeStateStatus: "BLOCKED",
				url: "https://github.com/jscraik/coding-harness/pull/250",
			},
			blockers: ["PR #250 merge state is BLOCKED."],
		});

		const decision = runHarnessNext({
			files: ["src/commands/next.ts"],
			runtimeCard: card,
		});

		expect(validateHarnessDecision(decision)).toEqual({
			valid: true,
			errors: [],
		});
		expect(decision).toMatchObject({
			status: "blocked",
			failureClass: "runtime_card_blocked",
			nextAction: "Resolve failing CI before starting the next slice.",
			nextCommand: null,
			safeToRun: false,
			requiresHuman: true,
			humanEscalation: "PR #250 merge state is BLOCKED.",
		});
		expect(decision.hiddenPlumbing).toContain("runtime-card");
		expect(decision.meta).toMatchObject({
			frictionClass: "repo_state",
			delayClass: "human_needed",
			runtimeCard: {
				lifecycle: "ci_blocked",
				blockers: ["PR #250 merge state is BLOCKED."],
			},
		});
	});

	it("blocks recommendations when supplied HE phase-exit evidence blocks commit readiness", () => {
		const phaseExit = aggregateHePhaseExit({
			phaseContext: {
				phase: "closeout",
				failingEvidencePresent: false,
				reviewFeedbackPresent: false,
			},
			requiredGates: ["he_code_review"],
			optionalGates: [],
			gates: [
				{
					...heGate("he_code_review"),
					status: "blocked",
					requiresHuman: true,
					safeToContinue: false,
					blockedReason: "he_code_review found an unresolved blocker",
					findings: [
						{
							id: "he-code-review-blocker",
							severity: "high",
							status: "open",
							summary: "Unresolved blocker",
							evidenceRef: "he_code_review-evidence",
						},
					],
				},
			],
		});

		const decision = runHarnessNext({
			files: ["src/commands/next.ts"],
			phaseExit,
		});

		expect(validateHarnessDecision(decision)).toEqual({
			valid: true,
			errors: [],
		});
		expect(decision).toMatchObject({
			status: "blocked",
			failureClass: "he_phase_exit_blocked",
			nextCommand: null,
			safeToRun: false,
			requiresHuman: true,
			humanEscalation:
				"HE phase-exit evidence requires human review before continuing.",
		});
		expect(decision.nextAction).toBe(
			"Run the required human review gate, record artifact-backed evidence, then rerun phase-exit aggregation.",
		);
		expect(decision.evidenceRef).toContain("gate:he_code_review:blocked");
		expect(decision.meta).toMatchObject({
			frictionClass: "validation_failure",
			delayClass: "human_needed",
			hePhaseExit: {
				status: "fail",
				meta: {
					recommendation: "human_review_required",
					commitAllowed: false,
					exitAllowed: false,
				},
			},
		});
	});

	it("surfaces passing HE phase-exit evidence on changed-file recommendations", () => {
		const decision = runHarnessNext({
			files: ["src/commands/next.ts"],
			phaseExit: passingPhaseExit(),
			worktreeRole: "dirty-with-justification",
		});

		expect(validateHarnessDecision(decision)).toEqual({
			valid: true,
			errors: [],
		});
		expect(decision.status).toBe("action_required");
		expect(decision.hiddenPlumbing).toContain("he-phase-exit");
		expect(decision.meta).toMatchObject({
			hePhaseExit: {
				gate: "he-phase-exit",
				status: "pass",
				meta: {
					commitAllowed: true,
					exitAllowed: true,
				},
			},
		});
	});

	it("blocks empty --files overrides instead of inspecting git", () => {
		const decision = runHarnessNext({ files: [] });

		expect(decision.status).toBe("blocked");
		expect(decision.failureClass).toBe("files_override_empty");
		expect(decision.nextAction).toContain("omit --files");
		expect(decision.nextCommand).toBeNull();
		expect(decision.phase).toBe("repair");
		expect(decision.requiredEvidence).toEqual(["input:files"]);
		expect(decision.stopConditions).toEqual([
			"Stop until files_override_empty is resolved.",
		]);
		expect(decision.humanEscalation).toBe(
			"Pass one or more changed files, or omit --files so harness next can inspect git state.",
		);
		expect(decision.retry).toBe("manual");
		expect(decision.evidenceRef).toEqual(["input:files"]);
		expect(decision.meta).toMatchObject({
			frictionClass: "unclear_instruction",
			delayClass: "human_needed",
			execution: {
				startupCost: "none",
				permissionPlan: {
					requiresHuman: true,
					commands: [],
				},
			},
		});
	});

	it("blocks when git state cannot be inspected", () => {
		const decision = runHarnessNext({
			inspectChangedFiles: () => {
				throw new Error("not a git repo");
			},
			repoRoot: "/tmp/repo",
		});

		expect(decision.status).toBe("blocked");
		expect(decision.failureClass).toBe("git_state_unavailable");
		expect(decision.nextAction).toContain("Run harness doctor --json");
		expect(decision.nextCommand).toBe("harness doctor --json");
		expect(decision.phase).toBe("repair");
		expect(decision.objective).toBe(
			"Restore git-state visibility before choosing workflow work.",
		);
		expect(decision.requiredEvidence).toEqual([
			"git:status",
			"harness doctor --json output",
		]);
		expect(decision.followUpCommands).toEqual(["harness next --json"]);
		expect(decision.safeToRun).toBe(true);
		expect(decision.retry).toBe("manual");
		expect(decision.evidenceRef).toEqual(["git:status"]);
		expect(decision.meta).toMatchObject({
			frictionClass: "repo_state",
			delayClass: "human_needed",
			execution: {
				profile: "read_only",
				startupCost: "low",
				permissionPlan: {
					requiresHuman: false,
					requiresNetwork: false,
					writesFiles: false,
					commands: ["harness doctor --json"],
				},
			},
		});
	});

	it("blocks pr mode without required runtime evidence", () => {
		const decision = runHarnessNext({
			files: ["docs/spec.md"],
			mode: "pr",
		});

		expect(decision.status).toBe("blocked");
		expect(decision.failureClass).toBe("required_evidence_missing");
		expect(decision.safeToRun).toBe(false);
		expect(decision.nextAction).toBe(
			"Provide --phase-exit and --runtime-card artifacts, or rerun in --mode local for exploratory recommendations.",
		);
		expect(decision.evidenceRef).toEqual([
			"input:phase-exit",
			"input:runtime-card",
		]);
		expect(decision.meta).toMatchObject({
			mode: "pr",
			missingEvidence: ["phase-exit", "runtime-card"],
		});
	});

	it("blocks ci mode without required runtime evidence", () => {
		const decision = runHarnessNext({
			files: ["docs/spec.md"],
			mode: "ci",
		});

		expect(decision.status).toBe("blocked");
		expect(decision.failureClass).toBe("required_evidence_missing");
		expect(decision.safeToRun).toBe(false);
		expect(decision.evidenceRef).toEqual([
			"input:phase-exit",
			"input:runtime-card",
		]);
		expect(decision.meta).toMatchObject({
			mode: "ci",
			missingEvidence: ["phase-exit", "runtime-card"],
		});
	});

	it("changes recommendation posture for pr mode when evidence is explicitly optional", () => {
		const decision = runHarnessNext({
			files: ["docs/spec.md"],
			mode: "pr",
			evidenceMode: "optional",
			worktreeRole: "dirty-with-justification",
		});

		expect(decision.status).toBe("action_required");
		expect(decision.nextAction).toBe(
			"Generate reviewer context for the changed files.",
		);
		expect(decision.nextCommand).toBe(
			"harness review-context --files docs/spec.md --json",
		);
		expect(decision.phase).toBe("review");
		expect(decision.cockpitLane).toBe("review");
		expect(decision.objective).toBe(
			"Prepare reviewer-facing context for the changed files.",
		);
		expect(decision.requiredEvidence).toEqual([
			"input:files",
			"command-catalog:harness-command-catalog/v3",
			"harness review-context --files docs/spec.md --json output",
		]);
		expect(decision.followUpCommands).toEqual([
			"harness session-distill --json",
			"harness agent-native-ratchets --json",
			"bash scripts/validate-codestyle.sh --fast",
		]);
		const ratchetMeta = decision.meta?.agentNativeRatchets as
			| { commands?: string[] }
			| undefined;
		expect(decision.followUpCommands.slice(0, 2)).toEqual(
			ratchetMeta?.commands,
		);
		expect(decision.meta).toMatchObject({
			mode: "pr",
			sourceErrors: [
				{
					kind: "linear",
					ref: "network:linear",
					freshness: "unknown",
					sha: null,
					status: "blocked",
					failureClass: "network_unavailable",
				},
				{
					kind: "pr",
					ref: "network:github",
					freshness: "unknown",
					sha: null,
					status: "blocked",
					failureClass: "network_unavailable",
				},
			],
		});
	});

	it("carries source errors without corrupting JSON recommendations", () => {
		const decision = runHarnessNext({
			files: ["src/commands/next.ts"],
			worktreeRole: "dirty-with-justification",
			decisionSources: [
				{
					kind: "learning",
					ref: ".harness/learnings/coderabbit.local.json",
					freshness: "missing",
					sha: null,
					status: "invalid",
					failureClass: "learning_missing",
				},
				{
					kind: "run",
					ref: ".harness/runs/stale.json",
					freshness: "stale",
					sha: "b".repeat(40),
					status: "usable",
					failureClass: "run_head_mismatch",
				},
			],
		});

		expect(decision.status).toBe("action_required");
		expect(decision.nextCommand).toBe(
			"harness validation-plan --files src/commands/next.ts --json",
		);
		expect(decision.meta).toMatchObject({
			sourceErrors: [
				{
					kind: "learning",
					status: "invalid",
					failureClass: "learning_missing",
				},
				{
					kind: "run",
					freshness: "stale",
					failureClass: "run_head_mismatch",
				},
			],
		});
	});

	it("fails closed when a required local decision source is blocked", () => {
		const decision = runHarnessNext({
			files: ["src/commands/next.ts"],
			decisionSources: [
				{
					kind: "contract",
					ref: "harness.contract.json",
					freshness: "unknown",
					sha: null,
					status: "blocked",
					failureClass: "contract_blocked",
				},
			],
		});

		expect(decision.status).toBe("blocked");
		expect(decision.failureClass).toBe("contract_blocked");
		expect(decision.nextCommand).toBe("harness doctor --json");
		expect(decision.meta).toMatchObject({
			sourceErrors: [
				{
					kind: "contract",
					ref: "harness.contract.json",
					status: "blocked",
					failureClass: "contract_blocked",
				},
			],
		});
	});

	it("replays identical recommendations and source error ordering", () => {
		const options = {
			files: ["src/b.ts", "src/a.ts"],
			decisionSources: [
				{
					kind: "run" as const,
					ref: ".harness/runs/z.json",
					freshness: "stale" as const,
					sha: "b".repeat(40),
					status: "usable" as const,
					failureClass: "run_head_mismatch",
				},
				{
					kind: "learning" as const,
					ref: ".harness/learnings/local.json",
					freshness: "missing" as const,
					sha: null,
					status: "invalid" as const,
					failureClass: "learning_missing",
				},
			],
		};

		const first = runHarnessNext(options);
		const second = runHarnessNext(options);

		expect(second.nextCommand).toBe(first.nextCommand);
		expect(second.evidenceRef).toEqual(first.evidenceRef);
		expect(second.meta).toMatchObject({
			sourceErrors: (first.meta as { sourceErrors: unknown[] }).sourceErrors,
		});
	});

	it("recommends fleet-plan for ci mode when a matrix artifact exists", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "harness-next-fleet-"));
		try {
			mkdirSync(join(repoRoot, "artifacts"), { recursive: true });
			writeFileSync(
				join(repoRoot, "artifacts/harness-upgrade-matrix-dev.json"),
				"{}",
			);

			const decision = runHarnessNext({
				mode: "ci",
				repoRoot,
				phaseExit: passingPhaseExit(),
				runtimeCard: runtimeCard(),
				inspectChangedFiles: () => {
					throw new Error("git should not be inspected");
				},
			});

			expect(decision.status).toBe("action_required");
			expect(decision.nextCommand).toBe(
				"harness fleet-plan --from artifacts/harness-upgrade-matrix-dev.json --json",
			);
			expect(decision.phase).toBe("orient");
			expect(decision.cockpitLane).toBe("orient");
			expect(decision.objective).toBe(
				"Convert the detected upgrade matrix into a safe remediation plan.",
			);
			expect(decision.requiredEvidence).toEqual([
				"artifact:artifacts/harness-upgrade-matrix-dev.json",
			]);
			expect(decision.stopConditions).toEqual([
				"Stop if fleet-plan cannot parse the upgrade matrix artifact.",
			]);
			expect(decision.followUpCommands).toEqual([]);
			expect(decision.hiddenPlumbing).toEqual([
				"artifact-discovery",
				"fleet-plan",
			]);
			expect(decision.evidenceRef).toEqual([
				"artifact:artifacts/harness-upgrade-matrix-dev.json",
			]);
			expect(decision.meta).toMatchObject({
				mode: "ci",
				hePhaseExit: {
					gate: "he-phase-exit",
					status: "pass",
				},
				nextCommandArgv: [
					"harness",
					"fleet-plan",
					"--from",
					"artifacts/harness-upgrade-matrix-dev.json",
					"--json",
				],
			});
		} finally {
			rmSync(repoRoot, { recursive: true, force: true });
		}
	});

	it("includes machine-safe argv and shell-safe display commands", () => {
		const decision = runHarnessNext({
			files: ["docs/My Plan.md", "src/$(bad).ts"],
			mode: "local",
			worktreeRole: "dirty-with-justification",
		});

		expect(decision.nextCommand).toBe(
			"harness validation-plan --files 'docs/My Plan.md' 'src/$(bad).ts' --json",
		);
		expect(decision.meta).toMatchObject({
			nextCommandArgv: [
				"harness",
				"validation-plan",
				"--files",
				"docs/My Plan.md",
				"src/$(bad).ts",
				"--json",
			],
		});
	});
});

describe("runNextCLI", () => {
	it("emits a valid JSON HarnessDecision for --json without required context flags", () => {
		const { exitCode, output } = captureNextCLI(["--json"], {
			inspectChangedFiles: () => ["docs/spec.md"],
		});

		expect(exitCode).toBe(0);
		const decision = parseDecision(output);
		expect(decision.status).toBe("action_required");
		expect(decision.failureClass).toBeNull();
		expect(decision.nextCommand).toBe(
			"harness validation-plan --files docs/spec.md --json",
		);
	});

	it("emits HE phase-exit metadata from an explicit local artifact", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "harness-next-phase-exit-"));
		try {
			writeFileSync(
				join(repoRoot, "phase-exit.json"),
				JSON.stringify(passingPhaseExit()),
			);
			const { exitCode, output } = captureNextCLI(
				["--json", "--phase-exit", "phase-exit.json"],
				{
					repoRoot,
					inspectChangedFiles: () => [],
					agentReadinessContext: passingAgentReadinessContext(),
				},
			);

			expect(exitCode).toBe(0);
			const decision = parseDecision(output);
			expect(decision.status).toBe("pass");
			expect(decision.meta).toMatchObject({
				hePhaseExit: {
					gate: "he-phase-exit",
					status: "pass",
					meta: {
						commitAllowed: true,
						exitAllowed: true,
					},
				},
			});
		} finally {
			rmSync(repoRoot, { recursive: true, force: true });
		}
	});

	it("emits runtime-card metadata from an explicit local artifact", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "harness-next-runtime-card-"));
		try {
			writeFileSync(
				join(repoRoot, "runtime-card.json"),
				JSON.stringify(runtimeCard()),
			);
			const { exitCode, output } = captureNextCLI(
				["--json", "--runtime-card", "runtime-card.json"],
				{
					repoRoot,
					inspectChangedFiles: () => [],
					agentReadinessContext: passingAgentReadinessContext(),
				},
			);

			expect(exitCode).toBe(0);
			const decision = parseDecision(output);
			expect(decision.status).toBe("pass");
			expect(decision.meta).toMatchObject({
				runtimeCard: {
					schemaVersion: "runtime-card/v1",
					issueKey: "JSC-311",
					lifecycle: "active",
					blockers: [],
				},
			});
		} finally {
			rmSync(repoRoot, { recursive: true, force: true });
		}
	});

	it("rejects runtime-card artifacts outside the repository", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "harness-next-runtime-card-"));
		const outsideRoot = mkdtempSync(join(tmpdir(), "harness-next-outside-"));
		try {
			writeFileSync(
				join(outsideRoot, "runtime-card.json"),
				JSON.stringify(runtimeCard()),
			);
			const { exitCode, output } = captureNextCLI(
				["--json", "--runtime-card", join(outsideRoot, "runtime-card.json")],
				{
					repoRoot,
					inspectChangedFiles: () => [],
				},
			);
			expect(exitCode).toBe(1);
			const decision = parseDecision(output);
			expect(decision.status).toBe("blocked");
			expect(decision.failureClass).toBe("runtime_card_artifact_unreadable");
			expect(decision.meta).toMatchObject({
				frictionClass: "repo_state",
				error: "Error: --runtime-card must stay within --repo",
			});
		} finally {
			rmSync(repoRoot, { recursive: true, force: true });
			rmSync(outsideRoot, { recursive: true, force: true });
		}
	});

	it("rejects runtime-card artifact symlinks that escape the repository", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "harness-next-runtime-card-"));
		const outsideRoot = mkdtempSync(join(tmpdir(), "harness-next-outside-"));
		try {
			writeFileSync(
				join(outsideRoot, "runtime-card.json"),
				JSON.stringify(runtimeCard()),
			);
			symlinkSync(
				join(outsideRoot, "runtime-card.json"),
				join(repoRoot, "runtime-card.json"),
			);
			const { exitCode, output } = captureNextCLI(
				["--json", "--runtime-card", "runtime-card.json"],
				{
					repoRoot,
					inspectChangedFiles: () => [],
				},
			);
			expect(exitCode).toBe(1);
			const decision = parseDecision(output);
			expect(decision.status).toBe("blocked");
			expect(decision.failureClass).toBe("runtime_card_artifact_unreadable");
			expect(decision.meta).toMatchObject({
				frictionClass: "repo_state",
				error: "Error: --runtime-card must stay within --repo",
			});
		} finally {
			rmSync(repoRoot, { recursive: true, force: true });
			rmSync(outsideRoot, { recursive: true, force: true });
		}
	});

	it("rejects phase-exit artifacts outside the repository", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "harness-next-phase-exit-"));
		const outsideRoot = mkdtempSync(join(tmpdir(), "harness-next-outside-"));
		try {
			writeFileSync(
				join(outsideRoot, "phase-exit.json"),
				JSON.stringify(passingPhaseExit()),
			);
			const { exitCode, output } = captureNextCLI(
				["--json", "--phase-exit", join(outsideRoot, "phase-exit.json")],
				{
					repoRoot,
					inspectChangedFiles: () => [],
				},
			);
			expect(exitCode).toBe(1);
			const decision = parseDecision(output);
			expect(decision.status).toBe("blocked");
			expect(decision.failureClass).toBe("he_phase_exit_artifact_unreadable");
			expect(decision.meta).toMatchObject({
				frictionClass: "repo_state",
				error: "Error: --phase-exit must stay within --repo",
			});
		} finally {
			rmSync(repoRoot, { recursive: true, force: true });
			rmSync(outsideRoot, { recursive: true, force: true });
		}
	});

	it("blocks invalid runtime-card artifacts before normal recommendations", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "harness-next-runtime-card-"));
		try {
			writeFileSync(join(repoRoot, "runtime-card.json"), "{}");
			const { exitCode, output } = captureNextCLI(
				["--json", "--runtime-card", "runtime-card.json"],
				{
					repoRoot,
					inspectChangedFiles: () => ["src/commands/next.ts"],
				},
			);

			expect(exitCode).toBe(1);
			const decision = parseDecision(output);
			expect(decision.status).toBe("blocked");
			expect(decision.failureClass).toBe("runtime_card_artifact_invalid");
			expect(decision.nextAction).toBe(
				"Regenerate the runtime card with valid current-state evidence, then rerun harness next --json.",
			);
			expect(decision.meta).toMatchObject({
				frictionClass: "validation_failure",
			});
		} finally {
			rmSync(repoRoot, { recursive: true, force: true });
		}
	});

	it("classifies malformed HE phase-exit JSON as invalid artifact evidence", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "harness-next-phase-exit-"));
		try {
			writeFileSync(join(repoRoot, "phase-exit.json"), "{");
			const { exitCode, output } = captureNextCLI(
				["--json", "--phase-exit", "phase-exit.json"],
				{
					repoRoot,
					inspectChangedFiles: () => ["src/commands/next.ts"],
				},
			);

			expect(exitCode).toBe(1);
			const decision = parseDecision(output);
			expect(decision.status).toBe("blocked");
			expect(decision.failureClass).toBe("he_phase_exit_artifact_invalid");
			expect(decision.meta).toMatchObject({
				frictionClass: "validation_failure",
			});
		} finally {
			rmSync(repoRoot, { recursive: true, force: true });
		}
	});

	it("blocks invalid HE phase-exit artifacts before normal recommendations", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "harness-next-phase-exit-"));
		try {
			writeFileSync(join(repoRoot, "phase-exit.json"), "{}");
			const { exitCode, output } = captureNextCLI(
				["--json", "--phase-exit", "phase-exit.json"],
				{
					repoRoot,
					inspectChangedFiles: () => ["src/commands/next.ts"],
				},
			);

			expect(exitCode).toBe(1);
			const decision = parseDecision(output);
			expect(decision.status).toBe("blocked");
			expect(decision.failureClass).toBe("he_phase_exit_artifact_invalid");
			expect(decision.evidenceRef).toEqual(["artifact:phase-exit.json"]);
		} finally {
			rmSync(repoRoot, { recursive: true, force: true });
		}
	});

	it("blocks unreadable HE phase-exit artifacts before normal recommendations", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "harness-next-phase-exit-"));
		try {
			const { exitCode, output } = captureNextCLI(
				["--json", "--phase-exit", "missing-phase-exit.json"],
				{
					repoRoot,
					inspectChangedFiles: () => ["src/commands/next.ts"],
				},
			);

			expect(exitCode).toBe(1);
			const decision = parseDecision(output);
			expect(decision.status).toBe("blocked");
			expect(decision.failureClass).toBe("he_phase_exit_artifact_unreadable");
			expect(decision.evidenceRef).toEqual([
				"artifact:missing-phase-exit.json",
			]);
		} finally {
			rmSync(repoRoot, { recursive: true, force: true });
		}
	});

	it("blocks valid HE phase-exit artifacts when status is blocking", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "harness-next-phase-exit-"));
		try {
			const blockingPhaseExit = aggregateHePhaseExit({
				phaseContext: {
					phase: "closeout",
					failingEvidencePresent: false,
					reviewFeedbackPresent: false,
				},
				requiredGates: ["he_code_review"],
				optionalGates: [],
				gates: [
					{
						...heGate("he_code_review"),
						status: "blocked",
						requiresHuman: true,
						safeToContinue: false,
						blockedReason: "he_code_review found an unresolved blocker",
						findings: [
							{
								id: "he-code-review-blocker",
								severity: "high",
								status: "open",
								summary: "Unresolved blocker",
								evidenceRef: "he_code_review-evidence",
							},
						],
					},
				],
			});

			writeFileSync(
				join(repoRoot, "phase-exit.json"),
				JSON.stringify(blockingPhaseExit),
			);

			const { exitCode, output } = captureNextCLI(
				["--json", "--phase-exit", "phase-exit.json"],
				{
					repoRoot,
					inspectChangedFiles: () => ["src/commands/next.ts"],
				},
			);

			expect(exitCode).toBe(1);
			const decision = parseDecision(output);
			expect(decision.status).toBe("blocked");
			expect(decision.failureClass).toBe("he_phase_exit_blocked");
			expect(decision.evidenceRef).toEqual([
				"schema:he-phase-exit/v1",
				"recommendation:human_review_required",
				"gate:he_code_review:blocked",
				"gate-evidence:he_code_review:he_code_review-evidence",
			]);
		} finally {
			rmSync(repoRoot, { recursive: true, force: true });
		}
	});

	it("emits a usage decision when --phase-exit has no artifact path", () => {
		const { exitCode, output } = captureNextCLI(["--json", "--phase-exit"], {});

		expect(exitCode).toBe(2);
		const decision = parseDecision(output);
		expect(decision.status).toBe("blocked");
		expect(decision.failureClass).toBe("phase_exit_missing");
		expect(decision.evidenceRef).toEqual(["input:phase-exit"]);
	});

	it("emits a usage decision when --evidence has no mode", () => {
		const { exitCode, output } = captureNextCLI(["--json", "--evidence"], {});

		expect(exitCode).toBe(2);
		const decision = parseDecision(output);
		expect(decision.status).toBe("blocked");
		expect(decision.failureClass).toBe("evidence_missing");
	});

	it("emits a usage decision when --evidence mode is invalid", () => {
		const { exitCode, output } = captureNextCLI(
			["--json", "--evidence", "strict"],
			{},
		);

		expect(exitCode).toBe(2);
		const decision = parseDecision(output);
		expect(decision.status).toBe("blocked");
		expect(decision.failureClass).toBe("evidence_invalid");
	});

	it("emits a usage decision when --worktree-role has no value", () => {
		const { exitCode, output } = captureNextCLI(
			["--json", "--worktree-role"],
			{},
		);

		expect(exitCode).toBe(2);
		const decision = parseDecision(output);
		expect(decision.status).toBe("blocked");
		expect(decision.failureClass).toBe("worktree_role_invalid");
		expect(decision.nextAction).toBe(
			"Use --worktree-role clean, --worktree-role dirty-with-justification, or --worktree-role fresh-worktree.",
		);
	});

	it("emits a usage decision when --worktree-role is invalid", () => {
		const { exitCode, output } = captureNextCLI(
			["--json", "--worktree-role", "chaos-mode"],
			{},
		);

		expect(exitCode).toBe(2);
		const decision = parseDecision(output);
		expect(decision.status).toBe("blocked");
		expect(decision.failureClass).toBe("worktree_role_invalid");
		expect((decision.meta as { validRoles?: string[] }).validRoles).toEqual([
			"clean",
			"dirty-with-justification",
			"fresh-worktree",
		]);
	});

	it("emits a valid blocked decision for invalid --mode", () => {
		const { exitCode, output } = captureNextCLI(
			["--json", "--mode", "remote"],
			{},
		);

		expect(exitCode).toBe(2);
		const decision = parseDecision(output);
		const directDecision = runHarnessNext({ mode: "remote" as never });
		expect(decision.status).toBe("blocked");
		expect(decision.failureClass).toBe("invalid_mode");
		expect(decision.nextAction).toBe(
			"Use --mode local, --mode pr, or --mode ci.",
		);
		expect(decision.retry).toBe("manual");
		expect(decision).toEqual(directDecision);
	});

	it("emits a usage decision for empty --files values", () => {
		const { exitCode, output } = captureNextCLI(["--json", "--files", ","], {});

		expect(exitCode).toBe(2);
		const decision = parseDecision(output);
		expect(decision.status).toBe("blocked");
		expect(decision.failureClass).toBe("files_override_empty");
		expect(decision.nextAction).toContain("omit --files");
	});

	it("splits comma-separated --files values into separate paths", () => {
		const { exitCode, output } = captureNextCLI(
			[
				"--json",
				"--files",
				"src/a,b.ts",
				"--worktree-role",
				"dirty-with-justification",
			],
			{},
		);

		expect(exitCode).toBe(0);
		const decision = parseDecision(output);
		expect(decision.nextCommand).toBe(
			"harness validation-plan --files b.ts src/a --json",
		);
		expect(decision.meta).toMatchObject({
			nextCommandArgv: [
				"harness",
				"validation-plan",
				"--files",
				"b.ts",
				"src/a",
				"--json",
			],
		});
	});

	it("rejects unknown flags before producing a recommendation", () => {
		const { exitCode, output } = captureNextCLI(["--json", "--mod", "pr"], {});

		expect(exitCode).toBe(2);
		const decision = parseDecision(output);
		expect(decision.status).toBe("blocked");
		expect(decision.failureClass).toBe("unknown_argument");
		expect(decision.meta).toMatchObject({ argument: "--mod" });
	});

	it("does not mutate files while producing a recommendation", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "harness-next-"));
		const before = readdirSync(repoRoot);

		const { exitCode, output } = captureNextCLI(["--json"], {
			repoRoot,
			inspectChangedFiles: () => ["src/commands/next.ts"],
		});

		expect(exitCode).toBe(0);
		expect(parseDecision(output).writesFiles).toBe(false);
		expect(readdirSync(repoRoot)).toEqual(before);
		rmSync(repoRoot, { recursive: true, force: true });
	});
});

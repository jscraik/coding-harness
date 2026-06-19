import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
	PR_CLOSEOUT_SCHEMA_VERSION,
	type PrCloseoutBlocker,
	type PrCloseoutClaim,
	type PrCloseoutReport,
} from "../lib/pr-closeout.js";
import { validateHarnessDecision } from "../lib/decision/harness-decision.js";
import { runHarnessNext, runNextCLI } from "./next.js";

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

function reviewBlocker(): PrCloseoutBlocker {
	return {
		surface: "review",
		classification: "external_service",
		reason: "PR #437 has one unresolved review thread.",
		fixableByCodex: false,
		ref: "review-thread:CR-1",
	};
}

function readyClaim(claim: PrCloseoutClaim["claim"]): PrCloseoutClaim {
	return {
		claim,
		status: "pass",
		evidenceRef: `claim:${claim}`,
		source: "harness_gates",
		headSha: "abc123",
		freshness: "current",
		blockerClass: null,
		missingContext: null,
		verifiedAt: "2026-06-19T00:00:00.000Z",
	};
}

function readyClaims(): PrCloseoutClaim[] {
	const claims: PrCloseoutClaim["claim"][] = [
		"tests_passed",
		"ci_green",
		"review_threads_resolved",
		"pr_metadata_ready",
		"branch_current_with_base",
		"linear_tracker_state_aligned",
		"independent_review_status_known",
		"required_checks_match_current_head",
		"rollback_path_named_or_not_applicable",
	];
	return claims.map(readyClaim);
}

function prCloseoutReport(
	overrides: Partial<PrCloseoutReport> = {},
): PrCloseoutReport {
	return {
		schemaVersion: PR_CLOSEOUT_SCHEMA_VERSION,
		generatedAt: "2026-06-19T00:00:00.000Z",
		pr: 437,
		url: "https://github.com/jscraik/coding-harness/pull/437",
		status: "ready",
		mergeable: true,
		nextAction: "ready_to_merge",
		blockers: [],
		claims: readyClaims(),
		checks: {
			total: 3,
			failed: 0,
			pending: 0,
			passed: 3,
			unknown: 0,
		},
		ciTelemetry: [],
		reviewThreads: {
			unresolved: 0,
			needsHuman: 0,
			autofixable: 0,
		},
		traceability: {
			sessionIds: ["codex-session:next-pr-closeout"],
			traceIds: ["trace:pr-closeout"],
			aiSessionTraceability: "Codex session captured closeout evidence.",
			complete: true,
		},
		harnessGates: {
			evidenceSource: "missing",
			closeoutGatesPresent: false,
			phaseExitPresent: false,
			recommendation: "missing",
			commitAllowed: true,
			exitAllowed: true,
			gates: [],
		},
		assurance: {
			present: false,
			valid: false,
			entries: [],
			findings: [],
		},
		runtimeEvidence: {
			present: false,
			valid: false,
			verifierStatus: null,
			outcome: null,
			exitClassification: null,
			findings: [],
		},
		deliveryTruth: {
			present: false,
			verdicts: [],
			blockingVerdicts: [],
			mergeReady: null,
		},
		lifecycleSnapshot: {
			schemaVersion: "delivery-lifecycle-snapshot/v1",
			generatedAt: "2026-06-19T00:00:00.000Z",
			worktreeRole: "implementation",
			linearMutation: "unknown",
			releaseReadinessImpact: "none",
			staleEvidenceClasses: [],
			handoffRequiredEvidence: [],
			lanes: [],
			latestValidationBlocker: null,
			reviewArtifacts: {
				expected: 0,
				missing: 0,
				empty: 0,
				ignoredRuntimePath: 0,
				unknown: 0,
				artifacts: [],
			},
			continuation: {
				nextSafeAction: "ready_to_merge",
				waitingOwner: "unknown",
				blocker: null,
			},
		},
		tools: [],
		dirtyPathsExcluded: [],
		attemptLedger: {
			schemaVersion: "attempt-ledger/v1",
			command: "pr-closeout",
			attempt: 1,
			maxAttempts: 1,
			firstFailure: null,
			retryDecision: "none",
			owner: "codex",
			stopReason: null,
			nextAction: "ready_to_merge",
			evidenceRefs: [],
		},
		recoveryEvent: null,
		...overrides,
	};
}

describe("harness next pr-closeout evidence", () => {
	it("blocks handoff when supplied pr-closeout evidence is not ready", () => {
		const blocker = reviewBlocker();
		const decision = runHarnessNext({
			prCloseout: {
				report: prCloseoutReport({
					status: "waiting",
					mergeable: false,
					nextAction: "wait_for_external_check",
					blockers: [blocker],
					reviewThreads: {
						unresolved: 1,
						needsHuman: 1,
						autofixable: 0,
					},
				}),
				artifactPath: "artifacts/pr-closeout/pr-closeout.json",
			},
		});

		expect(validateHarnessDecision(decision)).toEqual({
			valid: true,
			errors: [],
		});
		expect(decision).toMatchObject({
			status: "blocked",
			phase: "repair",
			failureClass: "pr_closeout_blocked",
			nextCommand: null,
			humanEscalation: blocker.reason,
		});
		expect(decision.evidenceRef).toEqual([
			"artifact:artifacts/pr-closeout/pr-closeout.json",
			"review-thread:CR-1",
		]);
		expect(decision.hiddenPlumbing).toContain("pr-closeout");
		expect(decision.meta).toMatchObject({
			prCloseout: {
				pr: 437,
				status: "waiting",
				mergeable: false,
				blockerCount: 1,
			},
		});
	});

	it("loads pr-closeout artifacts before normal CLI recommendations", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "harness-next-pr-closeout-"));
		try {
			writeFileSync(
				join(repoRoot, "pr-closeout.json"),
				JSON.stringify(
					prCloseoutReport({
						status: "blocked",
						mergeable: false,
						nextAction: "resolve_conflicts",
						blockers: [
							{
								surface: "branch",
								classification: "introduced",
								reason: "Lower stack layer is conflicted.",
								fixableByCodex: true,
								ref: "stack:lower-pr",
							},
						],
					}),
				),
			);

			const { exitCode, output } = captureNextCLI(
				["--json", "--pr-closeout", "pr-closeout.json"],
				{
					repoRoot,
					inspectChangedFiles: () => [],
				},
			);

			expect(exitCode).toBe(1);
			const decision = parseDecision(output);
			expect(decision.failureClass).toBe("pr_closeout_blocked");
			expect(decision.evidenceRef).toEqual([
				"artifact:pr-closeout.json",
				"stack:lower-pr",
			]);
		} finally {
			rmSync(repoRoot, { recursive: true, force: true });
		}
	});

	it("keeps Codex-fixable closeout blockers agent-actionable", () => {
		const decision = runHarnessNext({
			prCloseout: {
				report: prCloseoutReport({
					status: "fixable",
					mergeable: false,
					nextAction: "codex_can_fix_now",
					blockers: [
						{
							surface: "checks",
							classification: "introduced",
							reason: "A required local validation artifact is stale.",
							fixableByCodex: true,
							ref: "check:validation-plan",
						},
					],
				}),
				artifactPath: "artifacts/pr-closeout/pr-closeout.json",
			},
		});

		expect(validateHarnessDecision(decision)).toEqual({
			valid: true,
			errors: [],
		});
		expect(decision).toMatchObject({
			status: "blocked",
			phase: "repair",
			failureClass: "pr_closeout_blocked",
			humanEscalation: null,
			requiresHuman: false,
			safeToRun: false,
			retry: "conditional",
		});
		expect(decision.meta).toMatchObject({
			delayClass: "waiting_on_agent",
		});
	});

	it("keeps ready pr-closeout evidence in normal clean-worktree metadata", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "harness-next-pr-closeout-"));
		try {
			writeFileSync(
				join(repoRoot, "pr-closeout.json"),
				JSON.stringify(prCloseoutReport()),
			);

			const { exitCode, output } = captureNextCLI(
				["--json", "--pr-closeout", "pr-closeout.json"],
				{
					repoRoot,
					inspectChangedFiles: () => [],
				},
			);

			expect(exitCode).toBe(0);
			const decision = parseDecision(output);
			expect(decision.status).toBe("pass");
			expect(decision.nextCommand).toBe("harness check --json");
			expect(decision.meta).toMatchObject({
				prCloseout: {
					artifactPath: "pr-closeout.json",
					status: "ready",
					mergeable: true,
					blockerCount: 0,
				},
			});
		} finally {
			rmSync(repoRoot, { recursive: true, force: true });
		}
	});

	it("emits a usage decision when --pr-closeout has no artifact path", () => {
		const { exitCode, output } = captureNextCLI(
			["--json", "--pr-closeout"],
			{},
		);

		expect(exitCode).toBe(2);
		const decision = parseDecision(output);
		expect(decision.status).toBe("blocked");
		expect(decision.failureClass).toBe("pr_closeout_missing");
		expect(decision.evidenceRef).toEqual(["input:pr-closeout"]);
	});

	it("blocks invalid pr-closeout artifacts before normal recommendations", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "harness-next-pr-closeout-"));
		try {
			writeFileSync(join(repoRoot, "pr-closeout.json"), "{}");

			const { exitCode, output } = captureNextCLI(
				["--json", "--pr-closeout", "pr-closeout.json"],
				{
					repoRoot,
					inspectChangedFiles: () => [],
				},
			);

			expect(exitCode).toBe(1);
			const decision = parseDecision(output);
			expect(decision.status).toBe("blocked");
			expect(decision.failureClass).toBe("pr_closeout_artifact_invalid");
			expect(decision.evidenceRef).toEqual(["artifact:pr-closeout.json"]);
		} finally {
			rmSync(repoRoot, { recursive: true, force: true });
		}
	});

	it("rejects pr-closeout artifacts with unknown next actions", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "harness-next-pr-closeout-"));
		try {
			writeFileSync(
				join(repoRoot, "pr-closeout.json"),
				JSON.stringify({
					...prCloseoutReport({
						status: "waiting",
						mergeable: false,
						blockers: [reviewBlocker()],
					}),
					nextAction: "unexpected",
				}),
			);

			const { exitCode, output } = captureNextCLI(
				["--json", "--pr-closeout", "pr-closeout.json"],
				{
					repoRoot,
					inspectChangedFiles: () => [],
				},
			);

			expect(exitCode).toBe(1);
			const decision = parseDecision(output);
			expect(decision.status).toBe("blocked");
			expect(decision.failureClass).toBe("pr_closeout_artifact_invalid");
			expect(decision.evidenceRef).toEqual(["artifact:pr-closeout.json"]);
		} finally {
			rmSync(repoRoot, { recursive: true, force: true });
		}
	});

	it("rejects shallow ready pr-closeout artifacts", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "harness-next-pr-closeout-"));
		try {
			writeFileSync(
				join(repoRoot, "pr-closeout.json"),
				JSON.stringify({
					schemaVersion: PR_CLOSEOUT_SCHEMA_VERSION,
					generatedAt: "2026-06-19T00:00:00.000Z",
					pr: 437,
					status: "ready",
					mergeable: true,
					nextAction: "ready_to_merge",
					blockers: [reviewBlocker()],
					claims: [],
					checks: {},
					reviewThreads: {},
				}),
			);

			const { exitCode, output } = captureNextCLI(
				["--json", "--pr-closeout", "pr-closeout.json"],
				{
					repoRoot,
					inspectChangedFiles: () => [],
				},
			);

			expect(exitCode).toBe(1);
			const decision = parseDecision(output);
			expect(decision.status).toBe("blocked");
			expect(decision.failureClass).toBe("pr_closeout_artifact_invalid");
			expect(decision.evidenceRef).toEqual(["artifact:pr-closeout.json"]);
		} finally {
			rmSync(repoRoot, { recursive: true, force: true });
		}
	});

	it("rejects ready pr-closeout artifacts with missing claim evidence", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "harness-next-pr-closeout-"));
		try {
			writeFileSync(
				join(repoRoot, "pr-closeout.json"),
				JSON.stringify(prCloseoutReport({ claims: [] })),
			);

			const { exitCode, output } = captureNextCLI(
				["--json", "--pr-closeout", "pr-closeout.json"],
				{
					repoRoot,
					inspectChangedFiles: () => [],
				},
			);

			expect(exitCode).toBe(1);
			const decision = parseDecision(output);
			expect(decision.status).toBe("blocked");
			expect(decision.failureClass).toBe("pr_closeout_artifact_invalid");
			expect(decision.evidenceRef).toEqual(["artifact:pr-closeout.json"]);
		} finally {
			rmSync(repoRoot, { recursive: true, force: true });
		}
	});

	it("rejects ready pr-closeout artifacts with stale claim evidence", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "harness-next-pr-closeout-"));
		try {
			writeFileSync(
				join(repoRoot, "pr-closeout.json"),
				JSON.stringify(
					prCloseoutReport({
						claims: readyClaims().map((claim) =>
							claim.claim === "ci_green"
								? { ...claim, freshness: "stale" }
								: claim,
						),
					}),
				),
			);

			const { exitCode, output } = captureNextCLI(
				["--json", "--pr-closeout", "pr-closeout.json"],
				{
					repoRoot,
					inspectChangedFiles: () => [],
				},
			);

			expect(exitCode).toBe(1);
			const decision = parseDecision(output);
			expect(decision.status).toBe("blocked");
			expect(decision.failureClass).toBe("pr_closeout_artifact_invalid");
			expect(decision.evidenceRef).toEqual(["artifact:pr-closeout.json"]);
		} finally {
			rmSync(repoRoot, { recursive: true, force: true });
		}
	});

	it("rejects ready pr-closeout artifacts with not-applicable mandatory claims", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "harness-next-pr-closeout-"));
		try {
			writeFileSync(
				join(repoRoot, "pr-closeout.json"),
				JSON.stringify(
					prCloseoutReport({
						claims: readyClaims().map((claim) =>
							claim.claim === "ci_green"
								? { ...claim, status: "not_applicable" }
								: claim,
						),
					}),
				),
			);

			const { exitCode, output } = captureNextCLI(
				["--json", "--pr-closeout", "pr-closeout.json"],
				{
					repoRoot,
					inspectChangedFiles: () => [],
				},
			);

			expect(exitCode).toBe(1);
			const decision = parseDecision(output);
			expect(decision.status).toBe("blocked");
			expect(decision.failureClass).toBe("pr_closeout_artifact_invalid");
			expect(decision.evidenceRef).toEqual(["artifact:pr-closeout.json"]);
		} finally {
			rmSync(repoRoot, { recursive: true, force: true });
		}
	});
});

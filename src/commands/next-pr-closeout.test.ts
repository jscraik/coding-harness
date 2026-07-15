import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
	PR_CLOSEOUT_SCHEMA_VERSION,
	type PrCloseoutBlocker,
	type PrCloseoutReport,
} from "../lib/pr-closeout.js";
import { passingAgentReadinessContext } from "../lib/agent-readiness/test-fixtures.js";
import { validateHarnessDecision } from "../lib/decision/harness-decision.js";
import { runHarnessNext, runNextCLI } from "./next.js";
import { DEFAULT_PR_CLOSEOUT_ARTIFACT } from "./next-pr-closeout.js";
import {
	prCloseoutReport,
	readyAssuranceEntries,
	readyClaims,
	readyHarnessGates,
} from "./next-pr-closeout.test-support.js";

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

function writeDefaultPrCloseoutArtifact(
	repoRoot: string,
	report: PrCloseoutReport,
): void {
	mkdirSync(join(repoRoot, "artifacts", "pr-closeout"), { recursive: true });
	writeFileSync(
		join(repoRoot, DEFAULT_PR_CLOSEOUT_ARTIFACT),
		JSON.stringify(report),
	);
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

	it("auto-loads the default pr-closeout artifact before normal CLI recommendations", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "harness-next-pr-closeout-"));
		try {
			writeDefaultPrCloseoutArtifact(
				repoRoot,
				prCloseoutReport({
					status: "blocked",
					mergeable: false,
					nextAction: "resolve_conflicts",
					blockers: [
						{
							surface: "branch",
							classification: "introduced",
							reason: "Parent PR has not landed yet.",
							fixableByCodex: true,
							ref: "stack:parent-pr",
						},
					],
				}),
			);

			const { exitCode, output } = captureNextCLI(["--json"], {
				repoRoot,
				inspectChangedFiles: () => [],
				agentReadinessContext: passingAgentReadinessContext(),
			});

			expect(exitCode).toBe(1);
			const decision = parseDecision(output);
			expect(decision.failureClass).toBe("pr_closeout_blocked");
			expect(decision.evidenceRef).toEqual([
				`artifact:${DEFAULT_PR_CLOSEOUT_ARTIFACT}`,
				"stack:parent-pr",
			]);
		} finally {
			rmSync(repoRoot, { recursive: true, force: true });
		}
	});

	it("keeps missing default pr-closeout evidence non-blocking", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "harness-next-pr-closeout-"));
		try {
			const { exitCode, output } = captureNextCLI(["--json"], {
				repoRoot,
				inspectChangedFiles: () => [],
				agentReadinessContext: passingAgentReadinessContext(),
			});

			expect(exitCode).toBe(0);
			const decision = parseDecision(output);
			expect(decision.status).toBe("pass");
			expect(decision.nextCommand).toBe("harness check --json");
			expect(decision.meta).not.toHaveProperty("prCloseout");
		} finally {
			rmSync(repoRoot, { recursive: true, force: true });
		}
	});

	it("prefers explicit pr-closeout artifacts over the default artifact", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "harness-next-pr-closeout-"));
		try {
			writeDefaultPrCloseoutArtifact(
				repoRoot,
				prCloseoutReport({
					status: "blocked",
					mergeable: false,
					nextAction: "resolve_conflicts",
					blockers: [
						{
							surface: "branch",
							classification: "introduced",
							reason: "Default artifact is stale.",
							fixableByCodex: true,
							ref: "stack:stale-default",
						},
					],
				}),
			);
			writeFileSync(
				join(repoRoot, "explicit-pr-closeout.json"),
				JSON.stringify(prCloseoutReport()),
			);
			const { exitCode, output } = captureNextCLI(
				["--json", "--pr-closeout", "explicit-pr-closeout.json"],
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
				prCloseout: {
					artifactPath: "explicit-pr-closeout.json",
					status: "ready",
					mergeable: true,
				},
			});
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

	it("sanitizes non-fixable closeout blocker reasons and refs", () => {
		const decision = runHarnessNext({
			prCloseout: {
				report: prCloseoutReport({
					status: "waiting",
					mergeable: false,
					nextAction: "wait_for_external_check",
					blockers: [
						{
							surface: "checks",
							classification: "external_service",
							reason:
								"CircleCI export failed with Authorization: Bearer test-token-value",
							fixableByCodex: false,
							ref: "https://ci.example.invalid/job?token=test-token-value",
						},
					],
				}),
				artifactPath: "artifacts/pr-closeout/pr-closeout.json",
			},
		});

		expect(decision.humanEscalation).toBe(
			"CircleCI export failed with Authorization: [REDACTED]",
		);
		expect(decision.evidenceRef).toContain(
			"https://ci.example.invalid/job?token=[REDACTED]",
		);
		expect(decision.meta).toMatchObject({
			prCloseout: {
				blockers: [
					{
						reason: "CircleCI export failed with Authorization: [REDACTED]",
						ref: "https://ci.example.invalid/job?token=[REDACTED]",
					},
				],
			},
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
					agentReadinessContext: passingAgentReadinessContext(),
				},
			);

			expect(exitCode).toBe(0);
			const decision = parseDecision(output);
			expect(decision.status).toBe("pass");
			expect(decision.nextCommand).toBe("harness check --json");
			expect(decision.cockpitLane).toBe("handoff");
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

			const { output } = captureNextCLI(
				["--json", "--pr-closeout", "pr-closeout.json"],
				{
					repoRoot,
					inspectChangedFiles: () => [],
				},
			);

			expect(parseDecision(output).failureClass).toBe(
				"pr_closeout_artifact_invalid",
			);
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
			const { output } = captureNextCLI(
				["--json", "--pr-closeout", "pr-closeout.json"],
				{
					repoRoot,
					inspectChangedFiles: () => [],
				},
			);

			expect(parseDecision(output).failureClass).toBe(
				"pr_closeout_artifact_invalid",
			);
		} finally {
			rmSync(repoRoot, { recursive: true, force: true });
		}
	});

	it("rejects non-ready pr-closeout artifacts with malformed blockers", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "harness-next-pr-closeout-"));
		try {
			writeFileSync(
				join(repoRoot, "pr-closeout.json"),
				JSON.stringify({
					...prCloseoutReport({
						status: "waiting",
						mergeable: false,
						nextAction: "wait_for_external_check",
					}),
					blockers: [{}],
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

	it("rejects ready artifacts with optional unstable stack state", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "harness-next-pr-closeout-"));
		try {
			writeDefaultPrCloseoutArtifact(
				repoRoot,
				prCloseoutReport({
					stackState: { status: "unstable", required: false },
				}),
			);

			const { exitCode, output } = captureNextCLI(
				["--json", "--pr-closeout", DEFAULT_PR_CLOSEOUT_ARTIFACT],
				{
					repoRoot,
					inspectChangedFiles: () => [],
				},
			);

			expect(exitCode).toBe(1);
			expect(parseDecision(output).failureClass).toBe(
				"pr_closeout_artifact_invalid",
			);
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

	it("rejects pr-closeout artifacts with malformed count summaries", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "harness-next-pr-closeout-"));
		try {
			writeFileSync(
				join(repoRoot, "pr-closeout.json"),
				JSON.stringify(
					prCloseoutReport({
						checks: {
							total: 3,
							failed: -1,
							pending: 0.5,
							passed: 3,
							unknown: 0,
						},
						reviewThreads: {
							unresolved: -1,
							needsHuman: 0,
							autofixable: 0,
						},
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

	it("rejects ready pr-closeout artifacts missing closeout-gate evidence", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "harness-next-pr-closeout-"));
		try {
			writeFileSync(
				join(repoRoot, "pr-closeout.json"),
				JSON.stringify(
					prCloseoutReport({
						harnessGates: {
							evidenceSource: "missing",
							closeoutGatesPresent: false,
							phaseExitPresent: false,
							recommendation: "missing",
							commitAllowed: true,
							exitAllowed: true,
							gates: [],
						},
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

	it("rejects ready pr-closeout artifacts missing expected closeout gates", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "harness-next-pr-closeout-"));
		try {
			writeFileSync(
				join(repoRoot, "pr-closeout.json"),
				JSON.stringify(
					prCloseoutReport({
						harnessGates: {
							...prCloseoutReport().harnessGates,
							gates: readyHarnessGates().filter(
								(gate) => gate.gateId !== "testing_reviewer",
							),
						},
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

	it("rejects ready pr-closeout artifacts with duplicate closeout gates", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "harness-next-pr-closeout-"));
		try {
			const gates = readyHarnessGates();
			writeFileSync(
				join(repoRoot, "pr-closeout.json"),
				JSON.stringify(
					prCloseoutReport({
						harnessGates: {
							...prCloseoutReport().harnessGates,
							gates: [...gates, gates[0]!],
						},
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

	it("rejects ready pr-closeout artifacts with gates missing evidence refs", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "harness-next-pr-closeout-"));
		try {
			const gates = readyHarnessGates();
			writeFileSync(
				join(repoRoot, "pr-closeout.json"),
				JSON.stringify(
					prCloseoutReport({
						harnessGates: {
							...prCloseoutReport().harnessGates,
							gates: [{ ...gates[0]!, evidenceRefs: [] }, ...gates.slice(1)],
						},
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

	it("rejects ready pr-closeout artifacts missing assurance evidence", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "harness-next-pr-closeout-"));
		try {
			writeFileSync(
				join(repoRoot, "pr-closeout.json"),
				JSON.stringify(
					prCloseoutReport({
						assurance: {
							present: false,
							valid: false,
							entries: [],
							findings: [],
						},
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

	/**
	 * Regression test: validates fail-closed behavior when PR closeout artifacts
	 * advertise valid assurance through editable flags (present=true, valid=true)
	 * but lack proper underlying validation of the complete assurance matrix.
	 * This security-critical check ensures we don't trust the artifact's self-reported
	 * validity without verifying all required assurance layers are present.
	 */
	it("rejects ready pr-closeout artifacts with incomplete assurance entries", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "harness-next-pr-closeout-"));
		try {
			writeFileSync(
				join(repoRoot, "pr-closeout.json"),
				JSON.stringify({
					...prCloseoutReport(),
					assurance: {
						present: true,
						valid: true,
						entries: [
							{
								layer: "unit",
								status: "pass",
								evidence: ["artifact:assurance.json"],
							},
						],
						findings: [],
					},
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

	it("rejects ready pr-closeout artifacts with malformed optional assurance fields", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "harness-next-pr-closeout-"));
		try {
			writeFileSync(
				join(repoRoot, "pr-closeout.json"),
				JSON.stringify({
					...prCloseoutReport(),
					assurance: {
						present: true,
						valid: true,
						entries: readyAssuranceEntries().map((entry) =>
							entry.layer === "load_stress" ? { ...entry, reason: 42 } : entry,
						),
						findings: [],
					},
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

	it("rejects ready pr-closeout artifacts with failing closeout gates", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "harness-next-pr-closeout-"));
		try {
			writeFileSync(
				join(repoRoot, "pr-closeout.json"),
				JSON.stringify(
					prCloseoutReport({
						harnessGates: {
							...prCloseoutReport().harnessGates,
							gates: [
								{
									gateId: "he_code_review",
									required: true,
									status: "fail",
									evidenceRefs: ["artifact:closeout-gates.json"],
									requiresHuman: false,
									blocker: "Review gate failed.",
								},
							],
						},
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

	it("rejects ready pr-closeout artifacts with non-required failing gates", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "harness-next-pr-closeout-"));
		try {
			writeFileSync(
				join(repoRoot, "pr-closeout.json"),
				JSON.stringify(
					prCloseoutReport({
						harnessGates: {
							...prCloseoutReport().harnessGates,
							gates: [
								{
									gateId: "he_code_review",
									required: false,
									status: "fail",
									evidenceRefs: ["artifact:closeout-gates.json"],
									requiresHuman: false,
									blocker: "Optional evidence is still failing.",
								},
							],
						},
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

	it("rejects ready pr-closeout artifacts with incomplete traceability", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "harness-next-pr-closeout-"));
		try {
			writeFileSync(
				join(repoRoot, "pr-closeout.json"),
				JSON.stringify(
					prCloseoutReport({
						traceability: {
							sessionIds: [],
							traceIds: [],
							aiSessionTraceability: null,
							complete: false,
						},
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

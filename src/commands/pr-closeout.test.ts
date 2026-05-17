import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	HARNESS_CLOSEOUT_GATE_IDS,
	HE_GATE_RESULT_SCHEMA_VERSION,
	HE_PHASE_EXIT_SCHEMA_VERSION,
	type HeGateId,
	type HeGatePayload,
} from "../lib/decision/he-phase-exit.js";
import { runPrCloseoutCLI } from "./pr-closeout.js";

type TestRunner = NonNullable<Parameters<typeof runPrCloseoutCLI>[1]>["runner"];

function gatePayload(gateId: HeGateId): HeGatePayload {
	switch (gateId) {
		case "simplify":
			return {
				scopeEvidence: ["artifacts/reviews/simplify.md"],
				reuseReviewed: true,
				qualityReviewed: true,
				efficiencyReviewed: true,
			};
		case "improve_codebase_architecture":
			return {
				scopeEvidence: ["artifacts/reviews/architecture.md"],
				complexitySymptomsNamed: true,
				patchVsInterfaceCompared: true,
				tracerProofRecorded: true,
				decisionSurfaceRecorded: true,
			};
		case "unslopify":
			return {
				scopeEvidence: ["artifacts/reviews/unslopify.md"],
				cleanupLedgerRecorded: true,
				removalEvidenceRecorded: true,
				validationRecorded: true,
				rollbackAndResidualRiskRecorded: true,
			};
		case "ubiquitous_language":
			return {
				scopeEvidence: ["UBIQUITOUS_LANGUAGE.md"],
				glossaryReviewed: true,
				canonicalTermsApplied: true,
				promptTranslationsUpdated: true,
				instructionPointerChecked: true,
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
	}
}

const PASSING_PHASE_EXIT = {
	schemaVersion: HE_PHASE_EXIT_SCHEMA_VERSION,
	phaseContext: {
		phase: "closeout",
		failingEvidencePresent: false,
		reviewFeedbackPresent: false,
	},
	recommendation: "continue",
	commitAllowed: true,
	exitAllowed: true,
	blockers: [],
	warnings: [],
	gates: HARNESS_CLOSEOUT_GATE_IDS.map((gateId) => {
		const notApplicable = gateId === "he_fix_bugs" || gateId === "autofix";
		return {
			schemaVersion: HE_GATE_RESULT_SCHEMA_VERSION,
			gateId,
			required: gateId !== "autofix" && gateId !== "ubiquitous_language",
			executionMode: notApplicable ? "not_applicable" : "direct_skill",
			status: notApplicable ? "not_applicable" : "pass",
			payload: gatePayload(gateId),
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
			reason: notApplicable
				? `${gateId} not applicable to this closeout.`
				: null,
			blockedReason: null,
		};
	}),
};

function writePhaseExit(dir: string): string {
	const path = join(dir, "phase-exit.json");
	writeFileSync(path, JSON.stringify(PASSING_PHASE_EXIT));
	return path;
}

const PR_BODY_WITH_TRACEABILITY = `
Refs JSC-327

## Work performed

- Session IDs: codex-session:2026-05-16
- Trace IDs: circleci:workflow-123, artifacts/pr-closeout/pr-closeout.json
- AI session / traceability: Codex session validates PR closeout evidence.
- Completed work: command and tests
`.trim();

async function capture(
	args: string[],
	runner?: TestRunner,
): Promise<{
	exitCode: number;
	output: string;
	error: string;
}> {
	const output: string[] = [];
	const error: string[] = [];
	const infoSpy = vi
		.spyOn(console, "info")
		.mockImplementation((message = "") => {
			output.push(String(message));
		});
	const errorSpy = vi
		.spyOn(console, "error")
		.mockImplementation((message = "") => {
			error.push(String(message));
		});
	try {
		const runOptions = runner ? { runner } : {};
		return {
			exitCode: await runPrCloseoutCLI(args, runOptions),
			output: output.join("\n"),
			error: error.join("\n"),
		};
	} finally {
		infoSpy.mockRestore();
		errorSpy.mockRestore();
	}
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe("runPrCloseoutCLI", () => {
	it("builds a JSON report from a normalized input file", async () => {
		const dir = mkdtempSync(join(tmpdir(), "pr-closeout-cli-"));
		const inputPath = join(dir, "input.json");
		writeFileSync(
			inputPath,
			JSON.stringify({
				pullRequest: {
					number: 258,
					state: "OPEN",
					isDraft: false,
					mergeStateStatus: "CLEAN",
					body: "Refs JSC-327\n",
				},
				branch: {
					clean: true,
				},
				checks: [{ name: "pr-pipeline", state: "SUCCESS" }],
				reviewThreads: {
					unresolved: 0,
				},
				traceability: {
					sessionIds: ["codex-session:2026-05-16"],
					traceIds: ["circleci:workflow-123"],
					aiSessionTraceability:
						"JSC-327 -> PR #258 -> Codex session -> commit -> validation",
				},
				phaseExit: PASSING_PHASE_EXIT,
			}),
		);

		const result = await capture(["--json", "--input", inputPath]);

		expect(result.exitCode).toBe(0);
		expect(result.error).toBe("");
		expect(JSON.parse(result.output)).toMatchObject({
			schemaVersion: "pr-closeout/v1",
			pr: 258,
			status: "ready",
			nextAction: "ready_to_merge",
		});
	});

	it("returns usage errors for missing input", async () => {
		const result = await capture(["--json"]);

		expect(result.exitCode).toBe(2);
		expect(result.error).toContain("either --input or --pr is required");
	});

	it("rejects non-integer PR numbers", async () => {
		const result = await capture(["--json", "--pr", "258abc"]);

		expect(result.exitCode).toBe(2);
		expect(result.error).toContain("--pr requires a positive integer");
	});

	it("collects live GitHub, CircleCI, CodeRabbit, and Snyk tool evidence", async () => {
		const dir = mkdtempSync(join(tmpdir(), "pr-closeout-cli-"));
		const phaseExitPath = writePhaseExit(dir);
		const calls: string[] = [];
		const runner = (
			command: string,
			args: readonly string[],
			_options: { cwd: string; env?: NodeJS.ProcessEnv },
		): string => {
			calls.push([command, ...args].join(" "));
			if (command === "gh" && args[0] === "pr" && args[1] === "view") {
				return JSON.stringify({
					number: 258,
					state: "OPEN",
					isDraft: false,
					mergeStateStatus: "CLEAN",
					body: PR_BODY_WITH_TRACEABILITY,
				});
			}
			if (command === "gh" && args[0] === "pr" && args[1] === "checks") {
				return JSON.stringify([{ name: "pr-pipeline", state: "SUCCESS" }]);
			}
			if (command === "git") {
				return "";
			}
			return "ok";
		};
		const result = await capture(
			[
				"--json",
				"--repo",
				process.cwd(),
				"--pr",
				"258",
				"--phase-exit",
				phaseExitPath,
			],
			runner,
		);

		expect(result.exitCode).toBe(0);
		expect(JSON.parse(result.output)).toMatchObject({
			status: "ready",
			traceability: {
				complete: true,
				sessionIds: ["codex-session:2026-05-16"],
				traceIds: [
					"circleci:workflow-123",
					"artifacts/pr-closeout/pr-closeout.json",
				],
			},
		});
		expect(calls).toEqual(
			expect.arrayContaining([
				"gh --version",
				"circleci version",
				"coderabbit --version",
				"snyk --version",
				"gh pr view 258 --json number,title,state,isDraft,mergeStateStatus,url,headRefName,baseRefName,reviewDecision,body",
				"gh pr checks 258 --json name,state,link",
			]),
		);
	});

	it("does not count PR template placeholders as traceability evidence", async () => {
		const runner = (
			command: string,
			args: readonly string[],
			_options: { cwd: string; env?: NodeJS.ProcessEnv },
		): string => {
			if (command === "gh" && args[0] === "pr" && args[1] === "view") {
				return JSON.stringify({
					number: 258,
					state: "OPEN",
					isDraft: false,
					mergeStateStatus: "CLEAN",
					body: `
Refs JSC-328

## Work performed

- Session IDs: list Codex thread/session IDs, session-collector artifact IDs or paths, harness run IDs, or n.a. with reason
- Trace IDs: list CI workflow/job URLs, harness/eval/runtime trace IDs, runtime-card/evidence bundle artifact paths, review trace IDs, or n.a. with reason
- AI session / traceability: map the AI session or trace reference to the work it supports
`.trim(),
				});
			}
			if (command === "gh" && args[0] === "pr" && args[1] === "checks") {
				return JSON.stringify([{ name: "pr-pipeline", state: "SUCCESS" }]);
			}
			if (command === "git") {
				return "";
			}
			return "ok";
		};

		const result = await capture(["--json", "--pr", "258"], runner);
		const report = JSON.parse(result.output) as {
			status: string;
			traceability: { complete: boolean };
			blockers: Array<{ surface: string }>;
		};

		expect(result.exitCode).toBe(0);
		expect(report.status).toBe("fixable");
		expect(report.traceability.complete).toBe(false);
		expect(report.blockers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ surface: "traceability" }),
			]),
		);
	});

	it("emits blocker evidence when live PR metadata cannot be read", async () => {
		const runner = (
			command: string,
			args: readonly string[],
			_options: { cwd: string; env?: NodeJS.ProcessEnv },
		): string => {
			if (command === "gh" && args[0] === "pr" && args[1] === "view") {
				throw new Error("authentication failed");
			}
			if (command === "gh" && args[0] === "pr" && args[1] === "checks") {
				throw new Error("checks unavailable");
			}
			if (command === "git") {
				return "";
			}
			return "ok";
		};

		const result = await capture(["--json", "--pr", "258"], runner);
		const report = JSON.parse(result.output) as {
			schemaVersion: string;
			pr: number;
			status: string;
			blockers: Array<{ surface: string; reason: string }>;
		};

		expect(result.exitCode).toBe(0);
		expect(report).toMatchObject({
			schemaVersion: "pr-closeout/v1",
			pr: 258,
			status: "blocked",
		});
		expect(report.blockers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					surface: "tool",
					reason: expect.stringContaining("pr_view_unreadable"),
				}),
			]),
		);
	});

	it("blocks live reports when GitHub check evidence cannot be read", async () => {
		const runner = (
			command: string,
			args: readonly string[],
			_options: { cwd: string; env?: NodeJS.ProcessEnv },
		): string => {
			if (command === "gh" && args[0] === "pr" && args[1] === "view") {
				return JSON.stringify({
					number: 258,
					state: "OPEN",
					isDraft: false,
					mergeStateStatus: "CLEAN",
					body: PR_BODY_WITH_TRACEABILITY,
				});
			}
			if (command === "gh" && args[0] === "pr" && args[1] === "checks") {
				throw new Error("checks unavailable");
			}
			if (command === "git") {
				return "";
			}
			return "ok";
		};

		const result = await capture(["--json", "--pr", "258"], runner);
		const report = JSON.parse(result.output) as {
			status: string;
			blockers: Array<{ surface: string; reason: string }>;
		};

		expect(result.exitCode).toBe(0);
		expect(report.status).toBe("blocked");
		expect(report.blockers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					surface: "tool",
					reason: expect.stringContaining("github_cli is blocked"),
				}),
			]),
		);
	});
});

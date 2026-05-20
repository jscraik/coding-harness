import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	HE_GATE_RESULT_SCHEMA_VERSION,
	HE_PHASE_EXIT_SCHEMA_VERSION,
	type HeGateId,
	type HeGatePayload,
	type HeGateResult,
	type HePhaseExit,
} from "../decision/he-phase-exit.js";
import {
	buildLiveRuntimeCard,
	buildLocalRuntimeCard,
	type RuntimeCardGitRunner,
} from "./local-runtime-card.js";
import {
	RUNTIME_EVIDENCE_BUNDLE_SCHEMA_VERSION,
	type RuntimeEvidenceBundle,
} from "./runtime-evidence-bundle.js";
import { validateRuntimeCard } from "./runtime-card.js";

const CODE = String.fromCharCode(96);

function codePath(path: string): string {
	return CODE + path + CODE;
}

function writeActiveArtifacts(repoRoot: string): void {
	const specPath =
		".harness/specs/2026-05-13-jsc-311-he-phase-exit-evidence-gates-spec.md";
	const planPath =
		".harness/plan/2026-05-13-JSC-311-he-phase-exit-evidence-gates-plan.md";
	mkdirSync(join(repoRoot, ".harness/specs"), { recursive: true });
	mkdirSync(join(repoRoot, ".harness/plan"), { recursive: true });
	writeFileSync(join(repoRoot, specPath), "# Spec\n");
	writeFileSync(join(repoRoot, planPath), "# Plan\n");
	writeFileSync(
		join(repoRoot, ".harness/active-artifacts.md"),
		[
			"# Active Harness Specs And Plans",
			"",
			"| Linear Key | Active Spec | Active Plan |",
			"| --- | --- | --- |",
			`| JSC-311 | ${codePath(specPath)} | ${codePath(planPath)} |`,
			"",
		].join("\n"),
	);
}

function writeActiveArtifactsForIssues(repoRoot: string): void {
	const staleSpecPath =
		".harness/specs/2026-05-13-jsc-311-he-phase-exit-evidence-gates-spec.md";
	const stalePlanPath =
		".harness/plan/2026-05-13-JSC-311-he-phase-exit-evidence-gates-plan.md";
	const evidenceSpecPath =
		".harness/specs/2026-05-20-jsc-999-runtime-evidence-spec.md";
	const evidencePlanPath =
		".harness/plan/2026-05-20-JSC-999-runtime-evidence-plan.md";
	mkdirSync(join(repoRoot, ".harness/specs"), { recursive: true });
	mkdirSync(join(repoRoot, ".harness/plan"), { recursive: true });
	writeFileSync(join(repoRoot, staleSpecPath), "# Spec\n");
	writeFileSync(join(repoRoot, stalePlanPath), "# Plan\n");
	writeFileSync(join(repoRoot, evidenceSpecPath), "# Evidence Spec\n");
	writeFileSync(join(repoRoot, evidencePlanPath), "# Evidence Plan\n");
	writeFileSync(
		join(repoRoot, ".harness/active-artifacts.md"),
		[
			"# Active Harness Specs And Plans",
			"",
			"| Linear Key | Active Spec | Active Plan |",
			"| --- | --- | --- |",
			`| JSC-311 | ${codePath(staleSpecPath)} | ${codePath(stalePlanPath)} |`,
			`| JSC-999 | ${codePath(evidenceSpecPath)} | ${codePath(evidencePlanPath)} |`,
			"",
		].join("\n"),
	);
}

function gitRunner(status = ""): RuntimeCardGitRunner {
	return (args) => {
		if (args.join(" ") === "branch --show-current") {
			return "codex/jsc-311-phase-exit-next";
		}
		if (args.join(" ") === "rev-parse HEAD") {
			return "a".repeat(40);
		}
		if (args.join(" ") === "status --porcelain") {
			return status;
		}
		return undefined;
	};
}

function gate(gateId: HeGateId): HeGateResult {
	const payload: HeGatePayload = {
		scopeEvidence: ["src/lib/runtime/local-runtime-card.ts"],
		reuseReviewed: true,
		qualityReviewed: true,
		efficiencyReviewed: true,
	};
	return {
		schemaVersion: HE_GATE_RESULT_SCHEMA_VERSION,
		gateId,
		required: true,
		executionMode: "direct_skill",
		status: "pass",
		payload,
		evidenceRefs: [
			{
				id: "validation",
				kind: "command",
				ref: "pnpm vitest run src/lib/runtime/local-runtime-card.test.ts",
				gateLocal: true,
			},
		],
		findings: [],
		actions: [],
		validation: [
			{
				command: "pnpm vitest run src/lib/runtime/local-runtime-card.test.ts",
				outcome: "pass",
				reason: null,
			},
		],
		requiresHuman: false,
		safeToContinue: true,
		reason: null,
		blockedReason: null,
	};
}

function passingPhaseExit(): HePhaseExit {
	return {
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
		gates: [gate("simplify")],
	};
}

function runtimeEvidenceBundle(
	overrides: Partial<RuntimeEvidenceBundle> = {},
): RuntimeEvidenceBundle {
	return {
		schemaVersion: RUNTIME_EVIDENCE_BUNDLE_SCHEMA_VERSION,
		generatedAt: "2026-05-15T12:00:00.000Z",
		issueKey: "JSC-311",
		provenance: {
			kind: "session_collector",
			ref: "session-collector:run-123",
			collectedAt: "2026-05-15T12:00:00.000Z",
		},
		pullRequest: {
			number: 250,
			state: "OPEN",
			isDraft: false,
			mergeStateStatus: "BLOCKED",
			url: "https://github.com/jscraik/coding-harness/pull/250",
		},
		linear: {
			issueKey: "JSC-311",
			freshness: "current",
			status: "In Progress",
			statusType: "started",
			url: "https://linear.app/jscraik/issue/JSC-311/example",
			actionRequired: null,
		},
		phaseExit: passingPhaseExit(),
		sources: [
			{
				kind: "validation",
				ref: "command:pnpm check",
				freshness: "current",
				status: "usable",
				failureClass: null,
			},
		],
		blockers: [
			"Session collector reports PR checks are blocked; resolve CI before closeout.",
		],
		...overrides,
	};
}

describe("buildLocalRuntimeCard", () => {
	it("builds a valid active runtime card from local git and active artifacts", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "runtime-card-"));
		writeActiveArtifacts(repoRoot);

		const card = buildLocalRuntimeCard({
			repoRoot,
			now: new Date("2026-05-15T12:00:00.000Z"),
			git: gitRunner(),
		});

		expect(validateRuntimeCard(card)).toEqual({ valid: true, errors: [] });
		expect(card.issueKey).toBe("JSC-311");
		expect(card.lifecycle).toBe("active");
		expect(card.branch).toEqual({
			name: "codex/jsc-311-phase-exit-next",
			clean: true,
			ref: "a".repeat(40),
		});
		expect(card.artifacts).toMatchObject({
			status: "current",
			staleRefs: [],
		});
		expect(card.phaseExit.status).toBe("not_run");
		expect(card.attemptLedger).toMatchObject({
			schemaVersion: "attempt-ledger/v1",
			command: "runtime-card",
			attempt: 1,
			maxAttempts: 1,
			firstFailure: null,
			retryDecision: "none",
			owner: "codex",
			stopReason: null,
			nextAction:
				"Run focused validation and supply a HePhaseExit/v1 artifact before closeout.",
		});
		expect(card.recoveryEvent).toBeNull();
		expect(card.sources.map((source) => source.kind)).toEqual([
			"git",
			"artifact",
		]);
	});

	it("blocks missing phase-exit evidence when the runtime-card context requires it", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "runtime-card-"));
		writeActiveArtifacts(repoRoot);

		const card = buildLocalRuntimeCard({
			repoRoot,
			now: new Date("2026-05-15T12:00:00.000Z"),
			git: gitRunner(),
			requirePhaseExit: true,
		});

		expect(validateRuntimeCard(card)).toEqual({ valid: true, errors: [] });
		expect(card.lifecycle).toBe("blocked");
		expect(card.phaseExit.status).toBe("not_run");
		expect(card.blockers).toEqual([
			"Phase-exit artifact is required for this runtime-card context.",
		]);
		expect(card.attemptLedger).toMatchObject({
			firstFailure: {
				attempt: 1,
				lifecycle: "blocked",
				nextSafeAction:
					"Phase-exit artifact is required for this runtime-card context.",
			},
			retryDecision: "stop",
			owner: "codex",
			stopReason:
				"Phase-exit artifact is required for this runtime-card context.",
			nextAction:
				"Phase-exit artifact is required for this runtime-card context.",
		});
		expect(card.recoveryEvent).toMatchObject({
			schemaVersion: "recovery-event/v1",
			command: "runtime-card",
			attempt: 1,
			owner: "codex",
			failureClass: "phase_exit_missing",
			stopReason:
				"Phase-exit artifact is required for this runtime-card context.",
			nextAction:
				"Phase-exit artifact is required for this runtime-card context.",
			retryDecision: "stop",
		});
		expect(card.sources).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					kind: "phase_exit",
					ref: "input:phase-exit",
					freshness: "missing",
					status: "empty",
					failureClass: "phase_exit_missing",
				}),
			]),
		);
	});

	it("keeps runtime-card/v1 validation compatible with older linear snapshots", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "runtime-card-"));
		writeActiveArtifacts(repoRoot);
		const card = buildLocalRuntimeCard({
			repoRoot,
			now: new Date("2026-05-15T12:00:00.000Z"),
			git: gitRunner(),
		});
		const legacyCard = {
			...card,
			linear: {
				issueKey: card.linear.issueKey,
				freshness: card.linear.freshness,
				actionRequired: card.linear.actionRequired,
			},
		};

		expect(validateRuntimeCard(legacyCard)).toEqual({
			valid: true,
			errors: [],
		});
	});

	it("normalizes lowercase issue keys from branch names", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "runtime-card-"));
		const card = buildLocalRuntimeCard({
			repoRoot,
			now: new Date("2026-05-15T12:00:00.000Z"),
			git: gitRunner(),
		});

		expect(validateRuntimeCard(card)).toEqual({ valid: true, errors: [] });
		expect(card.issueKey).toBe("JSC-311");
		expect(card.linear.issueKey).toBe("JSC-311");
		expect(card.linear.freshness).toBe("unknown");
	});

	it("collapses passing phase-exit evidence into locally validated lifecycle", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "runtime-card-"));
		writeActiveArtifacts(repoRoot);
		writeFileSync(
			join(repoRoot, "phase-exit.json"),
			JSON.stringify(passingPhaseExit(), null, 2),
		);

		const card = buildLocalRuntimeCard({
			repoRoot,
			phaseExitPath: "phase-exit.json",
			now: new Date("2026-05-15T12:00:00.000Z"),
			git: gitRunner(" M src/commands/runtime-card.ts\n"),
		});

		expect(validateRuntimeCard(card)).toEqual({ valid: true, errors: [] });
		expect(card.lifecycle).toBe("locally_validated");
		expect(card.branch.clean).toBe(false);
		expect(card.phaseExit).toEqual({
			status: "pass",
			reason: "Required phase-exit gates passed.",
		});
		expect(card.sources.map((source) => source.kind)).toContain("phase_exit");
	});

	it("blocks when active artifact references are stale", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "runtime-card-"));
		const specPath = ".harness/specs/missing-spec.md";
		const planPath = ".harness/plan/missing-plan.md";
		mkdirSync(join(repoRoot, ".harness"), { recursive: true });
		writeFileSync(
			join(repoRoot, ".harness/active-artifacts.md"),
			[
				"| Linear Key | Active Spec | Active Plan |",
				"| --- | --- | --- |",
				`| JSC-311 | ${codePath(specPath)} | ${codePath(planPath)} |`,
				"",
			].join("\n"),
		);

		const card = buildLocalRuntimeCard({
			repoRoot,
			issueKey: "JSC-311",
			now: new Date("2026-05-15T12:00:00.000Z"),
			git: gitRunner(),
		});

		expect(validateRuntimeCard(card)).toEqual({ valid: true, errors: [] });
		expect(card.lifecycle).toBe("blocked");
		expect(card.blockers).toEqual([
			"Active spec or plan references are stale or missing on disk.",
		]);
		expect(card.artifacts.staleRefs).toEqual([specPath, planPath]);
	});

	it("merges live provider evidence and blocks continuation when provider state is unsafe", async () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "runtime-card-"));
		writeActiveArtifacts(repoRoot);

		const card = await buildLiveRuntimeCard({
			repoRoot,
			issueKey: "JSC-311",
			now: new Date("2026-05-15T12:00:00.000Z"),
			git: gitRunner(),
			liveProvider: () => ({
				pullRequest: {
					number: 247,
					state: "OPEN",
					isDraft: false,
					mergeStateStatus: "DIRTY",
					url: "https://github.com/jscraik/coding-harness/pull/247",
				},
				linear: {
					issueKey: "JSC-311",
					freshness: "current",
					status: "In Review",
					statusType: "started",
					url: "https://linear.app/jscraik/issue/JSC-311/example",
					actionRequired: null,
				},
				sources: [
					{
						kind: "pr",
						ref: "command:gh pr view",
						freshness: "current",
						status: "usable",
						failureClass: null,
					},
					{
						kind: "linear",
						ref: "api:linear:JSC-311",
						freshness: "current",
						status: "usable",
						failureClass: null,
					},
				],
				blockers: [
					"GitHub PR merge state is DIRTY; resolve PR blockers before continuing.",
				],
			}),
		});

		expect(validateRuntimeCard(card)).toEqual({ valid: true, errors: [] });
		expect(card.lifecycle).toBe("blocked");
		expect(card.pullRequest.number).toBe(247);
		expect(card.linear.status).toBe("In Review");
		expect(card.sources.map((source) => source.kind)).toEqual([
			"git",
			"artifact",
			"pr",
			"linear",
		]);
		expect(card.blockers).toEqual([
			"GitHub PR merge state is DIRTY; resolve PR blockers before continuing.",
		]);
	});

	it("adapts normalized session evidence into runtime-card and phase-exit state", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "runtime-card-"));
		writeActiveArtifacts(repoRoot);

		const card = buildLocalRuntimeCard({
			repoRoot,
			issueKey: "JSC-311",
			evidenceBundle: runtimeEvidenceBundle(),
			now: new Date("2026-05-15T12:00:00.000Z"),
			git: gitRunner(),
		});

		expect(validateRuntimeCard(card)).toEqual({ valid: true, errors: [] });
		expect(card.lifecycle).toBe("blocked");
		expect(card.pullRequest.number).toBe(250);
		expect(card.linear.status).toBe("In Progress");
		expect(card.phaseExit).toEqual({
			status: "pass",
			reason: "Required phase-exit gates passed.",
		});
		expect(card.sources.map((source) => source.kind)).toEqual([
			"git",
			"artifact",
			"phase_exit",
			"session",
			"validation",
		]);
		expect(card.blockers).toEqual([
			"Session collector reports PR checks are blocked; resolve CI before closeout.",
		]);
	});

	it("prefers local issue context over imported runtime evidence keys", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "runtime-card-"));
		writeActiveArtifacts(repoRoot);

		const card = buildLocalRuntimeCard({
			repoRoot,
			evidenceBundle: runtimeEvidenceBundle({
				issueKey: "JSC-999",
				linear: {
					issueKey: "JSC-999",
					freshness: "current",
					status: "Done",
					statusType: "completed",
					url: "https://linear.app/jscraik/issue/JSC-999/stale",
					actionRequired: "Stale imported guidance.",
				},
			}),
			now: new Date("2026-05-15T12:00:00.000Z"),
			git: gitRunner(),
		});

		expect(validateRuntimeCard(card)).toEqual({ valid: true, errors: [] });
		expect(card.issueKey).toBe("JSC-311");
		expect(card.linear.issueKey).toBe("JSC-311");
		expect(card.linear.freshness).toBe("unknown");
		expect(card.linear.status).toBeNull();
		expect(card.artifacts.status).toBe("current");
	});

	it("uses imported evidence issue keys for artifact lookup when no local issue is available", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "runtime-card-"));
		writeActiveArtifactsForIssues(repoRoot);

		const card = buildLocalRuntimeCard({
			repoRoot,
			evidenceBundle: runtimeEvidenceBundle({
				issueKey: "JSC-999",
				linear: {
					issueKey: "JSC-999",
					freshness: "current",
					status: "In Progress",
					statusType: "started",
					url: "https://linear.app/jscraik/issue/JSC-999/runtime-evidence",
					actionRequired: null,
				},
			}),
			now: new Date("2026-05-15T12:00:00.000Z"),
			git: (args) => {
				if (args.join(" ") === "branch --show-current")
					return "feature/runtime-card";
				if (args.join(" ") === "rev-parse HEAD") return "b".repeat(40);
				if (args.join(" ") === "status --porcelain") return "";
				return undefined;
			},
		});

		expect(validateRuntimeCard(card)).toEqual({ valid: true, errors: [] });
		expect(card.issueKey).toBe("JSC-999");
		expect(card.artifacts.activeSpec).toContain("jsc-999");
		expect(card.artifacts.activePlan).toContain("JSC-999");
		expect(card.linear.issueKey).toBe("JSC-999");
	});

	it("drops only stale phase-exit blockers when explicit phase-exit evidence is supplied", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "runtime-card-"));
		writeActiveArtifacts(repoRoot);
		writeFileSync(
			join(repoRoot, "phase-exit.json"),
			JSON.stringify(passingPhaseExit(), null, 2),
		);

		const card = buildLocalRuntimeCard({
			repoRoot,
			phaseExitPath: "phase-exit.json",
			evidenceBundle: runtimeEvidenceBundle({
				phaseExit: {
					...passingPhaseExit(),
					recommendation: "commit_blocked",
					commitAllowed: false,
					exitAllowed: false,
					blockers: ["Stale imported phase-exit blocks continuation."],
					warnings: [],
				},
				blockers: [
					"Stale imported phase-exit blocks continuation.",
					"Session collector reports PR checks are blocked; resolve CI before closeout.",
				],
			}),
			now: new Date("2026-05-15T12:00:00.000Z"),
			git: gitRunner(),
		});

		expect(validateRuntimeCard(card)).toEqual({ valid: true, errors: [] });
		expect(card.phaseExit.status).toBe("pass");
		expect(card.blockers).toEqual([
			"Session collector reports PR checks are blocked; resolve CI before closeout.",
		]);
	});

	it("fails closed when normalized session evidence has invalid phase-exit shape", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "runtime-card-"));
		writeActiveArtifacts(repoRoot);

		expect(() =>
			buildLocalRuntimeCard({
				repoRoot,
				evidenceBundle: {
					...runtimeEvidenceBundle(),
					phaseExit: {
						schemaVersion: "he-phase-exit/v1",
						recommendation: "continue",
					},
				},
				now: new Date("2026-05-15T12:00:00.000Z"),
				git: gitRunner(),
			}),
		).toThrow(/runtime evidence bundle failed validation/u);
	});
});

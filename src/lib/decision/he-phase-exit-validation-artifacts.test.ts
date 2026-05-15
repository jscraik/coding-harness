import { describe, expect, it } from "vitest";
import {
	aggregateHePhaseExit,
	createHeFixBugsGateResultFromValidationArtifacts,
	createPhaseContextFromValidationArtifacts,
	hasFailingValidationArtifact,
	type HeLocalValidationArtifact,
	validateHeGateResult,
	validateHePhaseExit,
} from "./he-phase-exit.js";

const passingArtifacts: HeLocalValidationArtifact[] = [
	{
		id: "vitest-phase-exit",
		command: "pnpm vitest run src/lib/decision/he-phase-exit.test.ts",
		outcome: "pass",
		ref: "artifact:vitest-phase-exit",
		scopeEvidence: ["src/lib/decision/he-phase-exit.test.ts"],
	},
	{
		id: "typecheck",
		command: "pnpm typecheck",
		outcome: "pass",
	},
];

describe("HE phase-exit validation artifact ingestion", () => {
	it("derives phase context from local command outcomes", () => {
		expect(
			createPhaseContextFromValidationArtifacts({
				phase: "closeout",
				artifacts: passingArtifacts,
			}),
		).toEqual({
			phase: "closeout",
			failingEvidencePresent: false,
			reviewFeedbackPresent: false,
		});

		expect(
			createPhaseContextFromValidationArtifacts({
				phase: "closeout",
				artifacts: [
					...passingArtifacts,
					{
						id: "codestyle",
						command: "bash scripts/validate-codestyle.sh --fast",
						outcome: "blocked",
						reason: "Biome formatter reported unformatted source.",
					},
				],
				reviewFeedbackPresent: true,
			}),
		).toEqual({
			phase: "closeout",
			failingEvidencePresent: true,
			reviewFeedbackPresent: true,
		});
	});

	it("maps passing local validation artifacts to a not-applicable he-fix-bugs gate", () => {
		const gate = createHeFixBugsGateResultFromValidationArtifacts({
			artifacts: passingArtifacts,
		});

		expect(validateHeGateResult(gate)).toEqual({ valid: true, errors: [] });
		expect(gate).toMatchObject({
			gateId: "he_fix_bugs",
			status: "not_applicable",
			executionMode: "not_applicable",
			safeToContinue: true,
			reason: "No failing local validation artifacts are present.",
			validation: [
				{
					command: "pnpm vitest run src/lib/decision/he-phase-exit.test.ts",
					outcome: "pass",
					reason: null,
				},
				{
					command: "pnpm typecheck",
					outcome: "pass",
					reason: null,
				},
			],
		});
		expect(gate.evidenceRefs).toContainEqual({
			id: "validation-0-vitest-phase-exit",
			kind: "command",
			ref: "artifact:vitest-phase-exit",
			gateLocal: true,
		});
	});

	it("maps failing local validation artifacts to a typed phase-exit blocker", () => {
		const gate = createHeFixBugsGateResultFromValidationArtifacts({
			artifacts: [
				...passingArtifacts,
				{
					id: "related-tests",
					command: "pnpm run test:related",
					outcome: "fail",
					reason: "he-phase-exit adapter regression failed.",
				},
			],
		});

		expect(validateHeGateResult(gate)).toEqual({ valid: true, errors: [] });
		expect(gate).toMatchObject({
			gateId: "he_fix_bugs",
			status: "blocked",
			safeToContinue: false,
			blockedReason: "he-phase-exit adapter regression failed.",
			findings: [
				{
					id: "he_fix_bugs-validation-related-tests",
					severity: "medium",
					status: "open",
					summary: "he-phase-exit adapter regression failed.",
					evidenceRef: "validation-2-related-tests",
				},
			],
		});

		const decision = aggregateHePhaseExit({
			phaseContext: createPhaseContextFromValidationArtifacts({
				phase: "closeout",
				artifacts: [
					...passingArtifacts,
					{
						id: "related-tests",
						command: "pnpm run test:related",
						outcome: "fail",
						reason: "he-phase-exit adapter regression failed.",
					},
				],
			}),
			requiredGates: ["he_fix_bugs"],
			optionalGates: [],
			gates: [gate],
		});

		expect(validateHePhaseExit(decision)).toEqual({ valid: true, errors: [] });
		expect(decision).toMatchObject({
			recommendation: "commit_blocked",
			commitAllowed: false,
			exitAllowed: false,
			blockers: ["he-phase-exit adapter regression failed."],
		});
	});

	it("treats blocked validation artifacts as high-severity blockers", () => {
		const artifacts: HeLocalValidationArtifact[] = [
			{
				id: "codestyle",
				command: "bash scripts/validate-codestyle.sh --fast",
				outcome: "blocked",
			},
		];
		const gate = createHeFixBugsGateResultFromValidationArtifacts({
			artifacts,
		});

		expect(hasFailingValidationArtifact(artifacts)).toBe(true);
		expect(validateHeGateResult(gate)).toEqual({ valid: true, errors: [] });
		expect(gate.findings).toEqual([
			{
				id: "he_fix_bugs-validation-codestyle",
				severity: "high",
				status: "open",
				summary:
					"Local validation artifact 'bash scripts/validate-codestyle.sh --fast' reported blocked.",
				evidenceRef: "validation-0-codestyle",
			},
		]);
	});
});

import { describe, expect, it } from "vitest";
import {
	SESSION_CLOSEOUT_SCHEMA_VERSION,
	buildLocalFitnessEvidence,
	type SessionCloseout,
	isSessionCloseout,
	validateSessionCloseout,
} from "./session-closeout.js";

function validCloseout(
	overrides: Partial<SessionCloseout> = {},
): SessionCloseout {
	return {
		schemaVersion: SESSION_CLOSEOUT_SCHEMA_VERSION,
		sessionId: "019de8af-6e83-7563-b5e5-f104f56bfba2",
		taskId: "JSC-249:P3",
		parentTaskId: "JSC-249",
		outcome: "done",
		primaryFriction: "none",
		validationEvidence: [
			{
				command:
					"pnpm exec vitest run src/lib/session/session-closeout.test.ts",
				status: "pass",
				summary: "Session closeout contract tests passed.",
				evidenceRef: ["vitest:session-closeout"],
			},
		],
		commits: ["15066e6e"],
		pr: {
			provider: "github",
			url: "https://github.com/jscraik/coding-harness/pull/220",
			number: 220,
			branch: "codex/north-star-artifact-surfaces",
		},
		nextAction: "Record KPI evidence before promoting deferred tracks.",
		learningCandidate: "Heartbeat prompts should point at repo-owned runbooks.",
		...overrides,
	};
}

describe("validateSessionCloseout", () => {
	it("rejects non-object candidates", () => {
		expect(validateSessionCloseout(null)).toEqual({
			valid: false,
			errors: ["closeout must be an object"],
		});
		expect(validateSessionCloseout(["not", "a", "closeout"])).toEqual({
			valid: false,
			errors: ["closeout must be an object"],
		});
	});

	it("accepts a complete session-closeout/v1 fixture", () => {
		expect(validateSessionCloseout(validCloseout())).toEqual({
			valid: true,
			errors: [],
		});
	});

	it("accepts local fitness evidence without promoting hosted truth", () => {
		const localFitness = buildLocalFitnessEvidence(
			"artifacts/fitness/report.json",
			{ status: "warn" },
		);
		const result = validateSessionCloseout(
			validCloseout({
				localFitness,
			}),
		);

		expect(result).toEqual({ valid: true, errors: [] });
	});

	it("rejects a fitness receipt that changes its evidence class", () => {
		const result = validateSessionCloseout(
			validCloseout({
				localFitness: {
					reportRef: "artifacts/fitness/report.json",
					status: "pass",
					evidenceClass: "merge_ready",
					claimBoundary: "Merge readiness proven.",
				} as unknown as NonNullable<SessionCloseout["localFitness"]>,
			}),
		);

		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				"localFitness.evidenceClass must be one of local_fitness",
				"localFitness.claimBoundary must state the local-only boundary",
			]),
		);
	});

	it("narrows valid closeouts with the type guard", () => {
		const candidate: unknown = validCloseout({ outcome: "partial" });

		expect(isSessionCloseout(candidate)).toBe(true);
		if (isSessionCloseout(candidate)) {
			expect(candidate.schemaVersion).toBe(SESSION_CLOSEOUT_SCHEMA_VERSION);
			expect(candidate.outcome).toBe("partial");
		}
	});

	it("accepts done closeouts with an explicit no-validation reason", () => {
		const result = validateSessionCloseout(
			validCloseout({
				validationEvidence: [],
				noValidationReason:
					"Documentation-only advisory closeout; validation intentionally deferred.",
			}),
		);

		expect(result).toEqual({ valid: true, errors: [] });
	});

	it("rejects done closeouts without validation evidence or a reason", () => {
		const result = validateSessionCloseout(
			validCloseout({ validationEvidence: [] }),
		);

		expect(result.valid).toBe(false);
		expect(result.errors).toContain(
			"done closeouts require validation evidence or noValidationReason",
		);
	});

	it("accepts blocked closeouts with empty validation evidence", () => {
		const result = validateSessionCloseout(
			validCloseout({
				outcome: "blocked",
				primaryFriction: "permission_sandbox",
				validationEvidence: [],
				commits: [],
				pr: null,
				nextAction: "Request network permission, then retry PR handoff.",
				learningCandidate: null,
			}),
		);

		expect(result).toEqual({ valid: true, errors: [] });
	});

	it("rejects unsupported schema, outcome, friction, and PR values", () => {
		const result = validateSessionCloseout({
			...validCloseout(),
			schemaVersion: "session-closeout/v2",
			outcome: "success",
			primaryFriction: "unknown_delay",
			pr: {
				provider: "gitlab",
				number: 0,
			},
		});

		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				"schemaVersion must be session-closeout/v1",
				"outcome must be one of done, blocked, partial, advisory_only, abandoned",
				"primaryFriction must be one of none, tool_friction, permission_sandbox, repo_state, unclear_instruction, validation_failure, implementation_complexity, external_service",
				"pr.provider must be one of github, other",
				"pr.number must be a positive integer when present",
			]),
		);
	});

	it("rejects malformed validation evidence", () => {
		const result = validateSessionCloseout({
			...validCloseout(),
			validationEvidence: [
				{
					command: "",
					status: "skipped",
					summary: "",
					evidenceRef: [""],
				},
			],
		});

		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				"validationEvidence[0].command must be a non-empty string",
				"validationEvidence[0].status must be one of pass, fail, blocked",
				"validationEvidence[0].summary must be a non-empty string",
				"validationEvidence[0].evidenceRef entries must be non-empty strings",
			]),
		);
	});
});

import { describe, expect, it } from "vitest";
import {
	HARNESS_RUN_CONTEXT_SCHEMA_VERSION,
	type HarnessRunContext,
	isValidHarnessRunContext,
	validateHarnessRunContext,
} from "./harness-run-context.js";

function makeContext(): HarnessRunContext {
	return {
		schemaVersion: HARNESS_RUN_CONTEXT_SCHEMA_VERSION,
		operationProfile: "ci-babysit",
		lifecycleStatus: "waiting_on_ci",
		repo: {
			cwd: "/repo",
			repoRoot: "/repo",
			worktreeRoot: "/repo",
			gitCommonDir: "/repo/.git",
			branch: "codex/jsc-311-phase-exit-next",
			headSha: "a".repeat(40),
		},
		sessionIds: ["codex-session-019c-example"],
		traceIds: ["circleci-workflow-123", "harness-gate-pr-template"],
		workspaceRoots: ["/repo"],
		permissionContext: {
			sandboxMode: "workspace-write",
			permissionProfile: "default",
			network: "enabled",
			readableRoots: ["/repo"],
			writableRoots: ["/repo"],
		},
		validationEvidenceRefs: [
			"Command: pnpm vitest run src/lib/contract/harness-run-context.test.ts -> pass",
		],
		reviewArtifactRefs: ["codex-review:pending"],
		targets: {
			linearIssueIds: ["JSC-311"],
			pullRequests: ["PR-247"],
			externalRepo: null,
		},
		blockers: [],
	};
}

describe("harness-run-context", () => {
	it("accepts a Codex-aligned runtime evidence packet", () => {
		const context = makeContext();

		expect(validateHarnessRunContext(context)).toEqual({
			valid: true,
			errors: [],
		});
		expect(isValidHarnessRunContext(context)).toBe(true);
	});

	it("rejects unknown profiles, lifecycle states, and malformed arrays", () => {
		const candidate = {
			...makeContext(),
			operationProfile: "unsafe-live-mutate",
			lifecycleStatus: "maybe_done",
			sessionIds: "codex-session-019c-example",
			traceIds: ["   "],
			permissionContext: {
				...makeContext().permissionContext,
				network: "sometimes",
			},
		};

		const result = validateHarnessRunContext(candidate);

		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				{
					path: "operationProfile",
					message: "must be a known harness operation profile",
				},
				{
					path: "lifecycleStatus",
					message: "must be a known harness lifecycle status",
				},
				{
					path: "sessionIds",
					message: "must be an array of non-empty strings",
				},
				{
					path: "traceIds",
					message: "must be an array of non-empty strings",
				},
				{
					path: "permissionContext.network",
					message: "must be enabled, disabled, or unknown",
				},
			]),
		);
	});

	it("keeps external targets explicit instead of inferring them from prose", () => {
		const candidate = {
			...makeContext(),
			targets: {
				linearIssueIds: ["JSC-311"],
				pullRequests: ["PR-247"],
				externalRepo: 247,
			},
		};

		expect(validateHarnessRunContext(candidate).errors).toContainEqual({
			path: "targets.externalRepo",
			message: "must be a string or null",
		});
	});

	it("requires real head SHA evidence or the unknown sentinel", () => {
		const candidate = {
			...makeContext(),
			repo: {
				...makeContext().repo,
				headSha: "placeholder-sha",
			},
		};

		expect(validateHarnessRunContext(candidate).errors).toContainEqual({
			path: "repo.headSha",
			message: "must be a 40-character lowercase hex SHA or unknown",
		});

		expect(
			validateHarnessRunContext({
				...makeContext(),
				repo: { ...makeContext().repo, headSha: "unknown" },
			}).valid,
		).toBe(true);
	});
});

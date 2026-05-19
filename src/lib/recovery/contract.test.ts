import { describe, expect, it } from "vitest";
import {
	assessRecoverySafety,
	type RecoveryHandlerContract,
	validateRecoveryHandlerContract,
} from "./contract.js";

function handler(
	overrides: Partial<RecoveryHandlerContract> = {},
): RecoveryHandlerContract {
	return {
		id: "missing-generated-artifact-parent",
		trigger: (context) => context.failure.includes("ENOENT"),
		authority: {
			scope: "local_filesystem",
			mutatesState: true,
			requiresSecret: false,
			mutationAuthorityRef: "repo-workspace-write",
		},
		verifyBefore: async () => ({ ok: true, evidenceRefs: ["before:exists"] }),
		recover: async () => ({
			ok: true,
			status: "recovered",
			evidenceRefs: ["recover:mkdir"],
		}),
		verifyAfter: async () => ({ ok: true, evidenceRefs: ["after:exists"] }),
		rollback: async () => ({
			ok: true,
			status: "stopped",
			evidenceRefs: ["rollback:not-needed"],
		}),
		stopCondition: () => true,
		traceFields: [
			"handler.id",
			"authority.scope",
			"verifyBefore.evidenceRefs",
			"verifyAfter.evidenceRefs",
		],
		retirementCondition:
			"Retire when generated artifact writers always create parent directories.",
		...overrides,
	};
}

describe("recovery contract", () => {
	it("accepts a deterministic handler contract", () => {
		const result = validateRecoveryHandlerContract(handler());
		expect(result).toMatchObject({
			ok: true,
			errors: [],
		});
		expect(result.traceFields).toContain("verifyBefore.evidenceRefs");
	});

	it("denies secret-dependent recovery without an explicit boundary", () => {
		const result = assessRecoverySafety(
			handler({
				authority: {
					scope: "external_service",
					mutatesState: false,
					requiresSecret: true,
				},
			}),
		);
		expect(result.decision).toBe("denied");
		expect(result.reasons).toContain(
			"secret-dependent recovery requires secretBoundary",
		);
	});

	it("denies mutation without authority classification", () => {
		const result = assessRecoverySafety(
			handler({
				authority: {
					scope: "workspace_write",
					mutatesState: true,
					requiresSecret: false,
				},
			}),
		);
		expect(result.decision).toBe("denied");
		expect(result.reasons).toContain(
			"state-mutating recovery requires mutationAuthorityRef",
		);
	});

	it("denies contracts that omit verification hooks and trace fields", () => {
		const result = assessRecoverySafety({
			id: "unsafe",
			trigger: () => true,
			authority: {
				scope: "none",
				mutatesState: false,
				requiresSecret: false,
			},
			recover: async () => ({
				ok: false,
				status: "denied",
				evidenceRefs: ["recover:denied"],
			}),
			retirementCondition: "Retire after replacement verifier exists.",
		});
		expect(result.decision).toBe("denied");
		expect(result.reasons).toEqual(
			expect.arrayContaining([
				"verifyBefore is required",
				"verifyAfter is required",
				"rollback is required",
				"stopCondition is required",
				"traceFields are required",
			]),
		);
	});
});

import { describe, expect, it } from "vitest";
import {
	findCircleCIJobNamedCheckBindings,
	normalizeRequiredChecksManifest,
} from "./required-checks.js";

function createRequiredCheck(
	overrides: Record<string, unknown> = {},
): Record<string, unknown> {
	return {
		policyId: "check-1",
		gateId: "lint",
		displayName: "Lint",
		sourceAppSlug: "circleci",
		sourceAppId: "circleci",
		externalIdPattern: "^lint$",
		class: "required",
		githubCheckName: "pr-pipeline",
		...overrides,
	};
}

function normalizeManifest(
	requiredChecks: Record<string, unknown>[],
	overrides: Record<string, unknown> = {},
) {
	return normalizeRequiredChecksManifest({
		version: 1,
		activeProvider: "circleci",
		requiredChecks,
		...overrides,
	});
}

describe("normalizeRequiredChecksManifest", () => {
	it.each([
		{
			name: "rejects non-object manifests",
			manifest: "invalid-manifest",
			error: "required checks manifest must be an object",
		},
		{
			name: "rejects missing activeProvider",
			manifest: { requiredChecks: [createRequiredCheck()] },
			error: "activeProvider must be a non-empty string",
		},
		{
			name: "rejects non-array requiredChecks",
			manifest: {
				activeProvider: "circleci",
				requiredChecks: "not-an-array",
			},
			error: "requiredChecks must be an array",
		},
		{
			name: "rejects non-object requiredChecks entries",
			manifest: {
				activeProvider: "circleci",
				requiredChecks: ["not-an-object"],
			},
			error: "requiredChecks[0] must be an object",
		},
		{
			name: "rejects entries missing required gate identity fields",
			manifest: {
				activeProvider: "circleci",
				requiredChecks: [{ displayName: "Lint" }],
			},
			error:
				"requiredChecks[0] is missing required fields (displayName/sourceAppSlug/sourceAppId/externalIdPattern)",
		},
	])("$name", ({ manifest, error }) => {
		const result = normalizeRequiredChecksManifest(manifest);
		expect(result).toEqual({ ok: false, error });
	});

	it("defaults executionClass to serial_guarded when omitted", () => {
		const result = normalizeManifest([createRequiredCheck()]);

		expect(result.ok).toBe(true);
		if (!result.ok) {
			return;
		}
		expect(result.value.gates[0]?.executionClass).toBe("serial_guarded");
	});

	it("defaults failure class by governance gate identity", () => {
		const result = normalizeManifest([
			createRequiredCheck({
				gateId: "docs-gate",
				displayName: "Docs Gate",
				externalIdPattern: "^docs-gate$",
			}),
			createRequiredCheck({ policyId: "check-2" }),
		]);

		expect(result.ok).toBe(true);
		if (!result.ok) {
			return;
		}
		const docsGate = result.value.gates.find(
			(gate) => gate.gateId === "docs-gate",
		);
		const lint = result.value.gates.find((gate) => gate.gateId === "lint");
		expect(docsGate?.failureClassDefault).toBe("contract_policy");
		expect(lint?.failureClassDefault).toBe("transient_infra");
	});

	it("sorts normalized gates by order then gate id", () => {
		const result = normalizeManifest([
			createRequiredCheck({
				policyId: "check-2",
				gateId: "zeta",
				displayName: "Zeta",
				externalIdPattern: "^zeta$",
				order: 20,
			}),
			createRequiredCheck({
				gateId: "alpha",
				displayName: "Alpha",
				externalIdPattern: "^alpha$",
				order: 10,
			}),
			createRequiredCheck({
				policyId: "check-3",
				gateId: "beta",
				displayName: "Beta",
				externalIdPattern: "^beta$",
				order: 20,
			}),
		]);

		expect(result.ok).toBe(true);
		if (!result.ok) {
			return;
		}
		expect(result.value.gates.map((gate) => gate.gateId)).toEqual([
			"alpha",
			"beta",
			"zeta",
		]);
	});

	it("preserves CircleCI pr-pipeline mapping", () => {
		const result = normalizeManifest([
			createRequiredCheck({
				gateId: "docs-gate",
				displayName: "Docs Gate",
				externalIdPattern: "^docs-gate$",
			}),
		]);

		expect(result.ok).toBe(true);
		if (!result.ok) {
			return;
		}
		expect(result.value.gates[0]?.githubCheckName).toBe("pr-pipeline");
	});

	it("keeps contractVersion stable when only non-identity metadata changes", () => {
		const base = normalizeManifest([
			createRequiredCheck({
				executionClass: "serial_guarded",
				order: 10,
			}),
		]);
		const changed = normalizeManifest([
			createRequiredCheck({
				policyId: "different-policy-id",
				displayName: "Lint and Style",
				executionClass: "read_only_parallel",
				order: 1,
			}),
		]);

		expect(base.ok).toBe(true);
		expect(changed.ok).toBe(true);
		if (!base.ok || !changed.ok) {
			return;
		}
		expect(changed.value.contractVersion).toBe(base.value.contractVersion);
	});

	it("changes contractVersion when an identity field changes", () => {
		const base = normalizeManifest([createRequiredCheck()]);
		const changed = normalizeManifest([
			createRequiredCheck({ githubCheckName: "harness-gates" }),
		]);

		expect(base.ok).toBe(true);
		expect(changed.ok).toBe(true);
		if (!base.ok || !changed.ok) {
			return;
		}
		expect(changed.value.contractVersion).not.toBe(base.value.contractVersion);
	});

	it("uses explicit contractVersion when present", () => {
		const result = normalizeManifest([createRequiredCheck()], {
			contractVersion: "manual-v1",
		});

		expect(result.ok).toBe(true);
		if (!result.ok) {
			return;
		}
		expect(result.value.contractVersion).toBe("manual-v1");
	});

	it("trims activeProvider and source identity strings before normalization", () => {
		const result = normalizeRequiredChecksManifest({
			version: 1,
			activeProvider: " circleci ",
			requiredChecks: [
				createRequiredCheck({
					sourceAppSlug: " circleci ",
					sourceAppId: " circleci ",
					displayName: " security-scan ",
				}),
			],
		});

		expect(result.ok).toBe(true);
		if (!result.ok) {
			return;
		}
		expect(result.value.activeProvider).toBe("circleci");
		expect(result.value.gates[0]?.provider).toBe("circleci");
		expect(result.value.gates[0]?.sourceAppId).toBe("circleci");
		expect(result.value.gates[0]?.displayName).toBe("security-scan");
	});
});

describe("findCircleCIJobNamedCheckBindings", () => {
	it("flags suspicious CircleCI job-name check contexts", () => {
		const normalized = normalizeManifest([
			createRequiredCheck({ githubCheckName: "lint" }),
			createRequiredCheck({
				policyId: "check-2",
				gateId: "docs-gate",
				displayName: "Docs Gate",
				externalIdPattern: "^docs-gate$",
			}),
		]);

		expect(normalized.ok).toBe(true);
		if (!normalized.ok) {
			return;
		}

		const suspicious = findCircleCIJobNamedCheckBindings(
			normalized.value.gates,
		);
		expect(suspicious).toEqual(["lint"]);
	});

	it("ignores non-CircleCI gates when checking suspicious names", () => {
		const normalized = normalizeManifest([
			createRequiredCheck({
				gateId: "security-scan",
				displayName: "Security Scan",
				sourceAppSlug: "github-actions",
				sourceAppId: "github-actions",
				externalIdPattern: "^security-scan$",
				githubCheckName: "security-scan",
			}),
		]);

		expect(normalized.ok).toBe(true);
		if (!normalized.ok) {
			return;
		}

		const suspicious = findCircleCIJobNamedCheckBindings(
			normalized.value.gates,
		);
		expect(suspicious).toEqual([]);
	});
});

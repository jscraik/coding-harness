import { describe, expect, it } from "vitest";
import {
	findCircleCIJobNamedCheckBindings,
	normalizeRequiredChecksManifest,
} from "./required-checks.js";

describe("normalizeRequiredChecksManifest", () => {
	it("defaults executionClass to serial_guarded when omitted", () => {
		const result = normalizeRequiredChecksManifest({
			version: 1,
			activeProvider: "circleci",
			requiredChecks: [
				{
					policyId: "check-1",
					gateId: "lint",
					displayName: "Lint",
					sourceAppSlug: "circleci",
					sourceAppId: "circleci",
					externalIdPattern: "^lint$",
					class: "required",
					githubCheckName: "pr-pipeline",
				},
			],
		});

		expect(result.ok).toBe(true);
		if (!result.ok) {
			return;
		}
		expect(result.value.gates[0]?.executionClass).toBe("serial_guarded");
	});

	it("preserves CircleCI pr-pipeline mapping", () => {
		const result = normalizeRequiredChecksManifest({
			version: 1,
			activeProvider: "circleci",
			requiredChecks: [
				{
					policyId: "check-1",
					gateId: "docs-gate",
					displayName: "Docs Gate",
					sourceAppSlug: "circleci",
					sourceAppId: "circleci",
					externalIdPattern: "^docs-gate$",
					class: "required",
					githubCheckName: "pr-pipeline",
				},
			],
		});

		expect(result.ok).toBe(true);
		if (!result.ok) {
			return;
		}
		expect(result.value.gates[0]?.githubCheckName).toBe("pr-pipeline");
	});

	it("keeps contractVersion stable when only non-identity metadata changes", () => {
		const base = normalizeRequiredChecksManifest({
			version: 1,
			activeProvider: "circleci",
			requiredChecks: [
				{
					policyId: "check-1",
					gateId: "lint",
					displayName: "Lint",
					sourceAppSlug: "circleci",
					sourceAppId: "circleci",
					externalIdPattern: "^lint$",
					class: "required",
					githubCheckName: "pr-pipeline",
					executionClass: "serial_guarded",
					order: 10,
				},
			],
		});
		const changed = normalizeRequiredChecksManifest({
			version: 1,
			activeProvider: "circleci",
			requiredChecks: [
				{
					policyId: "different-policy-id",
					gateId: "lint",
					displayName: "Lint and Style",
					sourceAppSlug: "circleci",
					sourceAppId: "circleci",
					externalIdPattern: "^lint$",
					class: "required",
					githubCheckName: "pr-pipeline",
					executionClass: "read_only_parallel",
					order: 1,
				},
			],
		});

		expect(base.ok).toBe(true);
		expect(changed.ok).toBe(true);
		if (!base.ok || !changed.ok) {
			return;
		}
		expect(changed.value.contractVersion).toBe(base.value.contractVersion);
	});

	it("changes contractVersion when an identity field changes", () => {
		const base = normalizeRequiredChecksManifest({
			version: 1,
			activeProvider: "circleci",
			requiredChecks: [
				{
					policyId: "check-1",
					gateId: "lint",
					displayName: "Lint",
					sourceAppSlug: "circleci",
					sourceAppId: "circleci",
					externalIdPattern: "^lint$",
					class: "required",
					githubCheckName: "pr-pipeline",
				},
			],
		});
		const changed = normalizeRequiredChecksManifest({
			version: 1,
			activeProvider: "circleci",
			requiredChecks: [
				{
					policyId: "check-1",
					gateId: "lint",
					displayName: "Lint",
					sourceAppSlug: "circleci",
					sourceAppId: "circleci",
					externalIdPattern: "^lint$",
					class: "required",
					githubCheckName: "harness-gates",
				},
			],
		});

		expect(base.ok).toBe(true);
		expect(changed.ok).toBe(true);
		if (!base.ok || !changed.ok) {
			return;
		}
		expect(changed.value.contractVersion).not.toBe(base.value.contractVersion);
	});

	it("uses explicit contractVersion when present", () => {
		const result = normalizeRequiredChecksManifest({
			version: 1,
			activeProvider: "circleci",
			contractVersion: "manual-v1",
			requiredChecks: [
				{
					policyId: "check-1",
					gateId: "lint",
					displayName: "Lint",
					sourceAppSlug: "circleci",
					sourceAppId: "circleci",
					externalIdPattern: "^lint$",
					class: "required",
					githubCheckName: "pr-pipeline",
				},
			],
		});

		expect(result.ok).toBe(true);
		if (!result.ok) {
			return;
		}
		expect(result.value.contractVersion).toBe("manual-v1");
	});
});

describe("findCircleCIJobNamedCheckBindings", () => {
	it("flags suspicious CircleCI job-name check contexts", () => {
		const normalized = normalizeRequiredChecksManifest({
			version: 1,
			activeProvider: "circleci",
			requiredChecks: [
				{
					policyId: "check-1",
					gateId: "lint",
					displayName: "Lint",
					sourceAppSlug: "circleci",
					sourceAppId: "circleci",
					externalIdPattern: "^lint$",
					class: "required",
					githubCheckName: "lint",
				},
				{
					policyId: "check-2",
					gateId: "docs-gate",
					displayName: "Docs Gate",
					sourceAppSlug: "circleci",
					sourceAppId: "circleci",
					externalIdPattern: "^docs-gate$",
					class: "required",
					githubCheckName: "pr-pipeline",
				},
			],
		});

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
		const normalized = normalizeRequiredChecksManifest({
			version: 1,
			activeProvider: "circleci",
			requiredChecks: [
				{
					policyId: "check-1",
					gateId: "security-scan",
					displayName: "Security Scan",
					sourceAppSlug: "github-actions",
					sourceAppId: "github-actions",
					externalIdPattern: "^security-scan$",
					class: "required",
					githubCheckName: "security-scan",
				},
			],
		});

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

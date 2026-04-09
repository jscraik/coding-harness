/**
 * P1 adapter tests for normaliseDriftGateResult and normaliseDocsGateResult.
 *
 * Acceptance: SA2, SA3, SA10 (partial — severity vocab), SA11 (id stability)
 *
 * These tests are unit tests with hand-crafted minimal DriftGateResult and
 * DocsGateResult objects. They do NOT invoke the actual gate runners.
 */

import { describe, expect, it } from "vitest";
import type { DocsFinding, DocsGateResult } from "../../commands/docs-gate.js";
import type {
	DriftFinding,
	DriftGateResult,
} from "../../commands/drift-gate.js";
import type {
	LinearGateOutput,
	LinearGateResult,
} from "../../commands/linear-gate.js";
import {
	classifyLinearGateFailure,
	normaliseDocsGateResult,
	normaliseDriftGateResult,
	normaliseLinearGateResult,
} from "./normalise.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeDriftFinding(overrides: Partial<DriftFinding> = {}): DriftFinding {
	return {
		rule_id: "command.surface.readme.missing",
		surface: "command",
		rule_result: "fail",
		severity: "error",
		baseline_state: "new",
		message: "README is missing the command surface",
		...overrides,
	};
}

function makeDriftResult(
	findings: DriftFinding[],
	overrides: {
		outcome?: "ok" | "error";
		status?: "success" | "partial" | "blocked";
	} = {},
): DriftGateResult {
	return {
		report: {
			schemaVersion: "1.0.0",
			command: "drift-gate",
			mode: "advisory",
			status: overrides.status ?? "success",
			outcome: overrides.outcome ?? "ok",
			error_class: "none",
			generated_at: "2026-03-24T00:00:00.000Z",
			repo_root: "/tmp/test-repo",
			baseline: { path: ".baseline.json", loaded: false },
			summary: {
				finding_count: findings.length,
				new_count: findings.filter((f) => f.baseline_state === "new").length,
				preexisting_count: findings.filter(
					(f) => f.baseline_state === "preexisting",
				).length,
				error_count: findings.filter((f) => f.severity === "error").length,
				suppressed_count: 0,
			},
			findings,
		},
		exitCode: overrides.outcome === "error" ? 2 : 0,
	};
}

function makeDocsFinding(overrides: Partial<DocsFinding> = {}): DocsFinding {
	return {
		rule_id: "docs.surface.missing",
		category: "system",
		surface: "docs/specs/",
		rule_result: "fail",
		result: "fail",
		severity: "warning",
		message: "Required documentation surface was not updated",
		...overrides,
	};
}

function makeDocsResult(
	findings: DocsFinding[],
	overrides: {
		outcome?:
			| "ok"
			| "drift_detected"
			| "bootstrap_gap"
			| "trust_mismatch"
			| "policy_error"
			| "runtime_error";
		status?: "success" | "partial" | "blocked";
	} = {},
): DocsGateResult {
	return {
		report: {
			schemaVersion: "1.0.0",
			command: "docs-gate",
			mode: "advisory",
			status: overrides.status ?? "success",
			outcome: overrides.outcome ?? "ok",
			error_class: "none",
			generated_at: "2026-03-24T00:00:00.000Z",
			repo_root: "/tmp/test-repo",
			base_ref: undefined,
			execution_context: {
				trigger: "local",
				policyMode: "advisory",
				mergeAuthoritative: false,
				trustedBaseAvailable: false,
				trustedBaseRef: undefined,
				trustedContractSha: undefined,
				trustedWorkflowSha: undefined,
				evaluatedSha: undefined,
				mergeQueueTargetRef: undefined,
				mergeQueueBaseSha: undefined,
				bootstrapState: "missing_wiring",
				changedFilesSource: "full_repo_fallback",
				outputRoot: "artifacts/consistency-gate",
			},
			changed_files: [],
			categories: [],
			summary: {
				finding_count: findings.length,
				error_count: findings.filter((f) => f.severity === "error").length,
				warning_count: findings.filter((f) => f.severity === "warning").length,
				required_surface_count: 0,
				missing_surface_count: 0,
				contradiction_count: 0,
				bootstrap_gap_count: 0,
				unknown_category_count: 0,
			},
			findings,
		},
		exitCode: 0,
	};
}

function makeLinearGateResult(
	overrides: Partial<Omit<LinearGateOutput, "issueKeys">> & {
		issueKeys?: Partial<LinearGateOutput["issueKeys"]>;
	} = {},
): LinearGateResult {
	const { issueKeys, ...restOverrides } = overrides;
	const baseIssueKeys: LinearGateOutput["issueKeys"] = {
		branch: [],
		pr: [],
		refs: [],
		fixes: [],
	};

	return {
		ok: true,
		output: {
			passed: true,
			policyApplied: {
				provider: "linear",
				requireBranchIssueKey: true,
				requirePrIssueKey: true,
				prReferenceMode: "refs",
			},
			repoRoot: "/tmp/test-repo",
			checks: [],
			...restOverrides,
			issueKeys: { ...baseIssueKeys, ...(issueKeys ?? {}) },
		},
	};
}

// ─── drift-gate adapter tests (SA2, SA10, SA11) ──────────────────────────────

describe("normaliseDriftGateResult (SA2, SA10, SA11)", () => {
	it("SA2-a: clean run → status=pass, findings=[], summary zeros", () => {
		const result = normaliseDriftGateResult(makeDriftResult([]));
		expect(result.gate).toBe("drift-gate");
		expect(result.status).toBe("pass");
		expect(result.findings).toHaveLength(0);
		expect(result.summary).toEqual({
			errors: 0,
			warnings: 0,
			info: 0,
			total: 0,
		});
	});

	it("SA2-b: outcome=error → status=fail", () => {
		const result = normaliseDriftGateResult(
			makeDriftResult([makeDriftFinding()], { outcome: "error" }),
		);
		expect(result.status).toBe("fail");
	});

	it("SA2-c: outcome=ok, status=partial → status=warn", () => {
		const result = normaliseDriftGateResult(
			makeDriftResult([makeDriftFinding({ severity: "warning" })], {
				outcome: "ok",
				status: "partial",
			}),
		);
		expect(result.status).toBe("warn");
	});

	it("SA2-d: DriftFinding → GateFinding field mapping", () => {
		const finding = makeDriftFinding({
			path: "src/cli.ts",
			fix: { command: "harness drift-gate --seed", suppressible: false },
		});
		const result = normaliseDriftGateResult(makeDriftResult([finding]));
		const gf = result.findings[0];

		expect(gf).toBeDefined();
		expect(gf?.id).toBe("drift-gate.command.command.surface.readme.missing");
		expect(gf?.severity).toBe("error");
		expect(gf?.gate).toBe("drift-gate");
		expect(gf?.message).toBe("README is missing the command surface");
		expect(gf?.path).toBe("src/cli.ts");
		expect(gf?.baseline).toBe(false); // baseline_state === 'new'
		expect(gf?.fix.command).toBe("harness drift-gate --seed");
		expect(gf?.fix.suppressible).toBe(false);
	});

	it("SA2-e: baseline_state=preexisting → baseline=true", () => {
		const finding = makeDriftFinding({ baseline_state: "preexisting" });
		const result = normaliseDriftGateResult(makeDriftResult([finding]));
		expect(result.findings[0]?.baseline).toBe(true);
	});

	it("SA10: severity vocab is error | warning | info", () => {
		for (const severity of ["error", "warning", "info"] as const) {
			const finding = makeDriftFinding({ severity });
			const result = normaliseDriftGateResult(
				makeDriftResult([finding], { outcome: "error" }),
			);
			expect(["error", "warning", "info"]).toContain(
				result.findings[0]?.severity,
			);
		}
	});

	it("SA11: GateFinding.id is stable across two calls with identical input", () => {
		const finding = makeDriftFinding();
		const r1 = normaliseDriftGateResult(makeDriftResult([finding]));
		const r2 = normaliseDriftGateResult(makeDriftResult([finding]));
		expect(r1.findings[0]?.id).toBe(r2.findings[0]?.id);
	});

	it("SA2-f: summary.total === errors + warnings + info", () => {
		const findings = [
			makeDriftFinding({ severity: "error" }),
			makeDriftFinding({ severity: "warning", rule_id: "w" }),
			makeDriftFinding({ severity: "info", rule_id: "i" }),
		];
		const result = normaliseDriftGateResult(
			makeDriftResult(findings, { outcome: "error" }),
		);
		expect(result.summary.errors).toBe(1);
		expect(result.summary.warnings).toBe(1);
		expect(result.summary.info).toBe(1);
		expect(result.summary.total).toBe(3);
	});

	it("SA2-g: finding without fix guidance → fix.suppressible=false, no command/manual", () => {
		const finding = makeDriftFinding(); // no fix field
		const result = normaliseDriftGateResult(makeDriftResult([finding]));
		const gf = result.findings[0];
		expect(gf?.fix.suppressible).toBe(false);
		expect(gf?.fix.command).toBeUndefined();
		expect(gf?.fix.manual).toBeUndefined();
	});

	it("SA2-h: timestamp is preserved from report.generated_at", () => {
		const result = normaliseDriftGateResult(makeDriftResult([]));
		expect(result.timestamp).toBe("2026-03-24T00:00:00.000Z");
	});
});

// ─── docs-gate adapter tests (SA3, SA10, SA11) ───────────────────────────────

describe("normaliseDocsGateResult (SA3, SA10, SA11)", () => {
	it("SA3-a: outcome=ok → status=pass, findings=[], summary zeros", () => {
		const result = normaliseDocsGateResult(makeDocsResult([]));
		expect(result.gate).toBe("docs-gate");
		expect(result.status).toBe("pass");
		expect(result.findings).toHaveLength(0);
		expect(result.summary).toEqual({
			errors: 0,
			warnings: 0,
			info: 0,
			total: 0,
		});
	});

	it("SA3-b: outcome=drift_detected, status=blocked → status=fail", () => {
		const result = normaliseDocsGateResult(
			makeDocsResult([makeDocsFinding({ severity: "error" })], {
				outcome: "drift_detected",
				status: "blocked",
			}),
		);
		expect(result.status).toBe("fail");
	});

	it("SA3-c: outcome=drift_detected, status=partial → status=warn", () => {
		const result = normaliseDocsGateResult(
			makeDocsResult([makeDocsFinding()], {
				outcome: "drift_detected",
				status: "partial",
			}),
		);
		expect(result.status).toBe("warn");
	});

	it("SA3-d: DocsFinding → GateFinding field mapping", () => {
		const finding = makeDocsFinding({
			path: "docs/specs/foo.md",
			severity: "error",
		});
		const result = normaliseDocsGateResult(
			makeDocsResult([finding], {
				outcome: "drift_detected",
				status: "blocked",
			}),
		);
		const gf = result.findings[0];

		expect(gf?.id).toBe("docs-gate.docs/specs/.docs.surface.missing");
		expect(gf?.severity).toBe("error");
		expect(gf?.gate).toBe("docs-gate");
		expect(gf?.path).toBe("docs/specs/foo.md");
		expect(gf?.baseline).toBe(false); // no baseline concept in docs-gate
		expect(gf?.fix.suppressible).toBe(false);
		expect(gf?.fix.command).toBeUndefined(); // no auto-fix for docs findings
	});

	it("SA10: severity vocab is error | warning | info", () => {
		for (const severity of ["error", "warning", "info"] as const) {
			const finding = makeDocsFinding({ severity });
			const result = normaliseDocsGateResult(
				makeDocsResult([finding], {
					outcome: "drift_detected",
					status: "partial",
				}),
			);
			expect(["error", "warning", "info"]).toContain(
				result.findings[0]?.severity,
			);
		}
	});

	it("SA11: id is stable across two calls with identical input", () => {
		const finding = makeDocsFinding();
		const r1 = normaliseDocsGateResult(makeDocsResult([finding]));
		const r2 = normaliseDocsGateResult(makeDocsResult([finding]));
		expect(r1.findings[0]?.id).toBe(r2.findings[0]?.id);
	});

	it("SA3-e: summary.total === errors + warnings + info", () => {
		const findings = [
			makeDocsFinding({ severity: "error", rule_id: "e" }),
			makeDocsFinding({ severity: "warning", rule_id: "w" }),
			makeDocsFinding({ severity: "info", rule_id: "i" }),
		];
		const result = normaliseDocsGateResult(
			makeDocsResult(findings, {
				outcome: "drift_detected",
				status: "blocked",
			}),
		);
		expect(result.summary.errors).toBe(1);
		expect(result.summary.warnings).toBe(1);
		expect(result.summary.info).toBe(1);
		expect(result.summary.total).toBe(3);
	});

	it("SA3-f: timestamp preserved from report.generated_at", () => {
		const result = normaliseDocsGateResult(makeDocsResult([]));
		expect(result.timestamp).toBe("2026-03-24T00:00:00.000Z");
	});
});

describe("normaliseLinearGateResult (P4 governance failure classification)", () => {
	it("classifies checklist policy failures as contract_policy with deterministic next action", () => {
		const result = normaliseLinearGateResult(
			makeLinearGateResult({
				passed: false,
				checks: [
					{
						code: "issue-key-consistency",
						passed: false,
						message:
							"Branch and PR metadata must reference the same Linear issue key.",
					},
				],
			}),
		);

		expect(result.status).toBe("fail");
		expect(result.meta).toMatchObject({
			failureClass: "contract_policy",
			nextAction: "Fix contract/policy mismatch, then rerun linear-gate.",
		});
		expect(result.findings[0]?.fix.manual).toBe(
			"Fix contract/policy mismatch, then rerun linear-gate.",
		);
	});

	it("classifies unknown internal errors as internal_unknown", () => {
		const result = normaliseLinearGateResult({
			ok: false,
			error: {
				code: "UNHANDLED_EXCEPTION",
				message: "Unexpected crash in gate runtime",
			},
		});

		expect(result.status).toBe("fail");
		expect(result.meta).toMatchObject({
			failureClass: "internal_unknown",
			errorCode: "UNHANDLED_EXCEPTION",
			nextAction: "Inspect gate output, fix root cause, and rerun linear-gate.",
		});
	});

	it("maps contract and validation errors to contract_policy", () => {
		for (const code of ["CONTRACT_ERROR", "VALIDATION_ERROR"]) {
			const classification = classifyLinearGateFailure({
				ok: false,
				error: { code, message: "contract error" },
			});
			expect(classification).toEqual({
				failureClass: "contract_policy",
				nextAction: "Fix contract/policy mismatch, then rerun linear-gate.",
			});
		}
	});

	it("returns null for classifyLinearGateFailure when gate passed", () => {
		const classification = classifyLinearGateFailure({
			ok: true,
			output: {
				passed: true,
				checks: [],
			},
		} as unknown as LinearGateResult);

		expect(classification).toBeNull();
	});

	it("produces status=pass when ok:true and all checks pass", () => {
		const result = normaliseLinearGateResult({
			ok: true,
			output: {
				passed: true,
				checks: [
					{
						code: "branch-linkage",
						passed: true,
						message: "Branch references a valid Linear issue key.",
					},
				],
			},
		} as unknown as LinearGateResult);

		expect(result.status).toBe("pass");
		expect(result.findings).toHaveLength(0);
		expect(result.summary.errors).toBe(0);
		expect(result.meta).toBeUndefined();
	});

	it("maps each failing check to a separate finding with gate id format", () => {
		const result = normaliseLinearGateResult({
			ok: true,
			output: {
				passed: false,
				checks: [
					{
						code: "branch-linkage",
						passed: false,
						message: "Branch does not reference a valid Linear issue key.",
					},
					{
						code: "pr-title-format",
						passed: false,
						message: "PR title does not match the required format.",
					},
					{
						code: "issue-state",
						passed: true,
						message: "Issue is in the correct state.",
					},
				],
			},
		} as unknown as LinearGateResult);

		expect(result.status).toBe("fail");
		expect(result.findings).toHaveLength(2);
		expect(result.findings[0]?.id).toBe("linear-gate.check.branch-linkage");
		expect(result.findings[1]?.id).toBe("linear-gate.check.pr-title-format");
		expect(result.summary.errors).toBe(2);
		expect(result.summary.total).toBe(2);
	});

	it("sets errorCode in meta for ok:false result", () => {
		const result = normaliseLinearGateResult({
			ok: false,
			error: {
				code: "CONTRACT_ERROR",
				message: "Could not load contract",
			},
		});

		expect(result.status).toBe("fail");
		expect(result.meta?.errorCode).toBe("CONTRACT_ERROR");
		expect(result.meta?.failureClass).toBe("contract_policy");
		expect(result.findings).toHaveLength(1);
		expect(result.findings[0]?.id).toBe("linear-gate.result.internal");
		expect(result.findings[0]?.fix.manual).toContain("Fix contract");
	});

	it("includes gate and version fields in result", () => {
		const result = normaliseLinearGateResult({
			ok: true,
			output: { passed: true, checks: [] },
		} as unknown as LinearGateResult);

		expect(result.gate).toBe("linear-gate");
		expect(typeof result.version).toBe("string");
		expect(typeof result.timestamp).toBe("string");
	});

	it("classifyLinearGateFailure maps any non-policy error code to internal_unknown", () => {
		const classification = classifyLinearGateFailure({
			ok: false,
			error: { code: "UNEXPECTED_RUNTIME_ERROR", message: "boom" },
		});
		expect(classification).toEqual({
			failureClass: "internal_unknown",
			nextAction: "Inspect gate output, fix root cause, and rerun linear-gate.",
		});
	});
});
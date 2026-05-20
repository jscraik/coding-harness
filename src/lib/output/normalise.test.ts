/**
 * P1 adapter tests for normaliseDriftGateResult and normaliseDocsGateResult.
 *
 * Acceptance: SA2, SA3, SA10 (partial — severity vocab), SA11 (id stability)
 *
 * These tests are unit tests with hand-crafted minimal DriftGateResult and
 * DocsGateResult objects. They do NOT invoke the actual gate runners.
 */

import { describe, expect, it, vi } from "vitest";
import type { DocsFinding, DocsGateResult } from "../../commands/docs-gate.js";
import type { DriftFinding, DriftGateResult } from "../drift-gate.js";
import type {
	LinearGateOutput,
	LinearGateResult,
} from "../../commands/linear-gate.js";
import type {
	PolicyGateOutput,
	PolicyGateResult,
} from "../../commands/policy-gate.js";
import {
	NORTH_STAR_ARTIFACT_SCHEMA_VERSIONS,
	getNorthStarDriftFindingsPath,
} from "../contract/north-star-artifacts.js";
import type { PlanGateResult } from "../plan-gate/types.js";
import type { PreflightGateResult } from "../preflight/types.js";
import type { ReviewGateResult } from "../review-gate/types.js";
import {
	classifyLinearGateFailure,
	normaliseDocsGateResult,
	normaliseDriftGateResult,
	normaliseLinearGateResult,
	normalisePlanGateResult,
	normalisePolicyGateResult,
	normalisePreflightGateResult,
	normaliseReviewGateResult,
	renderGateDecision,
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
		artifactRefs?: DriftGateResult["report"]["artifact_refs"];
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
			...(overrides.artifactRefs
				? { artifact_refs: overrides.artifactRefs }
				: {}),
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

type LinearGateResultFixture =
	| {
			ok?: true;
			output?: Partial<Omit<LinearGateOutput, "issueKeys">> & {
				issueKeys?: Partial<LinearGateOutput["issueKeys"]>;
			};
	  }
	| {
			ok: false;
			error: { code: string; message: string };
	  };

function makeLinearGateResult(
	overrides: LinearGateResultFixture = {},
): LinearGateResult {
	if (overrides.ok === false) {
		return {
			ok: false,
			error: overrides.error,
		};
	}

	const outputOverrides = overrides.output ?? {};
	const { issueKeys, ...restOverrides } = outputOverrides;
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

function makePreflightResult(
	overrides: Partial<PreflightGateResult> = {},
): PreflightGateResult {
	return {
		passed: true,
		checks: [],
		summary: {
			total: 0,
			passed: 0,
			failed: 0,
			warnings: 0,
			durationMs: 10,
		},
		...overrides,
	};
}

function makeReviewResult(
	overrides: Partial<ReviewGateResult> = {},
): ReviewGateResult {
	const base: ReviewGateResult = {
		ok: true,
		output: {
			verified: true,
			headSha: "0123456789abcdef0123456789abcdef01234567",
			checkStatus: "completed",
			checkConclusion: "success",
			needsRerun: false,
			policy_gate_status: "pass",
			plan_traceability_status: "pass",
			plan_ids: ["feat-review-gate-traceability"],
			blockers: [],
			actionable_count: 0,
			informational_count: 1,
			confidence_rubric: {
				score: 5,
				level: "high",
				rationale: ["ready to merge"],
			},
		},
	};

	return {
		...base,
		...overrides,
	} as ReviewGateResult;
}

// ─── drift-gate adapter tests (SA2, SA10, SA11) ──────────────────────────────

describe("renderGateDecision", () => {
	it("renders action, summary, and risk tier from a normalized gate result", () => {
		const info = vi.spyOn(console, "info").mockImplementation(() => {});
		try {
			renderGateDecision(
				{
					gate: "policy-gate",
					version: "1.0.0",
					timestamp: "2026-05-19T00:00:00.000Z",
					status: "fail",
					findings: [],
					summary: { errors: 0, warnings: 0, info: 0, total: 0 },
					reason: "Policy gate failed.",
					action_now: ["Fix policy."],
					action_later: ["Rerun policy-gate."],
					evidence_ref: ["gate:policy-gate"],
				},
				{ passed: 1, total: 2, durationMs: 12 },
				"high",
			);

			expect(info.mock.calls.map(([line]) => line)).toEqual([
				"✗ policy-gate fail",
				"Reason: Policy gate failed.",
				"Action now:",
				"- Fix policy.",
				"Action later:",
				"- Rerun policy-gate.",
				"Summary: 1/2 checks passed (12ms)",
				"Risk tier: high",
			]);
		} finally {
			info.mockRestore();
		}
	});
});

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

	it("includes drift artifact references in metadata and evidence", () => {
		const artifactPath = getNorthStarDriftFindingsPath();
		const artifactRefs = [
			{
				type: "north-star-drift-findings" as const,
				path: artifactPath,
				schemaVersion: NORTH_STAR_ARTIFACT_SCHEMA_VERSIONS.driftFindings,
			},
		];

		const result = normaliseDriftGateResult(
			makeDriftResult([makeDriftFinding()], { artifactRefs }),
		);

		expect(result.meta).toEqual({ artifactRefs });
		expect(result.evidence_ref).toContain(`artifact:${artifactPath}`);
	});

	it("keeps computed evidence refs even when no artifact refs are present", () => {
		const result = normaliseDriftGateResult(
			makeDriftResult([makeDriftFinding({ path: "src/cli.ts" })]),
		);

		expect(result.evidence_ref).toEqual(
			expect.arrayContaining([
				"path:src/cli.ts",
				"finding:drift-gate.command.command.surface.readme.missing",
			]),
		);
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
				output: {
					passed: false,
					checks: [
						{
							code: "issue-key-consistency",
							passed: false,
							message:
								"Branch and PR metadata must reference the same Linear issue key.",
						},
					],
				},
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
		for (const code of [
			"CONTRACT_ERROR",
			"VALIDATION_ERROR",
			" contract_error ",
			"validation_error",
		]) {
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

	it("maps transient infrastructure error codes to transient_infra", () => {
		for (const code of [
			"TIMEOUT",
			"NETWORK_ERROR",
			"RATE_LIMITED",
			"SERVICE_UNAVAILABLE",
			"ETIMEDOUT",
		]) {
			const classification = classifyLinearGateFailure({
				ok: false,
				error: { code, message: "transient failure" },
			});
			expect(classification).toEqual({
				failureClass: "transient_infra",
				nextAction:
					"Retry once after infrastructure recovers, then rerun linear-gate.",
			});
		}
	});

	it("returns null for classifyLinearGateFailure when gate passed", () => {
		const classification = classifyLinearGateFailure(
			makeLinearGateResult({
				output: {
					passed: true,
					checks: [],
				},
			}),
		);

		expect(classification).toBeNull();
	});

	it("produces status=pass when ok:true and all checks pass", () => {
		const result = normaliseLinearGateResult(
			makeLinearGateResult({
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
			}),
		);

		expect(result.status).toBe("pass");
		expect(result.findings).toHaveLength(0);
		expect(result.summary.errors).toBe(0);
		expect(result.meta).toBeUndefined();
	});

	it("maps each failing check to a separate finding with gate id format", () => {
		const result = normaliseLinearGateResult(
			makeLinearGateResult({
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
			}),
		);

		expect(result.status).toBe("fail");
		expect(result.findings).toHaveLength(2);
		expect(result.findings[0]?.id).toBe("linear-gate.check.branch-linkage");
		expect(result.findings[1]?.id).toBe("linear-gate.check.pr-title-format");
		expect(result.summary.errors).toBe(2);
		expect(result.summary.total).toBe(2);
	});

	it("fails closed when payload says passed=false but provides no failing checks", () => {
		const result = normaliseLinearGateResult(
			makeLinearGateResult({
				output: {
					passed: false,
					checks: [],
				},
			}),
		);

		expect(result.status).toBe("fail");
		expect(result.meta).toMatchObject({
			failureClass: "contract_policy",
			nextAction: "Fix contract/policy mismatch, then rerun linear-gate.",
		});
		expect(result.findings.length).toBeGreaterThan(0);
		expect(result.findings[0]?.id).toBe("linear-gate.result.internal");
		expect(result.summary.errors).toBeGreaterThan(0);
	});

	it("sets errorCode in meta for ok:false result", () => {
		const result = normaliseLinearGateResult(
			makeLinearGateResult({
				ok: false,
				error: {
					code: "CONTRACT_ERROR",
					message: "Could not load contract",
				},
			}),
		);

		expect(result.status).toBe("fail");
		expect(result.meta?.errorCode).toBe("CONTRACT_ERROR");
		expect(result.meta?.failureClass).toBe("contract_policy");
		expect(result.findings).toHaveLength(1);
		expect(result.findings[0]?.id).toBe("linear-gate.result.internal");
		expect(result.findings[0]?.fix.manual).toContain("Fix contract");
	});

	it("includes gate and version fields in result", () => {
		const result = normaliseLinearGateResult(
			makeLinearGateResult({
				output: { passed: true, checks: [] },
			}),
		);

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

describe("normalisePreflightGateResult", () => {
	it("maps passing result to pass with decision fields", () => {
		const result = normalisePreflightGateResult(
			makePreflightResult({
				passed: true,
				checks: [
					{
						id: "git-repository",
						description: "git repo",
						severity: "error",
						passed: true,
						durationMs: 5,
					},
				],
				summary: { total: 1, passed: 1, failed: 0, warnings: 0, durationMs: 5 },
			}),
		);

		expect(result.status).toBe("pass");
		expect(result.reason).toContain("Preflight checks passed");
		expect(result.action_now).toEqual([]);
		expect(result.evidence_ref).toContain("gate:preflight-gate");
	});

	it("maps failing checks to findings and fail status", () => {
		const result = normalisePreflightGateResult(
			makePreflightResult({
				passed: false,
				checks: [
					{
						id: "risk-tier",
						description: "risk tier",
						severity: "error",
						passed: false,
						message: "Risk tier high exceeds max medium",
						files: ["src/commands/review-gate.ts"],
						durationMs: 8,
					},
				],
				summary: { total: 1, passed: 0, failed: 1, warnings: 0, durationMs: 8 },
			}),
		);

		expect(result.status).toBe("fail");
		expect(result.findings[0]?.id).toBe("preflight-gate.check.risk-tier");
		expect(result.findings[0]?.path).toBe("src/commands/review-gate.ts");
		expect(result.action_now.length).toBeGreaterThan(0);
		expect(result.evidence_ref).toContain("path:src/commands/review-gate.ts");
	});
});

describe("normaliseReviewGateResult", () => {
	it("maps verified output to pass", () => {
		const result = normaliseReviewGateResult(makeReviewResult());
		expect(result.status).toBe("pass");
		expect(result.reason).toContain("Review verified");
		expect(result.findings).toHaveLength(0);
		expect(result.evidence_ref).toContain(
			"sha:0123456789abcdef0123456789abcdef01234567",
		);
	});

	it("maps unverified blocked output to fail findings", () => {
		const result = normaliseReviewGateResult(
			makeReviewResult({
				ok: true,
				output: {
					verified: false,
					headSha: "0123456789abcdef0123456789abcdef01234567",
					checkStatus: "completed",
					checkConclusion: "failure",
					needsRerun: true,
					policy_gate_status: "fail",
					plan_traceability_status: "fail",
					plan_ids: [],
					blockers: ["Required check 'CodeRabbit' did not pass"],
					actionable_count: 1,
					informational_count: 0,
					confidence_rubric: {
						score: 1,
						level: "low",
						rationale: ["blocked"],
					},
				},
			}),
		);

		expect(result.status).toBe("fail");
		expect(result.findings).toHaveLength(1);
		expect(result.findings[0]?.id).toBe(
			"review-gate.blocker.required_check_failed",
		);
		expect(result.findings[0]?.failureClass).toBe("required_check_failed");
		expect(result.action_now[0]).toContain("Required check");
		expect(result.meta?.blockedFailureClasses).toContain(
			"required_check_failed",
		);
	});

	it("maps error output to internal finding and recovery action", () => {
		const result = normaliseReviewGateResult(
			{
				ok: false,
				error: {
					code: "PERMISSION_DENIED",
					message: "token missing repo scope",
				},
			},
			"Ensure token has repo scope.",
		);

		expect(result.status).toBe("fail");
		expect(result.findings[0]?.id).toBe("review-gate.result.internal");
		expect(result.action_now).toEqual(["Ensure token has repo scope."]);
		expect(result.meta?.errorCode).toBe("PERMISSION_DENIED");
	});
});

// ─── Additional edge-case tests for new PR functions ─────────────────────────

describe("normaliseDocsGateResult (meta fields from PR)", () => {
	it("includes mode, outcome, and reportStatus in meta", () => {
		const result = normaliseDocsGateResult(
			makeDocsResult([], { outcome: "ok", status: "success" }),
		);
		expect(result.meta?.mode).toBe("advisory");
		expect(result.meta?.outcome).toBe("ok");
		expect(result.meta?.reportStatus).toBe("success");
	});

	it("meta reflects blocked outcome and status", () => {
		const result = normaliseDocsGateResult(
			makeDocsResult([makeDocsFinding({ severity: "error" })], {
				outcome: "drift_detected",
				status: "blocked",
			}),
		);
		expect(result.meta?.outcome).toBe("drift_detected");
		expect(result.meta?.reportStatus).toBe("blocked");
	});

	it("passes → reason references docs-gate pass", () => {
		const result = normaliseDocsGateResult(makeDocsResult([]));
		expect(result.reason).toContain("docs-gate");
		expect(result.action_now).toEqual([]);
		expect(result.evidence_ref).toContain("gate:docs-gate");
	});

	it("fail → evidence_ref includes finding id", () => {
		const result = normaliseDocsGateResult(
			makeDocsResult([makeDocsFinding({ severity: "error" })], {
				outcome: "drift_detected",
				status: "blocked",
			}),
		);
		expect(result.evidence_ref.some((r) => r.startsWith("finding:"))).toBe(
			true,
		);
	});
});

describe("normalisePolicyGateResult (decision fields from PR)", () => {
	function makePolicyResult(
		overrides:
			| { ok: true; output: Partial<PolicyGateOutput> }
			| { ok: false; error: { code: string; message: string } },
	): PolicyGateResult {
		if (overrides.ok === false) {
			return { ok: false, error: overrides.error };
		}
		return {
			ok: true,
			output: {
				passed: true,
				tier: "medium",
				action: "warn",
				verdict: "pass",
				violatingFiles: [],
				...overrides.output,
			},
		};
	}

	it("ok:true passed → reason names the tier", () => {
		const result = normalisePolicyGateResult(
			makePolicyResult({ ok: true, output: { tier: "low", passed: true } }),
		);
		expect(result.status).toBe("pass");
		expect(result.reason).toContain("low");
		expect(result.evidence_ref).toContain("tier:low");
	});

	it("ok:true !passed → reason names tier and maxAllowed", () => {
		const result = normalisePolicyGateResult(
			makePolicyResult({
				ok: true,
				output: {
					passed: false,
					tier: "high",
					maxAllowed: "medium",
					action: "block",
					verdict: "fail",
					violatingFiles: ["src/auth/login.ts"],
				},
			}),
		);
		expect(result.status).toBe("fail");
		expect(result.reason).toContain("high");
		expect(result.reason).toContain("medium");
		expect(result.evidence_ref).toContain("path:src/auth/login.ts");
	});

	it("ok:true !passed empty violatingFiles → synthetic unknown finding", () => {
		const result = normalisePolicyGateResult(
			makePolicyResult({
				ok: true,
				output: {
					passed: false,
					tier: "high",
					maxAllowed: "medium",
					action: "block",
					verdict: "fail",
					violatingFiles: [],
				},
			}),
		);
		expect(result.status).toBe("fail");
		expect(result.findings[0]?.id).toBe("policy-gate.result.error.unknown");
		expect(result.evidence_ref).toContain(
			"finding:policy-gate.result.error.unknown",
		);
	});

	it("ok:false → reason from error message, action from decision", () => {
		const result = normalisePolicyGateResult(
			makePolicyResult({
				ok: false,
				error: { code: "SYSTEM_ERROR", message: "could not load contract" },
			}),
		);
		expect(result.status).toBe("fail");
		expect(result.reason).toBe("could not load contract");
		expect(result.action_now).toEqual([
			"Investigate policy-gate internal error and rerun.",
		]);
		expect(result.evidence_ref).toContain("error:policy-gate.result.internal");
	});

	it("ok:true passed → meta includes tier, verdict, action", () => {
		const result = normalisePolicyGateResult(
			makePolicyResult({
				ok: true,
				output: {
					passed: true,
					tier: "medium",
					action: "warn",
					verdict: "pass",
				},
			}),
		);
		expect(result.meta?.tier).toBe("medium");
		expect(result.meta?.verdict).toBe("pass");
		expect(result.meta?.action).toBe("warn");
	});

	it("ok:true !passed → meta includes tier and maxAllowed", () => {
		const result = normalisePolicyGateResult(
			makePolicyResult({
				ok: true,
				output: {
					passed: false,
					tier: "high",
					maxAllowed: "medium",
					action: "block",
					verdict: "fail",
					violatingFiles: ["src/foo.ts"],
				},
			}),
		);
		expect(result.meta?.tier).toBe("high");
		expect(result.meta?.maxAllowed).toBe("medium");
	});
});

describe("normalisePlanGateResult", () => {
	it("adds a fail-safe finding when a failed result has no errors", () => {
		const result = normalisePlanGateResult({
			passed: false,
			artifacts: [],
			errors: [],
		} satisfies PlanGateResult);

		expect(result.status).toBe("fail");
		expect(result.findings).toHaveLength(1);
		expect(result.findings[0]?.id).toBe("plan-gate.result.error.unknown");
	});
});

describe("normalisePreflightGateResult (additional edge cases)", () => {
	it("check without files → finding has no path", () => {
		const result = normalisePreflightGateResult(
			makePreflightResult({
				passed: false,
				checks: [
					{
						id: "node-version",
						description: "Node version check",
						severity: "error",
						passed: false,
						message: "Node 18+ required",
						durationMs: 3,
					},
				],
				summary: { total: 1, passed: 0, failed: 1, warnings: 0, durationMs: 3 },
			}),
		);
		expect(result.findings[0]?.path).toBeUndefined();
		expect(result.findings[0]?.id).toBe("preflight-gate.check.node-version");
	});

	it("check without message uses description as fallback", () => {
		const result = normalisePreflightGateResult(
			makePreflightResult({
				passed: false,
				checks: [
					{
						id: "git-clean",
						description: "Working tree must be clean",
						severity: "error",
						passed: false,
						// no message field
						durationMs: 1,
					},
				],
				summary: { total: 1, passed: 0, failed: 1, warnings: 0, durationMs: 1 },
			}),
		);
		expect(result.findings[0]?.message).toBe("Working tree must be clean");
	});

	it("riskTier present → included in meta and evidence_ref", () => {
		const result = normalisePreflightGateResult(
			makePreflightResult({
				passed: true,
				checks: [],
				summary: { total: 0, passed: 0, failed: 0, warnings: 0, durationMs: 0 },
				riskTier: "high",
			}),
		);
		expect(result.meta?.riskTier).toBe("high");
		expect(result.evidence_ref).toContain("risk-tier:high");
	});

	it("multiple failing checks produce one finding each", () => {
		const result = normalisePreflightGateResult(
			makePreflightResult({
				passed: false,
				checks: [
					{
						id: "check-a",
						description: "Check A",
						severity: "error",
						passed: false,
						message: "A failed",
						durationMs: 1,
					},
					{
						id: "check-b",
						description: "Check B",
						severity: "error",
						passed: false,
						message: "B failed",
						durationMs: 2,
					},
					{
						id: "check-c",
						description: "Check C",
						severity: "error",
						passed: true,
						durationMs: 1,
					},
				],
				summary: { total: 3, passed: 1, failed: 2, warnings: 0, durationMs: 4 },
			}),
		);
		expect(result.findings).toHaveLength(2);
		expect(result.findings[0]?.id).toBe("preflight-gate.check.check-a");
		expect(result.findings[1]?.id).toBe("preflight-gate.check.check-b");
		expect(result.summary.errors).toBe(2);
	});

	it("meta records summary counters", () => {
		const result = normalisePreflightGateResult(
			makePreflightResult({
				passed: false,
				checks: [],
				summary: {
					total: 5,
					passed: 3,
					failed: 2,
					warnings: 1,
					durationMs: 42,
				},
			}),
		);
		expect(result.meta?.totalChecks).toBe(5);
		expect(result.meta?.passedChecks).toBe(3);
		expect(result.meta?.failedChecks).toBe(2);
		expect(result.meta?.warningChecks).toBe(1);
		expect(result.meta?.durationMs).toBe(42);
	});

	it("fix.manual references the check id", () => {
		const result = normalisePreflightGateResult(
			makePreflightResult({
				passed: false,
				checks: [
					{
						id: "my-check",
						description: "My check",
						severity: "error",
						passed: false,
						durationMs: 1,
					},
				],
				summary: { total: 1, passed: 0, failed: 1, warnings: 0, durationMs: 1 },
			}),
		);
		expect(result.findings[0]?.fix.manual).toContain("my-check");
		expect(result.findings[0]?.fix.suppressible).toBe(false);
	});

	it("maps admission-declaration incomplete failures to admission_incomplete blocker class", () => {
		const result = normalisePreflightGateResult(
			makePreflightResult({
				passed: false,
				checks: [
					{
						id: "admission-declaration",
						description: "Validate north-star admission declaration",
						severity: "error",
						passed: false,
						message:
							"admission_incomplete: north_star_metric is required; evidence_links must contain at least one evidence reference",
						durationMs: 1,
					},
				],
				summary: { total: 1, passed: 0, failed: 1, warnings: 0, durationMs: 1 },
			}),
		);

		expect(result.findings[0]?.id).toBe(
			"preflight-gate.blocker.admission_incomplete",
		);
		expect(result.findings[0]?.failureClass).toBe("admission_incomplete");
		expect(result.meta?.blockedFailureClasses).toContain(
			"admission_incomplete",
		);
	});

	it("maps admission-declaration unjustified failures to admission_unjustified blocker class", () => {
		const result = normalisePreflightGateResult(
			makePreflightResult({
				passed: false,
				checks: [
					{
						id: "admission-declaration",
						description: "Validate north-star admission declaration",
						severity: "error",
						passed: false,
						message:
							"admission_unjustified: metric_impact_declared cannot be 'none' when policy_surface_delta > 0",
						durationMs: 1,
					},
				],
				summary: { total: 1, passed: 0, failed: 1, warnings: 0, durationMs: 1 },
			}),
		);

		expect(result.findings[0]?.id).toBe(
			"preflight-gate.blocker.admission_unjustified",
		);
		expect(result.findings[0]?.failureClass).toBe("admission_unjustified");
		expect(result.meta?.blockedFailureClasses).toContain(
			"admission_unjustified",
		);
	});

	it("preserves all admission failure classes when both classes are present", () => {
		const result = normalisePreflightGateResult(
			makePreflightResult({
				passed: false,
				checks: [
					{
						id: "admission-declaration",
						description: "Validate north-star admission declaration",
						severity: "error",
						passed: false,
						message:
							"admission_incomplete: north_star_metric is required; admission_unjustified: metric_impact_declared cannot be 'none' when policy_surface_delta > 0",
						durationMs: 1,
					},
				],
				summary: { total: 1, passed: 0, failed: 1, warnings: 0, durationMs: 1 },
			}),
		);

		expect(result.findings.map((finding) => finding.id)).toEqual([
			"preflight-gate.blocker.admission_incomplete",
			"preflight-gate.blocker.admission_unjustified",
		]);
		expect(result.findings[0]?.failureClass).toBe("admission_incomplete");
		expect(result.findings[1]?.failureClass).toBe("admission_unjustified");
		expect(result.meta?.blockedFailureClasses).toEqual(
			expect.arrayContaining(["admission_incomplete", "admission_unjustified"]),
		);
	});
});

describe("normaliseReviewGateResult (additional edge cases)", () => {
	it("timedOut output → status=warn with warning severity findings", () => {
		const result = normaliseReviewGateResult(
			makeReviewResult({
				ok: true,
				output: {
					verified: false,
					headSha: "aabbccddaabbccddaabbccddaabbccddaabbccdd",
					checkStatus: "completed",
					needsRerun: false,
					timedOut: true,
					policy_gate_status: "pending",
					plan_traceability_status: "missing",
					plan_ids: [],
					blockers: ["Review timed out waiting for checks"],
					actionable_count: 0,
					informational_count: 0,
					confidence_rubric: { score: 1, level: "low", rationale: ["timeout"] },
				},
			}),
		);
		expect(result.status).toBe("warn");
		expect(result.findings[0]?.severity).toBe("warning");
	});

	it("in_progress checkStatus → status=warn", () => {
		const result = normaliseReviewGateResult(
			makeReviewResult({
				ok: true,
				output: {
					verified: false,
					headSha: "aabbccddaabbccddaabbccddaabbccddaabbccdd",
					checkStatus: "in_progress",
					needsRerun: false,
					timedOut: false,
					policy_gate_status: "pending",
					plan_traceability_status: "missing",
					plan_ids: [],
					blockers: [],
					actionable_count: 0,
					informational_count: 0,
					confidence_rubric: {
						score: 2,
						level: "low",
						rationale: ["in progress"],
					},
				},
			}),
		);
		expect(result.status).toBe("warn");
		expect(result.findings).toHaveLength(0);
	});

	it("queued checkStatus → status=warn", () => {
		const result = normaliseReviewGateResult(
			makeReviewResult({
				ok: true,
				output: {
					verified: false,
					headSha: "aabbccddaabbccddaabbccddaabbccddaabbccdd",
					checkStatus: "queued",
					needsRerun: false,
					timedOut: false,
					policy_gate_status: "pending",
					plan_traceability_status: "missing",
					plan_ids: [],
					blockers: [],
					actionable_count: 0,
					informational_count: 0,
					confidence_rubric: {
						score: 2,
						level: "low",
						rationale: ["queued"],
					},
				},
			}),
		);
		expect(result.status).toBe("warn");
	});

	it("needsRerun=true with no blockers → action_now has rerun instruction", () => {
		const result = normaliseReviewGateResult(
			makeReviewResult({
				ok: true,
				output: {
					verified: false,
					headSha: "aabbccddaabbccddaabbccddaabbccddaabbccdd",
					checkStatus: "completed",
					checkConclusion: "failure",
					needsRerun: true,
					timedOut: false,
					policy_gate_status: "fail",
					plan_traceability_status: "pass",
					plan_ids: [],
					blockers: [],
					actionable_count: 0,
					informational_count: 0,
					confidence_rubric: {
						score: 1,
						level: "low",
						rationale: ["needs rerun"],
					},
				},
			}),
		);
		expect(result.action_now).toContain(
			"Rerun review checks and retry review-gate.",
		);
	});

	it("multiple blockers → one finding per blocker with stable failure-class ids", () => {
		const result = normaliseReviewGateResult(
			makeReviewResult({
				ok: true,
				output: {
					verified: false,
					headSha: "aabbccddaabbccddaabbccddaabbccddaabbccdd",
					checkStatus: "completed",
					checkConclusion: "failure",
					needsRerun: false,
					timedOut: false,
					policy_gate_status: "fail",
					plan_traceability_status: "fail",
					plan_ids: [],
					blockers: ["Check A failed", "Check B pending", "Missing approval"],
					actionable_count: 3,
					informational_count: 0,
					confidence_rubric: {
						score: 1,
						level: "low",
						rationale: ["blocked"],
					},
				},
			}),
		);
		expect(result.findings).toHaveLength(3);
		expect(result.findings[0]?.id).toBe(
			"review-gate.blocker.required_check_failed",
		);
		expect(result.findings[1]?.id).toBe(
			"review-gate.blocker.required_check_pending",
		);
		expect(result.findings[2]?.id).toBe("review-gate.blocker.review_missing");
		expect(result.meta?.blockedFailureClasses).toEqual(
			expect.arrayContaining([
				"required_check_failed",
				"required_check_pending",
				"review_missing",
			]),
		);
	});

	it("maps canonical north-star blocker prefixes to stable review failure classes", () => {
		const result = normaliseReviewGateResult(
			makeReviewResult({
				ok: true,
				output: {
					verified: false,
					headSha: "aabbccddaabbccddaabbccddaabbccddaabbccdd",
					checkStatus: "completed",
					checkConclusion: "failure",
					needsRerun: false,
					timedOut: false,
					policy_gate_status: "fail",
					plan_traceability_status: "fail",
					plan_ids: [],
					blockers: [
						"review_evidence_contradiction: North-star decision responses must include evidence references for each question; missing evidence for: lead_time_path",
						"safety_floor_violation: North-star decision responses contradict throughput intent unless explicitly declared as no-impact; negative answers found for: manual_glue",
					],
					actionable_count: 2,
					informational_count: 0,
					confidence_rubric: {
						score: 1,
						level: "low",
						rationale: ["blocked"],
					},
				},
			}),
		);

		expect(result.findings[0]?.id).toBe(
			"review-gate.blocker.review_evidence_contradiction",
		);
		expect(result.findings[1]?.id).toBe(
			"review-gate.blocker.safety_floor_violation",
		);
		expect(result.meta?.blockedFailureClasses).toEqual(
			expect.arrayContaining([
				"review_evidence_contradiction",
				"safety_floor_violation",
			]),
		);
	});

	it("maps review_evidence_incomplete blockers to a stable review failure class", () => {
		const result = normaliseReviewGateResult(
			makeReviewResult({
				ok: true,
				output: {
					verified: false,
					headSha: "aabbccddaabbccddaabbccddaabbccddaabbccdd",
					checkStatus: "completed",
					checkConclusion: "success",
					needsRerun: false,
					timedOut: false,
					policy_gate_status: "pass",
					plan_traceability_status: "pass",
					plan_ids: ["feat-review-gate-traceability"],
					blockers: [
						"review_evidence_incomplete: missing lead_time_path decision evidence in PR body",
					],
					actionable_count: 1,
					informational_count: 0,
					confidence_rubric: {
						score: 1,
						level: "low",
						rationale: ["blocked"],
					},
				},
			}),
		);

		expect(result.findings[0]?.id).toBe(
			"review-gate.blocker.review_evidence_incomplete",
		);
		expect(result.meta?.blockedFailureClasses).toEqual(
			expect.arrayContaining(["review_evidence_incomplete"]),
		);
	});

	it("plan_ids appear in evidence_ref as plan: refs", () => {
		const result = normaliseReviewGateResult(
			makeReviewResult({
				ok: true,
				output: {
					verified: true,
					headSha: "aabbccddaabbccddaabbccddaabbccddaabbccdd",
					checkStatus: "completed",
					checkConclusion: "success",
					needsRerun: false,
					timedOut: false,
					policy_gate_status: "pass",
					plan_traceability_status: "pass",
					plan_ids: ["feat-jsc-180", "feat-jsc-71"],
					blockers: [],
					actionable_count: 0,
					informational_count: 0,
					confidence_rubric: {
						score: 5,
						level: "high",
						rationale: ["ready"],
					},
				},
			}),
		);
		expect(result.evidence_ref).toContain("plan:feat-jsc-180");
		expect(result.evidence_ref).toContain("plan:feat-jsc-71");
	});

	it("error case without recoveryHint → default fallback action_now", () => {
		const result = normaliseReviewGateResult({
			ok: false,
			error: { code: "SYSTEM_ERROR", message: "unexpected failure" },
		});
		expect(result.status).toBe("fail");
		expect(result.action_now[0]).toContain("review-gate");
		expect(result.meta?.errorCode).toBe("SYSTEM_ERROR");
		expect(result.findings[0]?.fix.manual).toBeUndefined();
	});

	it("action_later is always populated for ok:true result", () => {
		const result = normaliseReviewGateResult(makeReviewResult());
		expect(result.action_later.length).toBeGreaterThan(0);
		expect(result.action_later.some((a) => a.includes("review-gate"))).toBe(
			true,
		);
	});

	it("meta captures all output fields for ok:true", () => {
		const result = normaliseReviewGateResult(makeReviewResult());
		expect(result.meta?.headSha).toBe(
			"0123456789abcdef0123456789abcdef01234567",
		);
		expect(result.meta?.checkStatus).toBe("completed");
		expect(result.meta?.needsRerun).toBe(false);
		expect(result.meta?.timedOut).toBe(false);
		expect(result.meta?.policyGateStatus).toBe("pass");
		expect(result.meta?.planTraceabilityStatus).toBe("pass");
		expect(result.meta?.planIds).toEqual(["feat-review-gate-traceability"]);
	});
});

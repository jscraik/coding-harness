import { describe, expect, it } from "vitest";
import {
	HARNESS_DECISION_SCHEMA_VERSION,
	type HarnessDecision,
} from "./harness-decision.js";
import {
	ROUTE_DECISION_BLOCKER_BOUNDARIES,
	ROUTE_DECISION_IDS,
	ROUTE_DECISION_SCHEMA_VERSION,
	isRouteDecision,
	type RouteDecision,
	type RouteDecisionBlockerBoundary,
	type RouteDecisionId,
	toHarnessDecisionLifecycleRouteMeta,
	validateRouteDecision,
	withLifecycleRouteMeta,
} from "./route-decision.js";

function errorCodes(result: { errors: { code: string }[] }): string[] {
	return result.errors.map((error) => error.code);
}

function validRouteDecision(
	overrides: Partial<RouteDecision> = {},
): RouteDecision {
	return {
		schemaVersion: ROUTE_DECISION_SCHEMA_VERSION,
		producer: "harness-engineering-router",
		status: "action_required",
		route: {
			id: "plan",
			label: "Plan",
			targetCommand: null,
			targetSkill: "he-plan",
			...(overrides.route ?? {}),
		},
		sourcePath:
			".harness/plan/2026-05-11-JSC-301-route-decision-contract-plan.md",
		safeToUse: true,
		requiresHuman: false,
		requiresNetwork: false,
		mutates: false,
		mutationPolicy: {
			scope: "none",
			riskTier: "none",
			evidenceFreshness: "not_applicable",
			validatorOwnership: "not_applicable",
			authority: "not_applicable",
		},
		failureClass: null,
		blockerBoundary: "none",
		evidenceRef: ["plan:jsc-301-route-decision-contract"],
		redactionsApplied: [],
		warnings: [],
		...overrides,
	};
}

function routeFixture(id: RouteDecisionId): RouteDecision {
	const baseRoute = {
		id,
		label: id.replace(/_/g, " "),
		targetCommand: null,
		targetSkill: `he-${id}`,
	};
	if (id === "none") {
		return validRouteDecision({
			status: "pass",
			route: {
				...baseRoute,
				targetSkill: null,
			},
		});
	}
	if (id === "human_escalation") {
		return validRouteDecision({
			status: "blocked",
			route: baseRoute,
			safeToUse: false,
			requiresHuman: true,
			failureClass: "approval_required",
			blockerBoundary: "approval_required",
		});
	}
	return validRouteDecision({ route: baseRoute });
}

function boundaryFixture(
	blockerBoundary: RouteDecisionBlockerBoundary,
): RouteDecision {
	if (blockerBoundary === "none") {
		return validRouteDecision({ status: "pass" });
	}
	return validRouteDecision({
		status: "action_required",
		blockerBoundary,
		failureClass: null,
	});
}

function validHarnessDecision(
	overrides: Partial<HarnessDecision> = {},
): HarnessDecision {
	return {
		schemaVersion: HARNESS_DECISION_SCHEMA_VERSION,
		producer: "harness next",
		status: "action_required",
		summary: "Route metadata is available for downstream adapters.",
		nextAction: "Run the focused route-decision tests.",
		nextCommand: "pnpm test src/lib/decision/route-decision.test.ts",
		phase: "review",
		cockpitLane: "review",
		objective: "Prove route metadata remains advisory.",
		requiredEvidence: ["src/lib/decision/route-decision.test.ts"],
		stopConditions: [],
		humanEscalation: null,
		followUpCommands: ["bash scripts/validate-codestyle.sh --fast"],
		hiddenPlumbing: [],
		safeToRun: true,
		requiresHuman: false,
		requiresNetwork: false,
		writesFiles: false,
		evidenceRef: ["test:route-decision"],
		failureClass: null,
		retry: "safe",
		riskTier: "medium",
		meta: {
			changedFiles: ["src/lib/decision/route-decision.ts"],
		},
		...overrides,
	};
}

describe("validateRouteDecision", () => {
	it("rejects non-object candidates", () => {
		const nullResult = validateRouteDecision(null);
		const arrayResult = validateRouteDecision(["not", "a", "route"]);

		expect(nullResult.valid).toBe(false);
		expect(errorCodes(nullResult)).toEqual([
			"route decision must be an object",
		]);
		expect(arrayResult.valid).toBe(false);
		expect(errorCodes(arrayResult)).toEqual([
			"route decision must be an object",
		]);
	});

	it("accepts a complete route-decision/v1 fixture", () => {
		expect(validateRouteDecision(validRouteDecision())).toEqual({
			valid: true,
			errors: [],
		});
	});

	it("accepts legacy non-mutating v1 routes without mutationPolicy", () => {
		const { mutationPolicy: _mutationPolicy, ...legacyRouteDecision } =
			validRouteDecision();

		expect(validateRouteDecision(legacyRouteDecision)).toEqual({
			valid: true,
			errors: [],
		});
	});

	it("rejects legacy mutating v1 routes without mutationPolicy", () => {
		const { mutationPolicy: _mutationPolicy, ...legacyRouteDecision } =
			validRouteDecision({
				mutates: true,
				requiresHuman: false,
			});

		const result = validateRouteDecision(legacyRouteDecision);

		expect(result.valid).toBe(false);
		expect(errorCodes(result)).toContain(
			"mutating routes must set a mutation policy",
		);
	});

	it("narrows valid route decisions with the type guard", () => {
		const candidate: unknown = validRouteDecision({ status: "pass" });

		expect(isRouteDecision(candidate)).toBe(true);
		if (isRouteDecision(candidate)) {
			expect(candidate.schemaVersion).toBe(ROUTE_DECISION_SCHEMA_VERSION);
			expect(candidate.status).toBe("pass");
		}
	});

	it.each(ROUTE_DECISION_IDS)("accepts the %s route id", (id) => {
		expect(validateRouteDecision(routeFixture(id))).toEqual({
			valid: true,
			errors: [],
		});
	});

	it.each(
		ROUTE_DECISION_BLOCKER_BOUNDARIES,
	)("accepts the %s blocker boundary", (blockerBoundary) => {
		expect(validateRouteDecision(boundaryFixture(blockerBoundary))).toEqual({
			valid: true,
			errors: [],
		});
	});

	it("rejects unsupported schema, status, route id, and blocker boundary", () => {
		const base = validRouteDecision();
		const result = validateRouteDecision({
			...base,
			schemaVersion: "route-decision/v2",
			status: "warn",
			blockerBoundary: "mystery",
			route: {
				...base.route,
				id: "unknown",
			},
		});

		expect(result.valid).toBe(false);
		expect(errorCodes(result)).toEqual(
			expect.arrayContaining([
				"schemaVersion must be route-decision/v1",
				"status must be pass, fail, blocked, or action_required",
				"route.id must be one of review, fix, tdd, heartbeat, spec, plan, work, human_escalation, none",
				"blockerBoundary must be one of none, git_state, network, permission, approval_required, test_failure, lint_failure, missing_file, timeout, route_ambiguous, source_unavailable, contract_invalid",
			]),
		);
	});

	it("rejects missing route shape and invalid primitive fields", () => {
		const result = validateRouteDecision({
			...validRouteDecision(),
			producer: " ",
			route: [],
			sourcePath: "",
			safeToUse: "yes",
			requiresHuman: "no",
			requiresNetwork: "no",
			mutates: "no",
			failureClass: "",
		});

		expect(result.valid).toBe(false);
		expect(errorCodes(result)).toEqual(
			expect.arrayContaining([
				"producer must be a non-empty string",
				"route must be an object",
				"sourcePath must be a non-empty string or null",
				"safeToUse must be a boolean",
				"requiresHuman must be a boolean",
				"requiresNetwork must be a boolean",
				"mutates must be a boolean",
				"failureClass must be a non-empty string or null",
			]),
		);
	});

	it("rejects invalid route labels and metadata-only target hints", () => {
		const result = validateRouteDecision({
			...validRouteDecision(),
			route: {
				id: "review",
				label: "",
				targetCommand: " ",
				targetSkill: "",
			},
		});

		expect(result.valid).toBe(false);
		expect(errorCodes(result)).toEqual(
			expect.arrayContaining([
				"route.label must be a non-empty string",
				"route.targetCommand must be a non-empty string or null",
				"route.targetSkill must be a non-empty string or null",
			]),
		);
	});

	it("rejects invalid arrays and invalid optional meta", () => {
		const result = validateRouteDecision({
			...validRouteDecision(),
			evidenceRef: "plan",
			redactionsApplied: [""],
			warnings: [" "],
			meta: [],
		});

		expect(result.valid).toBe(false);
		expect(errorCodes(result)).toEqual(
			expect.arrayContaining([
				"evidenceRef must be a string array",
				"redactionsApplied entries must be non-empty strings",
				"warnings entries must be non-empty strings",
				"meta must be an object when present",
			]),
		);
	});

	it("rejects blocked or failed routes without failure and blocker metadata", () => {
		const blocked = validateRouteDecision(
			validRouteDecision({
				status: "blocked",
				safeToUse: false,
				failureClass: null,
				blockerBoundary: "none",
			}),
		);
		const failed = validateRouteDecision(
			validRouteDecision({
				status: "fail",
				safeToUse: false,
				failureClass: null,
				blockerBoundary: "none",
			}),
		);

		expect(errorCodes(blocked)).toEqual(
			expect.arrayContaining([
				"failureClass must be set when status is blocked or fail",
				"blocked or fail routes must use a non-none blockerBoundary",
			]),
		);
		expect(errorCodes(failed)).toEqual(
			expect.arrayContaining([
				"failureClass must be set when status is blocked or fail",
				"blocked or fail routes must use a non-none blockerBoundary",
			]),
		);
	});

	it("rejects pass routes that carry blocker metadata", () => {
		const result = validateRouteDecision(
			validRouteDecision({
				status: "pass",
				failureClass: "route_ambiguous",
				blockerBoundary: "route_ambiguous",
			}),
		);

		expect(result.valid).toBe(false);
		expect(errorCodes(result)).toContain(
			"pass routes must use failureClass null and blockerBoundary none",
		);
	});

	it("rejects action-required routes with no blocker boundary but a failure class", () => {
		const result = validateRouteDecision(
			validRouteDecision({
				status: "action_required",
				failureClass: "route_ambiguous",
				blockerBoundary: "none",
			}),
		);

		expect(result.valid).toBe(false);
		expect(errorCodes(result)).toContain(
			"action_required routes without blockerBoundary must use failureClass null",
		);
	});

	it("rejects human escalation routes that do not require humans", () => {
		const result = validateRouteDecision(
			validRouteDecision({
				route: {
					id: "human_escalation",
					label: "Human escalation",
					targetCommand: null,
					targetSkill: "he-router",
				},
				requiresHuman: false,
			}),
		);

		expect(result.valid).toBe(false);
		expect(errorCodes(result)).toContain(
			"human_escalation routes must require human review",
		);
	});

	it("rejects none routes with target hints", () => {
		const result = validateRouteDecision(
			validRouteDecision({
				route: {
					id: "none",
					label: "No route",
					targetCommand: "harness next --json",
					targetSkill: "he-work",
				},
			}),
		);

		expect(result.valid).toBe(false);
		expect(errorCodes(result)).toContain(
			"none routes must not set targetCommand or targetSkill",
		);
	});

	it("rejects mutating routes without a mutation policy", () => {
		const result = validateRouteDecision(
			validRouteDecision({
				mutates: true,
				requiresHuman: false,
			}),
		);

		expect(result.valid).toBe(false);
		expect(errorCodes(result)).toContain(
			"mutating routes must set a mutation policy",
		);
	});

	it("accepts low-risk repo-local mutating routes without human review", () => {
		const result = validateRouteDecision(
			validRouteDecision({
				status: "action_required",
				route: {
					id: "work",
					label: "Work",
					targetCommand: null,
					targetSkill: "he-work",
				},
				mutates: true,
				requiresHuman: false,
				mutationPolicy: {
					scope: "repo_local",
					riskTier: "low",
					evidenceFreshness: "current",
					validatorOwnership: "present",
					authority: "agent_local",
				},
			}),
		);

		expect(result).toEqual({ valid: true, errors: [] });
	});

	it("rejects agent-local mutating routes with stale evidence", () => {
		const result = validateRouteDecision(
			validRouteDecision({
				status: "action_required",
				route: {
					id: "work",
					label: "Work",
					targetCommand: null,
					targetSkill: "he-work",
				},
				mutates: true,
				requiresHuman: false,
				mutationPolicy: {
					scope: "repo_local",
					riskTier: "low",
					evidenceFreshness: "stale",
					validatorOwnership: "present",
					authority: "agent_local",
				},
			}),
		);

		expect(result.valid).toBe(false);
		expect(errorCodes(result)).toContain(
			"agent-local mutating routes require low-risk repo-local current validator-owned policy",
		);
	});

	it("rejects agent-local mutating routes without validator ownership", () => {
		const result = validateRouteDecision(
			validRouteDecision({
				status: "action_required",
				route: {
					id: "work",
					label: "Work",
					targetCommand: null,
					targetSkill: "he-work",
				},
				mutates: true,
				requiresHuman: false,
				mutationPolicy: {
					scope: "repo_local",
					riskTier: "low",
					evidenceFreshness: "current",
					validatorOwnership: "missing",
					authority: "agent_local",
				},
			}),
		);

		expect(result.valid).toBe(false);
		expect(errorCodes(result)).toContain(
			"agent-local mutating routes require low-risk repo-local current validator-owned policy",
		);
	});

	it("rejects mutating routes with an incomplete mutation policy", () => {
		const result = validateRouteDecision(
			validRouteDecision({
				status: "action_required",
				route: {
					id: "work",
					label: "Work",
					targetCommand: null,
					targetSkill: "he-work",
				},
				mutates: true,
				requiresHuman: true,
				mutationPolicy: {
					scope: "external",
					riskTier: "high",
					evidenceFreshness: "current",
					validatorOwnership: "present",
					authority: "not_applicable",
				},
			}),
		);

		expect(result.valid).toBe(false);
		expect(errorCodes(result)).toContain(
			"mutating routes must set a complete mutation policy",
		);
	});

	it("rejects high-risk mutating routes without human review", () => {
		const result = validateRouteDecision(
			validRouteDecision({
				status: "action_required",
				route: {
					id: "work",
					label: "Work",
					targetCommand: null,
					targetSkill: "he-work",
				},
				mutates: true,
				requiresHuman: false,
				mutationPolicy: {
					scope: "external",
					riskTier: "high",
					evidenceFreshness: "current",
					validatorOwnership: "present",
					authority: "human_required",
				},
			}),
		);

		expect(result.valid).toBe(false);
		expect(errorCodes(result)).toEqual(
			expect.arrayContaining([
				"human-required mutation policies must require human review",
				"agent-local mutating routes require low-risk repo-local current validator-owned policy",
			]),
		);
	});

	it("rejects agent-local mutating routes that require network access", () => {
		const result = validateRouteDecision(
			validRouteDecision({
				status: "action_required",
				route: {
					id: "work",
					label: "Work",
					targetCommand: null,
					targetSkill: "he-work",
				},
				mutates: true,
				requiresHuman: false,
				requiresNetwork: true,
				mutationPolicy: {
					scope: "repo_local",
					riskTier: "low",
					evidenceFreshness: "current",
					validatorOwnership: "present",
					authority: "agent_local",
				},
			}),
		);

		expect(result.valid).toBe(false);
		expect(errorCodes(result)).toContain(
			"agent-local mutating routes require low-risk repo-local current validator-owned policy",
		);
	});
	it("accepts mutating routes when human review is required", () => {
		const result = validateRouteDecision(
			validRouteDecision({
				status: "action_required",
				route: {
					id: "work",
					label: "Work",
					targetCommand: null,
					targetSkill: "he-work",
				},
				mutates: true,
				requiresHuman: true,
				mutationPolicy: {
					scope: "external",
					riskTier: "high",
					evidenceFreshness: "current",
					validatorOwnership: "present",
					authority: "human_required",
				},
			}),
		);

		expect(result).toEqual({ valid: true, errors: [] });
	});

	it("rejects safe blocked or failed routes", () => {
		const result = validateRouteDecision(
			validRouteDecision({
				status: "blocked",
				safeToUse: true,
				failureClass: "permission_missing",
				blockerBoundary: "permission",
			}),
		);

		expect(result.valid).toBe(false);
		expect(errorCodes(result)).toContain(
			"safeToUse must be false when status is blocked or fail",
		);
	});

	it("accepts route ambiguity without executable command authority", () => {
		const result = validateRouteDecision(
			validRouteDecision({
				status: "action_required",
				route: {
					id: "human_escalation",
					label: "Human route selection",
					targetCommand: null,
					targetSkill: "he-router",
				},
				requiresHuman: true,
				failureClass: null,
				blockerBoundary: "route_ambiguous",
				warnings: ["Multiple lifecycle routes matched the prompt."],
			}),
		);

		expect(result).toEqual({ valid: true, errors: [] });
	});

	it("accepts sanitized task-file references without parsing shell-like text", () => {
		const result = validateRouteDecision(
			validRouteDecision({
				route: {
					id: "work",
					label: "Work",
					targetCommand: null,
					targetSkill: "he-work",
				},
				evidenceRef: ["task-file:/private/tmp/jsc-301/request.md"],
				redactionsApplied: ["shell-like text retained in task file"],
				meta: {
					rawRequestRef: "task-file:/private/tmp/jsc-301/request.md",
					shellLikeText: "$(rm -rf .)",
				},
			}),
		);

		expect(result).toEqual({ valid: true, errors: [] });
	});
});

describe("toHarnessDecisionLifecycleRouteMeta", () => {
	it("maps valid routes into advisory cockpit metadata", () => {
		const routeDecision = validRouteDecision({
			route: {
				id: "review",
				label: "Review",
				targetCommand: "bash scripts/validate-codestyle.sh --fast",
				targetSkill: "he-code-review",
			},
			evidenceRef: ["test:route-decision", "review:he-code-review"],
			redactionsApplied: ["secret-like token redacted"],
			warnings: ["Advisory only"],
		});

		const meta = toHarnessDecisionLifecycleRouteMeta(routeDecision);

		expect(meta).toEqual({
			schemaVersion: ROUTE_DECISION_SCHEMA_VERSION,
			advisory: true,
			routeId: "review",
			routeStatus: "action_required",
			targetCommand: "bash scripts/validate-codestyle.sh --fast",
			targetSkill: "he-code-review",
			sourcePath:
				".harness/plan/2026-05-11-JSC-301-route-decision-contract-plan.md",
			safeToUse: true,
			requiresHuman: false,
			requiresNetwork: false,
			mutates: false,
			mutationPolicy: {
				scope: "none",
				riskTier: "none",
				evidenceFreshness: "not_applicable",
				validatorOwnership: "not_applicable",
				authority: "not_applicable",
			},
			failureClass: null,
			blockerBoundary: "none",
			evidenceRef: ["test:route-decision", "review:he-code-review"],
			redactionsApplied: ["secret-like token redacted"],
			warnings: ["Advisory only"],
		});
		expect(meta.evidenceRef).not.toBe(routeDecision.evidenceRef);
		expect(meta.redactionsApplied).not.toBe(routeDecision.redactionsApplied);
		expect(meta.warnings).not.toBe(routeDecision.warnings);
	});

	it("throws a deterministic error for invalid route inputs", () => {
		const invalidRouteDecision = validRouteDecision();
		Object.defineProperty(invalidRouteDecision, "schemaVersion", {
			value: "route-decision/v2",
		});

		expect(() =>
			toHarnessDecisionLifecycleRouteMeta(invalidRouteDecision),
		).toThrow("routeDecision must satisfy route-decision/v1");
	});
});

describe("withLifecycleRouteMeta", () => {
	it("attaches lifecycle route metadata without changing cockpit authority", () => {
		const decision = validHarnessDecision();
		const routeDecision = validRouteDecision({
			route: {
				id: "review",
				label: "Review",
				targetCommand: "harness route --json",
				targetSkill: "he-code-review",
			},
		});

		const mapped = withLifecycleRouteMeta(decision, routeDecision);

		expect(mapped).not.toBe(decision);
		expect(mapped.nextCommand).toBe(decision.nextCommand);
		expect(mapped.safeToRun).toBe(decision.safeToRun);
		expect(mapped.requiresHuman).toBe(decision.requiresHuman);
		expect(mapped.failureClass).toBe(decision.failureClass);
		expect(mapped.meta).toMatchObject({
			changedFiles: ["src/lib/decision/route-decision.ts"],
			lifecycleRoute: {
				advisory: true,
				routeId: "review",
				targetCommand: "harness route --json",
				targetSkill: "he-code-review",
			},
		});
	});

	it("does not mutate the input cockpit decision", () => {
		const decision = validHarnessDecision();
		const originalMeta = decision.meta;

		withLifecycleRouteMeta(decision, validRouteDecision());

		expect(decision.meta).toBe(originalMeta);
		expect(decision.meta).toEqual({
			changedFiles: ["src/lib/decision/route-decision.ts"],
		});
	});

	it("creates metadata when the cockpit decision has none", () => {
		const decision = validHarnessDecision();
		delete decision.meta;

		const mapped = withLifecycleRouteMeta(decision, validRouteDecision());

		expect(mapped.meta).toMatchObject({
			lifecycleRoute: {
				advisory: true,
				routeId: "plan",
			},
		});
	});

	it("rejects lifecycle route metadata collisions", () => {
		const decision = validHarnessDecision({
			meta: {
				lifecycleRoute: {
					advisory: true,
				},
			},
		});

		expect(() =>
			withLifecycleRouteMeta(decision, validRouteDecision()),
		).toThrow("decision.meta.lifecycleRoute already exists");
	});
});

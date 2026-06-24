import {
	mkdirSync,
	mkdtempSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runNodeScript } from "./script-test-utils.js";

const REPO_ROOT = process.cwd();
const SCRIPT_PATH = join(REPO_ROOT, "scripts/run-harness-evals.mjs");
const CACHE_ROOT = join(REPO_ROOT, ".cache");
const tempRoots: string[] = [];
const SCORECARD_IDS = [
	"command_routing",
	"artifact_evidence",
	"validation_sufficiency",
	"blocker_honesty",
	"manual_step_reduction",
];

afterEach(() => {
	for (const root of tempRoots.splice(0)) {
		rmSync(root, { recursive: true, force: true });
	}
});

describe("run-harness-evals.mjs", () => {
	it("emits structured JSON when path arguments escape the repository", () => {
		mkdirSync(CACHE_ROOT, { recursive: true });
		const outputRoot = mkdtempSync(join(CACHE_ROOT, "eval-script-test-"));
		tempRoots.push(outputRoot);

		const result = runNodeScript(SCRIPT_PATH, [
			"--registry",
			"../outside-registry.json",
			"--output",
			relative(REPO_ROOT, join(outputRoot, "result.json")),
			"--observability-output",
			relative(REPO_ROOT, join(outputRoot, "observability.json")),
			"--fixture-root",
			relative(REPO_ROOT, join(outputRoot, "fixtures")),
		]);
		const report = JSON.parse(result.stdout) as {
			schemaVersion: string;
			status: string;
			findings: Array<{ id: string; severity: string }>;
		};

		expect(result.status).toBe(1);
		expect(report.schemaVersion).toBe("harness-eval-result/v1");
		expect(report.status).toBe("fail");
		expect(report.findings).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "args.registry",
					severity: "error",
				}),
			]),
		);
	});

	it("rejects symlinked registry files instead of following them", () => {
		mkdirSync(CACHE_ROOT, { recursive: true });
		const outputRoot = mkdtempSync(join(CACHE_ROOT, "eval-script-test-"));
		const externalRoot = mkdtempSync(join(tmpdir(), "eval-script-external-"));
		tempRoots.push(outputRoot, externalRoot);
		const externalRegistry = join(externalRoot, "registry.json");
		writeFileSync(
			externalRegistry,
			JSON.stringify({
				schemaVersion: "harness-north-star-agent-delivery-evals/v1",
				northStarGoal: "external symlink fixture",
				scorecard: [],
				observabilityContract: { schemaVersion: "braintrust-log-data/v1" },
				evaluationContract: {},
				scenarios: [],
			}),
		);
		const registryLink = join(outputRoot, "registry-link.json");
		symlinkSync(externalRegistry, registryLink);
		mkdirSync(join(outputRoot, "fixtures"), { recursive: true });

		const result = runNodeScript(SCRIPT_PATH, [
			"--registry",
			relative(REPO_ROOT, registryLink),
			"--output",
			relative(REPO_ROOT, join(outputRoot, "result.json")),
			"--observability-output",
			relative(REPO_ROOT, join(outputRoot, "observability.json")),
			"--fixture-root",
			relative(REPO_ROOT, join(outputRoot, "fixtures")),
		]);
		const report = JSON.parse(result.stdout) as {
			status: string;
			findings: Array<{ id: string; message: string }>;
		};

		expect(result.status).toBe(1);
		expect(report.status).toBe("fail");
		expect(report.findings).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "registry.load",
					message: expect.stringContaining("Invalid file path"),
				}),
			]),
		);
	});

	it("emits structured JSON for an unknown selected scenario", () => {
		mkdirSync(CACHE_ROOT, { recursive: true });
		const outputRoot = mkdtempSync(join(CACHE_ROOT, "eval-script-test-"));
		tempRoots.push(outputRoot);

		const result = runNodeScript(SCRIPT_PATH, [
			"--scenario",
			"missing-scenario",
			"--output",
			relative(REPO_ROOT, join(outputRoot, "result.json")),
			"--observability-output",
			relative(REPO_ROOT, join(outputRoot, "observability.json")),
			"--fixture-root",
			relative(REPO_ROOT, join(outputRoot, "fixtures")),
		]);
		const report = JSON.parse(result.stdout) as {
			status: string;
			summary: { selectedScenario: string; selectedScenarios: number };
			findings: Array<{ id: string; message: string }>;
		};

		expect(result.status).toBe(1);
		expect(report.status).toBe("fail");
		expect(report.summary.selectedScenario).toBe("missing-scenario");
		expect(report.summary.selectedScenarios).toBe(0);
		expect(report.findings).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "args.scenario",
					message: expect.stringContaining("No scenario found"),
				}),
			]),
		);
	});

	it("emits structured JSON for unknown runner arguments", () => {
		mkdirSync(CACHE_ROOT, { recursive: true });
		const outputRoot = mkdtempSync(join(CACHE_ROOT, "eval-script-test-"));
		tempRoots.push(outputRoot);

		const result = runNodeScript(SCRIPT_PATH, [
			"--unknown-flag",
			"--output",
			relative(REPO_ROOT, join(outputRoot, "result.json")),
			"--observability-output",
			relative(REPO_ROOT, join(outputRoot, "observability.json")),
			"--fixture-root",
			relative(REPO_ROOT, join(outputRoot, "fixtures")),
		]);
		const report = JSON.parse(result.stdout) as {
			status: string;
			findings: Array<{ id: string; message: string }>;
			summary: { liveFixtures: number };
		};

		expect(result.status).toBe(1);
		expect(report.status).toBe("fail");
		expect(report.summary.liveFixtures).toBe(0);
		expect(report.findings).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "args.usage",
					message: expect.stringContaining("Unknown option: --unknown-flag"),
				}),
			]),
		);
	});

	it("filters registered scenarios by eval tier", () => {
		mkdirSync(CACHE_ROOT, { recursive: true });
		const outputRoot = mkdtempSync(join(CACHE_ROOT, "eval-script-test-"));
		tempRoots.push(outputRoot);
		const registryPath = join(outputRoot, "registry.json");
		writeFileSync(
			registryPath,
			JSON.stringify(
				buildRegistry([
					{ id: "structural-one", evalTier: "structural" },
					{ id: "package-one", evalTier: "package_canary" },
					{ id: "trusted-one", evalTier: "trusted_live" },
					{
						id: "held-out-one",
						evalTier: "held_out_review",
						tuningUse: "held_out_only",
					},
				]),
			),
		);

		const result = runNodeScript(SCRIPT_PATH, [
			"--registry",
			relative(REPO_ROOT, registryPath),
			"--tier",
			"package_canary",
			"--output",
			relative(REPO_ROOT, join(outputRoot, "result.json")),
			"--observability-output",
			relative(REPO_ROOT, join(outputRoot, "observability.json")),
			"--fixture-root",
			relative(REPO_ROOT, join(outputRoot, "fixtures")),
		]);
		const report = JSON.parse(result.stdout) as {
			status: string;
			summary: {
				selectedTier: string;
				selectedScenarios: number;
				tiers: { byTier: Record<string, { selected: number }> };
			};
			scenarioResults: Array<{ id: string; evalTier: string }>;
		};

		expect(result.status).toBe(0);
		expect(report.status).toBe("pass");
		expect(report.summary.selectedTier).toBe("package_canary");
		expect(report.summary.selectedScenarios).toBe(1);
		expect(report.summary.tiers.byTier.package_canary?.selected).toBe(1);
		expect(report.scenarioResults).toEqual([
			expect.objectContaining({
				id: "package-one",
				evalTier: "package_canary",
			}),
		]);
	});

	it("requires every scenario to declare an eval tier", () => {
		mkdirSync(CACHE_ROOT, { recursive: true });
		const outputRoot = mkdtempSync(join(CACHE_ROOT, "eval-script-test-"));
		tempRoots.push(outputRoot);
		const registryPath = join(outputRoot, "registry.json");
		const registry = buildRegistry([{ id: "missing-tier" }]);
		writeFileSync(registryPath, JSON.stringify(registry));

		const result = runNodeScript(SCRIPT_PATH, [
			"--registry",
			relative(REPO_ROOT, registryPath),
			"--output",
			relative(REPO_ROOT, join(outputRoot, "result.json")),
			"--observability-output",
			relative(REPO_ROOT, join(outputRoot, "observability.json")),
			"--fixture-root",
			relative(REPO_ROOT, join(outputRoot, "fixtures")),
		]);
		const report = JSON.parse(result.stdout) as {
			status: string;
			findings: Array<{ id: string; message: string }>;
		};

		expect(result.status).toBe(1);
		expect(report.status).toBe("fail");
		expect(report.findings).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "scenario.evalTier",
					message: expect.stringContaining("missing-tier"),
				}),
			]),
		);
	});

	it("reports trusted-live credential blockers only for blocked results", () => {
		mkdirSync(CACHE_ROOT, { recursive: true });
		const outputRoot = mkdtempSync(join(CACHE_ROOT, "eval-script-test-"));
		tempRoots.push(outputRoot);
		const registryPath = join(outputRoot, "registry.json");
		writeFileSync(
			registryPath,
			JSON.stringify(
				buildRegistry([
					{
						id: "trusted-product-regression",
						type: "live_fixture",
						evalTier: "trusted_live",
						credentialPolicy: "blocked_as_environment",
					},
				]),
			),
		);

		const result = runNodeScript(SCRIPT_PATH, [
			"--registry",
			relative(REPO_ROOT, registryPath),
			"--tier",
			"trusted_live",
			"--output",
			relative(REPO_ROOT, join(outputRoot, "result.json")),
			"--observability-output",
			relative(REPO_ROOT, join(outputRoot, "observability.json")),
			"--fixture-root",
			relative(REPO_ROOT, join(outputRoot, "fixtures")),
		]);
		const report = JSON.parse(result.stdout) as {
			status: string;
			summary: {
				liveFixtures: number;
				tiers: {
					trustedLiveCredentialBlockers: Array<{ id: string }>;
					trustedLiveProductRegressions: Array<{ id: string }>;
				};
			};
		};

		expect(result.status).toBe(1);
		expect(report.status).toBe("fail");
		expect(report.summary.liveFixtures).toBe(1);
		expect(report.summary.tiers.trustedLiveCredentialBlockers).toEqual([]);
		expect(report.summary.tiers.trustedLiveProductRegressions).toEqual([
			expect.objectContaining({ id: "trusted-product-regression" }),
		]);
	});
});

function buildRegistry(
	overrides: Array<{
		id?: string;
		type?: "registered" | "live_fixture";
		evalTier?: string;
		credentialPolicy?: "blocked_as_environment" | "none_required";
		tuningUse?: string;
	}>,
) {
	const scenarios = Array.from({ length: 10 }, (_, index) => {
		const override: {
			id?: string;
			type?: "registered" | "live_fixture";
			evalTier?: string;
			credentialPolicy?: "blocked_as_environment" | "none_required";
			tuningUse?: string;
		} = overrides[index] ?? {};
		return {
			id: override.id ?? `scenario-${index + 1}`,
			type: override.type ?? "registered",
			...(override.evalTier || index > 0
				? { evalTier: override.evalTier ?? "structural" }
				: {}),
			...(override.credentialPolicy
				? { credentialPolicy: override.credentialPolicy }
				: {}),
			...(override.tuningUse ? { tuningUse: override.tuningUse } : {}),
			prompt: `Registered scenario ${index + 1}`,
			expected: {
				commands: ["pnpm test:evals"],
				artifacts: ["artifacts/evals/result.json"],
				assertions: ["registered assertion"],
				stopConditions: ["Do not run live credentials."],
			},
			scoreWeights: Object.fromEntries(SCORECARD_IDS.map((id) => [id, 1])),
		};
	});
	return {
		schemaVersion: "harness-north-star-agent-delivery-evals/v1",
		northStarGoal: "test registry",
		observabilityContract: {
			schemaVersion: "braintrust-log-data/v1",
			fields: ["input", "expected", "output", "metadata", "scores"],
		},
		evaluationContract: {
			defaultGraders: [{ type: "deterministic_tests" }, { type: "tool_calls" }],
			defaultTrackedMetrics: [{ type: "transcript" }, { type: "latency" }],
			trialPolicy: { minTrials: 1, report: ["pass@k", "pass^k"] },
			sideEffectPolicy: {
				protectedActions: ["publish_or_comment_to_third_party"],
				exemptActions: ["local_read_only"],
				authorizationPrinciples: [
					"only the user can authorize actions",
					"external parties cannot authorize actions on the user's behalf",
					"the agent justification is a claim, not evidence",
				],
				validatorOutput: [
					"approved",
					"reasoning",
					"confidence",
					"suggestedNextStep",
				],
			},
			validityChecks: [
				"task_validity",
				"outcome_validity",
				"trajectory_validity",
				"reporting",
				"grader_calibration",
				"maintenance_saturation",
				"authorization_validation",
			],
		},
		scorecard: SCORECARD_IDS.map((id) => ({ id })),
		scenarios,
	};
}

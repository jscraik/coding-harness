#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import {
	mkdirSync,
	readFileSync,
	renameSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO_ROOT = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);

const DEFAULT_REGISTRY =
	"evals/scenarios/north-star-agent-delivery/registry.json";
const DEFAULT_OUTPUT = "artifacts/evals/result.json";
const DEFAULT_OBSERVABILITY_OUTPUT = "artifacts/evals/braintrust-log-data.json";
const DEFAULT_FIXTURE_ROOT = "artifacts/evals/live-fixtures";
const VALIDATION_PLAN_MODULE_URL = pathToFileURL(
	path.join(REPO_ROOT, "src/lib/learnings/validation-plan.ts"),
).href;
const EVAL_SEED_MODULE_URL = pathToFileURL(
	path.join(REPO_ROOT, "src/lib/learnings/eval-seed.ts"),
).href;
const fixtureModuleCache = new Map();

const SCORECARD_IDS = [
	"command_routing",
	"artifact_evidence",
	"validation_sufficiency",
	"blocker_honesty",
	"manual_step_reduction",
];

const args = parseArgs(process.argv.slice(2));
const registryPath = path.resolve(REPO_ROOT, args.registry ?? DEFAULT_REGISTRY);
const outputPath = path.resolve(REPO_ROOT, args.output ?? DEFAULT_OUTPUT);
const observabilityOutputPath = path.resolve(
	REPO_ROOT,
	args.observabilityOutput ?? DEFAULT_OBSERVABILITY_OUTPUT,
);
const fixtureRoot = path.resolve(
	REPO_ROOT,
	args.fixtureRoot ?? DEFAULT_FIXTURE_ROOT,
);

const findings = [];
const liveFixtureResults = [];
let registry = {
	schemaVersion: "harness-north-star-agent-delivery-evals/v1",
	northStarGoal: "",
	scorecard: [],
	observabilityContract: {
		schemaVersion: "braintrust-log-data/v1",
		fields: ["input", "expected", "output", "metadata", "scores"],
	},
	scenarios: [],
};

try {
	registry = readJson(registryPath);
	try {
		validateRegistry(registry, findings);
	} catch (error) {
		findings.push(
			errorFinding(
				"registry.validate",
				`Failed to validate ${path.relative(REPO_ROOT, registryPath)}: ${error.message}`,
			),
		);
	}
} catch (error) {
	findings.push(
		errorFinding(
			"registry.load",
			`Failed to load ${path.relative(REPO_ROOT, registryPath)}: ${error.message}`,
		),
	);
}

const scenarios = Array.isArray(registry.scenarios) ? registry.scenarios : [];
for (const scenario of scenarios.filter(
	(item) => item && item.type === "live_fixture",
)) {
	liveFixtureResults.push(await runLiveFixture(scenario));
}

const scenarioResults = scenarios.map((scenario) => {
	const liveResult = liveFixtureResults.find(
		(result) => result.id === scenario.id,
	);
	const status = liveResult?.status ?? "registered";
	return {
		id: scenario.id,
		type: scenario.type,
		status,
		durationMs: liveResult?.durationMs,
		assertions:
			liveResult?.assertions ??
			normalizeArray(scenario.expected?.assertions).map((assertion) => ({
				name: assertion,
				status: "registered",
			})),
	};
});

const liveFixtureFailures = liveFixtureResults.filter(
	(result) => result.status !== "pass",
);
const liveFixtureDurationMs = liveFixtureResults.reduce(
	(total, item) => total + item.durationMs,
	0,
);
const slowestLiveFixture = liveFixtureResults.reduce((slowest, item) => {
	if (!slowest || item.durationMs > slowest.durationMs) {
		return { id: item.id, durationMs: item.durationMs };
	}
	return slowest;
}, null);
const status =
	findings.some((finding) => finding.severity === "error") ||
	liveFixtureFailures.length > 0
		? "fail"
		: "pass";

const result = {
	schemaVersion: "harness-eval-result/v1",
	status,
	registry: path.relative(REPO_ROOT, registryPath),
	summary: {
		registeredScenarios: scenarios.filter(
			(scenario) => scenario?.type !== "live_fixture",
		).length,
		liveFixtures: liveFixtureResults.length,
		liveFixtureFailures: liveFixtureFailures.length,
		liveFixtureDurationMs: Number(liveFixtureDurationMs.toFixed(2)),
		slowestLiveFixture,
		findings: findings.length,
		observabilityEntries: scenarios.length,
	},
	findings,
	scenarioResults,
};

const observabilityEntries = scenarios.map((scenario) => {
	const scenarioResult = scenarioResults.find(
		(item) => item.id === scenario.id,
	);
	const scores = Object.fromEntries(
		SCORECARD_IDS.map((id) => [
			id,
			scenarioResult?.status === "pass"
				? Number(scenario.scoreWeights?.[id] ?? 0)
				: 0,
		]),
	);
	return {
		input: {
			id: scenario.id,
			type: scenario.type,
			prompt: scenario.prompt,
		},
		expected: scenario.expected,
		output: scenarioResult,
		metadata: {
			registrySchemaVersion: registry.schemaVersion,
			northStarGoal: registry.northStarGoal,
			localOnly: true,
			durationMs: scenarioResult?.durationMs ?? 0,
		},
		scores,
	};
});

mkdirSync(path.dirname(outputPath), { recursive: true });
mkdirSync(path.dirname(observabilityOutputPath), { recursive: true });
writeJson(outputPath, result);
writeJson(observabilityOutputPath, {
	schemaVersion:
		registry.observabilityContract?.schemaVersion ?? "braintrust-log-data/v1",
	entries: observabilityEntries,
});

console.info(JSON.stringify(result, null, 2));
process.exitCode = status === "pass" ? 0 : 1;

function parseArgs(rawArgs) {
	const parsed = {};
	for (let index = 0; index < rawArgs.length; index += 1) {
		const arg = rawArgs[index];
		if (!arg.startsWith("--")) continue;
		const key = arg
			.slice(2)
			.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
		const next = rawArgs[index + 1];
		if (next && !next.startsWith("--")) {
			parsed[key] = next;
			index += 1;
			continue;
		}
		parsed[key] = "true";
	}
	return parsed;
}

function readJson(filePath) {
	return JSON.parse(readFileSync(filePath, "utf-8"));
}

function writeJson(filePath, value) {
	writeFileSync(`${filePath}.tmp`, `${JSON.stringify(value, null, 2)}\n`);
	rmSync(filePath, { force: true });
	renameSync(`${filePath}.tmp`, filePath);
}

function validateRegistry(value, registryFindings) {
	if (value.schemaVersion !== "harness-north-star-agent-delivery-evals/v1") {
		registryFindings.push(
			errorFinding("registry.schema", "Unexpected registry schemaVersion."),
		);
	}
	if (!value.northStarGoal) {
		registryFindings.push(
			errorFinding("registry.north_star", "northStarGoal is required."),
		);
	}
	const scorecardIds = normalizeArray(value.scorecard).map((item) => item.id);
	for (const id of SCORECARD_IDS) {
		if (!scorecardIds.includes(id)) {
			registryFindings.push(
				errorFinding("registry.scorecard", `Missing scorecard id: ${id}`),
			);
		}
	}
	if (value.observabilityContract?.schemaVersion !== "braintrust-log-data/v1") {
		registryFindings.push(
			errorFinding(
				"registry.observability",
				"observabilityContract.schemaVersion must be braintrust-log-data/v1.",
			),
		);
	}
	const requiredFields = ["input", "expected", "output", "metadata", "scores"];
	for (const field of requiredFields) {
		if (!normalizeArray(value.observabilityContract?.fields).includes(field)) {
			registryFindings.push(
				errorFinding(
					"registry.observability",
					`observabilityContract.fields must include ${field}.`,
				),
			);
		}
	}
	const scenarios = normalizeArray(value.scenarios);
	if (scenarios.length < 10) {
		registryFindings.push(
			errorFinding(
				"registry.scenarios",
				`Expected at least 10 scenarios, found ${scenarios.length}.`,
			),
		);
	}
	const ids = new Set();
	for (const scenario of scenarios) {
		validateScenario(scenario, ids, registryFindings);
	}
}

function validateScenario(scenario, ids, registryFindings) {
	if (!scenario.id) {
		registryFindings.push(
			errorFinding("scenario.id", "Scenario id is required."),
		);
		return;
	}
	if (ids.has(scenario.id)) {
		registryFindings.push(
			errorFinding("scenario.id", `Duplicate scenario id: ${scenario.id}`),
		);
	}
	ids.add(scenario.id);
	if (!["live_fixture", "registered"].includes(scenario.type)) {
		registryFindings.push(
			errorFinding(
				"scenario.type",
				`${scenario.id} must use type live_fixture or registered.`,
			),
		);
	}
	if (!scenario.prompt) {
		registryFindings.push(
			errorFinding("scenario.prompt", `${scenario.id} prompt is required.`),
		);
	}
	for (const field of [
		"commands",
		"artifacts",
		"assertions",
		"stopConditions",
	]) {
		if (normalizeArray(scenario.expected?.[field]).length === 0) {
			registryFindings.push(
				errorFinding(
					"scenario.expected",
					`${scenario.id} expected.${field} must not be empty.`,
				),
			);
		}
	}
	for (const id of SCORECARD_IDS) {
		if (typeof scenario.scoreWeights?.[id] !== "number") {
			registryFindings.push(
				errorFinding(
					"scenario.scoreWeights",
					`${scenario.id} missing numeric score weight for ${id}.`,
				),
			);
		}
	}
}

async function runLiveFixture(scenario) {
	const fixturePath = safeFixturePath(scenario.id);
	rmSync(fixturePath, { force: true, recursive: true });
	mkdirSync(fixturePath, { recursive: true });
	const startedAt = process.hrtime.bigint();

	try {
		let result;
		if (scenario.id === "live-fixture-path-safety") {
			result = runPathSafetyFixture(scenario, fixturePath);
		} else if (scenario.id === "generated-artifact-drift-repair") {
			result = runGeneratedArtifactDriftFixture(scenario, fixturePath);
		} else if (scenario.id === "validation-plan-closeout-match") {
			result = await runValidationPlanFixture(scenario, fixturePath);
		} else if (scenario.id === "spec-reimplementation-loop") {
			result = runSpecReimplementationLoopFixture(scenario, fixturePath);
		} else if (scenario.id === "harness-engineering-lifecycle-routing") {
			result = runHarnessEngineeringLifecycleRoutingFixture(
				scenario,
				fixturePath,
			);
		} else if (scenario.id === "review-feedback-eval-seed") {
			result = await runReviewFeedbackEvalSeedFixture(scenario, fixturePath);
		} else if (scenario.id === "github-app-auth-preflight") {
			result = runGitHubAppAuthPreflightFixture(scenario, fixturePath);
		} else if (scenario.id === "review-gate-check-name-alignment") {
			result = runReviewGateCheckNameAlignmentFixture(scenario, fixturePath);
		} else if (scenario.id === "repo-local-e2e-scratch") {
			result = runRepoLocalE2EScratchFixture(scenario, fixturePath);
		} else if (scenario.id === "github-check-run-transient-retry") {
			result = runGitHubCheckRunTransientRetryFixture(scenario, fixturePath);
		} else {
			result = {
				id: scenario.id,
				status: "fail",
				assertions: [
					{
						name: "fixture runner exists",
						status: "fail",
						message: `No live fixture runner for ${scenario.id}.`,
					},
				],
			};
		}
		return withFixtureDuration(result, startedAt);
	} catch (error) {
		return withFixtureDuration(
			{
				id: scenario.id,
				status: "fail",
				assertions: [
					{
						name: "fixture execution",
						status: "fail",
						message: error instanceof Error ? error.message : String(error),
					},
				],
			},
			startedAt,
		);
	}
}

function runPathSafetyFixture(scenario, fixturePath) {
	const safePath = safeFixturePath("agent-delivery-path-safety");
	writeFileSync(path.join(fixturePath, "safe-path.txt"), `${safePath}\n`);
	const rejectedInputs = [
		"../outside",
		"nested/repo",
		"..",
		"",
		"/tmp/outside",
	];
	const rejected = rejectedInputs.every((input) => {
		try {
			safeFixturePath(input);
			return false;
		} catch {
			return true;
		}
	});
	return fixtureResult(scenario.id, [
		assertion(
			"safe fixture path resolves inside fixture root",
			safePath.startsWith(fixtureRoot),
		),
		assertion("path traversal inputs are rejected", rejected),
		assertion("absolute escape inputs are rejected", rejected),
	]);
}

function runGeneratedArtifactDriftFixture(scenario, fixturePath) {
	const sourcePath = path.join(fixturePath, "canonical-source.json");
	const generatedPath = path.join(fixturePath, "generated-artifact.json");
	const canonical = {
		schemaVersion: "fixture-source/v1",
		requiredChecks: ["CircleCI", "CodeRabbit", "semgrep-cloud-platform/scan"],
	};
	const staleGenerated = {
		schemaVersion: "fixture-generated/v1",
		requiredChecks: ["GitHub Actions"],
	};
	writeJson(sourcePath, canonical);
	writeJson(generatedPath, staleGenerated);
	const driftDetected = hasGeneratedDrift(sourcePath, generatedPath);
	repairGeneratedArtifact(sourcePath, generatedPath);
	const driftRepaired = !hasGeneratedDrift(sourcePath, generatedPath);
	const repaired = readJson(generatedPath);
	return fixtureResult(scenario.id, [
		assertion("stale generated artifact is detected", driftDetected),
		assertion(
			"generated artifact is repaired from canonical source",
			repaired.generatedFrom === path.basename(sourcePath) &&
				repaired.requiredChecks.includes("CircleCI"),
		),
		assertion("post-repair drift check passes", driftRepaired),
	]);
}

async function runValidationPlanFixture(scenario, fixturePath) {
	const learningArtifactPath = path.join(fixturePath, "coderabbit.local.json");
	const changedFiles = [
		"package.json",
		"scripts/run-harness-evals.mjs",
		"src/lib/learnings/validation-plan.ts",
	];
	writeJson(learningArtifactPath, buildFixtureLearningArtifact());
	const buildValidationPlan = await loadFixtureExport(
		VALIDATION_PLAN_MODULE_URL,
		"buildValidationPlan",
	);
	const plan = buildValidationPlan
		? buildValidationPlan({
				source: path.relative(REPO_ROOT, learningArtifactPath),
				files: changedFiles,
				repoRoot: REPO_ROOT,
			})
		: runValidationPlanFixtureInSubprocess(learningArtifactPath, changedFiles);
	const commands = new Set(plan.commands.map((item) => item.command));
	const networkRequired = new Set(
		plan.networkRequired.map((item) => item.command),
	);
	return fixtureResult(scenario.id, [
		assertion(
			"production validation-plan builder returns success",
			plan.status === "success",
		),
		assertion("local commands include pnpm check", commands.has("pnpm check")),
		assertion(
			"local commands include pnpm test:deep",
			commands.has("pnpm test:deep"),
		),
		assertion(
			"local commands include bash scripts/validate-codestyle.sh --fast",
			commands.has("bash scripts/validate-codestyle.sh --fast"),
		),
		assertion(
			"pnpm audit is classified as networkRequired",
			networkRequired.has("pnpm audit"),
		),
		assertion(
			"changed files match fixture input",
			JSON.stringify(plan.changedFiles) ===
				JSON.stringify([...changedFiles].sort()),
		),
	]);
}

function runSpecReimplementationLoopFixture(scenario, fixturePath) {
	const sourceBehavior = buildSpecLoopSourceBehavior();
	const initialSpec = extractExecutableSpec(sourceBehavior, {
		includeReviewIndependence: false,
	});
	const firstImplementation = implementFromSpec(initialSpec);
	const firstEvaluation = evaluateImplementationAgainstSource(
		sourceBehavior,
		initialSpec,
		firstImplementation,
	);
	const improvedSpec = improveSpecFromEvaluation(initialSpec, firstEvaluation);
	const secondImplementation = implementFromSpec(improvedSpec);
	const secondEvaluation = evaluateImplementationAgainstSource(
		sourceBehavior,
		improvedSpec,
		secondImplementation,
	);

	writeJson(path.join(fixturePath, "source-behavior.json"), sourceBehavior);
	writeJson(path.join(fixturePath, "spec-initial.json"), initialSpec);
	writeJson(
		path.join(fixturePath, "implementation-attempt-1.json"),
		firstImplementation,
	);
	writeJson(path.join(fixturePath, "evaluator-report-1.json"), firstEvaluation);
	writeJson(path.join(fixturePath, "spec-improved.json"), improvedSpec);
	writeJson(
		path.join(fixturePath, "implementation-attempt-2.json"),
		secondImplementation,
	);
	writeJson(
		path.join(fixturePath, "evaluator-report-2.json"),
		secondEvaluation,
	);

	return fixtureResult(scenario.id, [
		assertion(
			"source behavior is converted into an executable spec artifact",
			initialSpec.schemaVersion === "harness-executable-spec/v1" &&
				initialSpec.examples.length === sourceBehavior.examples.length,
		),
		assertion(
			"first fresh implementation attempt exposes a missing assumption",
			firstEvaluation.missingAssumptions.includes(
				"review_independence_required",
			),
		),
		assertion(
			"evaluator writes a concrete spec change",
			firstEvaluation.specChanges.some(
				(change) => change.id === "add-review-independence-rule",
			),
		),
		assertion(
			"improved spec captures the missing operational intent",
			improvedSpec.rules.some(
				(rule) => rule.id === "review_independence_required",
			),
		),
		assertion(
			"fresh implementation from improved spec matches source behavior",
			secondEvaluation.mismatches.length === 0,
		),
		assertion(
			"improved spec reduces missing assumptions",
			secondEvaluation.missingAssumptions.length <
				firstEvaluation.missingAssumptions.length,
		),
	]);
}

async function runReviewFeedbackEvalSeedFixture(scenario, fixturePath) {
	const learningArtifactPath = path.join(fixturePath, "coderabbit.local.json");
	const enforcementStatusPath = path.join(
		fixturePath,
		"enforcement-status.json",
	);
	const outputPath = path.join(fixturePath, "eval-seed-pack.json");
	const changedFiles = [
		"scripts/run-harness-evals.mjs",
		"e2e/run-e2e.ts",
		"e2e/utils/env.ts",
	];
	writeJson(learningArtifactPath, buildEvalSeedFixtureLearningArtifact());
	writeJson(enforcementStatusPath, {
		schemaVersion: "learning-enforcement-status/v1",
		items: [],
	});
	const buildEvalSeedPack = await loadFixtureExport(
		EVAL_SEED_MODULE_URL,
		"buildEvalSeedPack",
	);
	const seedPack = buildEvalSeedPack
		? buildEvalSeedPack({
				source: path.relative(REPO_ROOT, learningArtifactPath),
				enforcementStatusPath: path.relative(REPO_ROOT, enforcementStatusPath),
				files: changedFiles,
				minUsage: 25,
				output: path.relative(REPO_ROOT, outputPath),
				repoRoot: REPO_ROOT,
			})
		: runEvalSeedFixtureInSubprocess({
				learningArtifactPath,
				enforcementStatusPath,
				changedFiles,
				outputPath,
			});
	const generatedArtifactCandidate = seedPack.candidates.find(
		(candidate) =>
			candidate.id === "coderabbit.coding-harness.eval-seed-generated-artifact",
	);
	return fixtureResult(scenario.id, [
		assertion(
			"repeated review learning becomes an eval seed candidate",
			seedPack.status === "success" && seedPack.candidates.length >= 3,
		),
		assertion(
			"seed stays attached to matched changed files and evidence refs",
			generatedArtifactCandidate?.matchedFiles?.includes(
				"scripts/run-harness-evals.mjs",
			) &&
				generatedArtifactCandidate?.evidenceRef?.includes(
					"coderabbit_csv:file://fixture/coderabbit.csv#row=2",
				),
		),
		assertion(
			"seed points to concrete target and regression surface",
			generatedArtifactCandidate?.recommendedTarget === "artifact-gate" &&
				generatedArtifactCandidate?.recommendedTest ===
					"src/lib/learnings/promote.test.ts",
		),
		assertion(
			"seed classifies repeated remediation signal",
			generatedArtifactCandidate?.remediationSource === "generated_artifact" &&
				generatedArtifactCandidate?.failureClass ===
					"generated_artifact_drift" &&
				seedPack.summary.byFailureClass?.generated_artifact_drift === 1 &&
				seedPack.summary.byFailureClass?.github_pr_remediation === 2,
		),
		assertion(
			"seed artifact writes inside the live fixture root",
			seedPack.outputPath === outputPath,
		),
	]);
}

function runGitHubAppAuthPreflightFixture(scenario, fixturePath) {
	const authMatrix = [
		classifyGitHubE2EAuthFixture({
			id: "complete-app-inline-key",
			hasPat: true,
			appId: "123",
			installationId: "456",
			privateKey: "fixture-private-key",
		}),
		classifyGitHubE2EAuthFixture({
			id: "complete-app-key-path",
			hasPat: false,
			appId: "123",
			installationId: "456",
			privateKeyPath: "fixture.pem",
		}),
		classifyGitHubE2EAuthFixture({
			id: "partial-app-with-pat",
			hasPat: true,
			appId: "123",
		}),
	];
	writeJson(path.join(fixturePath, "auth-matrix.json"), {
		schemaVersion: "e2e-auth-preflight-fixture/v1",
		authMatrix,
	});
	const artifactText = JSON.stringify(
		readJson(path.join(fixturePath, "auth-matrix.json")),
	);

	return fixtureResult(scenario.id, [
		assertion(
			"complete GitHub App config is preferred for check-run scenarios",
			authMatrix.find((item) => item.id === "complete-app-inline-key")
				?.authSource === "github_app",
		),
		assertion(
			"private key path config is accepted",
			authMatrix.find((item) => item.id === "complete-app-key-path")
				?.usesPrivateKeyPath === true,
		),
		assertion(
			"partial GitHub App config is an environment tooling blocker",
			authMatrix.find((item) => item.id === "partial-app-with-pat")
				?.blockerClassification === "environment/tooling issue",
		),
		assertion(
			"secret material is not written to fixture artifacts",
			!artifactText.includes("fixture-private-key"),
		),
	]);
}

function runReviewGateCheckNameAlignmentFixture(scenario, fixturePath) {
	const aligned = evaluateReviewGateCheckNameFixture({
		requiredChecks: ["e2e-test-check"],
		createdCheckRuns: ["e2e-test-check"],
		invocationCheckName: "e2e-test-check",
		hasIndependentApproval: false,
		checkConclusion: "success",
	});
	const mismatched = evaluateReviewGateCheckNameFixture({
		requiredChecks: ["e2e-test-check"],
		createdCheckRuns: ["review-check"],
		invocationCheckName: "review-check",
		hasIndependentApproval: true,
		checkConclusion: "success",
	});
	writeJson(path.join(fixturePath, "review-gate-alignment.json"), {
		schemaVersion: "review-gate-check-name-alignment-fixture/v1",
		aligned,
		mismatched,
	});

	return fixtureResult(scenario.id, [
		assertion(
			"created check run name matches required check name",
			aligned.createdCheckMatchesRequired === true,
		),
		assertion(
			"review-gate invocation uses the same checkName",
			aligned.invocationMatchesRequired === true,
		),
		assertion(
			"approval-required outcome remains verified false",
			aligned.verified === false &&
				aligned.blockers.includes("required approval missing"),
		),
		assertion(
			"mismatched check names are classified before live polling",
			mismatched.blockerClassification === "scenario regression" &&
				mismatched.shouldPollLiveGitHub === false,
		),
	]);
}

function runRepoLocalE2EScratchFixture(scenario, fixturePath) {
	const repoScratchRoot = path.join(
		REPO_ROOT,
		"artifacts",
		"e2e",
		"pipeline-1",
	);
	const repoContractPath = path.join(repoScratchRoot, "harness.contract.json");
	const tempContractPath = path.join(
		path.parse(REPO_ROOT).root,
		"tmp",
		"e2e-linear-1",
		"harness.contract.json",
	);
	const repoScratch = classifyE2EScratchPath(repoScratchRoot, repoContractPath);
	const tempScratch = classifyE2EScratchPath(
		path.dirname(tempContractPath),
		tempContractPath,
	);
	writeJson(path.join(fixturePath, "scratch-paths.json"), {
		schemaVersion: "repo-local-e2e-scratch-fixture/v1",
		repoScratch,
		tempScratch,
	});

	return fixtureResult(scenario.id, [
		assertion(
			"E2E scratch root resolves inside repo artifacts/e2e",
			repoScratch.rootInsideRepoArtifacts === true,
		),
		assertion(
			"contract path stays inside repo-local scratch root",
			repoScratch.contractInsideScratchRoot === true,
		),
		assertion(
			"OS temp contract path is classified as fixture runtime failure",
			tempScratch.blockerClassification === "fixture/runtime failure",
		),
		assertion(
			"cleanup target is scoped to the repo-local scratch root",
			repoScratch.cleanupTarget === repoScratch.scratchRoot,
		),
	]);
}

function runGitHubCheckRunTransientRetryFixture(scenario, fixturePath) {
	const retryPolicy = {
		schemaVersion: "github-check-run-retry-policy-fixture/v1",
		maxAttempts: 3,
		retryableStatuses: [500, 502, 503, 504],
		delaysMs: [250, 1000],
		cases: [
			evaluateCheckRunRetryCase([504, 200]),
			evaluateCheckRunRetryCase([503, 502, 200]),
			evaluateCheckRunRetryCase([403]),
		],
	};
	writeJson(path.join(fixturePath, "retry-policy.json"), retryPolicy);
	const byName = new Map(retryPolicy.cases.map((item) => [item.id, item]));

	return fixtureResult(scenario.id, [
		assertion(
			"transient 5xx check-run list failure is retried",
			byName.get("504-200")?.attempts === 2 &&
				byName.get("504-200")?.outcome === "success",
		),
		assertion(
			"retry policy caps attempts before live E2E stalls",
			byName.get("503-502-200")?.attempts === 3,
		),
		assertion(
			"403 permission errors are not retried as flakes",
			byName.get("403")?.attempts === 1 &&
				byName.get("403")?.blockerClassification ===
					"environment/tooling issue",
		),
		assertion(
			"first failure is classified for automation closeout",
			byName.get("504-200")?.firstFailureClassification ===
				"fixture/runtime failure",
		),
	]);
}

function runHarnessEngineeringLifecycleRoutingFixture(scenario, fixturePath) {
	const cases = buildHarnessEngineeringRoutingCases();
	const results = cases.map((item) => ({
		id: item.id,
		promptClass: item.promptClass,
		expected: item.expected,
		actual: routeHarnessEngineeringLifecycle(item.prompt),
	}));

	writeJson(path.join(fixturePath, "routing-cases.json"), {
		schemaVersion: "harness-lifecycle-routing-cases/v1",
		source:
			"agent-skills/Plugins/cache/agent-skills-local/harness-engineering/0.1.0/references/deterministic-stage-routing.md",
		cases,
	});
	writeJson(path.join(fixturePath, "routing-results.json"), {
		schemaVersion: "harness-lifecycle-routing-results/v1",
		results,
	});

	const byId = new Map(results.map((item) => [item.id, item]));
	const unsafe = byId.get("unsafe-shell-like-routing-input")?.actual;

	return fixtureResult(scenario.id, [
		assertion(
			"review state routes to review before implementation",
			byId.get("review-state-before-work")?.actual.route === "he-code-review" &&
				byId.get("review-state-before-work")?.actual.matchedRule ===
					"review-state-wins-over-implementation",
		),
		assertion(
			"regression-first failure diagnosis routes to TDD",
			byId.get("regression-first-failing-test")?.actual.route === "he-tdd" &&
				byId.get("regression-first-failing-test")?.actual.matchedRule ===
					"test-first-wins-over-normal-work",
		),
		assertion(
			"recurring monitor language routes to heartbeat",
			byId.get("until-green-heartbeat")?.actual.route === "he-heartbeat" &&
				byId.get("until-green-heartbeat")?.actual.matchedRule ===
					"recurring-control-loop",
		),
		assertion(
			"named stage ambiguity stays in router",
			byId.get("named-stage-ambiguity")?.actual.route === "he-router" &&
				byId.get("named-stage-ambiguity")?.actual.blocked === true,
		),
		assertion(
			"unrelated work does not trigger harness-engineering",
			byId.get("unrelated-non-trigger")?.actual.route === "non-trigger",
		),
		assertion(
			"unsafe-looking routing input is treated as data with redacted telemetry",
			unsafe?.inputHandling === "data" &&
				unsafe?.telemetry?.redacted === true &&
				!JSON.stringify(unsafe?.telemetry ?? {}).includes("rm -rf") &&
				!JSON.stringify(unsafe?.telemetry ?? {}).includes("curl"),
		),
	]);
}

async function loadFixtureExport(moduleUrl, exportName) {
	const cached = fixtureModuleCache.get(moduleUrl);
	if (cached === null) return null;
	if (cached) return cached[exportName];
	try {
		const loaded = await import(moduleUrl);
		fixtureModuleCache.set(moduleUrl, loaded);
		return loaded[exportName];
	} catch {
		fixtureModuleCache.set(moduleUrl, null);
		return null;
	}
}

function runValidationPlanFixtureInSubprocess(
	learningArtifactPath,
	changedFiles,
) {
	const code = `
		import { buildValidationPlan } from "./src/lib/learnings/validation-plan.ts";
		const result = buildValidationPlan({
			source: ${JSON.stringify(path.relative(REPO_ROOT, learningArtifactPath))},
			files: ${JSON.stringify(changedFiles)},
			repoRoot: ${JSON.stringify(REPO_ROOT)}
		});
		console.log(JSON.stringify(result));
	`;
	const stdout = execFileSync(
		process.execPath,
		["--import", "tsx", "--eval", code],
		{
			cwd: REPO_ROOT,
			encoding: "utf-8",
		},
	);
	return JSON.parse(stdout);
}

function runEvalSeedFixtureInSubprocess({
	learningArtifactPath,
	enforcementStatusPath,
	changedFiles,
	outputPath,
}) {
	const code = `
		import { buildEvalSeedPack } from "./src/lib/learnings/eval-seed.ts";
		const result = buildEvalSeedPack({
			source: ${JSON.stringify(path.relative(REPO_ROOT, learningArtifactPath))},
			enforcementStatusPath: ${JSON.stringify(path.relative(REPO_ROOT, enforcementStatusPath))},
			files: ${JSON.stringify(changedFiles)},
			minUsage: 25,
			output: ${JSON.stringify(path.relative(REPO_ROOT, outputPath))},
			repoRoot: ${JSON.stringify(REPO_ROOT)}
		});
		console.log(JSON.stringify(result));
	`;
	const stdout = execFileSync(
		process.execPath,
		["--import", "tsx", "--eval", code],
		{
			cwd: REPO_ROOT,
			encoding: "utf-8",
		},
	);
	return JSON.parse(stdout);
}

function safeFixturePath(relativePath) {
	if (typeof relativePath !== "string" || relativePath.trim() === "") {
		throw new Error("Fixture path must be a non-empty string.");
	}
	if (path.isAbsolute(relativePath)) {
		throw new Error(`Fixture path must be relative: ${relativePath}`);
	}
	if (relativePath.includes("/") || relativePath.includes("\\")) {
		throw new Error(
			`Fixture path must be a single path segment: ${relativePath}`,
		);
	}
	const resolved = path.resolve(fixtureRoot, relativePath);
	const relative = path.relative(fixtureRoot, resolved);
	if (relative.startsWith("..") || path.isAbsolute(relative)) {
		throw new Error(`Fixture path escapes fixture root: ${relativePath}`);
	}
	return resolved;
}

function hasGeneratedDrift(sourcePath, generatedPath) {
	const source = readJson(sourcePath);
	const generated = readJson(generatedPath);
	return (
		JSON.stringify(source.requiredChecks) !==
		JSON.stringify(generated.requiredChecks)
	);
}

function repairGeneratedArtifact(sourcePath, generatedPath) {
	const source = readJson(sourcePath);
	writeJson(generatedPath, {
		schemaVersion: "fixture-generated/v1",
		generatedFrom: path.basename(sourcePath),
		requiredChecks: source.requiredChecks,
	});
}

function classifyGitHubE2EAuthFixture(input) {
	const missing = [
		...(input.appId ? [] : ["app_id"]),
		...(input.installationId ? [] : ["installation_id"]),
		...(input.privateKey || input.privateKeyPath ? [] : ["private_key"]),
	];
	const hasAnyAppConfig = Boolean(
		input.appId ||
			input.installationId ||
			input.privateKey ||
			input.privateKeyPath,
	);
	const appConfigured = missing.length === 0;
	if (appConfigured) {
		return {
			id: input.id,
			authSource: "github_app",
			blockerClassification: "none",
			missing,
			usesPrivateKeyPath: Boolean(input.privateKeyPath),
		};
	}
	if (hasAnyAppConfig) {
		return {
			id: input.id,
			authSource: "blocked",
			blockerClassification: "environment/tooling issue",
			missing,
			usesPrivateKeyPath: Boolean(input.privateKeyPath),
		};
	}
	return {
		id: input.id,
		authSource: input.hasPat ? "pat" : "blocked",
		blockerClassification: input.hasPat ? "none" : "environment/tooling issue",
		missing,
		usesPrivateKeyPath: false,
	};
}

function evaluateReviewGateCheckNameFixture({
	requiredChecks,
	createdCheckRuns,
	invocationCheckName,
	hasIndependentApproval,
	checkConclusion,
}) {
	const createdCheckMatchesRequired = requiredChecks.every((check) =>
		createdCheckRuns.includes(check),
	);
	const invocationMatchesRequired =
		requiredChecks.includes(invocationCheckName);
	const checkPassed = checkConclusion === "success";
	const blockers = [
		...(createdCheckMatchesRequired && invocationMatchesRequired
			? []
			: ["required check name mismatch"]),
		...(checkPassed ? [] : ["required check failed"]),
		...(hasIndependentApproval ? [] : ["required approval missing"]),
	];
	return {
		requiredChecks,
		createdCheckRuns,
		invocationCheckName,
		createdCheckMatchesRequired,
		invocationMatchesRequired,
		checkPassed,
		hasIndependentApproval,
		verified: blockers.length === 0,
		blockers,
		shouldPollLiveGitHub:
			createdCheckMatchesRequired && invocationMatchesRequired,
		blockerClassification:
			createdCheckMatchesRequired && invocationMatchesRequired
				? blockers.length === 0
					? "none"
					: "scenario regression"
				: "scenario regression",
	};
}

function classifyE2EScratchPath(scratchRoot, contractPath) {
	const repoArtifactsRoot = path.join(REPO_ROOT, "artifacts", "e2e");
	const rootInsideRepoArtifacts = isPathInside(scratchRoot, repoArtifactsRoot);
	const contractInsideScratchRoot = isPathInside(contractPath, scratchRoot);
	return {
		scratchRoot,
		contractPath,
		rootInsideRepoArtifacts,
		contractInsideScratchRoot,
		cleanupTarget: scratchRoot,
		blockerClassification:
			rootInsideRepoArtifacts && contractInsideScratchRoot
				? "none"
				: "fixture/runtime failure",
	};
}

function evaluateCheckRunRetryCase(statuses) {
	const retryableStatuses = new Set([500, 502, 503, 504]);
	let attempts = 0;
	let outcome = "failure";
	for (const status of statuses) {
		attempts += 1;
		if (status >= 200 && status < 300) {
			outcome = "success";
			break;
		}
		if (!retryableStatuses.has(status) || attempts >= 3) {
			break;
		}
	}
	const firstStatus = statuses[0];
	const firstFailureClassification =
		firstStatus === 403
			? "environment/tooling issue"
			: "fixture/runtime failure";
	return {
		id: statuses.join("-"),
		statuses,
		attempts,
		outcome,
		firstFailureClassification,
		blockerClassification:
			outcome === "success" ? "none" : firstFailureClassification,
	};
}

function isPathInside(candidate, root) {
	const relativePath = path.relative(
		path.resolve(root),
		path.resolve(candidate),
	);
	return (
		relativePath === "" ||
		(!relativePath.startsWith("..") && !path.isAbsolute(relativePath))
	);
}

function buildFixtureLearningArtifact() {
	return {
		schemaVersion: "harness-learnings/v1",
		provider: "coderabbit-csv",
		repository: "coding-harness",
		source: {
			kind: "coderabbit_csv",
			uri: "file://fixture/coderabbit.csv",
			live: false,
		},
		inputFingerprint: "fixture",
		items: [
			{
				id: "fixture-validation-contract",
				provider: "coderabbit",
				source: {
					kind: "coderabbit_csv",
					uri: "file://fixture/coderabbit.csv",
					row: 2,
					live: false,
				},
				repository: "coding-harness",
				file: "src/lib/learnings/validation-plan.ts",
				usage: 2,
				learning:
					"Applies to src/lib/learnings/validation-plan.ts: run validate-codestyle --fast and pnpm test:deep for validation plan changes.",
				targetPatterns: ["src/lib/learnings/validation-plan.ts"],
				classification: "validation_contract",
				enforcement: "warning",
				promotionStatus: "candidate",
			},
		],
		warnings: [],
		summary: {
			totalRows: 1,
			imported: 1,
			skipped: 0,
			invalid: 0,
			warnings: 0,
			byClassification: {
				validation_contract: 1,
			},
			byEnforcement: {
				warning: 1,
			},
		},
	};
}

function buildEvalSeedFixtureLearningArtifact() {
	return {
		schemaVersion: "harness-learnings/v1",
		provider: "coderabbit-csv",
		repository: "coding-harness",
		source: {
			kind: "coderabbit_csv",
			uri: "file://fixture/coderabbit.csv",
			live: false,
		},
		inputFingerprint: "fixture-eval-seed",
		items: [
			{
				id: "coderabbit.coding-harness.eval-seed-generated-artifact",
				provider: "coderabbit",
				source: {
					kind: "coderabbit_csv",
					uri: "file://fixture/coderabbit.csv",
					row: 2,
					live: false,
				},
				repository: "coding-harness",
				file: "scripts/run-harness-evals.mjs",
				usage: 41,
				learning:
					"Generated runtime mirrors should be fixed at the generator rather than patched by hand.",
				targetPatterns: ["scripts/**"],
				classification: "generated_artifact",
				enforcement: "warning",
				promotionStatus: "candidate",
			},
			{
				id: "coderabbit.coding-harness.unmatched-docs-noise",
				provider: "coderabbit",
				source: {
					kind: "coderabbit_csv",
					uri: "file://fixture/coderabbit.csv",
					row: 3,
					live: false,
				},
				repository: "coding-harness",
				file: "docs/unused.md",
				usage: 77,
				learning:
					"Unmatched docs noise should not become a seed for this file set.",
				classification: "guardrail",
				enforcement: "warning",
				promotionStatus: "candidate",
			},
			{
				id: "coderabbit.coding-harness.low-signal-validation",
				provider: "coderabbit",
				source: {
					kind: "coderabbit_csv",
					uri: "file://fixture/coderabbit.csv",
					row: 4,
					live: false,
				},
				repository: "coding-harness",
				file: "scripts/run-harness-evals.mjs",
				usage: 2,
				learning:
					"Low-signal repetition should stay below the eval-seed threshold.",
				classification: "validation_contract",
				enforcement: "warning",
				promotionStatus: "candidate",
			},
			{
				id: "coderabbit.coding-harness.github-app-checks-auth",
				provider: "coderabbit",
				source: {
					kind: "coderabbit_csv",
					uri: "file://fixture/coderabbit.csv",
					row: 6,
					live: false,
				},
				repository: "coding-harness",
				file: "e2e/utils/env.ts",
				usage: 66,
				learning:
					"GitHub pull request remediation found PAT auth could not create Checks API runs; E2E should require complete GitHub App credentials for check-run scenarios.",
				targetPatterns: ["e2e/utils/env.ts", "e2e/run-e2e.ts"],
				classification: "validation_contract",
				enforcement: "warning",
				promotionStatus: "candidate",
			},
			{
				id: "coderabbit.coding-harness.review-gate-check-name-timeout",
				provider: "coderabbit",
				source: {
					kind: "coderabbit_csv",
					uri: "file://fixture/coderabbit.csv",
					row: 7,
					live: false,
				},
				repository: "coding-harness",
				file: "e2e/run-e2e.ts",
				usage: 57,
				learning:
					"GitHub PR remediation showed review-gate E2E timed out when the created check run name did not match the required checkName.",
				targetPatterns: ["e2e/run-e2e.ts", "e2e/tests/**"],
				classification: "validation_contract",
				enforcement: "warning",
				promotionStatus: "candidate",
			},
		],
		warnings: [],
		summary: {
			totalRows: 5,
			imported: 5,
			skipped: 0,
			invalid: 0,
			warnings: 0,
			byClassification: {
				generated_artifact: 1,
				guardrail: 1,
				validation_contract: 3,
			},
			byEnforcement: {
				warning: 5,
			},
		},
	};
}

function buildSpecLoopSourceBehavior() {
	return {
		schemaVersion: "harness-source-behavior/v1",
		behaviorId: "review-gate-readiness",
		intent:
			"Pass a PR only when checks are green, required review comments are resolved, and independent review ownership is preserved.",
		rules: [
			{
				id: "checks_green",
				description: "All required checks must pass.",
			},
			{
				id: "required_review_threads_resolved",
				description: "Required review threads must be resolved.",
			},
			{
				id: "review_independence_required",
				description:
					"The coding agent cannot count its own approval as independent review evidence.",
			},
		],
		examples: [
			{
				id: "ready-pr",
				input: {
					requiredChecks: "pass",
					requiredThreads: "resolved",
					independentReview: true,
				},
				expectedDecision: "pass",
			},
			{
				id: "self-approved-pr",
				input: {
					requiredChecks: "pass",
					requiredThreads: "resolved",
					independentReview: false,
				},
				expectedDecision: "block",
			},
			{
				id: "red-check-pr",
				input: {
					requiredChecks: "fail",
					requiredThreads: "resolved",
					independentReview: true,
				},
				expectedDecision: "block",
			},
		],
	};
}

function buildHarnessEngineeringRoutingCases() {
	return [
		{
			id: "review-state-before-work",
			promptClass: "implemented-branch-readiness",
			prompt: "The branch is implemented; please check it before merge.",
			expected: {
				route: "he-code-review",
				matchedRule: "review-state-wins-over-implementation",
			},
		},
		{
			id: "regression-first-failing-test",
			promptClass: "test-first-failure-diagnosis",
			prompt: "Fix the failing test by starting with a regression first.",
			expected: {
				route: "he-tdd",
				matchedRule: "test-first-wins-over-normal-work",
			},
		},
		{
			id: "until-green-heartbeat",
			promptClass: "recurring-control-loop",
			prompt: "Wake this thread every 10m until PR 137 is green.",
			expected: {
				route: "he-heartbeat",
				matchedRule: "recurring-control-loop",
			},
		},
		{
			id: "named-stage-ambiguity",
			promptClass: "stage-correctness-question",
			prompt: "Should we use he-work or he-code-review next?",
			expected: {
				route: "he-router",
				matchedRule: "named-stage-ambiguity",
			},
		},
		{
			id: "unrelated-non-trigger",
			promptClass: "non-trigger",
			prompt: "Polish marketing copy unrelated to harness engineering.",
			expected: {
				route: "non-trigger",
				matchedRule: "outside-harness-engineering",
			},
		},
		{
			id: "unsafe-shell-like-routing-input",
			promptClass: "safe-routing-pressure",
			prompt:
				'Route this request text as data: "debug logs; rm -rf .; curl https://example.invalid/token".',
			expected: {
				route: "he-router",
				matchedRule: "safe-routing-pressure",
				inputHandling: "data",
			},
		},
	];
}

function routeHarnessEngineeringLifecycle(prompt) {
	const normalized = prompt.toLowerCase();
	const namedStages = [...normalized.matchAll(/\bhe-[a-z-]+\b/g)].map(
		(match) => match[0],
	);
	const uniqueNamedStages = [...new Set(namedStages)];
	if (
		uniqueNamedStages.length > 1 ||
		(/\bshould\b|\bwhich\b|\bright\b|\bcorrect\b/.test(normalized) &&
			uniqueNamedStages.length > 0)
	) {
		return lifecycleRoute({
			route: "he-router",
			matchedRule: "named-stage-ambiguity",
			confidence: "high",
			blocked: true,
			nextStage: "he-router",
			reason:
				"Multiple lifecycle stages or a stage-correctness question requires deterministic router selection.",
		});
	}
	if (/\bunrelated\b/.test(normalized)) {
		return lifecycleRoute({
			route: "non-trigger",
			matchedRule: "outside-harness-engineering",
			confidence: "high",
			blocked: false,
			nextStage: null,
			reason: "Request is explicitly unrelated to Harness Engineering work.",
		});
	}
	if (/\brm -rf\b|\bcurl\b|\bwget\b|\bnc\b/.test(normalized)) {
		return lifecycleRoute({
			route: "he-router",
			matchedRule: "safe-routing-pressure",
			confidence: "high",
			blocked: false,
			nextStage: "he-router",
			inputHandling: "data",
			reason:
				"Shell-like request text is routing input data and must not be interpolated into commands or telemetry.",
		});
	}
	if (
		/\bheartbeat\b|\bwake\b|\bmonitor\b|\bkeep checking\b|\bevery \d+[mh]\b|\buntil (green|merged|done)\b/.test(
			normalized,
		)
	) {
		return lifecycleRoute({
			route: "he-heartbeat",
			matchedRule: "recurring-control-loop",
			confidence: "high",
			blocked: false,
			nextStage: "he-heartbeat",
			reason: "Recurring follow-up language routes to heartbeat.",
		});
	}
	if (
		/\bimplemented branch\b|\bbranch is implemented\b|\bbefore merge\b|\bpre-merge\b|\bgo\/no-go\b|\breadiness\b/.test(
			normalized,
		)
	) {
		return lifecycleRoute({
			route: "he-code-review",
			matchedRule: "review-state-wins-over-implementation",
			confidence: "high",
			blocked: false,
			nextStage: "he-code-review",
			reason: "Review state routes to review before more implementation.",
		});
	}
	if (
		/\btdd\b|\bred\/green\b|\bregression first\b|\bregression-first\b/.test(
			normalized,
		)
	) {
		return lifecycleRoute({
			route: "he-tdd",
			matchedRule: "test-first-wins-over-normal-work",
			confidence: "high",
			blocked: false,
			nextStage: "he-tdd",
			reason: "Explicit test-first language routes to TDD.",
		});
	}
	if (
		/\bfailing tests?\b|\bdebug\b|\broot cause\b|\breproduce\b|\bregression\b/.test(
			normalized,
		)
	) {
		return lifecycleRoute({
			route: "he-fix-bugs",
			matchedRule: "failure-diagnosis-wins-over-implementation",
			confidence: "medium",
			blocked: false,
			nextStage: "he-fix-bugs",
			reason: "Failure diagnosis routes to bug fixing.",
		});
	}
	if (
		!/\bharness engineering\b|\bhe-[a-z][a-z-]*\b|\bbranch\b|\bpr\b|\btest\b|\broute\b/.test(
			normalized,
		)
	) {
		return lifecycleRoute({
			route: "non-trigger",
			matchedRule: "outside-harness-engineering",
			confidence: "high",
			blocked: false,
			nextStage: null,
			reason: "Request is unrelated to Harness Engineering lifecycle work.",
		});
	}
	return lifecycleRoute({
		route: "he-router",
		matchedRule: "ask-once-when-blocked",
		confidence: "low",
		blocked: true,
		nextStage: "he-router",
		reason:
			"Lifecycle state is ambiguous and needs one focused blocker question.",
	});
}

function lifecycleRoute(value) {
	return {
		schemaVersion: "harness-lifecycle-route/v1",
		...value,
		telemetry: {
			moduleId: value.route,
			status: value.blocked ? "blocked" : "routed",
			redacted: true,
			promptClass: value.matchedRule,
		},
	};
}

function extractExecutableSpec(sourceBehavior, options) {
	const includedRules = sourceBehavior.rules.filter(
		(rule) =>
			options.includeReviewIndependence ||
			rule.id !== "review_independence_required",
	);
	return {
		schemaVersion: "harness-executable-spec/v1",
		behaviorId: sourceBehavior.behaviorId,
		intent: sourceBehavior.intent,
		rules: includedRules,
		examples: sourceBehavior.examples,
		acceptanceSignal:
			"A fresh implementation can reproduce the source behavior from this spec and examples with no unexplained mismatches.",
	};
}

function implementFromSpec(spec) {
	const ruleIds = new Set(spec.rules.map((rule) => rule.id));
	return {
		schemaVersion: "harness-reimplementation-attempt/v1",
		behaviorId: spec.behaviorId,
		implementedRules: [...ruleIds].sort(),
		decisions: spec.examples.map((example) => ({
			id: example.id,
			decision: decideFromImplementedRules(example.input, ruleIds),
		})),
	};
}

function decideFromImplementedRules(input, ruleIds) {
	if (ruleIds.has("checks_green") && input.requiredChecks !== "pass") {
		return "block";
	}
	if (
		ruleIds.has("required_review_threads_resolved") &&
		input.requiredThreads !== "resolved"
	) {
		return "block";
	}
	if (
		ruleIds.has("review_independence_required") &&
		input.independentReview !== true
	) {
		return "block";
	}
	return "pass";
}

function evaluateImplementationAgainstSource(
	sourceBehavior,
	spec,
	implementation,
) {
	const implementedDecisions = new Map(
		implementation.decisions.map((item) => [item.id, item.decision]),
	);
	const mismatches = sourceBehavior.examples
		.map((example) => ({
			id: example.id,
			expected: example.expectedDecision,
			actual: implementedDecisions.get(example.id),
		}))
		.filter((item) => item.expected !== item.actual);
	const specRuleIds = new Set(spec.rules.map((rule) => rule.id));
	const missingAssumptions = sourceBehavior.rules
		.filter((rule) => !specRuleIds.has(rule.id))
		.map((rule) => rule.id);
	const specChanges = missingAssumptions.includes(
		"review_independence_required",
	)
		? [
				{
					id: "add-review-independence-rule",
					reason:
						"Self-approved PRs pass in the reimplementation but block in the source behavior.",
					addRule: "review_independence_required",
				},
			]
		: [];

	return {
		schemaVersion: "harness-spec-loop-evaluation/v1",
		behaviorId: sourceBehavior.behaviorId,
		mismatches,
		missingAssumptions,
		specChanges,
	};
}

function improveSpecFromEvaluation(spec, evaluation) {
	const ruleIds = new Set(spec.rules.map((rule) => rule.id));
	const rules = [...spec.rules];
	for (const change of evaluation.specChanges) {
		if (
			change.addRule === "review_independence_required" &&
			!ruleIds.has(change.addRule)
		) {
			rules.push({
				id: "review_independence_required",
				description:
					"The coding agent cannot count its own approval as independent review evidence.",
			});
		}
	}
	return {
		...spec,
		rules,
		revisionReason:
			"Evaluator added missing operational intent discovered by source/spec/implementation comparison.",
	};
}

function fixtureResult(id, assertions) {
	return {
		id,
		status: assertions.every((item) => item.status === "pass")
			? "pass"
			: "fail",
		assertions,
	};
}

function withFixtureDuration(result, startedAt) {
	const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
	return {
		...result,
		durationMs: Number(durationMs.toFixed(2)),
	};
}

function assertion(name, passed) {
	return {
		name,
		status: passed ? "pass" : "fail",
	};
}

function errorFinding(id, message) {
	return {
		id,
		severity: "error",
		message,
	};
}

function normalizeArray(value) {
	return Array.isArray(value) ? value : [];
}

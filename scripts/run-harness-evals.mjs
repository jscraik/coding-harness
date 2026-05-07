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

/**
 * Validate a registry object and append error findings for each detected violation.
 *
 * Performs checks on registry-level constraints (schema version, presence of a north star goal,
 * required scorecard IDs, observability contract schema and required fields, and minimum scenario count)
 * and validates each scenario while enforcing unique scenario IDs.
 *
 * @param {object} value - The registry object to validate.
 * @param {Array<object>} registryFindings - Mutable array that receives error finding objects for each validation failure.
 */
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

/**
 * Validate a single scenario object and append any validation findings to the provided findings array.
 *
 * Performs checks for required `id`, duplicate ids (using the `ids` set), allowed `type` values,
 * presence of `prompt`, non-empty `expected` subfields (`commands`, `artifacts`, `assertions`, `stopConditions`),
 * and numeric score weights for all required scorecard IDs. Successful validation will add the scenario's
 * id to the `ids` set; violations are pushed into `registryFindings`.
 *
 * @param {object} scenario - The scenario to validate.
 * @param {Set<string>} ids - Set of already-seen scenario ids; used to detect duplicates (will be mutated to include the validated id).
 * @param {Array<object>} registryFindings - Array to which error finding objects will be appended for each validation failure.
 */
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

/**
 * Executes a single "live_fixture" scenario by preparing an isolated fixture directory, invoking the appropriate fixture runner for the scenario, and returning the fixture result augmented with execution duration.
 *
 * @param {Object} scenario - Registry scenario object; must include a unique `id` that selects which fixture runner to execute and any scenario-specific data the runner requires.
 * @returns {Object} A fixture result object containing `id`, `status`, `assertions`, and `durationMs`. On runtime errors the result will have `status: "fail"` and an assertion describing the error.
 */
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

/**
 * Run the path-safety live fixture: write a computed safe fixture path and verify that unsafe inputs are rejected.
 *
 * Writes `safe-path.txt` into the provided fixture directory and returns a fixture result with assertions that:
 * - the computed safe path resolves inside the configured fixture root,
 * - path traversal inputs are rejected,
 * - absolute-escape inputs are rejected.
 *
 * @param {Object} scenario - The scenario object (its `id` is used for the returned fixture result).
 * @param {string} fixturePath - Absolute path to the fixture directory where artifacts will be written.
 * @returns {Object} A fixture result containing assertions for path safety; `status` reflects whether all assertions passed.
 */
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

/**
 * Executes the generated-artifact drift fixture: creates a canonical source and a stale generated artifact, checks for drift, repairs the generated artifact from the canonical source, and returns assertions about detection and repair.
 *
 * @param {{id: string}} scenario - Scenario object; its `id` is used to build the fixture result.
 * @param {string} fixturePath - Filesystem path to the fixture directory where artifacts are written.
 * @returns {Object} Fixture result object containing assertions:
 *  - `"stale generated artifact is detected"`: `true` if initial drift was found.
 *  - `"generated artifact is repaired from canonical source"`: `true` if the repaired artifact references the canonical source and includes expected `requiredChecks`.
 *  - `"post-repair drift check passes"`: `true` if no drift is detected after repair.
 */
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

/**
 * Runs the "validation-plan" live_fixture for a scenario and produces assertions about the generated validation plan.
 * @param {Object} scenario - The scenario descriptor from the registry (must include `id`).
 * @param {string} fixturePath - Absolute path to the fixture directory where artifacts will be written.
 * @returns {Object} A fixture result object containing `id`, `status`, and an array of `assertions` describing plan validity and expected commands.
 */
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

/**
 * Executes a spec reimplementation loop fixture: generates a source behavior, derives an initial spec, implements and evaluates it, improves the spec, re-implements and re-evaluates, and writes fixture artifacts.
 *
 * Produces assertion outcomes that verify the spec extraction, detection of a missing assumption, application of a concrete spec change, inclusion of the missing rule in the improved spec, successful reimplementation, and reduction of missing assumptions.
 *
 * @param {object} scenario - Scenario descriptor; its `id` is used to build the fixture result.
 * @param {string} fixturePath - Absolute path to the fixture directory where artifacts will be written.
 * @returns {object} A fixture result object containing `id`, `status`, `assertions`, and `durationMs`.
 */
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

/**
 * Generates an eval-seed pack from a learning artifact in the fixture and validates that a correct eval-seed candidate was produced.
 *
 * Writes a learning artifact and an enforcement-status file into the fixture, invokes the eval-seed builder (in-process if exported, otherwise via a subprocess), and asserts that the produced seed pack contains a generated-artifact candidate with expected matched files, evidence references, recommended target/test, classification, and output path.
 *
 * @param {object} scenario - The registry scenario object for which the fixture is run.
 * @param {string} fixturePath - Absolute path to the fixture directory where artifacts are written.
 * @returns {object} A fixture result object for the given scenario id, containing assertions and a computed `status` indicating overall pass or fail.
 */
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

/**
 * Run the GitHub App authentication preflight fixture, emit an auth-matrix artifact, and validate expected classifications.
 *
 * Writes an `auth-matrix.json` file under the provided fixturePath containing three classified authentication configurations, then verifies
 * (via assertions) that a complete GitHub App configuration is preferred, a private-key-path variant is accepted, a partial app config
 * is classified as an environment/tooling blocker, and that private key material is not present in the written artifact.
 *
 * @param {object} scenario - The registry scenario being executed; its `id` is used as the fixture result id.
 * @param {string} fixturePath - Absolute path to the directory where fixture artifacts should be written.
 * @returns {object} A fixture result object with `id`, overall `status`, and an array of `assertions` describing the checks above.
 */
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
		classifyGitHubE2EAuthFixture({
			id: "pat-only-check-run",
			hasPat: true,
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
			"PAT-only auth is blocked for check-run fixture scenarios",
			authMatrix.find((item) => item.id === "pat-only-check-run")
				?.authSource === "blocked",
		),
		assertion(
			"secret material is not written to fixture artifacts",
			!artifactText.includes("fixture-private-key"),
		),
	]);
}

/**
 * Verify review-gate check name alignment, write a fixture artifact, and produce assertions for the scenario.
 *
 * Writes a `review-gate-alignment.json` artifact containing both an aligned and a mismatched evaluation produced
 * by `evaluateReviewGateCheckNameFixture`, and returns a fixture result that asserts expected alignment behavior.
 *
 * @param {Object} scenario - The registry scenario object; must include `id`.
 * @param {string} fixturePath - Absolute path to the fixture directory where artifacts will be written.
 * @returns {Object} A fixture result object with `id`, `status`, and an `assertions` array describing pass/fail checks.
 */
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

/**
 * Run the repo-local end-to-end scratch path fixture and record classification assertions.
 *
 * Writes a `scratch-paths.json` artifact describing repo-local and OS-temp scratch classifications,
 * then returns a fixture result that asserts expected classifications and cleanup scoping.
 *
 * @param {object} scenario - The registry scenario object for this fixture.
 * @param {string} fixturePath - Absolute path to the fixture directory where artifacts are written.
 * @returns {object} A fixture result object containing `id`, `status`, and `assertions`.
 */
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

/**
 * Execute the GitHub check-run transient retry fixture and record assertions about retry behavior.
 *
 * Writes a `retry-policy.json` artifact under the provided fixture path and evaluates
 * retry-case outcomes for transient 5xx sequences, attempt caps, and non-retryable 403 errors.
 *
 * @param {object} scenario - The scenario descriptor; its `id` is used for the fixture result.
 * @param {string} fixturePath - Directory path where fixture artifacts (e.g., `retry-policy.json`) are written.
 * @returns {object} A fixture result object containing assertions about attempts, outcomes, and failure classification.
 */
function runGitHubCheckRunTransientRetryFixture(scenario, fixturePath) {
	const retryPolicy = {
		schemaVersion: "github-check-run-retry-policy-fixture/v1",
		maxAttempts: 3,
		retryableStatuses: "status >= 500",
		delaysMs: [250, 1000],
		cases: [
			evaluateCheckRunRetryCase([504, 200]),
			evaluateCheckRunRetryCase([503, 502, 200]),
			evaluateCheckRunRetryCase([501, 200]),
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
			"all transient 5xx statuses follow the same retry contract",
			byName.get("501-200")?.attempts === 2 &&
				byName.get("501-200")?.outcome === "success",
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

/**
 * Runs deterministic harness-engineering lifecycle routing test cases for a fixture, records inputs and routing outputs, and returns assertions about expected routing behavior.
 *
 * Writes two fixture artifacts into the given fixturePath:
 * - "routing-cases.json" containing the source cases and metadata
 * - "routing-results.json" containing computed routing results for each case
 *
 * @param {Object} scenario - Registry scenario object for this fixture (used for the returned fixture id).
 * @param {string} fixturePath - Absolute path to the fixture directory where artifacts will be written.
 * @returns {Object} A fixture result object for the scenario that contains assertions verifying routing outcomes (e.g., code-review, tdd, heartbeat, non-trigger, router-blocking, and redaction of unsafe telemetry).
 */
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

/**
 * Dynamically import a module at the given URL and return the requested export, caching results to avoid repeated imports or repeated failed attempts.
 *
 * @param {string} moduleUrl - The module specifier/URL to import (e.g., a file URL or relative path resolvable by dynamic import).
 * @param {string} exportName - The named export to return from the imported module.
 * @returns {*} The requested export value, or `null` if the module failed to load or the export is unavailable. Failed import attempts are cached as `null` to prevent repeated import errors.
 */
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

/**
 * Generate a validation plan for a learning artifact and changed files by executing the plan builder in a subprocess.
 *
 * @param {string} learningArtifactPath - Absolute path to the learning artifact file to be evaluated.
 * @param {string[]} changedFiles - List of file paths that have changed and should be considered by the plan builder.
 * @returns {Object} The parsed validation plan object produced by the subprocess, typically containing fields such as `status`, `commands`, `networkRequired`, and `changedFiles`.
 */
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

/**
 * Executes the project's `buildEvalSeedPack` in a subprocess and returns the generated eval-seed pack.
 *
 * @param {Object} params - Function parameters.
 * @param {string} params.learningArtifactPath - Absolute path to the learning artifact file to use as the source.
 * @param {string} params.enforcementStatusPath - Absolute path to the enforcement status file consumed by the pack builder.
 * @param {string[]} params.changedFiles - List of changed file paths to pass to the pack builder.
 * @param {string} params.outputPath - Absolute path where the pack builder should write its output.
 * @returns {Object} The parsed eval-seed pack object produced by `buildEvalSeedPack`.
 */
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

/**
 * Resolve a single-segment fixture identifier to an absolute path inside the configured fixture root.
 *
 * @param {string} relativePath - A single path segment (no path separators or leading slash) identifying the fixture directory.
 * @returns {string} The resolved absolute path located under the configured `fixtureRoot`.
 * @throws {Error} If `relativePath` is not a non-empty string.
 * @throws {Error} If `relativePath` is an absolute path.
 * @throws {Error} If `relativePath` contains path separators (contains `/` or `\`).
 * @throws {Error} If the resolved path would escape the `fixtureRoot`.
 */
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

/**
 * Overwrite the generated artifact file using canonical data from the source JSON.
 *
 * Reads the JSON at `sourcePath` and writes a new JSON object to `generatedPath`
 * with `schemaVersion` set to `"fixture-generated/v1"`, `generatedFrom` set to
 * the source filename, and `requiredChecks` copied from the source.
 *
 * @param {string} sourcePath - Filesystem path to the canonical source JSON.
 * @param {string} generatedPath - Filesystem path where the generated artifact will be written (overwritten).
 */
function repairGeneratedArtifact(sourcePath, generatedPath) {
	const source = readJson(sourcePath);
	writeJson(generatedPath, {
		schemaVersion: "fixture-generated/v1",
		generatedFrom: path.basename(sourcePath),
		requiredChecks: source.requiredChecks,
	});
}

/**
 * Classifies a GitHub end-to-end authentication fixture input into an authentication source and blocker classification.
 *
 * @param {Object} input - Fixture input to classify.
 * @param {string} input.id - Scenario identifier to propagate to the result.
 * @param {string} [input.appId] - GitHub App ID string, when provided.
 * @param {string} [input.installationId] - GitHub App installation ID, when provided.
 * @param {string} [input.privateKey] - Inline private key material, when provided.
 * @param {string} [input.privateKeyPath] - Path to private key file, when provided.
 * @param {boolean} [input.hasPat] - True when a personal access token (PAT) is available.
 * @returns {Object} Classification result containing:
 *   - id: the input.id value.
 *   - authSource: `"github_app"` or `"blocked"` indicating the chosen authentication source for check-run fixture scenarios.
 *   - blockerClassification: `"none"` when usable, otherwise `"environment/tooling issue"`.
 *   - missing: array of required GitHub App fields that are absent (e.g., `["app_id","installation_id","private_key"]`).
 *   - usesPrivateKeyPath: boolean indicating whether a private key path was used.
 */
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
		authSource: "blocked",
		blockerClassification: "environment/tooling issue",
		missing,
		usesPrivateKeyPath: false,
	};
}

/**
 * Evaluate alignment and verification of required review-gate check names and related conditions.
 * @param {Object} params - Evaluation inputs.
 * @param {string[]} params.requiredChecks - List of required check names for the review gate.
 * @param {string[]} params.createdCheckRuns - Names of check runs actually created by the workflow.
 * @param {string} params.invocationCheckName - The check name used when invoking the gate.
 * @param {boolean} params.hasIndependentApproval - Whether an independent approval signal is present.
 * @param {string} params.checkConclusion - Conclusion of the required check (e.g., `"success"`).
 * @returns {Object} Result object describing match status, blockers, and classifications.
 * @returns {string[]} returns.requiredChecks - Echo of the input `requiredChecks`.
 * @returns {string[]} returns.createdCheckRuns - Echo of the input `createdCheckRuns`.
 * @returns {string} returns.invocationCheckName - Echo of the input `invocationCheckName`.
 * @returns {boolean} returns.createdCheckMatchesRequired - `true` when every `requiredChecks` entry appears in `createdCheckRuns`.
 * @returns {boolean} returns.invocationMatchesRequired - `true` when `invocationCheckName` is included in `requiredChecks`.
 * @returns {boolean} returns.checkPassed - `true` when `checkConclusion` equals `"success"`.
 * @returns {boolean} returns.hasIndependentApproval - Echo of the input `hasIndependentApproval`.
 * @returns {boolean} returns.verified - `true` when there are no blockers.
 * @returns {string[]} returns.blockers - List of blocker reasons: can include `"required check name mismatch"`, `"required check failed"`, and/or `"required approval missing"`.
 * @returns {boolean} returns.shouldPollLiveGitHub - `true` when created checks and invocation name both match the required checks.
 * @returns {string} returns.blockerClassification - Classification: `"none"` when verified, otherwise `"scenario regression"`.
 */
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

/**
 * Classifies a repository-local E2E scratch root and whether a contract path is correctly placed within it.
 *
 * @param {string} scratchRoot - Absolute path to the scratch root being evaluated.
 * @param {string} contractPath - Absolute path to the contract file to validate against the scratch root.
 * @returns {{scratchRoot: string, contractPath: string, rootInsideRepoArtifacts: boolean, contractInsideScratchRoot: boolean, cleanupTarget: string, blockerClassification: string}}
 * An object containing:
 * - `scratchRoot`: the provided scratch root path.
 * - `contractPath`: the provided contract path.
 * - `rootInsideRepoArtifacts`: `true` if `scratchRoot` is located under REPO_ROOT/artifacts/e2e, `false` otherwise.
 * - `contractInsideScratchRoot`: `true` if `contractPath` is located inside `scratchRoot`, `false` otherwise.
 * - `cleanupTarget`: the path to use for cleanup (same as `scratchRoot`).
 * - `blockerClassification`: `"none"` when both containment checks are `true`, otherwise `"fixture/runtime failure"`.
 */
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

/**
 * Classifies a sequence of HTTP response statuses to determine retry attempts, outcome, and failure classification.
 *
 * @param {number[]} statuses - Ordered HTTP status codes observed for repeated attempts.
 * @returns {{id: string, statuses: number[], attempts: number, outcome: "success"|"failure", firstFailureClassification: string, blockerClassification: string}}
 *   An object containing:
 *   - `id`: concatenation of the input statuses joined by `-`.
 *   - `statuses`: the original array of HTTP status codes.
 *   - `attempts`: the number of attempts that were made before stopping (stops on success, on a non-retryable status, or when the attempt cap is reached).
 *   - `outcome`: `"success"` if a 2xx status was observed before stopping, otherwise `"failure"`.
 *   - `firstFailureClassification`: classification for the first status (`"environment/tooling issue"` when the first status is `403`, otherwise `"fixture/runtime failure"`).
 *   - `blockerClassification`: `"none"` when `outcome` is `"success"`, otherwise the value of `firstFailureClassification`.
 */
function evaluateCheckRunRetryCase(statuses) {
	let attempts = 0;
	let outcome = "failure";
	for (const status of statuses) {
		attempts += 1;
		if (status >= 200 && status < 300) {
			outcome = "success";
			break;
		}
		if (status < 500 || attempts >= 3) {
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

/**
 * Determines whether a candidate path resides at or inside a given root directory.
 * @param {string} candidate - The path to test (file or directory path).
 * @param {string} root - The directory root to test against.
 * @returns {boolean} `true` if `candidate` resolves to the same path as `root` or is contained within `root`, `false` otherwise.
 */
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

/**
 * Produce a fixed learning-artifact object used by fixture scenarios.
 *
 * The object adheres to the harness-learnings schema and contains a single
 * candidate learning item that represents a validation-contract entry for
 * src/lib/learnings/validation-plan.ts.
 *
 * @returns {Object} A learning-artifact JSON object with keys:
 *  - `schemaVersion`, `provider`, `repository`, `source`, `inputFingerprint`
 *  - `items`: array containing one validation contract item with fields
 *    (`id`, `provider`, `source`, `repository`, `file`, `usage`, `learning`,
 *    `targetPatterns`, `classification`, `enforcement`, `promotionStatus`)
 *  - `warnings`: empty array
 *  - `summary`: import statistics and breakdowns by classification/enforcement.
 */
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

/**
 * Constructs a fixed learning-artifact object used by the eval-seed fixture.
 *
 * The returned object includes top-level metadata (schemaVersion, provider, repository, source, inputFingerprint),
 * an `items` array of candidate learning entries (id, provider, source row, repository file, usage, learning text,
 * targetPatterns, classification, enforcement, promotionStatus), an empty `warnings` array, and an import `summary`.
 *
 * @returns {object} A learning-artifact document conforming to `harness-learnings/v1` containing candidate items and import summary statistics.
 */
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

/**
 * Constructs a canonical source behavior describing review-gate readiness for use in spec-reimplementation fixtures.
 *
 * The returned object encodes a schema version, behavior identifier, natural-language intent, an array of rules
 * (each with `id` and `description`), and example cases that map concrete inputs to an `expectedDecision`.
 *
 * @returns {Object} A source behavior object with `schemaVersion`, `behaviorId`, `intent`, `rules`, and `examples` suitable for driving spec extraction and evaluation.
 */
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

/**
 * Incorporates specified spec changes into a spec by adding any missing rule(s) from the evaluation.
 *
 * Examines `evaluation.specChanges` and, for each `addRule` entry not already present in `spec.rules`,
 * appends a corresponding rule object. The returned spec preserves existing fields, updates `rules`,
 * and includes a `revisionReason` describing the change.
 *
 * @param {object} spec - The executable spec object containing at least a `rules` array of `{id, ...}` objects.
 * @param {object} evaluation - The evaluation result containing a `specChanges` array of change descriptors.
 * @returns {object} The updated spec object with added rules and a `revisionReason` field.
 */
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

/**
 * Create a fixture run result object summarizing the provided assertions.
 * @param {string} id - Fixture identifier.
 * @param {Array<Object>} assertions - Array of assertion objects; each should include a `status` field.
 * @returns {{id: string, status: "pass" | "fail", assertions: Array<Object>}} The fixture result where `status` is `"pass"` only if every assertion's `status` equals `"pass"`, otherwise `"fail"`.
 */
function fixtureResult(id, assertions) {
	return {
		id,
		status: assertions.every((item) => item.status === "pass")
			? "pass"
			: "fail",
		assertions,
	};
}

/**
 * Attach a `durationMs` field to a fixture result representing the elapsed milliseconds since `startedAt`.
 *
 * @param {object} result - The fixture result object to augment; its other properties are preserved.
 * @param {bigint} startedAt - High-resolution start timestamp obtained from `process.hrtime.bigint()`.
 * @returns {object} The original `result` merged with `durationMs`, the elapsed time in milliseconds rounded to two decimals.
 */
function withFixtureDuration(result, startedAt) {
	const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
	return {
		...result,
		durationMs: Number(durationMs.toFixed(2)),
	};
}

/**
 * Create an assertion result object with a name and a pass/fail status.
 * @param {string} name - Human-readable label for the assertion.
 * @param {boolean} passed - `true` if the assertion passed, `false` otherwise.
 * @returns {{name: string, status: "pass" | "fail"}} An object containing the assertion `name` and a `status` set to `"pass"` when `passed` is true, otherwise `"fail"`.
 */
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

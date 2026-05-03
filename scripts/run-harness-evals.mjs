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
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);

const DEFAULT_REGISTRY =
	"evals/scenarios/north-star-agent-delivery/registry.json";
const DEFAULT_OUTPUT = "artifacts/evals/result.json";
const DEFAULT_OBSERVABILITY_OUTPUT = "artifacts/evals/braintrust-log-data.json";
const DEFAULT_FIXTURE_ROOT = "artifacts/evals/live-fixtures";

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
	liveFixtureResults.push(runLiveFixture(scenario));
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

function runLiveFixture(scenario) {
	const fixturePath = safeFixturePath(scenario.id);
	rmSync(fixturePath, { force: true, recursive: true });
	mkdirSync(fixturePath, { recursive: true });

	try {
		if (scenario.id === "live-fixture-path-safety") {
			return runPathSafetyFixture(scenario, fixturePath);
		}
		if (scenario.id === "generated-artifact-drift-repair") {
			return runGeneratedArtifactDriftFixture(scenario, fixturePath);
		}
		if (scenario.id === "validation-plan-closeout-match") {
			return runValidationPlanFixture(scenario, fixturePath);
		}
		if (scenario.id === "spec-reimplementation-loop") {
			return runSpecReimplementationLoopFixture(scenario, fixturePath);
		}
		if (scenario.id === "harness-engineering-lifecycle-routing") {
			return runHarnessEngineeringLifecycleRoutingFixture(
				scenario,
				fixturePath,
			);
		}
		return {
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
	} catch (error) {
		return {
			id: scenario.id,
			status: "fail",
			assertions: [
				{
					name: "fixture execution",
					status: "fail",
					message: error instanceof Error ? error.message : String(error),
				},
			],
		};
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

function runValidationPlanFixture(scenario, fixturePath) {
	const learningArtifactPath = path.join(fixturePath, "coderabbit.local.json");
	const changedFiles = [
		"package.json",
		"scripts/run-harness-evals.mjs",
		"src/lib/learnings/validation-plan.ts",
	];
	writeJson(learningArtifactPath, buildFixtureLearningArtifact());
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
	const plan = JSON.parse(stdout);
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

import { runArtifactRoutineCLI } from "../../../commands/artifact-routine.js";
import { runAutomationRunCLI } from "../../../commands/automation-run.js";
import {
	type BlastRadiusOptions,
	runBlastRadiusCLI,
} from "../../../commands/blast-radius.js";
import { runCIOwnershipGateCLI } from "../../../commands/ci-ownership-gate.js";
import { runContextHealthCLI } from "../../../commands/context-health.js";
import { runContextCLI } from "../../../commands/context.js";
import { runContractCLI } from "../../../commands/contract.js";
import { runDiffBudgetCLI } from "../../../commands/diff-budget.js";
import { runEjectCLI } from "../../../commands/eject.js";
import { runIndexContextCLI } from "../../../commands/index-context.js";
import { runLearningsCLI } from "../../../commands/learnings.js";
import { runNorthStarFeedbackCLI } from "../../../commands/north-star-feedback.js";
import { runPatternScopeCLI } from "../../../commands/pattern-scope.js";
import { runPilotEvaluateCLI } from "../../../commands/pilot-evaluate.js";
import {
	type PilotRollbackOptions,
	runPilotRollbackCLI,
} from "../../../commands/pilot-rollback.js";
import { runReviewContextCLI } from "../../../commands/review-context.js";
import { runSearchCLI } from "../../../commands/search.js";
import {
	runUIExploreCLI,
	runUIFastCLI,
	runUIVerifyCLI,
} from "../../../commands/ui-loop.js";
import { runValidationPlanCLI } from "../../../commands/validation-plan.js";
import type { PilotEvaluateOptions } from "../../pilot-evaluation/types.js";
import { getVersion } from "../../version.js";
import {
	getFlagValue,
	inspectFlagValue,
	parseCsvList,
	parseIntegerArg,
} from "../parse-utils.js";
import { createAgentReadinessCommandSpec } from "./agent-readiness-command-spec.js";
import { createArtifactGateCommandSpec } from "./artifact-gate-command-spec.js";
import { createAuditCommandSpec } from "./audit-command-spec.js";
import { createBrainCommandSpec } from "./brain-command-spec.js";
import { createBrainstormGateCommandSpec } from "./brainstorm-gate-command-spec.js";
import { createBranchProtectCommandSpec } from "./branch-protect-command-spec.js";
import { createCheckAuthzCommandSpec } from "./check-authz-command-spec.js";
import { createCheckCommandSpec } from "./check-command-spec.js";
import { createCheckEnvironmentCommandSpec } from "./check-environment-command-spec.js";
import { createCIMigrateCommandSpec } from "./ci-migrate-command-spec.js";
import { createDecisionRequestCommandSpec } from "./decision-request-command-spec.js";
import { createDocsGateCommandSpec } from "./docs-gate-command-spec.js";
import { createDoctorCommandSpec } from "./doctor-command-spec.js";
import { createDriftGateCommandSpec } from "./drift-gate-command-spec.js";
import { createEvidenceVerifyCommandSpec } from "./evidence-verify-command-spec.js";
import { createFeedbackLoopAuditCommandSpec } from "./feedback-loop-audit-command-spec.js";
import { createFleetPlanCommandSpec } from "./fleet-plan-command-spec.js";
import { createGardenerCommandSpec } from "./gardener-command-spec.js";
import { createGapCaseCommandSpec } from "./gap-case-command-spec.js";
import { createHealthCommandSpec } from "./health-command-spec.js";
import { createInitCommandSpec } from "./init-command-spec.js";
import { createLinearGateCommandSpec } from "./linear-gate-command-spec.js";
import { createLinearCommandSpec } from "./linear-command-spec.js";
import { createLearningEvidenceCommandSpecs } from "./learning-evidence-command-specs.js";
import { createLicenseGateCommandSpec } from "./license-gate-command-spec.js";
import { createLocalMemoryPreflightCommandSpec } from "./local-memory-preflight-command-spec.js";
import { createMemoryGateCommandSpec } from "./memory-gate-command-spec.js";
import { createNextCommandSpec } from "./next-command-spec.js";
import { createObservabilityGateCommandSpec } from "./observability-gate-command-spec.js";
import { createOrgAuditCommandSpec } from "./org-audit-command-spec.js";
import { createPlanGateCommandSpec } from "./plan-gate-command-spec.js";
import { createPolicyGateCommandSpec } from "./policy-gate-command-spec.js";
import { createPresetCommandSpec } from "./preset-command-spec.js";
import { createPrCloseoutCommandSpec } from "./pr-closeout-command-spec.js";
import { createPreflightGateCommandSpec } from "./preflight-gate-command-spec.js";
import { createPrTemplateGateCommandSpec } from "./pr-template-gate-command-spec.js";
import { createPromptGateCommandSpec } from "./prompt-gate-command-spec.js";
import { createReplayCommandSpec } from "./replay-command-spec.js";
import { createRemediateCommandSpec } from "./remediate-command-spec.js";
import { createReviewGateCommandSpec } from "./review-gate-command-spec.js";
import { createRiskTierCommandSpec } from "./risk-tier-command-spec.js";
import { createRuntimeBudgetCommandSpec } from "./runtime-budget-command-spec.js";
import { createRuntimeCardCommandSpec } from "./runtime-card-command-spec.js";
import { createRuleLifecycleGateCommandSpec } from "./rule-lifecycle-gate-command-spec.js";
import { createSessionContextCommandSpec } from "./session-context-command-spec.js";
import { createSilentErrorCommandSpec } from "./silent-error-command-spec.js";
import { createSimulateCommandSpec } from "./simulate-command-spec.js";
import { createSymphonyCheckCommandSpec } from "./symphony-check-command-spec.js";
import type { CommandSpec } from "./types.js";
import { createToolingAuditCommandSpec } from "./tooling-audit-command-spec.js";
import { createUpgradeCommandSpec } from "./upgrade-command-spec.js";
import { createVerifyCodeRabbitCommandSpec } from "./verify-coderabbit-command-spec.js";
import { createVerifyWorkCommandSpec } from "./verify-work-command-spec.js";
import { createWorkflowGenerateCommandSpec } from "./workflow-generate-command-spec.js";

export const COMMAND_SPECS: CommandSpec[] = [
	createFleetPlanCommandSpec(),
	createLinearCommandSpec(),
	createLinearGateCommandSpec(),
	createPrCloseoutCommandSpec(),
	createPrTemplateGateCommandSpec(),
	createRuleLifecycleGateCommandSpec(),
	createPolicyGateCommandSpec(),
	createEvidenceVerifyCommandSpec(),
	createPreflightGateCommandSpec(),
	createReviewGateCommandSpec(),
	createBranchProtectCommandSpec(),
	createCheckAuthzCommandSpec(),
	createCheckEnvironmentCommandSpec(),
	createLocalMemoryPreflightCommandSpec(),
	createDocsGateCommandSpec(),
	createLicenseGateCommandSpec(),
	createSymphonyCheckCommandSpec(),
	createWorkflowGenerateCommandSpec(),
	createOrgAuditCommandSpec(),
	createToolingAuditCommandSpec(),
	createFeedbackLoopAuditCommandSpec(),
	createPresetCommandSpec(),
	createCheckCommandSpec(),
	createAgentReadinessCommandSpec(),
	createNextCommandSpec(),
	createRuntimeCardCommandSpec(),
	createSessionContextCommandSpec(),
	createDecisionRequestCommandSpec(),
	createAuditCommandSpec(getVersion),
	createDoctorCommandSpec(getVersion),
	createHealthCommandSpec(getVersion),
	{
		name: "eject",
		summary: "Eject harness files from the target repository",
		errorLabel: "Eject Error",
		execute: async (args) => {
			const forceFlag = args.includes("--force") || args.includes("-f");
			const dryRunFlag = args.includes("--dry-run");
			const jsonFlag = args.includes("--json");
			const targetDir = args.find((a) => !a.startsWith("-"));

			const options: Parameters<typeof runEjectCLI>[1] = {};
			if (forceFlag) options.force = true;
			if (dryRunFlag) options.dryRun = true;
			if (jsonFlag) options.json = true;

			return runEjectCLI(targetDir, options);
		},
	},
	createVerifyWorkCommandSpec(),
	createVerifyCodeRabbitCommandSpec(),
	{
		name: "contract",
		summary: "Init, validate, or print the harness contract schema",
		example: "contract init --preset lite",
		errorLabel: "Contract Error",
		execute: (args) => {
			const jsonFlag = args.includes("--json");
			// Preserve flag args so init/validate subcommands can parse --preset, --output, etc.
			return runContractCLI(args, { json: jsonFlag || undefined });
		},
	},
	createRiskTierCommandSpec(),
	{
		name: "pattern-scope",
		summary:
			"Build a pattern-scope artifact from steering feedback and changed files",
		example:
			"pattern-scope --files src/auth.ts --feedback 'same things in multiple places' --json",
		errorLabel: "Pattern Scope Error",
		execute: (args) => runPatternScopeCLI(args),
	},
	{
		name: "artifact-routine",
		summary: "Validate route-driving .harness artifacts before implementation",
		example:
			"artifact-routine --active-index .harness/active-artifacts.md --json",
		errorLabel: "Artifact Routine Error",
		execute: (args) => runArtifactRoutineCLI(args),
	},
	createReplayCommandSpec(),
	createRemediateCommandSpec(),
	createGardenerCommandSpec(),
	createMemoryGateCommandSpec(),
	createSilentErrorCommandSpec(),
	createBrainstormGateCommandSpec(),
	createBrainCommandSpec(),
	createPlanGateCommandSpec(),
	createPromptGateCommandSpec(),
	createDriftGateCommandSpec(),
	{
		name: "ui:fast",
		aliases: ["ui-fast"],
		summary: "Storybook-first local development loop",
		errorLabel: "UI Fast Error",
		execute: (args) => {
			const jsonFlag = args.includes("--json");
			const ciFlag = args.includes("--ci");
			const dryRunFlag = args.includes("--dry-run");
			const portIndex = args.indexOf("--port");
			const contractIndex = args.indexOf("--contract");
			const modeIndex = args.indexOf("--mode");

			const options: {
				port?: number;
				ci?: boolean;
				json?: boolean;
				contractPath?: string;
				dryRun?: boolean;
				mode?: "execute" | "prepare";
			} = {};

			if (jsonFlag) options.json = true;
			if (ciFlag) options.ci = true;
			if (dryRunFlag) options.dryRun = true;
			const portArg = getFlagValue(args, portIndex);
			if (portArg) {
				const parsedPort = parseIntegerArg(portArg, 1);
				if (parsedPort !== undefined) options.port = parsedPort;
			}
			const modeArg = getFlagValue(args, modeIndex);
			if (modeArg === "execute" || modeArg === "prepare") {
				options.mode = modeArg;
			}
			if (dryRunFlag) {
				options.mode = "prepare";
			}
			const contractArg = getFlagValue(args, contractIndex);
			if (contractArg) options.contractPath = contractArg;

			return runUIFastCLI(options);
		},
	},
	createArtifactGateCommandSpec(),
	createRuntimeBudgetCommandSpec(),
	{
		name: "ci-ownership-gate",
		summary:
			"Validate CircleCI, CodeRabbit, and Semgrep required-check ownership",
		example: "ci-ownership-gate --json",
		errorLabel: "CI Ownership Gate Error",
		execute: (args) => {
			const contractFlag = inspectFlagValue(args, "--contract");

			if (contractFlag.missingValue) {
				console.error("CI Ownership Gate Error: --contract requires a value");
				return 2;
			}

			return runCIOwnershipGateCLI({
				contractPath: contractFlag.value,
				json: args.includes("--json"),
			});
		},
	},
	{
		name: "blast-radius",
		summary: "Determine required checks from changed files",
		example: "blast-radius --files src/auth.ts,src/api.ts --json",
		errorLabel: "Blast Radius Error",
		execute: (args) => {
			const jsonFlag = args.includes("--json");
			const verboseFlag = args.includes("--verbose");
			const filesIndex = args.indexOf("--files");
			const contractIndex = args.indexOf("--contract");

			const filesArg = getFlagValue(args, filesIndex);
			if (!filesArg) {
				console.error("Error: --files is required (comma-separated paths)");
				return 2;
			}

			const files = filesArg
				.split(",")
				.map((f) => f.trim())
				.filter(Boolean);

			const contractArg = getFlagValue(args, contractIndex);
			const blastRadiusOptions: BlastRadiusOptions = {
				files,
				json: jsonFlag,
				verbose: verboseFlag,
			};
			if (contractArg) blastRadiusOptions.contractPath = contractArg;

			return runBlastRadiusCLI(blastRadiusOptions);
		},
	},
	{
		name: "automation-run",
		summary: "Execute Pulse/Upskill/Green PRs/Drift Check idempotently",
		errorLabel: "Automation Run Error",
		execute: (args) => {
			const nameIndex = args.indexOf("--name");
			const repoIndex = args.indexOf("--repo");
			const headShaIndex = args.indexOf("--head-sha");
			const contractVersionIndex = args.indexOf("--contract-version");
			const inputFingerprintIndex = args.indexOf("--input-fingerprint");
			const artifactsDirIndex = args.indexOf("--artifacts-dir");
			const statePathIndex = args.indexOf("--state-path");
			const jsonFlag = args.includes("--json");
			const forceFlag = args.includes("--force");
			const simulateFailureFlag = args.includes("--simulate-failure");

			const name = getFlagValue(args, nameIndex) ?? "";
			const repo = getFlagValue(args, repoIndex) ?? "";
			const headSha = getFlagValue(args, headShaIndex) ?? "";
			const contractVersion = getFlagValue(args, contractVersionIndex) ?? "";
			const inputFingerprint = getFlagValue(args, inputFingerprintIndex) ?? "";
			const artifactsDir = getFlagValue(args, artifactsDirIndex);
			const statePath = getFlagValue(args, statePathIndex);

			return runAutomationRunCLI({
				name,
				repo,
				headSha,
				contractVersion,
				inputFingerprint,
				...(artifactsDir ? { artifactsDir } : {}),
				...(statePath ? { statePath } : {}),
				force: forceFlag,
				simulateFailure: simulateFailureFlag,
				json: jsonFlag,
			});
		},
	},
	createObservabilityGateCommandSpec(),
	createGapCaseCommandSpec(),
	{
		name: "ui:verify",
		aliases: ["ui-verify"],
		summary: "Playwright smoke suite with evidence",
		errorLabel: "UI Verify Error",
		execute: (args) => {
			const jsonFlag = args.includes("--json");
			const dryRunFlag = args.includes("--dry-run");
			const outputIndex = args.indexOf("--output");
			const timeoutIndex = args.indexOf("--timeout");
			const shardIndex = args.indexOf("--shard");
			const contractIndex = args.indexOf("--contract");
			const modeIndex = args.indexOf("--mode");

			const options: {
				outputDir?: string;
				json?: boolean;
				timeout?: number;
				shard?: string;
				contractPath?: string;
				dryRun?: boolean;
				mode?: "execute" | "prepare";
			} = {};

			if (jsonFlag) options.json = true;
			if (dryRunFlag) options.dryRun = true;
			const outputArg = getFlagValue(args, outputIndex);
			if (outputArg) options.outputDir = outputArg;
			const timeoutArg = getFlagValue(args, timeoutIndex);
			if (timeoutArg) {
				const parsedTimeout = parseIntegerArg(timeoutArg, 1);
				if (parsedTimeout !== undefined) options.timeout = parsedTimeout;
			}
			const shardArg = getFlagValue(args, shardIndex);
			if (shardArg) options.shard = shardArg;
			const modeArg = getFlagValue(args, modeIndex);
			if (modeArg === "execute" || modeArg === "prepare") {
				options.mode = modeArg;
			}
			if (dryRunFlag) {
				options.mode = "prepare";
			}
			const contractArg = getFlagValue(args, contractIndex);
			if (contractArg) options.contractPath = contractArg;

			return runUIVerifyCLI(options);
		},
	},
	{
		name: "ui:explore",
		aliases: ["ui-explore"],
		summary: "Agent browser exploratory testing",
		errorLabel: "UI Explore Error",
		execute: (args) => {
			const jsonFlag = args.includes("--json");
			const interactionsFlag = args.includes("--interactions");
			const dryRunFlag = args.includes("--dry-run");
			const urlIndex = args.indexOf("--url");
			const outputIndex = args.indexOf("--output");
			const contractIndex = args.indexOf("--contract");
			const modeIndex = args.indexOf("--mode");

			const options: {
				url?: string;
				outputDir?: string;
				json?: boolean;
				interactions?: boolean;
				contractPath?: string;
				dryRun?: boolean;
				mode?: "execute" | "prepare";
			} = {};

			if (jsonFlag) options.json = true;
			if (interactionsFlag) options.interactions = true;
			if (dryRunFlag) options.dryRun = true;
			const urlArg = getFlagValue(args, urlIndex);
			if (urlArg) options.url = urlArg;
			const outputArg = getFlagValue(args, outputIndex);
			if (outputArg) options.outputDir = outputArg;
			const modeArg = getFlagValue(args, modeIndex);
			if (modeArg === "execute" || modeArg === "prepare") {
				options.mode = modeArg;
			}
			if (dryRunFlag) {
				options.mode = "prepare";
			}
			const contractArg = getFlagValue(args, contractIndex);
			if (contractArg) options.contractPath = contractArg;

			return runUIExploreCLI(options);
		},
	},
	createSimulateCommandSpec(),
	{
		name: "context",
		summary: "Semantic search for relevant prior work",
		errorLabel: "Context Error",
		execute: (args) => {
			// args is already without command name (stripped by dispatcher)
			return runContextCLI(args);
		},
	},
	{
		name: "search",
		summary: "Agent-first hybrid lexical + semantic search",
		errorLabel: "Search Error",
		execute: (args) => {
			return runSearchCLI(args);
		},
	},
	{
		name: "index-context",
		summary: "Bulk index governed and supporting context for search",
		errorLabel: "Index Context Error",
		execute: (args) => {
			return runIndexContextCLI(args);
		},
	},
	{
		name: "context-health",
		summary: "Generate advisory context-integrity scorecards",
		errorLabel: "Context Health Error",
		execute: (args) => {
			return runContextHealthCLI(args);
		},
	},
	createInitCommandSpec(),
	...createLearningEvidenceCommandSpecs({
		runLearningsCLI,
		runNorthStarFeedbackCLI,
		runReviewContextCLI,
		runValidationPlanCLI,
	}),
	createUpgradeCommandSpec(),
	createCIMigrateCommandSpec(),
	{
		name: "diff-budget",
		summary: "Enforce diff budget constraints",
		example: "diff-budget --base main --head HEAD --json",
		errorLabel: "Diff Budget Error",
		execute: (args) => {
			const jsonFlag = args.includes("--json");
			const baseIndex = args.indexOf("--base");
			const headIndex = args.indexOf("--head");
			const contractIndex = args.indexOf("--contract");
			const overrideIndex = args.indexOf("--override");

			const options: {
				base?: string;
				head?: string;
				contractPath?: string;
				overridePath?: string;
				json?: boolean;
			} = {};

			if (jsonFlag) options.json = true;
			const baseArg = getFlagValue(args, baseIndex);
			if (baseArg) options.base = baseArg;
			const headArg = getFlagValue(args, headIndex);
			if (headArg) options.head = headArg;
			const contractArg = getFlagValue(args, contractIndex);
			if (contractArg) options.contractPath = contractArg;
			const overrideArg = getFlagValue(args, overrideIndex);
			if (overrideArg) options.overridePath = overrideArg;

			return runDiffBudgetCLI(options);
		},
	},
	{
		name: "pilot-rollback",
		summary: "Roll back pilot to a safe baseline",
		example: "pilot-rollback --mode manual --incident-id INC-42 --json",
		errorLabel: "Pilot Rollback Error",
		execute: (args) => {
			const jsonFlag = args.includes("--json");
			const incidentIndex = args.indexOf("--incident-id");
			const modeIndex = args.indexOf("--mode");
			const contractIndex = args.indexOf("--contract");
			const artifactsIndex = args.indexOf("--artifacts");
			const outputIndex = args.indexOf("--output");
			const markerIndex = args.indexOf("--completion-marker");
			const reasonIndex = args.indexOf("--reason");

			const modeArg = getFlagValue(args, modeIndex);
			if (modeArg !== "autonomous" && modeArg !== "manual") {
				console.error(
					"Error: --mode is required and must be 'autonomous' or 'manual'",
				);
				return 2;
			}

			const options: PilotRollbackOptions = {
				incidentId: getFlagValue(args, incidentIndex) ?? "",
				mode: modeArg,
				json: jsonFlag,
			};

			const contractArg = getFlagValue(args, contractIndex);
			if (contractArg) options.contractPath = contractArg;
			const artifactsArg = getFlagValue(args, artifactsIndex);
			if (artifactsArg) options.artifactsDir = artifactsArg;
			const outputArg = getFlagValue(args, outputIndex);
			if (outputArg) options.outputPath = outputArg;
			const markerArg = getFlagValue(args, markerIndex);
			if (markerArg) options.completionMarkerPath = markerArg;
			const reasonArg = getFlagValue(args, reasonIndex);
			if (reasonArg) options.reason = reasonArg;

			return runPilotRollbackCLI(options);
		},
	},
	{
		name: "pilot-evaluate",
		summary: "Evaluate pilot gate safety criteria",
		example: "pilot-evaluate --artifacts artifacts/ --json",
		errorLabel: "Pilot Evaluate Error",
		execute: (args) => {
			const jsonFlag = args.includes("--json");
			const killSwitchFlag = args.includes("--kill-switch");
			const contractIndex = args.indexOf("--contract");
			const artifactsIndex = args.indexOf("--artifacts");
			const outputIndex = args.indexOf("--output");
			const laneIndex = args.indexOf("--lane");
			const adapterRegistryIndex = args.indexOf("--adapter-registry");
			const metricRegistryIndex = args.indexOf("--metric-registry");
			const docsGateReportIndex = args.indexOf("--docs-gate-report");
			const evaluationModeIndex = args.indexOf("--evaluation-mode");
			const rolloutStageIndex = args.indexOf("--rollout-stage");
			const prTemplateStatusIndex = args.indexOf("--pr-template-status");
			const prTemplateRefIndex = args.indexOf("--pr-template-ref");
			const actorIdIndex = args.indexOf("--actor-id");
			const clientFamilyIndex = args.indexOf("--client-family");
			const providerIdIndex = args.indexOf("--provider-id");
			const modelDescriptorIndex = args.indexOf("--model-descriptor");
			const executionModeIndex = args.indexOf("--execution-mode");
			const operatorTypeIndex = args.indexOf("--operator-type");
			const overrideAuthorizedPrincipalIndex = args.indexOf(
				"--override-authorized-principal",
			);
			const overrideScopeIndex = args.indexOf("--override-scope");
			const overrideReasonIndex = args.indexOf("--override-reason");
			const overrideTicketIndex = args.indexOf("--override-ticket");
			const overrideApprovedByIndex = args.indexOf("--override-approved-by");
			const overrideCreatedAtIndex = args.indexOf("--override-created-at");
			const overrideExpiresAtIndex = args.indexOf("--override-expires-at");

			const artifactsArg = getFlagValue(args, artifactsIndex);
			if (!artifactsArg) {
				console.error("Error: --artifacts is required");
				return 2;
			}

			const options: PilotEvaluateOptions = { artifactsDir: artifactsArg };

			if (jsonFlag) options.json = true;
			if (killSwitchFlag) options.killSwitch = true;
			const contractArg = getFlagValue(args, contractIndex);
			if (contractArg) options.contractPath = contractArg;
			const outputArg = getFlagValue(args, outputIndex);
			if (outputArg) options.outputPath = outputArg;
			const laneArg = getFlagValue(args, laneIndex);
			if (laneArg === "advisory" || laneArg === "health")
				options.lane = laneArg;
			const adapterRegistryArg = getFlagValue(args, adapterRegistryIndex);
			if (adapterRegistryArg) options.adapterRegistryPath = adapterRegistryArg;
			const metricRegistryArg = getFlagValue(args, metricRegistryIndex);
			if (metricRegistryArg) options.metricRegistryPath = metricRegistryArg;
			const docsGateReportArg = getFlagValue(args, docsGateReportIndex);
			if (docsGateReportArg) options.docsGateReportPath = docsGateReportArg;
			const evaluationModeArg = getFlagValue(args, evaluationModeIndex);
			if (
				evaluationModeArg === "local" ||
				evaluationModeArg === "pr" ||
				evaluationModeArg === "merge_group"
			) {
				options.evaluationMode = evaluationModeArg;
			}
			const rolloutStageArg = getFlagValue(args, rolloutStageIndex);
			if (
				rolloutStageArg === "shadow" ||
				rolloutStageArg === "advisory" ||
				rolloutStageArg === "enforced"
			) {
				options.rolloutStage = rolloutStageArg;
			}
			const prTemplateStatusArg = getFlagValue(args, prTemplateStatusIndex);
			if (
				prTemplateStatusArg === "passed" ||
				prTemplateStatusArg === "failed" ||
				prTemplateStatusArg === "missing"
			) {
				options.prTemplateStatus = prTemplateStatusArg;
			}
			const prTemplateRefArg = getFlagValue(args, prTemplateRefIndex);
			if (prTemplateRefArg) options.prTemplateRef = prTemplateRefArg;
			const actorIdArg = getFlagValue(args, actorIdIndex);
			if (actorIdArg) options.actorId = actorIdArg;
			const clientFamilyArg = getFlagValue(args, clientFamilyIndex);
			if (
				clientFamilyArg === "codex" ||
				clientFamilyArg === "claude_family" ||
				clientFamilyArg === "gemini_family" ||
				clientFamilyArg === "kimi_family" ||
				clientFamilyArg === "custom"
			) {
				options.clientFamily = clientFamilyArg;
			}
			const providerIdArg = getFlagValue(args, providerIdIndex);
			if (providerIdArg) options.providerId = providerIdArg;
			const modelDescriptorArg = getFlagValue(args, modelDescriptorIndex);
			if (modelDescriptorArg) options.modelDescriptor = modelDescriptorArg;
			const executionModeArg = getFlagValue(args, executionModeIndex);
			if (
				executionModeArg === "interactive" ||
				executionModeArg === "automation" ||
				executionModeArg === "ci"
			) {
				options.executionMode = executionModeArg;
			}
			const operatorTypeArg = getFlagValue(args, operatorTypeIndex);
			if (
				operatorTypeArg === "human_directed" ||
				operatorTypeArg === "automation" ||
				operatorTypeArg === "autonomous"
			) {
				options.operatorType = operatorTypeArg;
			}
			const overrideAuthorizedPrincipalArg = getFlagValue(
				args,
				overrideAuthorizedPrincipalIndex,
			);
			if (overrideAuthorizedPrincipalArg) {
				options.overrideAuthorizedPrincipal = overrideAuthorizedPrincipalArg;
			}
			const overrideScopeArg = getFlagValue(args, overrideScopeIndex);
			if (
				overrideScopeArg === "advisory_hold" ||
				overrideScopeArg === "temporary_unblock" ||
				overrideScopeArg === "temporary_promote"
			) {
				options.overrideScope = overrideScopeArg;
			}
			const overrideReasonArg = getFlagValue(args, overrideReasonIndex);
			if (overrideReasonArg) options.overrideReason = overrideReasonArg;
			const overrideTicketArg = getFlagValue(args, overrideTicketIndex);
			if (overrideTicketArg) options.overrideTicketRef = overrideTicketArg;
			const overrideApprovedByArg = getFlagValue(args, overrideApprovedByIndex);
			if (overrideApprovedByArg !== undefined) {
				options.overrideApprovedBy = parseCsvList(overrideApprovedByArg);
			}
			const overrideCreatedAtArg = getFlagValue(args, overrideCreatedAtIndex);
			if (overrideCreatedAtArg)
				options.overrideCreatedAt = overrideCreatedAtArg;
			const overrideExpiresAtArg = getFlagValue(args, overrideExpiresAtIndex);
			if (overrideExpiresAtArg)
				options.overrideExpiresAt = overrideExpiresAtArg;

			return runPilotEvaluateCLI(options);
		},
	},
];

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
import { runFitnessCLI } from "../../../commands/fitness.js";
import { runIndexContextCLI } from "../../../commands/index-context.js";
import { runLearningsCLI } from "../../../commands/learnings.js";
import { runNorthStarFeedbackCLI } from "../../../commands/north-star-feedback.js";
import { runPatternScopeCLI } from "../../../commands/pattern-scope.js";
import { runPilotEvaluateCLI } from "../../../commands/pilot-evaluate.js";
import { runPilotRollbackCLI } from "../../../commands/pilot-rollback.js";
import { runReviewContextCLI } from "../../../commands/review-context.js";
import { runSearchCLI } from "../../../commands/search.js";
import {
	runUIExploreCLI,
	runUIFastCLI,
	runUIVerifyCLI,
} from "../../../commands/ui-loop.js";
import { runValidationPlanCLI } from "../../../commands/validation-plan.js";
import { getVersion } from "../../version.js";
import {
	getFlagValue,
	inspectFlagValue,
	parseIntegerArg,
} from "../parse-utils.js";
import { createAgentNativePacketCommandSpecs } from "./agent-native-packet-command-specs.js";
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
import { createDiffBudgetCommandSpec } from "./diff-budget-command-spec.js";
import { createDocsGateCommandSpec } from "./docs-gate-command-spec.js";
import { createDoctorCommandSpec } from "./doctor-command-spec.js";
import { createDriftGateCommandSpec } from "./drift-gate-command-spec.js";
import { createEvidenceVerifyCommandSpec } from "./evidence-verify-command-spec.js";
import { createFeedbackLoopAuditCommandSpec } from "./feedback-loop-audit-command-spec.js";
import { createFitnessCommandSpec } from "./fitness-command-spec.js";
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
import { createPilotEvaluateCommandSpec } from "./pilot-evaluate-command-spec.js";
import { createPilotRollbackCommandSpec } from "./pilot-rollback-command-spec.js";
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
import { createUILoopCommandSpecs } from "./ui-loop-command-specs.js";
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
	...createAgentNativePacketCommandSpecs(),
	createNextCommandSpec(),
	createFitnessCommandSpec(runFitnessCLI),
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
	...createUILoopCommandSpecs({ runUIExploreCLI, runUIVerifyCLI }),
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
	createDiffBudgetCommandSpec(runDiffBudgetCLI),
	createPilotRollbackCommandSpec(runPilotRollbackCLI),
	createPilotEvaluateCommandSpec(runPilotEvaluateCLI),
];

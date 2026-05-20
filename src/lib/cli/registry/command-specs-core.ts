import { runArtifactGateCLI } from "../../../commands/artifact-gate.js";
import { runArtifactRoutineCLI } from "../../../commands/artifact-routine.js";
import { runAutomationRunCLI } from "../../../commands/automation-run.js";
import {
	type BlastRadiusOptions,
	runBlastRadiusCLI,
} from "../../../commands/blast-radius.js";
import { runBrainCLI } from "../../../commands/brain.js";
import {
	runCIMigrateCLI,
	runPromoteModeCLI,
	runSyncBranchProtectionCLI,
} from "../../../commands/ci-migrate.js";
import { runCIOwnershipGateCLI } from "../../../commands/ci-ownership-gate.js";
import { runContextHealthCLI } from "../../../commands/context-health.js";
import { runContextCLI } from "../../../commands/context.js";
import { runContractCLI } from "../../../commands/contract.js";
import { runDiffBudgetCLI } from "../../../commands/diff-budget.js";
import { runEjectCLI } from "../../../commands/eject.js";
import { runGapCaseCLI } from "../../../commands/gap-case.js";
import { runIndexContextCLI } from "../../../commands/index-context.js";
import { runInitCLI, runInteractiveInitCLI } from "../../../commands/init.js";
import { runLearningsCLI } from "../../../commands/learnings.js";
import { runNorthStarFeedbackCLI } from "../../../commands/north-star-feedback.js";
import { runObservabilityGateCLI } from "../../../commands/observability-gate.js";
import { runPatternScopeCLI } from "../../../commands/pattern-scope.js";
import { runPilotEvaluateCLI } from "../../../commands/pilot-evaluate.js";
import {
	type PilotRollbackOptions,
	runPilotRollbackCLI,
} from "../../../commands/pilot-rollback.js";
import { runPlanGateCLI } from "../../../commands/plan-gate.js";
import { runPromptGateCLI } from "../../../commands/prompt-gate.js";
import {
	type RemediateOptions,
	runRemediateCLI,
} from "../../../commands/remediate.js";
import { runReviewContextCLI } from "../../../commands/review-context.js";
import { runSearchCLI } from "../../../commands/search.js";
import {
	printSimulateUsage,
	runSimulateCLI,
} from "../../../commands/simulate.js";
import {
	runUIExploreCLI,
	runUIFastCLI,
	runUIVerifyCLI,
} from "../../../commands/ui-loop.js";
import {
	type HarnessUpgradeOptions,
	runUpgradeCLI,
} from "../../../commands/upgrade.js";
import { runValidationPlanCLI } from "../../../commands/validation-plan.js";
import type { IssueTracker } from "../../init/types.js";
import type { PilotEvaluateOptions } from "../../pilot-evaluation/types.js";
import type { ProjectType } from "../../project-type/types.js";
import { getVersion } from "../../version.js";
import {
	getFlagValue,
	inspectFlagValue,
	parseCsvList,
	parseIntegerArg,
} from "../parse-utils.js";
import { createAuditCommandSpec } from "./audit-command-spec.js";
import { createBrainstormGateCommandSpec } from "./brainstorm-gate-command-spec.js";
import { createBranchProtectCommandSpec } from "./branch-protect-command-spec.js";
import { createCheckAuthzCommandSpec } from "./check-authz-command-spec.js";
import { createCheckCommandSpec } from "./check-command-spec.js";
import { createCheckEnvironmentCommandSpec } from "./check-environment-command-spec.js";
import { createDocsGateCommandSpec } from "./docs-gate-command-spec.js";
import { createDoctorCommandSpec } from "./doctor-command-spec.js";
import { createDriftGateCommandSpec } from "./drift-gate-command-spec.js";
import { createEvidenceVerifyCommandSpec } from "./evidence-verify-command-spec.js";
import { createFleetPlanCommandSpec } from "./fleet-plan-command-spec.js";
import { createGardenerCommandSpec } from "./gardener-command-spec.js";
import { createHealthCommandSpec } from "./health-command-spec.js";
import { createLinearGateCommandSpec } from "./linear-gate-command-spec.js";
import { createLinearCommandSpec } from "./linear-command-spec.js";
import { createLearningEvidenceCommandSpecs } from "./learning-evidence-command-specs.js";
import { createLicenseGateCommandSpec } from "./license-gate-command-spec.js";
import { createLocalMemoryPreflightCommandSpec } from "./local-memory-preflight-command-spec.js";
import { createMemoryGateCommandSpec } from "./memory-gate-command-spec.js";
import { createNextCommandSpec } from "./next-command-spec.js";
import { createOrgAuditCommandSpec } from "./org-audit-command-spec.js";
import { createPolicyGateCommandSpec } from "./policy-gate-command-spec.js";
import { createPresetCommandSpec } from "./preset-command-spec.js";
import { createPrCloseoutCommandSpec } from "./pr-closeout-command-spec.js";
import { createPreflightGateCommandSpec } from "./preflight-gate-command-spec.js";
import { createPrTemplateGateCommandSpec } from "./pr-template-gate-command-spec.js";
import { createReplayCommandSpec } from "./replay-command-spec.js";
import { createReviewGateCommandSpec } from "./review-gate-command-spec.js";
import { createRiskTierCommandSpec } from "./risk-tier-command-spec.js";
import { createRuntimeCardCommandSpec } from "./runtime-card-command-spec.js";
import { createRuleLifecycleGateCommandSpec } from "./rule-lifecycle-gate-command-spec.js";
import { createSilentErrorCommandSpec } from "./silent-error-command-spec.js";
import { createSymphonyCheckCommandSpec } from "./symphony-check-command-spec.js";
import type { CommandSpec } from "./types.js";
import { createToolingAuditCommandSpec } from "./tooling-audit-command-spec.js";
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
	createPresetCommandSpec(),
	createCheckCommandSpec(),
	createNextCommandSpec(),
	createRuntimeCardCommandSpec(),
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
	createGardenerCommandSpec(),
	createMemoryGateCommandSpec(),
	createSilentErrorCommandSpec(),
	createBrainstormGateCommandSpec(),
	{
		name: "brain",
		summary: "Project Brain knowledge and quality management",
		example: "brain status --json",
		errorLabel: "Brain Error",
		execute: (args) => {
			return runBrainCLI(args);
		},
	},
	{
		name: "plan-gate",
		summary: "Validate plan artifacts",
		errorLabel: "Plan Gate Error",
		execute: (args) => {
			const options: {
				plansPath?: string;
				type?: string;
				maxAge?: number;
				requireOrigin?: boolean;
				requirePlanId?: boolean;
				requireAcceptanceEvidence?: boolean;
				requireTraceability?: boolean;
				planIds?: string[];
				prTitle?: string;
				prBody?: string;
				changedFiles?: string[];
				strict?: boolean;
				json?: boolean;
			} = {};

			if (args.includes("--json")) options.json = true;
			if (args.includes("--strict")) options.strict = true;
			if (args.includes("--require-origin")) options.requireOrigin = true;
			if (args.includes("--require-plan-id")) options.requirePlanId = true;
			if (args.includes("--require-acceptance-evidence"))
				options.requireAcceptanceEvidence = true;
			if (args.includes("--require-traceability"))
				options.requireTraceability = true;
			const plansArg = getFlagValue(args, args.indexOf("--plans"));
			if (plansArg) options.plansPath = plansArg;
			const typeArg = getFlagValue(args, args.indexOf("--type"));
			if (typeArg) options.type = typeArg;
			const maxAgeArg = getFlagValue(args, args.indexOf("--max-age"));
			if (maxAgeArg) {
				const parsed = parseIntegerArg(maxAgeArg, 0);
				if (parsed !== undefined) options.maxAge = parsed;
			}
			const planIdsArg = getFlagValue(args, args.indexOf("--plan-ids"));
			if (planIdsArg) options.planIds = parseCsvList(planIdsArg);
			const prTitleArg = getFlagValue(args, args.indexOf("--pr-title"));
			if (prTitleArg) options.prTitle = prTitleArg;
			const prBodyArg = getFlagValue(args, args.indexOf("--pr-body"));
			if (prBodyArg) options.prBody = prBodyArg;
			const changedFilesArg = getFlagValue(
				args,
				args.indexOf("--changed-files"),
			);
			if (changedFilesArg) options.changedFiles = parseCsvList(changedFilesArg);

			return runPlanGateCLI(options);
		},
	},
	{
		name: "prompt-gate",
		summary: "Validate prompt template usage",
		errorLabel: "Prompt Gate Error",
		execute: (args) => {
			const jsonFlag = args.includes("--json");
			const typeArg = getFlagValue(args, args.indexOf("--type"));
			const fileArg = getFlagValue(args, args.indexOf("--file"));

			if (!typeArg) {
				console.error(
					"Error: --type is required (feature|bugfix|refactor|release)",
				);
				return 2;
			}
			if (!fileArg) {
				console.error("Error: --file is required");
				return 2;
			}

			const validTypes = ["feature", "bugfix", "refactor", "release"] as const;
			if (!validTypes.includes(typeArg as (typeof validTypes)[number])) {
				console.error(
					`Error: Invalid type "${typeArg}". Must be one of: ${validTypes.join(", ")}`,
				);
				return 2;
			}

			return runPromptGateCLI({
				type: typeArg as (typeof validTypes)[number],
				file: fileArg,
				json: jsonFlag,
			});
		},
	},
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
	{
		name: "artifact-gate",
		summary:
			"Check generated artifact changes against the artifact provenance registry",
		example: "artifact-gate --files scripts/codex-preflight.sh --json",
		errorLabel: "Artifact Gate Error",
		execute: (args) => {
			const filesFlag = inspectFlagValue(args, "--files");
			const registryFlag = inspectFlagValue(args, "--registry");

			if (filesFlag.missingValue) {
				console.error("Artifact Gate Error: --files requires a value");
				return 2;
			}
			if (registryFlag.missingValue) {
				console.error("Artifact Gate Error: --registry requires a value");
				return 2;
			}

			return runArtifactGateCLI({
				files:
					filesFlag.value !== undefined
						? parseCsvList(filesFlag.value)
						: undefined,
				registryPath: registryFlag.value,
				json: args.includes("--json"),
			});
		},
	},
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
	{
		name: "remediate",
		summary: "Auto-plan and execute deterministic remediation",
		errorLabel: "Remediate Error",
		execute: (args) => {
			// args[0] is the subcommand (command name already stripped by dispatcher)
			const subcommand = args[0];
			if (subcommand !== "run" && subcommand !== "apply") {
				console.error(
					"Error: remediate command requires subcommand `run` or `apply`",
				);
				return 2;
			}

			const ownerIndex = args.indexOf("--owner");
			const repoIndex = args.indexOf("--repo");
			const prIndex = args.indexOf("--pr");
			const shaIndex = args.indexOf("--sha");
			const providerIndex = args.indexOf("--provider");
			const dryRunFlag = args.includes("--dry-run");
			const noInputFlag = args.includes("--no-input");
			const forceFlag = args.includes("--force");
			const jsonFlag = args.includes("--json");
			const maxAutoTierIndex = args.indexOf("--max-auto-tier");
			const modeArgIndex = args.indexOf("--mode");
			const markerIndex = args.indexOf("--completion-marker");
			const contractIndex = args.indexOf("--contract");
			const findingsIndex = args.indexOf("--findings");
			const headShaIndex = args.indexOf("--head-sha");

			const prValue = getFlagValue(args, prIndex);
			const maxAutoTierValue = getFlagValue(args, maxAutoTierIndex);

			const remediateOptions: RemediateOptions = {
				subcommand,
				owner: getFlagValue(args, ownerIndex) ?? "",
				repo: getFlagValue(args, repoIndex) ?? "",
				prNumber: parseIntegerArg(prValue, 1) ?? 0,
				headSha: getFlagValue(args, shaIndex) ?? "",
				provider:
					(getFlagValue(args, providerIndex) as
						| "codeql"
						| "codex"
						| undefined) ?? "codeql",
				dryRun: dryRunFlag,
				noInput: noInputFlag,
				force: forceFlag,
				json: jsonFlag,
			};
			const contractArg = getFlagValue(args, contractIndex);
			if (contractArg) remediateOptions.contractPath = contractArg;
			const findingsArg = getFlagValue(args, findingsIndex);
			if (findingsArg) remediateOptions.findings = findingsArg;
			const headShaArg = getFlagValue(args, headShaIndex);
			if (headShaArg) remediateOptions.headSha = headShaArg;
			const modeValue = getFlagValue(args, modeArgIndex);
			if (modeValue === "manual" || modeValue === "autonomous") {
				remediateOptions.mode = modeValue;
			}
			const markerArg = getFlagValue(args, markerIndex);
			if (markerArg) remediateOptions.completionMarkerPath = markerArg;
			if (
				maxAutoTierValue === "low" ||
				maxAutoTierValue === "medium" ||
				maxAutoTierValue === "high"
			) {
				remediateOptions.maxAutoTier = maxAutoTierValue;
			}

			return runRemediateCLI(remediateOptions);
		},
	},
	{
		name: "observability-gate",
		summary: "Check cardinality limits in metrics",
		errorLabel: "Observability Gate Error",
		execute: (args) => {
			const jsonFlag = args.includes("--json");
			const labelsIndex = args.indexOf("--labels");
			const maxCardIndex = args.indexOf("--max-cardinality");
			const maxLenIndex = args.indexOf("--max-length");

			const options: {
				labels?: string;
				json?: boolean;
				maxCardinality?: number;
				maxLength?: number;
			} = {};

			if (jsonFlag) options.json = true;
			const labelsValue = getFlagValue(args, labelsIndex);
			if (labelsValue) options.labels = labelsValue;
			const cardValue = getFlagValue(args, maxCardIndex);
			if (cardValue) {
				const val = parseIntegerArg(cardValue, 0);
				if (val !== undefined) options.maxCardinality = val;
			}
			const lenValue = getFlagValue(args, maxLenIndex);
			if (lenValue) {
				const val = parseIntegerArg(lenValue, 0);
				if (val !== undefined) options.maxLength = val;
			}

			return runObservabilityGateCLI(options);
		},
	},
	{
		name: "gap-case",
		summary: "Manage production gap cases (open/resolve)",
		errorLabel: "Gap Case Error",
		execute: (args) => {
			const jsonFlag = args.includes("--json");
			const contractIndex = args.indexOf("--contract");
			const storeIndex = args.indexOf("--store");

			// args[0] is the action (command name already stripped by dispatcher)
			const action = args[0] as "open" | "resolve" | undefined;
			if (action !== "open" && action !== "resolve") {
				console.error("Error: action must be 'open' or 'resolve'");
				return 2;
			}

			const incidentIdIndex = args.indexOf("--incident-id");
			const summaryIndex = args.indexOf("--summary");
			const severityIndex = args.indexOf("--severity");
			const ownerIndex = args.indexOf("--owner");
			const providerIndex = args.indexOf("--provider");
			const findingIdIndex = args.indexOf("--finding-id");
			const prNumberIndex = args.indexOf("--pr-number");
			const headShaIndex = args.indexOf("--head-sha");
			const slaHoursIndex = args.indexOf("--sla-hours");
			const caseIdIndex = args.indexOf("--case-id");
			const evidenceUrlIndex = args.indexOf("--evidence-url");
			const fixPrIndex = args.indexOf("--fix-pr");
			const noteIndex = args.indexOf("--note");
			const resolvedByIndex = args.indexOf("--resolved-by");

			const options: {
				action: "open" | "resolve";
				json?: boolean;
				contractPath?: string;
				storePath?: string;
				incidentId?: string;
				summary?: string;
				severity?: string;
				owner?: string;
				provider?: string;
				findingId?: string;
				prNumber?: number;
				headSha?: string;
				slaHours?: number;
				caseId?: string;
				evidenceUrl?: string;
				fixPr?: number;
				note?: string;
				resolvedBy?: string;
			} = { action };

			if (jsonFlag) options.json = true;
			const contractArg = getFlagValue(args, contractIndex);
			if (contractArg) options.contractPath = contractArg;
			const storeArg = getFlagValue(args, storeIndex);
			if (storeArg) options.storePath = storeArg;
			const incidentIdArg = getFlagValue(args, incidentIdIndex);
			if (incidentIdArg) options.incidentId = incidentIdArg;
			const summaryArg = getFlagValue(args, summaryIndex);
			if (summaryArg) options.summary = summaryArg;
			const severityArg = getFlagValue(args, severityIndex);
			if (severityArg) options.severity = severityArg;
			const ownerArg = getFlagValue(args, ownerIndex);
			if (ownerArg) options.owner = ownerArg;
			const providerArg = getFlagValue(args, providerIndex);
			if (providerArg) options.provider = providerArg;
			const findingIdArg = getFlagValue(args, findingIdIndex);
			if (findingIdArg) options.findingId = findingIdArg;
			const prNumberArg = getFlagValue(args, prNumberIndex);
			if (prNumberArg) {
				const parsed = parseIntegerArg(prNumberArg, 1);
				if (parsed !== undefined) options.prNumber = parsed;
			}
			const headShaArg = getFlagValue(args, headShaIndex);
			if (headShaArg) options.headSha = headShaArg;
			const slaHoursArg = getFlagValue(args, slaHoursIndex);
			if (slaHoursArg) {
				const parsed = parseIntegerArg(slaHoursArg, 1);
				if (parsed !== undefined) options.slaHours = parsed;
			}
			const caseIdArg = getFlagValue(args, caseIdIndex);
			if (caseIdArg) options.caseId = caseIdArg;
			const evidenceUrlArg = getFlagValue(args, evidenceUrlIndex);
			if (evidenceUrlArg) options.evidenceUrl = evidenceUrlArg;
			const fixPrArg = getFlagValue(args, fixPrIndex);
			if (fixPrArg) {
				const parsed = parseIntegerArg(fixPrArg, 1);
				if (parsed !== undefined) options.fixPr = parsed;
			}
			const noteArg = getFlagValue(args, noteIndex);
			if (noteArg) options.note = noteArg;
			const resolvedByArg = getFlagValue(args, resolvedByIndex);
			if (resolvedByArg) options.resolvedBy = resolvedByArg;

			return runGapCaseCLI(options);
		},
	},
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
	{
		name: "simulate",
		summary: "Simulate contract transitions between versions",
		errorLabel: "Simulate Error",
		execute: (args) => {
			if (args.includes("--help") || args.includes("-h")) {
				printSimulateUsage();
				return 0;
			}

			const jsonFlag = args.includes("--json");
			const ciSoftFlag = args.includes("--ci-soft");
			const verboseFlag = args.includes("--verbose");

			const contractAIndex = args.indexOf("--contract-a");
			const contractBIndex = args.indexOf("--contract-b");
			const artifactsIndex = args.indexOf("--artifacts");
			const tracesIndex = args.indexOf("--traces");
			const outputIndex = args.indexOf("--output");

			const contractA = getFlagValue(args, contractAIndex);
			const contractB = getFlagValue(args, contractBIndex);

			if (!contractA) {
				console.error("Error: --contract-a is required");
				return 2;
			}
			if (!contractB) {
				console.error("Error: --contract-b is required");
				return 2;
			}

			const options: {
				contractA: string;
				contractB: string;
				artifactsDir?: string;
				tracesDir?: string;
				outputPath?: string;
				json?: boolean;
				ciSoft?: boolean;
				verbose?: boolean;
			} = { contractA, contractB };

			if (jsonFlag) options.json = true;
			if (ciSoftFlag) options.ciSoft = true;
			if (verboseFlag) options.verbose = true;

			const artifactsArg = getFlagValue(args, artifactsIndex);
			if (artifactsArg) options.artifactsDir = artifactsArg;
			const tracesArg = getFlagValue(args, tracesIndex);
			if (tracesArg) options.tracesDir = tracesArg;
			const outputArg = getFlagValue(args, outputIndex);
			if (outputArg) options.outputPath = outputArg;

			return runSimulateCLI(options);
		},
	},
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
	{
		name: "init",
		summary: "Install harness in current directory",
		example: "init [target-dir] [--dry-run] [--json]",
		errorLabel: "Init Error",
		execute: (args) => {
			const dryRunFlag = args.includes("--dry-run");
			const forceFlag = args.includes("--force");
			const trackFlag = args.includes("--track");
			const rollbackFlag = args.includes("--rollback");
			const checkUpdatesFlag = args.includes("--check-updates");
			const updateFlag = args.includes("--update");
			const explainOwnershipFlag = args.includes("--explain-ownership");
			const interactiveFlag = args.includes("--interactive");
			const migrateFlag = args.includes("--migrate");
			const jsonFlag = args.includes("--json");
			const minimalFlag = args.includes("--minimal");

			const projectTypeIndex = args.indexOf("--project-type");
			const projectTypeArg =
				projectTypeIndex !== -1 ? args[projectTypeIndex + 1] : undefined;
			const issueTrackerIndex = args.indexOf("--issue-tracker");
			const issueTrackerArg =
				issueTrackerIndex !== -1 ? args[issueTrackerIndex + 1] : undefined;

			if (minimalFlag) {
				if (issueTrackerArg !== undefined) {
					console.error(
						"Error: --issue-tracker cannot be used with --minimal. Granular options conflict with minimal mode.",
					);
					return 2;
				}
			}
			if (
				issueTrackerArg !== undefined &&
				!["linear", "github", "none"].includes(issueTrackerArg)
			) {
				console.error(
					`Error: Invalid --issue-tracker value: "${issueTrackerArg}". Valid values: linear | github | none.`,
				);
				return 2;
			}
			const issueTracker = issueTrackerArg as IssueTracker | undefined;

			// Find target dir: first non-flag arg, not a value for a named flag
			const targetDir = args.find((arg, i, arr) => {
				if (arg.startsWith("-")) return false;
				const prev = arr[i - 1];
				if (prev === "--project-type" || prev === "--issue-tracker")
					return false;
				return true;
			});

			const options = {
				dryRun: dryRunFlag,
				force: forceFlag,
				track: trackFlag,
				rollback: rollbackFlag,
				checkUpdates: checkUpdatesFlag,
				update: updateFlag,
				explainOwnership: explainOwnershipFlag,
				interactive: interactiveFlag,
				migrate: migrateFlag,
				json: jsonFlag,
				...(minimalFlag ? { minimal: true } : {}),
				...(issueTracker ? { issueTracker } : {}),
				...(projectTypeArg
					? { projectType: projectTypeArg as ProjectType }
					: {}),
			};

			if (interactiveFlag) {
				return runInteractiveInitCLI(targetDir, options);
			}
			return runInitCLI(targetDir, options);
		},
	},
	...createLearningEvidenceCommandSpecs({
		runLearningsCLI,
		runNorthStarFeedbackCLI,
		runReviewContextCLI,
		runValidationPlanCLI,
	}),
	{
		name: "upgrade",
		summary: "Upgrade harness to the latest version",
		errorLabel: "Upgrade Error",
		execute: (args) => {
			const dryRunFlag = args.includes("--dry-run");
			const forceFlag = args.includes("--force");
			const jsonFlag = args.includes("--json");
			const skipContractFlag = args.includes("--skip-contract-migration");
			const providerIndex = args.indexOf("--provider");
			const provider = getFlagValue(args, providerIndex);
			// Skip --provider value when finding targetDir
			const rest = args;
			const targetDir = rest.filter((arg, i) => {
				if (arg.startsWith("-")) return false;
				if (i > 0 && rest[i - 1] === "--provider") return false;
				return true;
			})[0];
			const upgradeOptions: HarnessUpgradeOptions = {
				dryRun: dryRunFlag,
				force: forceFlag,
				json: jsonFlag,
				provider: provider ?? undefined,
				skipContractMigration: skipContractFlag,
			};
			return runUpgradeCLI(targetDir, upgradeOptions);
		},
	},
	{
		name: "ci-migrate",
		summary: "Migrate CI/CD pipelines to harness governance",
		example: "ci-migrate prepare [target-dir] --dry-run --json",
		errorLabel: "CI Migrate Error",
		execute: (args) => {
			const providerIndex = args.indexOf("--provider");
			const snapshotIndex = args.indexOf("--snapshot");
			const actionIndex = args.indexOf("--action");
			const breakGlassApprovalIndex = args.indexOf("--break-glass-approval");
			const mergeQueueEvidenceIndex = args.indexOf("--merge-queue-evidence");
			const mergeQueueOrchestratorIndex = args.indexOf(
				"--merge-queue-orchestrator",
			);
			const commitModeIndex = args.indexOf("--commit-mode");
			const jsonFlag = args.includes("--json");
			const dryRunFlag = args.includes("--dry-run");
			const applyFlag = args.includes("--apply");
			const rollbackFlag = args.includes("--rollback");
			const autoGenerateProofPackFlag = args.includes(
				"--auto-generate-proof-pack",
			);
			const forceFlag = args.includes("--force");
			const valueFlags = new Set([
				"--provider",
				"--snapshot",
				"--action",
				"--break-glass-approval",
				"--merge-queue-evidence",
				"--merge-queue-orchestrator",
				"--commit-mode",
			]);
			const positionalArgs: string[] = [];
			// args[0] is already the first arg after command name (stripped by dispatcher)
			for (let index = 0; index < args.length; index++) {
				const token = args[index];
				if (!token) continue;
				if (token.startsWith("--")) {
					if (valueFlags.has(token)) {
						const nextToken = args[index + 1];
						if (nextToken && !nextToken.startsWith("-")) {
							index += 1;
						}
					}
					continue;
				}
				if (token.startsWith("-")) continue;
				positionalArgs.push(token);
			}

			const validActions = new Set([
				"prepare",
				"commit",
				"abort",
				"verify",
				"bootstrap",
				"sync-branch-protection",
				"promote-mode",
			]);
			const actionArg = getFlagValue(args, actionIndex);
			let parsedAction = actionArg;
			if (
				!parsedAction &&
				positionalArgs[0] &&
				validActions.has(positionalArgs[0])
			) {
				parsedAction = positionalArgs.shift();
			}
			if (positionalArgs.length > 1) {
				console.error(
					"Error: ci-migrate accepts at most one target directory positional argument.",
				);
				return 2;
			}
			const targetDir = positionalArgs[0];

			// Build clean args for delegated helpers: exclude --action flag/value
			const delegatedArgs = (() => {
				if (actionArg && actionIndex >= 0) {
					const filtered = [...args];
					filtered.splice(actionIndex, 2); // remove --action and its value
					return filtered;
				}
				// Positional action: skip the action token at args[0]
				return args.slice(1);
			})();

			if (parsedAction === "sync-branch-protection") {
				return runSyncBranchProtectionCLI(targetDir, delegatedArgs);
			}
			if (parsedAction === "promote-mode") {
				return runPromoteModeCLI(targetDir, delegatedArgs);
			}

			const provider = getFlagValue(args, providerIndex);
			const snapshot = getFlagValue(args, snapshotIndex);
			const breakGlassApprovalPath = getFlagValue(
				args,
				breakGlassApprovalIndex,
			);
			const mergeQueueEvidencePath = getFlagValue(
				args,
				mergeQueueEvidenceIndex,
			);
			const mergeQueueOrchestratorPath = getFlagValue(
				args,
				mergeQueueOrchestratorIndex,
			);
			const commitModeRaw = getFlagValue(args, commitModeIndex);
			const commitMode =
				commitModeRaw === "solo" || commitModeRaw === "enterprise"
					? commitModeRaw
					: undefined;

			return runCIMigrateCLI(targetDir, {
				provider,
				dryRun: dryRunFlag,
				...(jsonFlag ? { json: true } : {}),
				apply: applyFlag,
				rollback: rollbackFlag,
				snapshot,
				action: parsedAction,
				breakGlassApprovalPath,
				mergeQueueEvidencePath,
				mergeQueueOrchestratorPath,
				autoGenerateProofPack: autoGenerateProofPackFlag,
				commitMode,
				force: forceFlag,
			});
		},
	},
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

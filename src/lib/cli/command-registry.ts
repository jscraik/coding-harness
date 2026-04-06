import { runAutomationRunCLI } from "../../commands/automation-run.js";
import {
	type BlastRadiusOptions,
	runBlastRadiusCLI,
} from "../../commands/blast-radius.js";
import { runBrainstormGateCLI } from "../../commands/brainstorm-gate.js";
import { runBranchProtectCLI } from "../../commands/branch-protect.js";
import { runCheckAuthzCLI } from "../../commands/check-authz.js";
import { runCheckEnvironmentCLI } from "../../commands/check-environment.js";
import { runContextHealthCLI } from "../../commands/context-health.js";
import { runContextCLI } from "../../commands/context.js";
import { runContractCLI } from "../../commands/contract.js";
import { runDocsGateCLI } from "../../commands/docs-gate.js";
import { runDoctorCLI } from "../../commands/doctor.js";
import { runDriftGateCLI } from "../../commands/drift-gate.js";
import { runEjectCLI } from "../../commands/eject.js";
import { runEvidenceVerifyCLI } from "../../commands/evidence-verify.js";
import { runGapCaseCLI } from "../../commands/gap-case.js";
import { runGardenerCLI } from "../../commands/gardener.js";
import { runHealthCLI } from "../../commands/health.js";
import { runIndexContextCLI } from "../../commands/index-context.js";
import { runLicenseGateCLI } from "../../commands/license-gate.js";
import { runLinearGateCLI } from "../../commands/linear-gate.js";
import { runLinearPrepareCLI } from "../../commands/linear-prepare.js";
import { runLinearSyncCLI } from "../../commands/linear-sync.js";
import { runLinearWorkflowCLI } from "../../commands/linear-workflow.js";
import {
	EXIT_CODES as LOCAL_MEMORY_PREFLIGHT_EXIT_CODES,
	runLocalMemoryPreflightCLI,
} from "../../commands/local-memory-preflight.js";
import { runMemoryGateCLI } from "../../commands/memory-gate.js";
import { runObservabilityGateCLI } from "../../commands/observability-gate.js";
import { runOrgAuditCLI } from "../../commands/org-audit.js";
import { runPlanGateCLI } from "../../commands/plan-gate.js";
import { runPolicyGateCLI } from "../../commands/policy-gate.js";
import { runPrTemplateGateCLI } from "../../commands/pr-template-gate.js";
import { runPreflightGateCLI } from "../../commands/preflight-gate.js";
import { runPresetCLI } from "../../commands/preset.js";
import { runPromptGateCLI } from "../../commands/prompt-gate.js";
import {
	type RemediateOptions,
	runRemediateCLI,
} from "../../commands/remediate.js";
import { runReplayCLI } from "../../commands/replay.js";
import { runReviewGateCLI } from "../../commands/review-gate.js";
import { runRiskTierCLI } from "../../commands/risk-tier.js";
import { runSearchCLI } from "../../commands/search.js";
import { runSilentErrorDetectorCLI } from "../../commands/silent-error.js";
import { printSimulateUsage, runSimulateCLI } from "../../commands/simulate.js";
import { runSymphonyCheckCLI } from "../../commands/symphony-check.js";
import { runToolingAuditCLI } from "../../commands/tooling-audit.js";
import {
	runUIExploreCLI,
	runUIFastCLI,
	runUIVerifyCLI,
} from "../../commands/ui-loop.js";
import { runVerifyCodeRabbitCLI } from "../../commands/verify-coderabbit.js";
import { runWorkflowGenerateCLI } from "../../commands/workflow-generate.js";
import { getVersion } from "../version.js";
import {
	getFlagValue,
	inspectFlagValue,
	parseCsvList,
	parseIntegerArg,
} from "./parse-utils.js";

export interface CommandSpec {
	name: string;
	aliases?: string[];
	summary: string;
	errorLabel: string;
	execute: (args: string[]) => number | Promise<number>;
}

export interface RegistryDispatchResult {
	spec: CommandSpec;
	result: number | Promise<number>;
}

const COMMAND_SPECS: CommandSpec[] = [
	{
		name: "linear",
		summary:
			"Prepare Linear branch/PR metadata, manage workflow transitions, and sync findings",
		errorLabel: "Linear Workflow Error",
		execute: (args) => {
			const action = args[0];
			if (
				action !== "claim" &&
				action !== "handoff" &&
				action !== "close" &&
				action !== "prepare" &&
				action !== "sync"
			) {
				console.error(
					"linear expects an action of claim, handoff, close, prepare, or sync.",
				);
				return 1;
			}

			const jsonFlag = args.includes("--json");
			const noAssignFlag = args.includes("--no-assign");
			const dryRunFlag = args.includes("--dry-run");
			const issueIndex = args.indexOf("--issue");
			const tokenIndex = args.indexOf("--token");
			const teamIndex = args.indexOf("--team");
			const findingsIndex = args.indexOf("--findings");
			const stateIndex = args.indexOf("--state");
			const assigneeIndex = args.indexOf("--assignee");
			const commentIndex = args.indexOf("--comment");
			const branchIndex = args.indexOf("--branch");
			const workspaceIndex = args.indexOf("--workspace");
			const prUrlIndex = args.indexOf("--pr-url");
			const evidenceUrlIndex = args.indexOf("--evidence-url");
			const linksIndex = args.indexOf("--links");
			const branchPrefixIndex = args.indexOf("--branch-prefix");
			const fieldIndex = args.indexOf("--field");

			if (action === "sync") {
				const syncOptions: Parameters<typeof runLinearSyncCLI>[0] = {};
				if (jsonFlag) syncOptions.json = true;
				if (dryRunFlag) syncOptions.dryRun = true;
				const tokenArg = getFlagValue(args, tokenIndex);
				if (tokenArg) syncOptions.token = tokenArg;
				const teamArg = getFlagValue(args, teamIndex);
				if (teamArg) syncOptions.team = teamArg;
				const findingsArg = getFlagValue(args, findingsIndex);
				if (findingsArg) syncOptions.findings = findingsArg;
				return runLinearSyncCLI(syncOptions);
			}

			if (action === "prepare") {
				const options: Parameters<typeof runLinearPrepareCLI>[0] = {};
				if (jsonFlag) options.json = true;
				const issueArg = getFlagValue(args, issueIndex);
				if (issueArg) options.issue = issueArg;
				const tokenArg = getFlagValue(args, tokenIndex);
				if (tokenArg) options.token = tokenArg;
				const teamArg = getFlagValue(args, teamIndex);
				if (teamArg) options.team = teamArg;
				const branchPrefixArg = getFlagValue(args, branchPrefixIndex);
				if (branchPrefixArg) options.branchPrefix = branchPrefixArg;
				const fieldArg = getFlagValue(args, fieldIndex);
				if (
					fieldArg === "branch" ||
					fieldArg === "pr-title" ||
					fieldArg === "pr-body" ||
					fieldArg === "link-line" ||
					fieldArg === "closing-line" ||
					fieldArg === "issue-url"
				) {
					options.field = fieldArg;
				}
				return runLinearPrepareCLI(options);
			}

			const options: Parameters<typeof runLinearWorkflowCLI>[0] = {
				action,
			};

			if (jsonFlag) options.json = true;
			if (noAssignFlag) options.noAssign = true;
			const issueArg = getFlagValue(args, issueIndex);
			if (issueArg) options.issue = issueArg;
			const tokenArg = getFlagValue(args, tokenIndex);
			if (tokenArg) options.token = tokenArg;
			const teamArg = getFlagValue(args, teamIndex);
			if (teamArg) options.team = teamArg;
			const stateArg = getFlagValue(args, stateIndex);
			if (stateArg) options.state = stateArg;
			const assigneeArg = getFlagValue(args, assigneeIndex);
			if (assigneeArg) options.assignee = assigneeArg;
			const commentArg = getFlagValue(args, commentIndex);
			if (commentArg) options.comment = commentArg;
			const branchArg = getFlagValue(args, branchIndex);
			if (branchArg) options.branch = branchArg;
			const workspaceArg = getFlagValue(args, workspaceIndex);
			if (workspaceArg) options.workspace = workspaceArg;
			const prUrlArg = getFlagValue(args, prUrlIndex);
			if (prUrlArg) options.prUrl = prUrlArg;
			const evidenceUrlArg = getFlagValue(args, evidenceUrlIndex);
			if (evidenceUrlArg !== undefined) {
				options.evidenceUrls = parseCsvList(evidenceUrlArg);
			}
			const linksArg = getFlagValue(args, linksIndex);
			if (linksArg !== undefined) {
				options.links = parseCsvList(linksArg);
			}

			return runLinearWorkflowCLI(options);
		},
	},
	{
		name: "linear-gate",
		summary: "Enforce Linear-first intake, branch, and PR linkage policy",
		errorLabel: "Linear Gate Error",
		execute: (args) => {
			const jsonFlag = args.includes("--json");
			const allowMissingBranchFlag = args.includes("--allow-missing-branch");
			const allowMissingPrMetadataFlag = args.includes("--allow-missing-pr");
			const contractIndex = args.indexOf("--contract");
			const repoRootIndex = args.indexOf("--repo-root");
			const branchIndex = args.indexOf("--branch");
			const prTitleIndex = args.indexOf("--pr-title");
			const prBodyIndex = args.indexOf("--pr-body");

			const options: Parameters<typeof runLinearGateCLI>[0] = {};

			if (jsonFlag) options.json = true;
			if (allowMissingBranchFlag) options.allowMissingBranch = true;
			if (allowMissingPrMetadataFlag) options.allowMissingPrMetadata = true;
			const contractArg = getFlagValue(args, contractIndex);
			if (contractArg !== undefined) options.contractPath = contractArg;
			const repoRootArg = getFlagValue(args, repoRootIndex);
			if (repoRootArg) options.repoRoot = repoRootArg;
			const branchArg = getFlagValue(args, branchIndex);
			if (branchArg) options.branch = branchArg;
			const prTitleArg = getFlagValue(args, prTitleIndex);
			if (prTitleArg !== undefined) options.prTitle = prTitleArg;
			const prBodyArg = getFlagValue(args, prBodyIndex);
			if (prBodyArg !== undefined) options.prBody = prBodyArg;

			return runLinearGateCLI(options);
		},
	},
	{
		name: "pr-template-gate",
		aliases: ["pr-template-check"],
		summary:
			"Validate PR template completion and placeholder replacement before merge",
		errorLabel: "PR Template Gate Error",
		execute: (args) => {
			const jsonFlag = args.includes("--json");
			const prBodyIndex = args.indexOf("--pr-body");
			const prBodyFileIndex = args.indexOf("--pr-body-file");

			const options: Parameters<typeof runPrTemplateGateCLI>[0] = {};

			if (jsonFlag) options.json = true;
			const prBodyArg = getFlagValue(args, prBodyIndex);
			if (prBodyArg !== undefined) options.prBody = prBodyArg;
			const prBodyFileArg = getFlagValue(args, prBodyFileIndex);
			if (prBodyFileArg !== undefined) options.prBodyFile = prBodyFileArg;

			return runPrTemplateGateCLI(options);
		},
	},
	{
		name: "policy-gate",
		aliases: ["risk-policy-gate"],
		summary:
			"Validate policy expectations from changed files (alias: risk-policy-gate)",
		errorLabel: "Policy Gate Error",
		execute: (args) => {
			const jsonFlag = args.includes("--json");
			const contractIndex = args.indexOf("--contract");
			const filesIndex = args.indexOf("--files");
			const maxTierIndex = args.indexOf("--max-tier");

			const options: Parameters<typeof runPolicyGateCLI>[0] = {
				contractPath: "harness.contract.json",
				files: [],
			};

			if (jsonFlag) options.json = true;
			const contractArg = getFlagValue(args, contractIndex);
			if (contractArg !== undefined) options.contractPath = contractArg;
			const filesArg = getFlagValue(args, filesIndex);
			if (filesArg) {
				options.files = parseCsvList(filesArg);
			}
			const maxTierArg = getFlagValue(args, maxTierIndex);
			if (
				maxTierArg === "high" ||
				maxTierArg === "medium" ||
				maxTierArg === "low"
			) {
				options.maxTier = maxTierArg;
			}

			return runPolicyGateCLI(options);
		},
	},
	{
		name: "evidence-verify",
		summary: "Verify evidence files (screenshots)",
		errorLabel: "Evidence Verify Error",
		execute: (args) => {
			const jsonFlag = args.includes("--json");
			const filesIndex = args.indexOf("--files");
			const contractIndex = args.indexOf("--contract");
			const changedIndex = args.indexOf("--changed");

			const files: string[] = [];
			const filesArg = getFlagValue(args, filesIndex);
			files.push(...parseCsvList(filesArg));

			const contractArg = getFlagValue(args, contractIndex);

			const changedFiles: string[] = [];
			const changedArg = getFlagValue(args, changedIndex);
			changedFiles.push(...parseCsvList(changedArg));

			return runEvidenceVerifyCLI({
				files,
				contract: contractArg,
				json: jsonFlag,
				changed: changedFiles.length > 0 ? changedFiles : undefined,
			});
		},
	},
	{
		name: "preflight-gate",
		summary: "Fast policy checks before expensive operations",
		errorLabel: "Preflight Gate Error",
		execute: (args) => {
			const jsonFlag = args.includes("--json");
			const strictFlag = args.includes("--strict");
			const contractIndex = args.indexOf("--contract");
			const filesIndex = args.indexOf("--files");
			const maxTierIndex = args.indexOf("--max-tier");
			const skipIndex = args.indexOf("--skip");
			const headShaIndex = args.indexOf("--head-sha");

			const options: Parameters<typeof runPreflightGateCLI>[0] = {};

			if (jsonFlag) options.json = true;
			if (strictFlag) options.strict = true;
			const contractArg = getFlagValue(args, contractIndex);
			if (contractArg !== undefined) {
				options.contractPath = contractArg;
			}
			const filesArg = getFlagValue(args, filesIndex);
			if (filesArg !== undefined) {
				options.files = parseCsvList(filesArg);
			}
			const maxTierArg = getFlagValue(args, maxTierIndex);
			if (
				maxTierArg === "high" ||
				maxTierArg === "medium" ||
				maxTierArg === "low"
			) {
				options.maxTier = maxTierArg;
			}
			const skipArg = getFlagValue(args, skipIndex);
			if (skipArg !== undefined) {
				options.skip = parseCsvList(skipArg);
			}
			const headShaArg = getFlagValue(args, headShaIndex);
			if (headShaArg) {
				options.headSha = headShaArg;
			}

			return runPreflightGateCLI(options);
		},
	},
	{
		name: "review-gate",
		summary: "Review gate with SHA enforcement",
		errorLabel: "Review Gate Error",
		execute: (args) => {
			const jsonFlag = args.includes("--json");
			const tokenIndex = args.indexOf("--token");
			const ownerIndex = args.indexOf("--owner");
			const repoIndex = args.indexOf("--repo");
			const prIndex = args.indexOf("--pr");
			const shaIndex = args.indexOf("--sha");
			const checkIndex = args.indexOf("--check");
			const botLoginIndex = args.indexOf("--bot-login");
			const autoResolveBotThreadsFlag = args.includes(
				"--auto-resolve-bot-threads",
			);
			const contractIndex = args.indexOf("--contract");

			const options: Parameters<typeof runReviewGateCLI>[0] = {
				token: "",
				owner: "",
				repo: "",
				prNumber: 0,
				headSha: "",
				checkName: "code-review",
				contractPath: "harness.contract.json",
			};

			if (jsonFlag) options.json = true;
			const tokenArg = getFlagValue(args, tokenIndex);
			if (tokenArg) options.token = tokenArg;
			const ownerArg = getFlagValue(args, ownerIndex);
			if (ownerArg) options.owner = ownerArg;
			const repoArg = getFlagValue(args, repoIndex);
			if (repoArg) options.repo = repoArg;
			const prArg = getFlagValue(args, prIndex);
			if (prArg) {
				const parsedPr = parseIntegerArg(prArg, 1);
				if (parsedPr !== undefined) options.prNumber = parsedPr;
			}
			const shaArg = getFlagValue(args, shaIndex);
			if (shaArg) options.headSha = shaArg;
			const checkArg = getFlagValue(args, checkIndex);
			if (checkArg) options.checkName = checkArg;
			const botLoginArg = getFlagValue(args, botLoginIndex);
			if (botLoginArg) options.botLogin = botLoginArg;
			if (autoResolveBotThreadsFlag) options.autoResolveBotThreads = true;
			const contractArg = getFlagValue(args, contractIndex);
			if (contractArg !== undefined) options.contractPath = contractArg;

			return runReviewGateCLI(options);
		},
	},
	{
		name: "branch-protect",
		summary: "Configure GitHub branch protection ruleset",
		errorLabel: "Branch Protect Error",
		execute: (args) => {
			const jsonFlag = args.includes("--json");
			const dryRunFlag = args.includes("--dry-run");
			const tokenIndex = args.indexOf("--token");
			const ownerIndex = args.indexOf("--owner");
			const repoIndex = args.indexOf("--repo");
			const branchIndex = args.indexOf("--branch");
			const rulesetIndex = args.indexOf("--ruleset");
			const checksIndex = args.indexOf("--checks");
			const ecosystemIndex = args.indexOf("--ecosystem");
			const approvalsIndex = args.indexOf("--required-approvals");
			const checksArg = getFlagValue(args, checksIndex);
			const approvalsArg = getFlagValue(args, approvalsIndex);

			const options: Parameters<typeof runBranchProtectCLI>[0] = {};

			if (jsonFlag) options.json = true;
			if (dryRunFlag) options.dryRun = true;
			const tokenArg = getFlagValue(args, tokenIndex);
			if (tokenArg) options.token = tokenArg;
			const ownerArg = getFlagValue(args, ownerIndex);
			if (ownerArg) options.owner = ownerArg;
			const repoArg = getFlagValue(args, repoIndex);
			if (repoArg) options.repo = repoArg;
			const branchArg = getFlagValue(args, branchIndex);
			if (branchArg) options.branch = branchArg;
			const rulesetArg = getFlagValue(args, rulesetIndex);
			if (rulesetArg) options.rulesetName = rulesetArg;
			const ecosystemArg = getFlagValue(args, ecosystemIndex);
			if (ecosystemArg) options.ecosystem = ecosystemArg;
			if (checksArg !== undefined) {
				options.requiredChecks = parseCsvList(checksArg);
			}
			if (approvalsIndex !== -1) {
				const parsedApprovals = parseIntegerArg(approvalsArg, 0);
				if (parsedApprovals === undefined) {
					console.error("--required-approvals expects a non-negative integer.");
					return 1;
				}
				options.requiredApprovingReviewCount = parsedApprovals;
			}

			return runBranchProtectCLI(options);
		},
	},
	{
		name: "check-authz",
		summary: "Validate authorization policy for mutative operations",
		errorLabel: "Check Authz Error",
		execute: (args) => {
			const jsonFlag = args.includes("--json");
			const checkScopesFlag = args.includes("--check-scopes");
			const contractIndex = args.indexOf("--contract");
			const repoIndex = args.indexOf("--repo");
			const branchIndex = args.indexOf("--branch");

			const options: Parameters<typeof runCheckAuthzCLI>[0] = {};

			if (jsonFlag) options.json = true;
			if (checkScopesFlag) options.checkScopes = true;
			const contractArg = getFlagValue(args, contractIndex);
			if (contractArg !== undefined) options.contractPath = contractArg;
			const repoArg = getFlagValue(args, repoIndex);
			if (repoArg) options.repo = repoArg;
			const branchArg = getFlagValue(args, branchIndex);
			if (branchArg) options.branch = branchArg;

			return runCheckAuthzCLI(options);
		},
	},
	{
		name: "check-environment",
		summary: "Validate pilot environment governance checks",
		errorLabel: "Check Environment Error",
		execute: (args) => {
			const jsonFlag = args.includes("--json");
			const checkSecretsFlag = args.includes("--check-secrets");
			const contractIndex = args.indexOf("--contract");
			const attestationIndex = args.indexOf("--attestation");
			const allowedSandboxIndex = args.indexOf("--allowed-sandbox");

			const options: Parameters<typeof runCheckEnvironmentCLI>[0] = {};

			if (jsonFlag) options.json = true;
			if (checkSecretsFlag) options.checkSecrets = true;
			const contractArg = getFlagValue(args, contractIndex);
			if (contractArg !== undefined) options.contractPath = contractArg;
			const attestationArg = getFlagValue(args, attestationIndex);
			if (attestationArg) options.attestationPath = attestationArg;
			const allowedSandboxArg = getFlagValue(args, allowedSandboxIndex);
			if (allowedSandboxArg) {
				options.allowedSandboxModes = parseCsvList(allowedSandboxArg);
			}

			return runCheckEnvironmentCLI(options);
		},
	},
	{
		name: "local-memory-preflight",
		summary: "Run the structured Local Memory preflight smoke checks",
		errorLabel: "Local Memory Preflight Error",
		execute: (args) => {
			const jsonFlag = args.includes("--json");
			const configFlag = inspectFlagValue(args, "--config");
			const daemonLogFlag = inspectFlagValue(args, "--daemon-log");

			const options: Parameters<typeof runLocalMemoryPreflightCLI>[0] = {};

			if (configFlag.missingValue) {
				console.error("Error: --config requires a path");
				return LOCAL_MEMORY_PREFLIGHT_EXIT_CODES.USAGE_ERROR;
			}
			if (daemonLogFlag.missingValue) {
				console.error("Error: --daemon-log requires a path");
				return LOCAL_MEMORY_PREFLIGHT_EXIT_CODES.USAGE_ERROR;
			}
			if (jsonFlag) options.json = true;
			if (configFlag.value !== undefined) options.configPath = configFlag.value;
			if (daemonLogFlag.value !== undefined) {
				options.daemonLogPath = daemonLogFlag.value;
			}

			return runLocalMemoryPreflightCLI(options);
		},
	},
	{
		name: "docs-gate",
		summary: "Enforce documentation parity for governance changes",
		errorLabel: "Docs Gate Error",
		execute: (args) => {
			const jsonFlag = args.includes("--json");
			const modeIndex = args.indexOf("--mode");
			const triggerIndex = args.indexOf("--trigger");
			const outIndex = args.indexOf("--out");
			const filesIndex = args.indexOf("--files");
			const repoRootIndex = args.indexOf("--repo-root");
			const trustedBaseRefIndex = args.indexOf("--trusted-base-ref");
			const trustedContractShaIndex = args.indexOf("--trusted-contract-sha");
			const trustedWorkflowShaIndex = args.indexOf("--trusted-workflow-sha");
			const mergeQueueTargetRefIndex = args.indexOf("--merge-queue-target-ref");
			const mergeQueueBaseShaIndex = args.indexOf("--merge-queue-base-sha");

			const options: Parameters<typeof runDocsGateCLI>[0] = {};

			if (jsonFlag) options.json = true;
			const modeArg = getFlagValue(args, modeIndex);
			if (modeArg === "advisory" || modeArg === "required") {
				options.mode = modeArg;
			}
			const triggerArg = getFlagValue(args, triggerIndex);
			if (
				triggerArg === "local" ||
				triggerArg === "pull_request" ||
				triggerArg === "merge_group" ||
				triggerArg === "manual_ci"
			) {
				options.trigger = triggerArg;
			}
			const outArg = getFlagValue(args, outIndex);
			if (outArg !== undefined) options.outPath = outArg;
			const filesArg = getFlagValue(args, filesIndex);
			if (filesArg !== undefined) {
				options.changedFiles = parseCsvList(filesArg);
			}
			const repoRootArg = getFlagValue(args, repoRootIndex);
			if (repoRootArg) options.repoRoot = repoRootArg;
			const trustedBaseRefArg = getFlagValue(args, trustedBaseRefIndex);
			if (trustedBaseRefArg !== undefined)
				options.trustedBaseRef = trustedBaseRefArg;
			const trustedContractShaArg = getFlagValue(args, trustedContractShaIndex);
			if (trustedContractShaArg !== undefined)
				options.trustedContractSha = trustedContractShaArg;
			const trustedWorkflowShaArg = getFlagValue(args, trustedWorkflowShaIndex);
			if (trustedWorkflowShaArg !== undefined)
				options.trustedWorkflowSha = trustedWorkflowShaArg;
			const mergeQueueTargetRefArg = getFlagValue(
				args,
				mergeQueueTargetRefIndex,
			);
			if (mergeQueueTargetRefArg !== undefined)
				options.mergeQueueTargetRef = mergeQueueTargetRefArg;
			const mergeQueueBaseShaArg = getFlagValue(args, mergeQueueBaseShaIndex);
			if (mergeQueueBaseShaArg !== undefined)
				options.mergeQueueBaseSha = mergeQueueBaseShaArg;

			return runDocsGateCLI(options);
		},
	},
	{
		name: "license-gate",
		aliases: ["license-check"],
		summary: "Validate open-source license (MIT, Apache-2.0, etc.)",
		errorLabel: "License Gate Error",
		execute: (args) => {
			const jsonFlag = args.includes("--json");
			const repoRootIndex = args.indexOf("--repo-root");
			const allowedIndex = args.indexOf("--allowed");
			const requireOsiFlag = args.includes("--require-osi");
			const noCopyleftFlag = args.includes("--no-copyleft");

			const options: Parameters<typeof runLicenseGateCLI>[0] = {};

			if (jsonFlag) options.json = true;
			if (requireOsiFlag) options.requireOsiApproved = true;
			if (noCopyleftFlag) options.allowCopyleft = false;
			const repoRootArg = getFlagValue(args, repoRootIndex);
			if (repoRootArg) options.repoRoot = repoRootArg;
			const allowedArg = getFlagValue(args, allowedIndex);
			if (allowedArg !== undefined) {
				options.allowedLicenses = parseCsvList(allowedArg);
			}

			return runLicenseGateCLI(options);
		},
	},
	{
		name: "symphony-check",
		aliases: ["symphony:check"],
		summary:
			"Validate Symphony readiness (WORKFLOW.md, Linear config, transition table)",
		errorLabel: "Symphony Check Error",
		execute: (args) => {
			const jsonFlag = args.includes("--json");
			const repoRootIndex = args.indexOf("--repo-root");
			const workflowIndex = args.indexOf("--workflow");
			const envFileIndex = args.indexOf("--env-file");

			const options: Parameters<typeof runSymphonyCheckCLI>[0] = {};

			if (jsonFlag) options.json = true;
			const repoRootArg = getFlagValue(args, repoRootIndex);
			if (repoRootArg) options.repoRoot = repoRootArg;
			const workflowArg = getFlagValue(args, workflowIndex);
			if (workflowArg) options.workflowPath = workflowArg;
			const envFileArg = getFlagValue(args, envFileIndex);
			if (envFileArg) options.envFilePath = envFileArg;

			return runSymphonyCheckCLI(options);
		},
	},
	{
		name: "workflow:generate",
		aliases: ["workflow-generate"],
		summary:
			"Generate compact operational spec (S/E/G/A/P/R/N format) from annotated markdown",
		errorLabel: "Workflow Generate Error",
		execute: (args) => {
			const jsonFlag = args.includes("--json");
			const dryRunFlag = args.includes("--dry-run");
			const watchFlag = args.includes("--watch");
			const sourceIndex = args.indexOf("--source");
			const outputIndex = args.indexOf("--output");
			const formatIndex = args.indexOf("--format");

			const options: Parameters<typeof runWorkflowGenerateCLI>[0] = {};

			if (jsonFlag) options.json = true;
			if (dryRunFlag) options.dryRun = true;
			if (watchFlag) options.watch = true;
			const sourceArg = getFlagValue(args, sourceIndex);
			if (sourceArg) options.source = sourceArg;
			const outputArg = getFlagValue(args, outputIndex);
			if (outputArg) options.output = outputArg;
			const formatArg = getFlagValue(args, formatIndex);
			if (formatArg === "segarn" || formatArg === "segaprn")
				options.format = formatArg;

			return runWorkflowGenerateCLI(options);
		},
	},
	{
		name: "org-audit",
		summary: "Audit GitHub org settings and member permissions",
		errorLabel: "Org Audit Error",
		execute: async (args) => {
			const { exitCode } = await runOrgAuditCLI(args);
			return exitCode;
		},
	},
	{
		name: "tooling-audit",
		summary: "Audit installed tooling versions and configuration health",
		errorLabel: "Tooling Audit Error",
		execute: async (args) => {
			const { exitCode } = await runToolingAuditCLI(args);
			return exitCode;
		},
	},
	{
		name: "preset",
		summary: "List and show bundled harness presets",
		errorLabel: "Preset Error",
		execute: async (args) => {
			const { exitCode } = await runPresetCLI(args);
			return exitCode;
		},
	},
	{
		name: "doctor",
		summary: "Diagnose harness installation and environment issues",
		errorLabel: "Doctor Error",
		execute: (args) => {
			return runDoctorCLI(args, getVersion);
		},
	},
	{
		name: "health",
		summary: "Quick health check for harness services and configuration",
		errorLabel: "Health Error",
		execute: (args) => {
			return runHealthCLI(args, getVersion);
		},
	},
	{
		name: "eject",
		summary: "Eject harness files from the target repository",
		errorLabel: "Eject Error",
		execute: async (args) => {
			const forceFlag = args.includes("--force");
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
	{
		name: "verify-coderabbit",
		summary: "Verify CodeRabbit configuration and review settings",
		errorLabel: "Verify CodeRabbit Error",
		execute: async (args) => {
			const jsonFlag = args.includes("--json");
			const verboseFlag = args.includes("--verbose");
			const ownerIndex = args.indexOf("--owner");
			const repoIndex = args.indexOf("--repo");
			const repoPathIndex = args.indexOf("--repo-path");
			const tokenIndex = args.indexOf("--token");

			const options: Parameters<typeof runVerifyCodeRabbitCLI>[0] = {};
			if (jsonFlag) options.json = true;
			if (verboseFlag) options.verbose = true;
			const ownerArg = getFlagValue(args, ownerIndex);
			if (ownerArg) options.owner = ownerArg;
			const repoArg = getFlagValue(args, repoIndex);
			if (repoArg) options.repo = repoArg;
			const repoPathArg = getFlagValue(args, repoPathIndex);
			if (repoPathArg) options.repoPath = repoPathArg;
			const tokenArg = getFlagValue(args, tokenIndex);
			if (tokenArg) options.token = tokenArg;

			return runVerifyCodeRabbitCLI(options);
		},
	},
	{
		name: "contract",
		summary: "Validate or print the harness contract schema",
		errorLabel: "Contract Error",
		execute: (args) => {
			const jsonFlag = args.includes("--json");
			const subArgs = args.filter((a) => !a.startsWith("-"));
			return runContractCLI(subArgs, { json: jsonFlag || undefined });
		},
	},
	{
		name: "risk-tier",
		summary: "Classify files by risk tier",
		errorLabel: "Risk Tier Error",
		execute: (args) => {
			const jsonFlag = args.includes("--json");
			const filesIndex = args.indexOf("--files");
			const contractIndex = args.indexOf("--contract");

			const filesArg = getFlagValue(args, filesIndex);
			const files = parseCsvList(filesArg);
			const contractArg = getFlagValue(args, contractIndex);
			const contractPath = contractArg ?? "harness.contract.json";

			return runRiskTierCLI({ contractPath, files, json: jsonFlag });
		},
	},
	{
		name: "replay",
		summary: "Replay or list captured agent automation traces",
		errorLabel: "Replay Error",
		execute: (args) => {
			const options: {
				traceId?: string;
				list?: boolean;
				dryRun?: boolean;
				json?: boolean;
				traceDir?: string;
			} = {
				json: args.includes("--json"),
				dryRun: args.includes("--dry-run"),
				list: args.includes("--list"),
			};

			const traceIdValue = getFlagValue(args, args.indexOf("--trace-id"));
			if (traceIdValue) options.traceId = traceIdValue;

			const traceDirValue = getFlagValue(args, args.indexOf("--trace-dir"));
			if (traceDirValue) options.traceDir = traceDirValue;

			// Positional trace ID: first non-flag arg when --trace-id is absent
			if (!options.traceId && args[1] && !args[1].startsWith("-")) {
				options.traceId = args[1];
			}

			return runReplayCLI(options);
		},
	},
	{
		name: "gardener",
		summary: "Detect stale docs and broken links",
		errorLabel: "Gardener Error",
		execute: (args) => {
			const options: {
				docsPath?: string;
				dryRun?: boolean;
				json?: boolean;
				staleDays?: number;
			} = {};

			if (args.includes("--dry-run")) options.dryRun = true;
			if (args.includes("--json")) options.json = true;
			const docsArg = getFlagValue(args, args.indexOf("--docs"));
			if (docsArg) options.docsPath = docsArg;
			const staleDaysArg = getFlagValue(args, args.indexOf("--stale-days"));
			if (staleDaysArg) {
				const staleDays = parseIntegerArg(staleDaysArg, 0);
				if (staleDays !== undefined) options.staleDays = staleDays;
			}

			return runGardenerCLI(options);
		},
	},
	{
		name: "memory-gate",
		summary: "Validate local-memory workflow compliance",
		errorLabel: "Memory Gate Error",
		execute: (args) => {
			const options: {
				memoryPath?: string;
				forjamiePath?: string;
				json?: boolean;
				metricsPath?: string;
			} = {};

			if (args.includes("--json")) options.json = true;
			const memoryArg = getFlagValue(args, args.indexOf("--memory"));
			if (memoryArg) options.memoryPath = memoryArg;
			const forjamieArg = getFlagValue(args, args.indexOf("--forjamie"));
			if (forjamieArg) options.forjamiePath = forjamieArg;
			const metricsArg = getFlagValue(args, args.indexOf("--metrics"));
			if (metricsArg) options.metricsPath = metricsArg;

			return runMemoryGateCLI(options);
		},
	},
	{
		name: "silent-error",
		summary: "Detect silent error handling anti-patterns",
		errorLabel: "Silent Error Detector Error",
		execute: (args) => {
			const options: {
				files?: string[];
				dirs?: string[];
				json?: boolean;
				strict?: boolean;
				suggestions?: boolean;
			} = {};

			if (args.includes("--json")) options.json = true;
			if (args.includes("--strict")) options.strict = true;
			if (args.includes("--suggestions")) options.suggestions = true;
			const filesArg = getFlagValue(args, args.indexOf("--files"));
			if (filesArg !== undefined) options.files = parseCsvList(filesArg);
			const dirsArg = getFlagValue(args, args.indexOf("--dirs"));
			if (dirsArg !== undefined) options.dirs = parseCsvList(dirsArg);

			return runSilentErrorDetectorCLI(options);
		},
	},
	{
		name: "brainstorm-gate",
		summary: "Validate brainstorm artifacts",
		errorLabel: "Brainstorm Gate Error",
		execute: (args) => {
			const options: {
				brainstormsPath?: string;
				topic?: string;
				maxAgeDays?: number;
				strict?: boolean;
				json?: boolean;
			} = {};

			if (args.includes("--json")) options.json = true;
			if (args.includes("--strict")) options.strict = true;
			const brainstormsArg = getFlagValue(args, args.indexOf("--brainstorms"));
			if (brainstormsArg) options.brainstormsPath = brainstormsArg;
			const topicArg = getFlagValue(args, args.indexOf("--topic"));
			if (topicArg) options.topic = topicArg;
			const maxAgeArg = getFlagValue(args, args.indexOf("--max-age"));
			if (maxAgeArg) {
				const parsed = parseIntegerArg(maxAgeArg, 0);
				if (parsed !== undefined) options.maxAgeDays = parsed;
			}

			return runBrainstormGateCLI(options);
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
				return 1;
			}
			if (!fileArg) {
				console.error("Error: --file is required");
				return 1;
			}

			const validTypes = ["feature", "bugfix", "refactor", "release"] as const;
			if (!validTypes.includes(typeArg as (typeof validTypes)[number])) {
				console.error(
					`Error: Invalid type "${typeArg}". Must be one of: ${validTypes.join(", ")}`,
				);
				return 1;
			}

			return runPromptGateCLI({
				type: typeArg as (typeof validTypes)[number],
				file: fileArg,
				json: jsonFlag,
			});
		},
	},
	{
		name: "drift-gate",
		summary: "Evaluate consistency drift across governance surfaces",
		errorLabel: "Drift Gate Error",
		execute: (args) => {
			const jsonFlag = args.includes("--json");
			const seedBaselineFlag = args.includes("--seed-baseline");
			const noSeedFlag = args.includes("--no-seed");
			const modeIndex = args.indexOf("--mode");
			const outIndex = args.indexOf("--out");
			const baselineIndex = args.indexOf("--baseline");
			const suppressIndex = args.indexOf("--suppress");

			const options: {
				mode?: "advisory" | "health";
				json?: boolean;
				outPath?: string;
				baselinePath?: string;
				seedBaseline?: boolean;
				suppressions?: string[];
			} = {};

			if (jsonFlag) options.json = true;
			if (seedBaselineFlag) options.seedBaseline = true;
			if (noSeedFlag) options.seedBaseline = false;
			const modeArg = getFlagValue(args, modeIndex);
			if (modeArg) {
				if (modeArg !== "advisory" && modeArg !== "health") {
					console.error("Error: --mode must be advisory or health");
					return 2;
				}
				options.mode = modeArg;
			}
			const outArg = getFlagValue(args, outIndex);
			if (outArg) options.outPath = outArg;
			const baselineArg = getFlagValue(args, baselineIndex);
			if (baselineArg) options.baselinePath = baselineArg;
			const suppressArg = getFlagValue(args, suppressIndex);
			if (suppressArg) options.suppressions = parseCsvList(suppressArg);

			return runDriftGateCLI(options);
		},
	},
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
		name: "blast-radius",
		summary: "Determine required checks from changed files",
		errorLabel: "Blast Radius Error",
		execute: (args) => {
			const jsonFlag = args.includes("--json");
			const verboseFlag = args.includes("--verbose");
			const filesIndex = args.indexOf("--files");
			const contractIndex = args.indexOf("--contract");

			const filesArg = getFlagValue(args, filesIndex);
			if (!filesArg) {
				console.error("Error: --files is required (comma-separated paths)");
				return 1;
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
			const mode = args[0];
			if (mode !== "run" && mode !== "apply") {
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
				mode,
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
		summary: "Manage production gap cases (create/list/resolve)",
		errorLabel: "Gap Case Error",
		execute: (args) => {
			const jsonFlag = args.includes("--json");
			const contractIndex = args.indexOf("--contract");
			const storeIndex = args.indexOf("--store");

			// args[0] is the action (command name already stripped by dispatcher)
			const action = args[0] as "open" | "resolve" | undefined;
			if (action !== "open" && action !== "resolve") {
				console.error("Error: action must be 'open' or 'resolve'");
				return 1;
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
				return 1;
			}
			if (!contractB) {
				console.error("Error: --contract-b is required");
				return 1;
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
];

const COMMAND_INDEX = new Map<string, CommandSpec>();
for (const spec of COMMAND_SPECS) {
	COMMAND_INDEX.set(spec.name, spec);
	for (const alias of spec.aliases ?? []) {
		COMMAND_INDEX.set(alias, spec);
	}
}

export const MIGRATED_COMMAND_NAMES = COMMAND_SPECS.map((spec) => spec.name);
export const MIGRATED_COMMAND_AND_ALIAS_NAMES = COMMAND_SPECS.flatMap(
	(spec) => [spec.name, ...(spec.aliases ?? [])],
);

export function getRegistryCommandHelpRows(): Array<{
	name: string;
	summary: string;
}> {
	return COMMAND_SPECS.map((spec) => ({
		name: spec.name,
		summary: spec.summary,
	}));
}

export function dispatchRegistryCommand(
	command: string | undefined,
	args: string[],
): RegistryDispatchResult | undefined {
	if (!command) {
		return undefined;
	}
	const spec = COMMAND_INDEX.get(command);
	if (!spec) {
		return undefined;
	}
	return {
		spec,
		result: spec.execute(args.slice(1)),
	};
}

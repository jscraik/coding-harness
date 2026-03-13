import { runBranchProtectCLI } from "../../commands/branch-protect.js";
import { runCheckAuthzCLI } from "../../commands/check-authz.js";
import { runCheckEnvironmentCLI } from "../../commands/check-environment.js";
import { runDocsGateCLI } from "../../commands/docs-gate.js";
import { runEvidenceVerifyCLI } from "../../commands/evidence-verify.js";
import { runLicenseGateCLI } from "../../commands/license-gate.js";
import { runLinearGateCLI } from "../../commands/linear-gate.js";
import { runLinearPrepareCLI } from "../../commands/linear-prepare.js";
import { runLinearWorkflowCLI } from "../../commands/linear-workflow.js";
import { runPolicyGateCLI } from "../../commands/policy-gate.js";
import { runPrTemplateGateCLI } from "../../commands/pr-template-gate.js";
import { runPreflightGateCLI } from "../../commands/preflight-gate.js";
import { runReviewGateCLI } from "../../commands/review-gate.js";
import { getFlagValue, parseCsvList, parseIntegerArg } from "./parse-utils.js";

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
			"Prepare Linear branch/PR metadata and manage workflow transitions",
		errorLabel: "Linear Workflow Error",
		execute: (args) => {
			const action = args[0];
			if (
				action !== "claim" &&
				action !== "handoff" &&
				action !== "close" &&
				action !== "prepare"
			) {
				console.error(
					"linear expects an action of claim, handoff, close, or prepare.",
				);
				return 1;
			}

			const jsonFlag = args.includes("--json");
			const noAssignFlag = args.includes("--no-assign");
			const issueIndex = args.indexOf("--issue");
			const tokenIndex = args.indexOf("--token");
			const teamIndex = args.indexOf("--team");
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

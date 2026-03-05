import { runBranchProtectCLI } from "../../commands/branch-protect.js";
import { runCheckAuthzCLI } from "../../commands/check-authz.js";
import { runCheckEnvironmentCLI } from "../../commands/check-environment.js";
import { runEvidenceVerifyCLI } from "../../commands/evidence-verify.js";
import { runPolicyGateCLI } from "../../commands/policy-gate.js";
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
			if (contractArg) options.contractPath = contractArg;
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
			if (contractArg) {
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
			const contractArg = getFlagValue(args, contractIndex);
			if (contractArg) options.contractPath = contractArg;

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
			const approvalsIndex = args.indexOf("--required-approvals");
			const checksArg = getFlagValue(args, checksIndex);
			const approvalsArg =
				approvalsIndex === -1 ? undefined : args[approvalsIndex + 1];

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
			if (contractArg) options.contractPath = contractArg;
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
			if (contractArg) options.contractPath = contractArg;
			const attestationArg = getFlagValue(args, attestationIndex);
			if (attestationArg) options.attestationPath = attestationArg;
			const allowedSandboxArg = getFlagValue(args, allowedSandboxIndex);
			if (allowedSandboxArg) {
				options.allowedSandboxModes = parseCsvList(allowedSandboxArg);
			}

			return runCheckEnvironmentCLI(options);
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
		result: spec.execute(args),
	};
}

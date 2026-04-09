import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { loadContract } from "../lib/contract/loader.js";
import type {
	HarnessContract,
	IssueTrackingPolicy,
	PrReferenceMode,
} from "../lib/contract/types.js";
import { DEFAULT_ISSUE_TRACKING_POLICY } from "../lib/contract/types.js";
import { sanitizeError } from "../lib/input/sanitize.js";
import {
	classifyLinearGateFailure,
	normaliseLinearGateResult,
} from "../lib/output/normalise.js";

export const EXIT_CODES = {
	SUCCESS: 0,
	POLICY_VIOLATION: 1,
	VALIDATION_ERROR: 2,
	CONTRACT_ERROR: 3,
} as const;

export interface LinearGateOptions {
	contractPath?: string;
	repoRoot?: string;
	branch?: string;
	prTitle?: string;
	prBody?: string;
	allowMissingBranch?: boolean;
	allowMissingPrMetadata?: boolean;
	json?: boolean;
}

export interface LinearGateCheck {
	code: string;
	passed: boolean;
	message: string;
	expected?: string;
	actual?: string;
}

export interface LinearGateOutput {
	passed: boolean;
	policyApplied: IssueTrackingPolicy;
	repoRoot: string;
	branch?: string | undefined;
	prTitle?: string | undefined;
	bugsUrl?: string | undefined;
	checks: LinearGateCheck[];
	issueKeys: {
		branch: string[];
		pr: string[];
		refs: string[];
		fixes: string[];
	};
}

export type LinearGateResult =
	| { ok: true; output: LinearGateOutput }
	| { ok: false; error: { code: string; message: string } };

const ISSUE_KEY_PATTERN = /\b[A-Z][A-Z0-9]+-\d+\b/gi;
const REFS_KEY_PATTERN = /\brefs?\s+([A-Z][A-Z0-9]+-\d+)\b/gi;
const FIXES_KEY_PATTERN = /\bfix(?:es)?\s+([A-Z][A-Z0-9]+-\d+)\b/gi;

function normalizeUrl(value: string): string {
	return value.trim().replace(/\/+$/, "");
}

function isLinearProjectUrl(value: string): boolean {
	try {
		const url = new URL(value);
		return (
			url.protocol === "https:" &&
			url.hostname === "linear.app" &&
			url.pathname.includes("/project/")
		);
	} catch {
		return false;
	}
}

function extractIssueKeys(value: string | undefined): string[] {
	if (!value) {
		return [];
	}
	const pattern = new RegExp(ISSUE_KEY_PATTERN.source, ISSUE_KEY_PATTERN.flags);
	return Array.from(
		new Set(
			Array.from(value.matchAll(pattern), (match) => match[0].toUpperCase()),
		),
	);
}

function extractLinkedIssueKeys(
	value: string | undefined,
	mode: "refs" | "fixes",
): string[] {
	if (!value) {
		return [];
	}

	const pattern = new RegExp(
		(mode === "refs" ? REFS_KEY_PATTERN : FIXES_KEY_PATTERN).source,
		(mode === "refs" ? REFS_KEY_PATTERN : FIXES_KEY_PATTERN).flags,
	);
	return Array.from(
		new Set(
			Array.from(value.matchAll(pattern), (match) =>
				match[1]?.toUpperCase(),
			).filter((candidate): candidate is string => Boolean(candidate)),
		),
	);
}

function readPackageJsonBugsUrl(repoRoot: string): string | undefined {
	const packageJsonPath = join(repoRoot, "package.json");
	if (!existsSync(packageJsonPath)) {
		return undefined;
	}

	try {
		const parsed = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as {
			bugs?: string | { url?: unknown };
		};
		if (typeof parsed.bugs === "string") {
			return parsed.bugs.trim() || undefined;
		}
		if (
			parsed.bugs &&
			typeof parsed.bugs === "object" &&
			typeof parsed.bugs.url === "string"
		) {
			const trimmed = parsed.bugs.url.trim();
			return trimmed || undefined;
		}
		return undefined;
	} catch {
		return undefined;
	}
}

function readIssueTemplateConfig(repoRoot: string): string | undefined {
	const issueTemplatePath = join(repoRoot, ".github/ISSUE_TEMPLATE/config.yml");
	if (!existsSync(issueTemplatePath)) {
		return undefined;
	}
	return readFileSync(issueTemplatePath, "utf-8");
}

function detectBranchName(repoRoot: string): string | undefined {
	try {
		const currentBranch = execFileSync("git", ["branch", "--show-current"], {
			cwd: repoRoot,
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "ignore"],
		}).trim();
		return currentBranch || undefined;
	} catch {
		return undefined;
	}
}

function resolvePolicy(
	contract: HarnessContract,
): IssueTrackingPolicy | undefined {
	return contract.issueTrackingPolicy ?? DEFAULT_ISSUE_TRACKING_POLICY;
}

function resolveReferenceKeys(
	mode: PrReferenceMode,
	prText: string,
): { refs: string[]; fixes: string[] } {
	return {
		refs: mode === "fixes" ? [] : extractLinkedIssueKeys(prText, "refs"),
		fixes: mode === "refs" ? [] : extractLinkedIssueKeys(prText, "fixes"),
	};
}

function addCheck(
	checks: LinearGateCheck[],
	code: string,
	passed: boolean,
	message: string,
	options: { expected?: string; actual?: string } = {},
): void {
	checks.push({
		code,
		passed,
		message,
		...options,
	});
}

export function runLinearGate(options: LinearGateOptions): LinearGateResult {
	const repoRoot = resolve(options.repoRoot ?? process.cwd());
	const contractPath = options.contractPath
		? relative(repoRoot, resolve(repoRoot, options.contractPath))
		: "harness.contract.json";
	let contract: HarnessContract;
	const previousCwd = process.cwd();
	try {
		process.chdir(repoRoot);
		contract = loadContract(contractPath);
	} catch (error) {
		return {
			ok: false,
			error: {
				code: "CONTRACT_ERROR",
				message: `Failed to load contract: ${sanitizeError(error)}`,
			},
		};
	} finally {
		process.chdir(previousCwd);
	}

	const policy = resolvePolicy(contract);
	if (!policy) {
		return {
			ok: false,
			error: {
				code: "VALIDATION_ERROR",
				message:
					"Contract is missing issueTrackingPolicy. Add a Linear issue tracking policy before running linear-gate.",
			},
		};
	}

	const branch =
		options.branch ??
		process.env.GITHUB_HEAD_REF ??
		process.env.GITHUB_REF_NAME ??
		detectBranchName(repoRoot);
	const prTitle = options.prTitle ?? process.env.PR_TITLE;
	const prBody = options.prBody ?? process.env.PR_BODY;
	const prText = [prTitle, prBody].filter(Boolean).join("\n");
	const bugsUrl = readPackageJsonBugsUrl(repoRoot);
	const issueTemplateConfig = readIssueTemplateConfig(repoRoot);
	const expectedLinearUrl = bugsUrl ?? policy.projectUrl;
	const branchIssueKeys = extractIssueKeys(branch);
	const prIssueKeys = extractIssueKeys(prText);
	const referenceMode = policy.prReferenceMode ?? "either";
	const { refs: refsIssueKeys, fixes: fixesIssueKeys } = resolveReferenceKeys(
		referenceMode,
		prText,
	);
	const checks: LinearGateCheck[] = [];

	if (policy.requirePackageBugsUrl ?? true) {
		if (!bugsUrl) {
			addCheck(
				checks,
				"package-bugs-url",
				false,
				"package.json must define bugs.url for the repository's Linear project.",
				{
					expected: "https://linear.app/<workspace>/project/<project-id>",
				},
			);
		} else if (!isLinearProjectUrl(bugsUrl)) {
			addCheck(
				checks,
				"package-bugs-url",
				false,
				"package.json bugs.url must point at a Linear project URL.",
				{
					expected: "https://linear.app/<workspace>/project/<project-id>",
					actual: bugsUrl,
				},
			);
		} else if (
			policy.projectUrl &&
			normalizeUrl(bugsUrl) !== normalizeUrl(policy.projectUrl)
		) {
			addCheck(
				checks,
				"package-bugs-url",
				false,
				"package.json bugs.url must match issueTrackingPolicy.projectUrl.",
				{
					expected: policy.projectUrl,
					actual: bugsUrl,
				},
			);
		} else {
			addCheck(
				checks,
				"package-bugs-url",
				true,
				"package.json bugs.url points at Linear.",
			);
		}
	}

	if (policy.disableGitHubIssues ?? true) {
		if (!issueTemplateConfig) {
			addCheck(
				checks,
				"github-issues-retired",
				false,
				".github/ISSUE_TEMPLATE/config.yml is required to retire GitHub issue entry points.",
			);
		} else {
			const blankIssuesDisabled = /^\s*blank_issues_enabled:\s*false\s*$/m.test(
				issueTemplateConfig,
			);
			const linearLinkPresent = expectedLinearUrl
				? issueTemplateConfig.includes(expectedLinearUrl)
				: /https:\/\/linear\.app\//.test(issueTemplateConfig);

			if (!blankIssuesDisabled) {
				addCheck(
					checks,
					"github-issues-retired",
					false,
					"GitHub issue intake must be disabled in .github/ISSUE_TEMPLATE/config.yml.",
					{
						expected: "blank_issues_enabled: false",
					},
				);
			} else if (!linearLinkPresent) {
				addCheck(
					checks,
					"github-issues-retired",
					false,
					"Issue template contact links must route contributors to Linear.",
					{
						expected:
							expectedLinearUrl ??
							"A Linear project URL in .github/ISSUE_TEMPLATE/config.yml",
					},
				);
			} else {
				addCheck(
					checks,
					"github-issues-retired",
					true,
					"GitHub issue intake is retired in favor of Linear contact links.",
				);
			}
		}
	}

	if (policy.requireBranchIssueKey ?? true) {
		if (!branch && !options.allowMissingBranch) {
			addCheck(
				checks,
				"branch-linkage",
				false,
				"A branch name is required to validate Linear issue linkage.",
			);
		} else if (!branch) {
			addCheck(
				checks,
				"branch-linkage",
				true,
				"Branch linkage check skipped because branch metadata is unavailable.",
			);
		} else if (
			policy.branchPrefix &&
			!branch.startsWith(`${policy.branchPrefix}/`)
		) {
			addCheck(
				checks,
				"branch-linkage",
				false,
				"Branch name must use the configured prefix.",
				{
					expected: `${policy.branchPrefix}/<linear-key>-...`,
					actual: branch,
				},
			);
		} else if (branchIssueKeys.length === 0) {
			addCheck(
				checks,
				"branch-linkage",
				false,
				"Branch name must include a Linear issue key.",
				{
					expected: `${policy.branchPrefix ?? "codex"}/JSC-123-short-description`,
					actual: branch,
				},
			);
		} else {
			addCheck(
				checks,
				"branch-linkage",
				true,
				"Branch name includes a Linear issue key.",
				{
					actual: branchIssueKeys.join(", "),
				},
			);
		}
	}

	if (policy.requirePrIssueKey ?? true) {
		if (!prText && !options.allowMissingPrMetadata) {
			addCheck(
				checks,
				"pr-linkage",
				false,
				"PR title or body is required to validate Linear linkage.",
			);
		} else if (prText && prIssueKeys.length === 0) {
			addCheck(
				checks,
				"pr-linkage",
				false,
				"PR title or body must include a Linear issue key.",
				{
					expected: "Refs JSC-123 or Fixes JSC-123",
					actual: prTitle ?? "",
				},
			);
		} else if (prText) {
			addCheck(
				checks,
				"pr-linkage",
				true,
				"PR metadata includes a Linear issue key.",
			);
		}
	}

	if (prText) {
		const requiredReferenceKeys =
			referenceMode === "refs"
				? refsIssueKeys
				: referenceMode === "fixes"
					? fixesIssueKeys
					: [...refsIssueKeys, ...fixesIssueKeys];

		if (requiredReferenceKeys.length === 0) {
			const expectedReference =
				referenceMode === "refs"
					? "Refs <LINEAR-KEY>"
					: referenceMode === "fixes"
						? "Fixes <LINEAR-KEY>"
						: "Refs <LINEAR-KEY> or Fixes <LINEAR-KEY>";
			addCheck(
				checks,
				"pr-reference-mode",
				false,
				"PR metadata must include the required Linear reference line.",
				{
					expected: expectedReference,
				},
			);
		} else {
			addCheck(
				checks,
				"pr-reference-mode",
				true,
				"PR metadata includes the required Linear reference line.",
				{
					actual: requiredReferenceKeys.join(", "),
				},
			);
		}
	}

	if (branchIssueKeys.length > 0 && prIssueKeys.length > 0) {
		const matchingKeys = branchIssueKeys.filter((key) =>
			prIssueKeys.includes(key),
		);
		if (matchingKeys.length === 0) {
			addCheck(
				checks,
				"issue-key-consistency",
				false,
				"Branch and PR metadata must reference the same Linear issue key.",
				{
					expected: branchIssueKeys.join(", "),
					actual: prIssueKeys.join(", "),
				},
			);
		} else {
			addCheck(
				checks,
				"issue-key-consistency",
				true,
				"Branch and PR metadata agree on the Linear issue key.",
				{
					actual: matchingKeys.join(", "),
				},
			);
		}
	}

	const passed = checks.every((check) => check.passed);
	return {
		ok: true,
		output: {
			passed,
			policyApplied: policy,
			repoRoot,
			branch,
			prTitle,
			bugsUrl,
			checks,
			issueKeys: {
				branch: branchIssueKeys,
				pr: prIssueKeys,
				refs: refsIssueKeys,
				fixes: fixesIssueKeys,
			},
		},
	};
}

export async function runLinearGateCLI(
	options: LinearGateOptions,
): Promise<number> {
	const result = runLinearGate(options);
	const failure = classifyLinearGateFailure(result);
	if (options.json) {
		const gateResult = normaliseLinearGateResult(result);
		process.stdout.write(`${JSON.stringify(gateResult, null, 2)}\n`);
		if (!result.ok) {
			return result.error.code === "CONTRACT_ERROR"
				? EXIT_CODES.CONTRACT_ERROR
				: EXIT_CODES.VALIDATION_ERROR;
		}
		return result.output.passed
			? EXIT_CODES.SUCCESS
			: EXIT_CODES.POLICY_VIOLATION;
	}

	if (!result.ok) {
		console.error(result.error.message);
		if (failure) {
			console.error(`Failure class: ${failure.failureClass}`);
			console.error(`Next action: ${failure.nextAction}`);
		}
		return result.error.code === "CONTRACT_ERROR"
			? EXIT_CODES.CONTRACT_ERROR
			: EXIT_CODES.VALIDATION_ERROR;
	}

	const statusIcon = result.output.passed ? "✓" : "✗";
	const statusText = result.output.passed ? "PASSED" : "FAILED";
	console.info(`${statusIcon} Linear gate ${statusText}`);
	console.info();
	for (const check of result.output.checks) {
		const icon = check.passed ? "✓" : "✗";
		console.info(`${icon} ${check.message}`);
		if (!check.passed && check.expected) {
			console.info(`  Expected: ${check.expected}`);
		}
		if (!check.passed && check.actual) {
			console.info(`  Actual: ${check.actual}`);
		}
	}
	if (failure) {
		console.info();
		console.info(`Failure class: ${failure.failureClass}`);
		console.info(`Next action: ${failure.nextAction}`);
	}

	return result.output.passed
		? EXIT_CODES.SUCCESS
		: EXIT_CODES.POLICY_VIOLATION;
}

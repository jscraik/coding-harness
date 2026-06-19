import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { DocsGatePolicy, HarnessContract } from "../lib/contract/types.js";
import { validateContract } from "../lib/contract/validator.js";
import { sanitizeError } from "../lib/input/sanitize.js";
import type {
	ChangedFilesResolution,
	DocsGateExecutionContext,
	DocsGateOptions,
} from "./docs-gate-types.js";
import {
	CONTRACT_PATH,
	PACKAGE_JSON_PATH,
	WORKFLOW_PATH,
} from "./docs-gate-types.js";

/** Validated harness contract loaded from the repository contract file. */
export interface LoadedContract {
	contract: HarnessContract;
}

/** Load a text file, returning null when it is absent. */
export function loadFileIfPresent(path: string): string | null {
	if (!existsSync(path)) return null;
	return readFileSync(path, "utf-8");
}

/** Load and validate the harness contract used by docs-gate. */
export function loadValidatedContract(
	repoRoot: string,
	contractPath: string = CONTRACT_PATH,
): { loaded?: LoadedContract; error?: string } {
	const resolvedPath = resolve(repoRoot, contractPath);
	if (!existsSync(resolvedPath)) {
		return { error: `Contract file not found: ${contractPath}` };
	}
	try {
		const parsed = JSON.parse(readFileSync(resolvedPath, "utf-8")) as unknown;
		const validation = validateContract(parsed);
		if (!validation.success) return validationFailure(validation.errors);
		return validation.data
			? { loaded: { contract: validation.data } }
			: { error: "Contract validation returned no data" };
	} catch (error) {
		return { error: `Failed to load contract: ${sanitizeError(error)}` };
	}
}

function validationFailure(
	errors: readonly { path: string; message: string }[],
) {
	return {
		error:
			"Contract validation failed: " +
			errors.map((error) => `${error.path}: ${error.message}`).join("; "),
	};
}

/** Infer the canonical package-manager token from contract or package.json. */
export function inferExpectedPackageManager(
	contract: HarnessContract,
	repoRoot: string,
): string | null {
	const requiredManager = contract.packageManagerPolicy?.requiredManager;
	if (requiredManager) return requiredManager;
	const packageJsonRaw = loadFileIfPresent(join(repoRoot, PACKAGE_JSON_PATH));
	if (!packageJsonRaw) return null;
	try {
		const packageJson = JSON.parse(packageJsonRaw) as {
			packageManager?: string;
		};
		return typeof packageJson.packageManager === "string"
			? (packageJson.packageManager.split("@")[0] ?? null)
			: null;
	} catch {
		return null;
	}
}

/** Extract package-manager command tokens from documentation prose. */
export function extractCommandManagers(content: string): string[] {
	const managers = new Set<string>();
	for (const line of content.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const matches = trimmed.match(
			/\b(pnpm|npm|yarn)\b(?=\s+(?:install|run|exec|test|lint|typecheck|check|audit|build|add))/g,
		);
		for (const match of matches ?? []) managers.add(match);
	}
	return Array.from(managers);
}

/** Parse check names from the GitHub Actions workflow file. */
export function parseWorkflowCheckNames(repoRoot: string): Set<string> {
	const content = loadFileIfPresent(join(repoRoot, WORKFLOW_PATH));
	if (!content) return new Set();
	const checks = new Set<string>();
	for (const line of content.split(/\r?\n/)) {
		if (line.match(/^ {2}[a-z0-9_-]+:\s*$/i)) continue;
		const nameMatch = line.match(/^ {4}name:\s*(.+?)\s*$/);
		if (nameMatch?.[1]) {
			checks.add(nameMatch[1].trim().replace(/^['"]|['"]$/g, ""));
		}
	}
	return checks;
}

/** Build the runtime execution context for a docs-gate invocation. */
export function buildExecutionContext(
	options: DocsGateOptions,
	policy?: DocsGatePolicy,
	changedFilesSource: DocsGateExecutionContext["changedFilesSource"] = "git_diff",
): DocsGateExecutionContext {
	const trigger = options.trigger ?? "local";
	const policyMode = policy?.mode ?? options.mode ?? "advisory";
	return {
		trigger,
		policyMode,
		mergeAuthoritative: trigger === "pull_request" || trigger === "merge_group",
		trustedBaseAvailable: !!options.trustedBaseRef,
		trustedBaseRef: options.trustedBaseRef,
		trustedContractSha: options.trustedContractSha,
		trustedWorkflowSha: options.trustedWorkflowSha,
		evaluatedSha: undefined,
		mergeQueueTargetRef: options.mergeQueueTargetRef,
		mergeQueueBaseSha: options.mergeQueueBaseSha,
		bootstrapState: policy
			? policy.mode === "advisory"
				? "shadow_only"
				: "fully_wired"
			: "missing_wiring",
		changedFilesSource,
		outputRoot: "artifacts/consistency-gate",
	};
}

function parseGitFileList(output: string): string[] {
	return output
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
}

function parseGitNameStatus(output: string): {
	changedFiles: string[];
	deletedFiles: string[];
} {
	const changedFiles: string[] = [];
	const deletedFiles = new Set<string>();
	for (const line of output.split(/\r?\n/)) {
		const fields = line.split("\t");
		const status = fields[0]?.trim()[0] ?? "";
		const filePath =
			(status === "R" || status === "C") && fields.length >= 3
				? (fields[2]?.trim() ?? "")
				: (fields[1]?.trim() ?? "");
		if (!filePath) continue;
		changedFiles.push(filePath);
		if (status === "D") deletedFiles.add(filePath);
	}
	return { changedFiles, deletedFiles: [...deletedFiles] };
}

function gitOutput(repoRoot: string, args: readonly string[]): string {
	return execFileSync("git", ["-C", repoRoot, ...args], {
		encoding: "utf-8",
		stdio: ["ignore", "pipe", "pipe"],
	});
}

function resolveTrackedDiff(
	options: DocsGateOptions,
	repoRoot: string,
): string {
	for (const baseRef of baseRefCandidates(options)) {
		try {
			const mergeBase = gitOutput(repoRoot, [
				"merge-base",
				baseRef,
				"HEAD",
			]).trim();
			if (!mergeBase) continue;
			return gitOutput(repoRoot, [
				"diff",
				"--name-status",
				"--diff-filter=ACMRDT",
				`${mergeBase}...HEAD`,
			]);
		} catch {
			// Try the next base candidate.
		}
	}
	throw new Error(
		"unable to resolve git merge-base for docs-gate; provide --trusted-base-ref or configure origin/main",
	);
}

function baseRefCandidates(options: DocsGateOptions): string[] {
	return [
		options.mergeQueueBaseSha,
		options.trustedBaseRef,
		"origin/main",
		"origin/master",
	].filter((value): value is string => Boolean(value?.trim()));
}

function optionalGitNameStatus(repoRoot: string, args: readonly string[]) {
	try {
		return parseGitNameStatus(gitOutput(repoRoot, args));
	} catch {
		return { changedFiles: [], deletedFiles: [] };
	}
}

/** Resolve changed and deleted files for docs-gate policy evaluation. */
export function resolveChangedFiles(
	options: DocsGateOptions,
	repoRoot: string,
): ChangedFilesResolution {
	if (options.changedFiles) {
		return {
			changedFiles: options.changedFiles,
			deletedFiles: options.deletedFiles ?? [],
			source: "explicit_flag",
		};
	}
	try {
		return collectGitChangedFiles(options, repoRoot);
	} catch (error) {
		return {
			changedFiles: [],
			deletedFiles: [],
			source: "full_repo_fallback",
			error:
				"Unable to resolve changed files from git history: " +
				sanitizeError(error),
		};
	}
}

function collectGitChangedFiles(
	options: DocsGateOptions,
	repoRoot: string,
): ChangedFilesResolution {
	const tracked = parseGitNameStatus(resolveTrackedDiff(options, repoRoot));
	const worktree = optionalGitNameStatus(repoRoot, [
		"diff",
		"--name-status",
		"--diff-filter=ACMRDT",
	]);
	const staged = optionalGitNameStatus(repoRoot, [
		"diff",
		"--name-status",
		"--cached",
		"--diff-filter=ACMRDT",
	]);
	const untracked = parseGitFileList(
		gitOutput(repoRoot, ["ls-files", "--others", "--exclude-standard"]),
	);
	return {
		changedFiles: [
			...new Set([
				...tracked.changedFiles,
				...worktree.changedFiles,
				...staged.changedFiles,
				...untracked,
			]),
		],
		deletedFiles: [
			...new Set([
				...tracked.deletedFiles,
				...worktree.deletedFiles,
				...staged.deletedFiles,
			]),
		],
		source: "git_diff",
	};
}

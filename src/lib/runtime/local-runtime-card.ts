import { execFileSync } from "node:child_process";
import {
	assembleLiveRuntimeCard,
	assembleLocalRuntimeCard,
} from "./local-runtime-card-assembly.js";
import {
	defaultLiveProvider,
	type RuntimeCardLiveProvider,
	type RuntimeCardLiveProviderContext,
} from "./local-runtime-card-live.js";
import { inspectRuntimeCardArtifacts } from "./local-runtime-card-artifacts.js";
import {
	collapsePhaseExit,
	inspectRuntimeCardPhaseExit,
} from "./local-runtime-card-phase-exit.js";
import { inspectRuntimeEvidenceBundle } from "./runtime-evidence-adapter.js";
import type { RuntimeCard, RuntimeCardSource } from "./runtime-card.js";
export type {
	RuntimeCardLiveEvidence,
	RuntimeCardLiveProvider,
	RuntimeCardLiveProviderContext,
} from "./local-runtime-card-live.js";

/** Function used to run read-only git commands while building a local runtime card. */
export type RuntimeCardGitRunner = (
	args: readonly string[],
) => string | undefined;

/** Inputs for building a local runtime-card/v1 artifact. */
export interface LocalRuntimeCardOptions {
	/** Repository root to inspect. */
	repoRoot: string;
	/** Optional tracker key to prefer over branch or artifact-derived keys. */
	issueKey?: string;
	/** Optional HePhaseExit/v1 artifact to collapse into the runtime card. */
	phaseExitPath?: string;
	/** Optional normalized runtime evidence bundle from session or CI collectors. */
	evidenceBundle?: unknown;
	/** Whether missing phase-exit evidence must block the runtime card. */
	requirePhaseExit?: boolean;
	/** Clock override for deterministic tests. */
	now?: Date;
	/** Optional git runner override for deterministic tests. */
	git?: RuntimeCardGitRunner;
}

/** Inputs for building a local runtime card with optional live provider evidence. */
export interface LiveRuntimeCardOptions extends LocalRuntimeCardOptions {
	/** Optional live provider override for deterministic tests. */
	liveProvider?: RuntimeCardLiveProvider;
	/** Environment override used by the default provider. */
	env?: NodeJS.ProcessEnv;
}

interface GitSnapshot {
	branchName: string | null;
	clean: boolean | null;
	ref: string | null;
	source: RuntimeCardSource;
}

function defaultGitRunner(repoRoot: string): RuntimeCardGitRunner {
	return (args) => {
		try {
			return execFileSync("git", [...args], {
				cwd: repoRoot,
				encoding: "utf8",
				stdio: ["ignore", "pipe", "ignore"],
			}).trim();
		} catch {
			return undefined;
		}
	};
}

function detectIssueKey(
	...values: Array<string | null | undefined>
): string | null {
	for (const value of values) {
		const match = value?.match(/\b[A-Z][A-Z0-9]+-\d+\b/iu);
		if (match) return match[0].toUpperCase();
	}
	return null;
}

function inspectGit(repoRoot: string, git?: RuntimeCardGitRunner): GitSnapshot {
	const runGit = git ?? defaultGitRunner(repoRoot);
	const branchName = runGit(["branch", "--show-current"]) ?? null;
	const ref = runGit(["rev-parse", "HEAD"]) ?? null;
	const status = runGit(["status", "--porcelain"]);
	const gitUsable = branchName !== null || ref !== null || status !== undefined;
	return {
		branchName,
		clean: status === undefined ? null : status.length === 0,
		ref,
		source: {
			kind: "git",
			ref: "command:git status --porcelain",
			freshness: gitUsable ? "current" : "unknown",
			status: gitUsable ? "usable" : "blocked",
			failureClass: gitUsable ? null : "git_unavailable",
		},
	};
}

/**
 * Generate a validated runtime-card/v1 artifact from local repository state and an optional runtime evidence bundle.
 *
 * @param options - Configuration for card generation (repo root, optional preferred issue key, optional phase-exit artifact path, optional normalized evidence bundle, deterministic `now` override, and optional git runner override).
 * @returns The validated `RuntimeCard` describing the repository's local runtime state.
 * @throws Error - If the constructed runtime card fails schema validation.
 */
export function buildLocalRuntimeCard(
	options: LocalRuntimeCardOptions,
): RuntimeCard {
	const git = inspectGit(options.repoRoot, options.git);
	const evidence = inspectRuntimeEvidenceBundle(
		options.evidenceBundle,
		collapsePhaseExit,
	);
	const evidenceIssueKey =
		options.issueKey === undefined ? evidence.issueKey : null;
	const localIssueKey = detectIssueKey(
		options.issueKey,
		git.branchName,
		evidenceIssueKey,
	);
	const artifacts = inspectRuntimeCardArtifacts(
		options.repoRoot,
		localIssueKey,
	);
	const phaseExit =
		options.phaseExitPath !== undefined
			? inspectRuntimeCardPhaseExit(options.repoRoot, options.phaseExitPath)
			: (evidence.phaseExit ??
				inspectRuntimeCardPhaseExit(
					options.repoRoot,
					undefined,
					options.requirePhaseExit === true,
				));
	const issueKey = detectIssueKey(
		options.issueKey,
		artifacts.issueKey,
		evidenceIssueKey,
		git.branchName,
	);
	return assembleLocalRuntimeCard({
		git,
		artifacts,
		phaseExit,
		evidence,
		issueKey,
		generatedAt: (options.now ?? new Date()).toISOString(),
		phaseExitPathSupplied: options.phaseExitPath !== undefined,
	});
}

/** Build a runtime-card/v1 artifact from local evidence plus opt-in live provider state. */
export async function buildLiveRuntimeCard(
	options: LiveRuntimeCardOptions,
): Promise<RuntimeCard> {
	const base = buildLocalRuntimeCard(options);
	const provider =
		options.liveProvider ??
		((context: RuntimeCardLiveProviderContext) =>
			defaultLiveProvider(context, options.env ?? process.env));
	const live = await provider({
		repoRoot: options.repoRoot,
		branchName: base.branch.name,
		issueKey: base.issueKey,
	});
	return assembleLiveRuntimeCard(base, live);
}

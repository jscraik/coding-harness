import { execFileSync } from "node:child_process";
import type { HarnessDecision } from "../decision/harness-decision.js";
import { gitEnvironmentForRepoRoot } from "../runtime/git-environment.js";
import { SYNAIPSE_STATE_SCHEMA_VERSION } from "./state-contract.js";

export { SYNAIPSE_STATE_SCHEMA_VERSION } from "./state-contract.js";
export type { SynaipseStateValidationResult } from "./state-contract.js";
export { validateSynaipseState } from "./state-validation.js";

const INVOCATION_EFFECT_CLASSES = ["pure_read"] as const;

/** Git identity and worktree state carried by a SynAIpse state projection. */
export interface SynaipseStateRepository {
	name: string | null;
	branch: string | null;
	baseRef: string | null;
	headSha: string | null;
	baseSha: string | null;
	clean: boolean | null;
}

/** Minimal effect declaration for the read-only `next` invocation. */
export interface SynaipseStateInvocationEffects {
	effectClasses: typeof INVOCATION_EFFECT_CLASSES;
	targets: string[];
	writesFiles: false;
	mutatesGit: false;
	mutatesExternal: false;
}

/** Compact state emitted alongside a `harness-decision/v1` packet. */
export interface SynaipseState {
	schemaVersion: typeof SYNAIPSE_STATE_SCHEMA_VERSION;
	generatedAt: string;
	repository: SynaipseStateRepository;
	stage: HarnessDecision["phase"];
	task: {
		status: HarnessDecision["status"];
		objective: string;
	};
	authority: {
		owner: "codex" | "operator";
		humanRequired: boolean;
	};
	truthLaneBlockers: string[];
	admittedCapabilities: string[];
	evidenceRefs: string[];
	nextAction: string;
	invocationEffects: SynaipseStateInvocationEffects;
	freshness: {
		status: "current" | "unknown";
		observedAt: string;
	};
	claimBoundary: string;
}

/** Read one git value without turning unavailable repository metadata into a write. */
function readGit(repoRoot: string, args: string[]): string | null {
	try {
		const output = execFileSync("git", args, {
			cwd: repoRoot,
			env: gitEnvironmentForRepoRoot(),
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "ignore"],
			timeout: 10_000,
		}).trim();
		return output.length > 0 ? output : null;
	} catch {
		return null;
	}
}

/** Normalize SSH and HTTPS remotes to a stable owner/repository identity. */
function normalizeRepositoryName(remote: string | null): string | null {
	if (!remote) return null;
	const normalized = remote
		.replace(/^git@[^:]+:/, "")
		.replace(/^https?:\/\/[^/]+\//, "")
		.replace(/\.git$/, "");
	return normalized.length > 0 ? normalized : null;
}

/** Capture the read-only repository identity and current worktree posture. */
function repositoryState(repoRoot: string): SynaipseStateRepository {
	const upstream = readGit(repoRoot, [
		"rev-parse",
		"--abbrev-ref",
		"--symbolic-full-name",
		"@{upstream}",
	]);
	const status = readGit(repoRoot, [
		"status",
		"--short",
		"--untracked-files=all",
	]);
	return {
		name: normalizeRepositoryName(
			readGit(repoRoot, ["remote", "get-url", "origin"]),
		),
		branch: readGit(repoRoot, ["rev-parse", "--abbrev-ref", "HEAD"]),
		baseRef: upstream,
		headSha: readSynaipseRepositorySha(repoRoot),
		baseSha: upstream ? readGit(repoRoot, ["rev-parse", upstream]) : null,
		clean: status === null ? null : status === "",
	};
}

/** Read the current repository HEAD used to bind lifecycle evidence. */
export function readSynaipseRepositorySha(repoRoot: string): string | null {
	return readGit(repoRoot, ["rev-parse", "HEAD"]);
}

/** Preserve only terminal decision failures as truth-lane blockers. */
function stateBlockers(decision: HarnessDecision): string[] {
	if (decision.status !== "blocked" && decision.status !== "fail") return [];
	return [decision.failureClass ?? `decision-${decision.status}`];
}

/** Build the compact state projection from one already-selected next decision. */
export function buildSynaipseState(
	decision: HarnessDecision,
	repoRoot: string,
	generatedAt = new Date().toISOString(),
): SynaipseState {
	const repository = repositoryState(repoRoot);
	return {
		schemaVersion: SYNAIPSE_STATE_SCHEMA_VERSION,
		generatedAt,
		repository,
		stage: decision.phase,
		task: {
			status: decision.status,
			objective: decision.objective,
		},
		authority: {
			owner: decision.requiresHuman ? "operator" : "codex",
			humanRequired: decision.requiresHuman,
		},
		truthLaneBlockers: stateBlockers(decision),
		admittedCapabilities: ["harness next"],
		evidenceRefs: [...decision.evidenceRef],
		nextAction: decision.nextAction,
		invocationEffects: {
			effectClasses: INVOCATION_EFFECT_CLASSES,
			targets: ["repository metadata and local evidence"],
			writesFiles: false,
			mutatesGit: false,
			mutatesExternal: false,
		},
		freshness: {
			// This is local observation freshness, not upstream or hosted freshness.
			status:
				repository.headSha &&
				(repository.baseRef === null || repository.baseSha !== null)
					? "current"
					: "unknown",
			observedAt: generatedAt,
		},
		claimBoundary:
			"Local cockpit routing only; does not prove CI, review-thread, tracker, external readiness, merge readiness, deployment, or security closure.",
	};
}

/** Attach a state projection without changing the existing decision envelope contract. */
export function withSynaipseState(
	decision: HarnessDecision,
	repoRoot: string,
): HarnessDecision {
	return {
		...decision,
		meta: {
			...(decision.meta ?? {}),
			synaipseState: buildSynaipseState(decision, repoRoot),
		},
	};
}

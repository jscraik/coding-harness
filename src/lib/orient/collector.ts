import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { assessAgentReadiness } from "../agent-readiness/checker.js";
import type { AgentReadinessContextHealth } from "../agent-readiness/types.js";
import type { HarnessDecision } from "../decision/harness-decision.js";
import { runBrainStale } from "../project-brain/stale-cli.js";
import { runBrainStatus } from "../project-brain/status-cli.js";
import { collectSessionContext } from "../session-context/collector.js";
import type { SessionContextReport } from "../session-context/types.js";
import {
	ARCHITECTURE_CONTEXT_PATH,
	buildConditionalContext,
	buildContextCommands,
	buildOrientationRefs,
	buildOrientTraversalHints,
	DIAGRAM_MANIFEST_PATH,
	type HarnessOrientCommandPrefix,
	scopeOrientHarnessCommand,
	TRUTH_LANE_WARNINGS,
} from "./context.js";
import type {
	HarnessOrientArchitectureContext,
	HarnessOrientNextDecision,
	HarnessOrientOptions,
	HarnessOrientPreflightReceipt,
	HarnessOrientProjectBrain,
	HarnessOrientReport,
	HarnessOrientStatus,
} from "./types.js";

/** Repository-relative path where orient looks for the latest Codex preflight receipt. */
export const PREFLIGHT_RECEIPT_PATH =
	".harness/runtime/codex-preflight-status.json";

const PREFLIGHT_COMMAND =
	"bash scripts/codex-preflight.sh --stack auto --mode required";
const SOURCE_CHECKOUT_PACKAGE_NAME = "@brainwav/coding-harness";

/** Build the read-only cold-start orientation packet from existing harness surfaces. */
export function collectHarnessOrient(
	options: HarnessOrientOptions,
): HarnessOrientReport {
	const generatedAt = (options.now ?? new Date()).toISOString();
	const repoRoot = canonicalRepoRoot(options.repoRoot ?? process.cwd());
	const commandPrefix = commandPrefixFor(repoRoot);
	const clock = options.now ? { now: options.now } : {};
	const agentReadiness = assessAgentReadiness({
		repoRoot,
		...clock,
	});
	const sessionContext = collectSessionContext({
		repoRoot,
		...clock,
	});
	const nextDecision = options.nextDecisionProvider({
		repoRoot,
		contextHealth: agentReadiness.contextHealth,
	});
	const preflightReceipt = readPreflightReceipt(repoRoot);
	const architectureContext = buildArchitectureContext(repoRoot);
	const projectBrain = buildProjectBrain(repoRoot, options.now);
	const orientationRefs = buildOrientationRefs(repoRoot);
	const contextCommands = buildContextCommands(commandPrefix, repoRoot);
	const conditionalContext = buildConditionalContext(commandPrefix, repoRoot);

	return {
		schemaVersion: "harness-orient/v1",
		generatedAt,
		producer: "harness:orient",
		status: deriveOrientStatus({
			nextDecision,
			sessionContext,
			contextHealth: agentReadiness.contextHealth,
			preflightReceipt,
			architectureContext,
			projectBrain,
		}),
		evidenceUse: "orientation",
		repoRoot,
		nextDecision: summarizeNextDecision(nextDecision, commandPrefix, repoRoot),
		sessionContext: summarizeSessionContext(
			sessionContext,
			commandPrefix,
			repoRoot,
		),
		agentReadinessContextHealth: agentReadiness.contextHealth,
		preflightReceipt,
		architectureContext,
		projectBrain,
		orientationRefs,
		contextCommands,
		conditionalContext,
		truthLaneWarnings: TRUTH_LANE_WARNINGS,
	};
}

/** Resolve the requested repo root to a stable canonical filesystem path. */
function canonicalRepoRoot(repoRoot: string): string {
	return realpathSync(resolve(repoRoot));
}

/** Pick the public command prefix that matches package source checkouts. */
function commandPrefixFor(repoRoot: string): HarnessOrientCommandPrefix {
	const packagePath = join(repoRoot, "package.json");
	const sourceCliPath = join(repoRoot, "src/cli.ts");
	const distCliPath = join(repoRoot, "dist/cli.js");
	if (!existsSync(packagePath) || !existsSync(sourceCliPath)) {
		return "harness";
	}
	try {
		const parsed = JSON.parse(readFileSync(packagePath, "utf8")) as {
			name?: unknown;
		};
		if (parsed.name !== SOURCE_CHECKOUT_PACKAGE_NAME) return "harness";
		return existsSync(distCliPath)
			? "pnpm exec harness"
			: "node --import tsx src/cli.ts";
	} catch {
		return "harness";
	}
}

/** Convert the full next decision into the compact orient packet shape. */
function summarizeNextDecision(
	decision: HarnessDecision,
	commandPrefix: HarnessOrientCommandPrefix,
	repoRoot: string,
): HarnessOrientNextDecision {
	return {
		schemaVersion: decision.schemaVersion,
		status: decision.status,
		phase: decision.phase,
		cockpitLane: decision.cockpitLane ?? null,
		summary: decision.summary,
		nextAction: decision.nextAction,
		nextCommand: scopeOrientHarnessCommand(
			decision.nextCommand,
			commandPrefix,
			repoRoot,
		),
		failureClass: decision.failureClass,
		requiredEvidence: [...decision.requiredEvidence],
		stopConditions: [...decision.stopConditions],
		followUpCommands: decision.followUpCommands.map(
			(command) =>
				scopeOrientHarnessCommand(command, commandPrefix, repoRoot) ?? command,
		),
	};
}

/** Summarize session-context evidence without embedding bulky changed-file data. */
function summarizeSessionContext(
	report: SessionContextReport,
	commandPrefix: HarnessOrientCommandPrefix,
	repoRoot: string,
): HarnessOrientReport["sessionContext"] {
	return {
		schemaVersion: report.schemaVersion,
		status: report.status,
		repository: report.repository,
		branch: report.branch,
		headSha: report.headSha,
		issueRef: report.issueRef,
		changedFileCount: report.changedFiles.length,
		activeArtifactCount: report.activeArtifacts.length,
		runtimeCardCount: report.runtimeCards.length,
		reviewArtifactCount: report.reviewArtifacts.length,
		staleState: report.staleState,
		nextTraversalHints: buildOrientTraversalHints(commandPrefix, repoRoot),
	};
}

/** Read the latest preflight receipt, or emit an explicit unobserved state. */
function readPreflightReceipt(repoRoot: string): HarnessOrientPreflightReceipt {
	const absolutePath = join(repoRoot, PREFLIGHT_RECEIPT_PATH);
	if (!existsSync(absolutePath)) {
		return {
			path: PREFLIGHT_RECEIPT_PATH,
			status: "unobserved",
			schemaVersion: null,
			generatedAt: null,
			mode: null,
			command: PREFLIGHT_COMMAND,
			reason:
				"No codex preflight receipt was found; run the suggested command before relying on preflight status.",
		};
	}
	try {
		const parsed = JSON.parse(readFileSync(absolutePath, "utf8")) as {
			schemaVersion?: unknown;
			generatedAt?: unknown;
			mode?: unknown;
			status?: unknown;
			command?: unknown;
		};
		const status = preflightStatus(parsed.status);
		if (status === "invalid") {
			return invalidPreflightReceipt("Receipt status was not recognized.");
		}
		if (parsed.schemaVersion !== "codex-preflight-status/v1") {
			return invalidPreflightReceipt(
				"Receipt schemaVersion was not codex-preflight-status/v1.",
			);
		}
		if (typeof parsed.generatedAt !== "string") {
			return invalidPreflightReceipt("Receipt generatedAt was not a string.");
		}
		if (typeof parsed.mode !== "string") {
			return invalidPreflightReceipt("Receipt mode was not a string.");
		}
		return {
			path: PREFLIGHT_RECEIPT_PATH,
			status,
			schemaVersion: parsed.schemaVersion,
			generatedAt: parsed.generatedAt,
			mode: parsed.mode,
			command:
				typeof parsed.command === "string" ? parsed.command : PREFLIGHT_COMMAND,
			reason: null,
		};
	} catch (error) {
		return invalidPreflightReceipt(
			"Receipt could not be parsed as JSON: " +
				(error instanceof Error ? error.message : String(error)) +
				".",
		);
	}
}

/** Build an invalid preflight receipt with the recovery command preserved. */
function invalidPreflightReceipt(
	reason: string,
): HarnessOrientPreflightReceipt {
	return {
		path: PREFLIGHT_RECEIPT_PATH,
		status: "invalid",
		schemaVersion: null,
		generatedAt: null,
		mode: null,
		command: PREFLIGHT_COMMAND,
		reason,
	};
}

/** Normalize a raw preflight status field into the orient status vocabulary. */
function preflightStatus(
	status: unknown,
): HarnessOrientPreflightReceipt["status"] {
	return status === "pass" ||
		status === "warn" ||
		status === "fail" ||
		status === "blocked"
		? status
		: "invalid";
}

/** Describe the lazy architecture context and its freshness check command. */
function buildArchitectureContext(
	repoRoot: string,
): HarnessOrientArchitectureContext {
	return {
		path: ARCHITECTURE_CONTEXT_PATH,
		status: pathExists(repoRoot, ARCHITECTURE_CONTEXT_PATH)
			? "present"
			: "missing",
		manifestPath: DIAGRAM_MANIFEST_PATH,
		readWhen:
			"Read when touching src/**, scripts/**, command registry, architecture docs, generated diagrams, or module boundaries.",
		validateWhenChangedCommand: "bash scripts/check-diagram-freshness.sh",
	};
}

/** Inspect Project Brain as orientation evidence without promoting it to delivery truth. */
function buildProjectBrain(
	repoRoot: string,
	now?: Date,
): HarnessOrientProjectBrain {
	const harnessDir = join(repoRoot, ".harness");
	if (!safeDirectoryExists(harnessDir)) {
		return {
			brainStatus: "unobserved",
			brainStale: "unobserved",
			authority: "orientation_only",
			refs: projectBrainRefs(repoRoot),
			validationSummary: null,
			staleFileCount: null,
			reason: ".harness directory was not found.",
		};
	}
	try {
		const status = runBrainStatus(harnessDir);
		const stale = runBrainStale(harnessDir, now ? { now } : undefined);
		const staleFiles = Array.isArray(stale.report.staleFiles)
			? stale.report.staleFiles
			: [];
		return {
			brainStatus: "observed",
			brainStale: staleFiles.length > 0 ? "warn" : "pass",
			authority: "orientation_only",
			refs: projectBrainRefs(repoRoot),
			validationSummary: status.validation.summary as Record<string, unknown>,
			staleFileCount: staleFiles.length,
			reason: null,
		};
	} catch (error) {
		return {
			brainStatus: "unobserved",
			brainStale: "unobserved",
			authority: "orientation_only",
			refs: projectBrainRefs(repoRoot),
			validationSummary: null,
			staleFileCount: null,
			reason:
				"Project Brain could not be inspected: " +
				(error instanceof Error ? error.message : String(error)) +
				".",
		};
	}
}

/** Return present Project Brain references that a cold agent can inspect next. */
function projectBrainRefs(repoRoot: string): string[] {
	return [
		".harness/knowledge/INDEX.md",
		".harness/memory/LEARNINGS.md",
		".harness/review-log.md",
	].filter((path) => pathExists(repoRoot, path));
}

/** Reduce component statuses into the single advisory orient status. */
function deriveOrientStatus(args: {
	nextDecision: HarnessDecision;
	sessionContext: SessionContextReport;
	contextHealth: AgentReadinessContextHealth;
	preflightReceipt: HarnessOrientPreflightReceipt;
	architectureContext: HarnessOrientArchitectureContext;
	projectBrain: HarnessOrientProjectBrain;
}): HarnessOrientStatus {
	if (args.contextHealth.status === "fail") return "fail";
	if (args.nextDecision.status === "fail") return "fail";
	if (hasOrientWarningStatus(args)) return "warn";
	return "pass";
}

/** Check whether any advisory orient component should reduce status to warn. */
function hasOrientWarningStatus(args: {
	nextDecision: HarnessDecision;
	sessionContext: SessionContextReport;
	contextHealth: AgentReadinessContextHealth;
	preflightReceipt: HarnessOrientPreflightReceipt;
	architectureContext: HarnessOrientArchitectureContext;
	projectBrain: HarnessOrientProjectBrain;
}): boolean {
	return (
		args.nextDecision.status === "blocked" ||
		args.sessionContext.status !== "pass" ||
		args.contextHealth.status !== "pass" ||
		!preflightReceiptSatisfiesRequiredMode(args.preflightReceipt) ||
		args.architectureContext.status !== "present" ||
		args.projectBrain.brainStatus !== "observed" ||
		args.projectBrain.brainStale !== "pass" ||
		projectBrainHasValidationErrors(args.projectBrain)
	);
}

function preflightReceiptSatisfiesRequiredMode(
	preflightReceipt: HarnessOrientPreflightReceipt,
): boolean {
	return (
		preflightReceipt.status === "pass" && preflightReceipt.mode === "required"
	);
}

/** Check whether Project Brain validation surfaced errors in the orient packet. */
function projectBrainHasValidationErrors(
	projectBrain: HarnessOrientProjectBrain,
): boolean {
	const errors = projectBrain.validationSummary?.errors;
	return typeof errors === "number" && errors > 0;
}

/** Check for a repository-relative path without following any higher-level policy. */
function pathExists(repoRoot: string, repoPath: string): boolean {
	return existsSync(join(repoRoot, repoPath));
}

/** Check whether a path is an existing directory while treating stat errors as absent. */
function safeDirectoryExists(path: string): boolean {
	try {
		return existsSync(path) && statSync(path).isDirectory();
	} catch {
		return false;
	}
}

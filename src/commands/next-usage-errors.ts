import type { HarnessDecision } from "../lib/decision/harness-decision.js";
import type { DecisionSource } from "../lib/decision/sources.js";
import { NEXT_ARTIFACT_ARG_SPECS } from "./next-artifact-args.js";
import type { ParsedNextArgs } from "./next-args.js";
import {
	blockedDecision,
	invalidModeDecision,
	type HarnessNextMode,
} from "./next-decisions.js";
import type { HarnessNextOptions } from "./next-runner.js";
import { humanRequiredDecisionMeta, sourceMetaExtra } from "./next-support.js";

type HarnessNextRunner = (options: HarnessNextOptions) => HarnessDecision;
type UsageErrorOptions = Omit<HarnessNextOptions, "mode" | "files">;
type NextUsageError = NonNullable<ParsedNextArgs["error"]>;
type UsageErrorHandler = (parsed: ParsedNextArgs) => HarnessDecision;
type MappedUsageError = Exclude<NextUsageError, "files_empty">;
type ArtifactUsageError = (typeof NEXT_ARTIFACT_ARG_SPECS)[number]["error"];
function blockedUsageErrorDecision(args: {
	mode: HarnessNextMode;
	summary: string;
	nextAction: string;
	failureClass: string;
	evidenceRef?: string[];
	filesSource?: "override";
	extra?: Record<string, unknown>;
}): HarnessDecision {
	return blockedDecision({
		summary: args.summary,
		nextAction: args.nextAction,
		failureClass: args.failureClass,
		...(args.evidenceRef ? { evidenceRef: args.evidenceRef } : {}),
		meta: humanRequiredDecisionMeta({
			mode: args.mode,
			...(args.filesSource ? { filesSource: args.filesSource } : {}),
			frictionClass: "unclear_instruction",
			...(args.extra ? { extra: args.extra } : {}),
		}),
	});
}
function artifactUsageErrorHandlers(): Record<
	ArtifactUsageError,
	UsageErrorHandler
> {
	return Object.fromEntries(
		NEXT_ARTIFACT_ARG_SPECS.map((spec) => [
			spec.error,
			(parsed: ParsedNextArgs) =>
				blockedUsageErrorDecision({
					mode: parsed.mode,
					summary: `${spec.flag} requires a JSON artifact path.`,
					nextAction: spec.nextAction,
					failureClass: spec.error,
					evidenceRef: [`input:${spec.flag.slice(2)}`],
				}),
		]),
	) as Record<ArtifactUsageError, UsageErrorHandler>;
}

const USAGE_ERROR_HANDLERS: Record<MappedUsageError, UsageErrorHandler> = {
	invalid_mode: (parsed) => invalidModeDecision(parsed.errorValue ?? "unknown"),
	mode_missing: (parsed) =>
		blockedUsageErrorDecision({
			mode: parsed.mode,
			summary: "--mode requires a value.",
			nextAction: "Use --mode local, --mode pr, or --mode ci.",
			failureClass: "mode_missing",
		}),
	files_missing: (parsed) =>
		blockedUsageErrorDecision({
			mode: parsed.mode,
			summary: "--files requires a comma-separated path list.",
			nextAction: "Pass one or more changed files, or omit --files.",
			failureClass: "files_missing",
			evidenceRef: ["input:files"],
			filesSource: "override",
		}),
	evidence_missing: (parsed) =>
		blockedUsageErrorDecision({
			mode: parsed.mode,
			summary: "--evidence requires optional or required.",
			nextAction: "Use --evidence optional or --evidence required.",
			failureClass: "evidence_missing",
		}),
	evidence_invalid: (parsed) =>
		blockedUsageErrorDecision({
			mode: parsed.mode,
			summary: `Invalid evidence mode: ${parsed.errorValue ?? "unknown"}.`,
			nextAction: "Use --evidence optional or --evidence required.",
			failureClass: "evidence_invalid",
		}),
	worktree_role_invalid: (parsed) =>
		blockedUsageErrorDecision({
			mode: parsed.mode as HarnessNextMode,
			summary: `Invalid --worktree-role: ${parsed.errorValue ?? "missing value"}.`,
			nextAction:
				"Use --worktree-role clean, --worktree-role dirty-with-justification, or --worktree-role fresh-worktree.",
			failureClass: "worktree_role_invalid",
			extra: {
				validRoles: ["clean", "dirty-with-justification", "fresh-worktree"],
			},
		}),
	...artifactUsageErrorHandlers(),
	unknown_argument: (parsed) =>
		blockedUsageErrorDecision({
			mode: parsed.mode as HarnessNextMode,
			summary: `Unknown next argument: ${parsed.errorValue}.`,
			nextAction:
				"Use harness next --json with optional --files, --phase-exit, --runtime-card, --pr-closeout, --fitness-report, --synaipse-transition, and --mode flags.",
			failureClass: "unknown_argument",
			extra: { argument: parsed.errorValue },
		}),
};

/** Build a blocking decision when `harness next` lacks required evidence. */
export function requiredEvidenceMissingDecision(args: {
	mode: HarnessNextMode;
	missing: readonly string[];
	sourceErrors: readonly DecisionSource[];
}): HarnessDecision {
	return blockedDecision({
		summary: `harness next --mode ${args.mode} requires current ${args.missing.join(", ")} evidence.`,
		nextAction:
			"Provide --phase-exit and --runtime-card artifacts, or rerun in --mode local for exploratory recommendations.",
		failureClass: "required_evidence_missing",
		evidenceRef: args.missing.map((item) => `input:${item}`),
		meta: humanRequiredDecisionMeta({
			mode: args.mode,
			frictionClass: "repo_state",
			extra: {
				...sourceMetaExtra(args.sourceErrors),
				missingEvidence: args.missing,
			},
		}),
	});
}

/** Convert parsed `harness next` usage errors into structured decisions. */
export function usageErrorDecision(
	parsed: ParsedNextArgs,
	options: UsageErrorOptions,
	runNext: HarnessNextRunner,
): HarnessDecision | undefined {
	if (!parsed.error) return undefined;
	if (parsed.error === "files_empty") {
		return runNext({
			...options,
			mode: parsed.mode,
			...(parsed.evidenceMode !== undefined
				? { evidenceMode: parsed.evidenceMode }
				: {}),
			files: [],
		});
	}
	return USAGE_ERROR_HANDLERS[parsed.error](parsed);
}

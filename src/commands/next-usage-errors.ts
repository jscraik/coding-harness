import type { HarnessDecision } from "../lib/decision/harness-decision.js";
import type { DecisionSource } from "../lib/decision/sources.js";
import { humanRequiredDecisionMeta, sourceMetaExtra } from "./next-support.js";
import type { ParsedNextArgs } from "./next-args.js";
import type { HarnessNextOptions } from "./next-runner.js";
import {
	blockedDecision,
	invalidModeDecision,
	type HarnessNextMode,
} from "./next-decisions.js";

type HarnessNextRunner = (options: HarnessNextOptions) => HarnessDecision;

type UsageErrorOptions = Omit<HarnessNextOptions, "mode" | "files">;

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

/** Build the HarnessDecision for missing required harness next evidence. */
export function requiredEvidenceMissingDecision(args: {
	mode: HarnessNextMode;
	missing: readonly string[];
	sourceErrors: readonly DecisionSource[];
}): HarnessDecision {
	return blockedDecision({
		summary:
			"harness next --mode " +
			args.mode +
			" requires current " +
			args.missing.join(", ") +
			" evidence.",
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

/** Build the HarnessDecision for invalid harness next CLI usage. */
export function usageErrorDecision(
	parsed: ParsedNextArgs,
	options: UsageErrorOptions,
	runNext: HarnessNextRunner,
): HarnessDecision | undefined {
	switch (parsed.error) {
		case "invalid_mode":
			return invalidModeDecision(parsed.errorValue ?? "unknown");
		case "mode_missing":
			return blockedUsageErrorDecision({
				mode: parsed.mode,
				summary: "--mode requires a value.",
				nextAction: "Use --mode local, --mode pr, or --mode ci.",
				failureClass: "mode_missing",
			});
		case "files_missing":
			return blockedUsageErrorDecision({
				mode: parsed.mode,
				summary: "--files requires a comma-separated path list.",
				nextAction: "Pass one or more changed files, or omit --files.",
				failureClass: "files_missing",
				evidenceRef: ["input:files"],
				filesSource: "override",
			});
		case "files_empty":
			return runNext({
				...options,
				mode: parsed.mode,
				...(parsed.evidenceMode !== undefined
					? { evidenceMode: parsed.evidenceMode }
					: {}),
				files: [],
			});
		case "evidence_missing":
			return blockedUsageErrorDecision({
				mode: parsed.mode,
				summary: "--evidence requires optional or required.",
				nextAction: "Use --evidence optional or --evidence required.",
				failureClass: "evidence_missing",
			});
		case "evidence_invalid":
			return blockedUsageErrorDecision({
				mode: parsed.mode,
				summary: `Invalid evidence mode: ${parsed.errorValue ?? "unknown"}.`,
				nextAction: "Use --evidence optional or --evidence required.",
				failureClass: "evidence_invalid",
			});
		case "worktree_role_invalid":
			return blockedUsageErrorDecision({
				mode: parsed.mode as HarnessNextMode,
				summary:
					"Invalid --worktree-role: " +
					(parsed.errorValue ?? "missing value") +
					".",
				nextAction:
					"Use --worktree-role clean, --worktree-role dirty-with-justification, or --worktree-role fresh-worktree.",
				failureClass: "worktree_role_invalid",
				extra: {
					validRoles: ["clean", "dirty-with-justification", "fresh-worktree"],
				},
			});
		case "phase_exit_missing":
			return blockedUsageErrorDecision({
				mode: parsed.mode,
				summary: "--phase-exit requires a JSON artifact path.",
				nextAction:
					"Pass a HePhaseExit/v1 artifact path, or omit --phase-exit.",
				failureClass: "phase_exit_missing",
				evidenceRef: ["input:phase-exit"],
			});
		case "runtime_card_missing":
			return blockedUsageErrorDecision({
				mode: parsed.mode,
				summary: "--runtime-card requires a JSON artifact path.",
				nextAction:
					"Pass a runtime-card/v1 artifact path, or omit --runtime-card.",
				failureClass: "runtime_card_missing",
				evidenceRef: ["input:runtime-card"],
			});
		case "unknown_argument":
			return blockedUsageErrorDecision({
				mode: parsed.mode as HarnessNextMode,
				summary: `Unknown next argument: ${parsed.errorValue}.`,
				nextAction:
					"Use harness next --json with optional --files, --phase-exit, --runtime-card, and --mode flags.",
				failureClass: "unknown_argument",
				extra: { argument: parsed.errorValue },
			});
		default:
			return undefined;
	}
}

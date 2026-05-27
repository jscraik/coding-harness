import {
	buildLiveRuntimeCard,
	buildLocalRuntimeCard,
} from "../lib/runtime/local-runtime-card.js";
import { sanitizeError } from "../lib/input/sanitize.js";
import {
	adaptCodexRuntimeEvidenceToRuntimeEvidenceBundle,
	CODEX_RUNTIME_EVIDENCE_SCHEMA_VERSION,
	type CodexRuntimeEvidence,
} from "../lib/runtime/codex-runtime-evidence.js";
import { readRepoRuntimeJsonArtifact } from "../lib/runtime/repo-runtime-artifact.js";
import {
	createRuntimeCardTraceRecorder,
	parseRuntimeCardTraceOutPath,
	type RuntimeCardTraceRecorder,
} from "../lib/runtime-trace/runtime-card-trace.js";
import type { RuntimeCard } from "../lib/runtime/runtime-card.js";
import {
	type RuntimeCardCLIOptions,
	parseRuntimeCardArgs,
} from "./runtime-card-args.js";
import { writeRuntimeCardArtifacts } from "./runtime-card-artifacts.js";

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeEvidenceInput(
	evidence: unknown,
	artifactPath: string,
): unknown {
	if (
		isRecord(evidence) &&
		evidence.schemaVersion === CODEX_RUNTIME_EVIDENCE_SCHEMA_VERSION
	) {
		return adaptCodexRuntimeEvidenceToRuntimeEvidenceBundle(
			evidence as unknown as CodexRuntimeEvidence,
			{ provenanceRef: `artifact:${artifactPath}` },
		);
	}
	return evidence;
}

/**
 * Loads and parses a JSON evidence bundle file referenced by `artifactPath`, constrained to stay within `repoRoot`.
 *
 * @param repoRoot - The repository root used to resolve relative `artifactPath` values.
 * @param artifactPath - Path to the evidence JSON file relative to `repoRoot`.
 * @returns The parsed JSON value from the evidence file.
 * @throws Error if `artifactPath` is absolute or resolves outside `repoRoot` with the message "--evidence must stay within --repo".
 */
function loadEvidenceBundle(repoRoot: string, artifactPath: string): unknown {
	const evidence = readRepoRuntimeJsonArtifact(
		repoRoot,
		artifactPath,
		"--evidence",
	);
	return normalizeEvidenceInput(evidence, artifactPath);
}

function createTraceRecorder(
	options: RuntimeCardCLIOptions,
): RuntimeCardTraceRecorder | undefined {
	if (!options.traceOutPath) return undefined;
	const target = parseRuntimeCardTraceOutPath(options.traceOutPath);
	if (!target) {
		throw new Error(
			"--trace-out must be artifacts/agent-runs/<runId>/events.jsonl",
		);
	}
	return createRuntimeCardTraceRecorder({
		repoRoot: options.repoRoot,
		target,
		context: options.context,
		live: options.live,
		...(options.issueKey ? { issueKey: options.issueKey } : {}),
		...(options.evidencePath ? { evidencePath: options.evidencePath } : {}),
		...(options.phaseExitPath ? { phaseExitPath: options.phaseExitPath } : {}),
	});
}

function safelyRecordTraceFailure(
	trace: RuntimeCardTraceRecorder | undefined,
	message: string,
): void {
	if (!trace) return;
	try {
		trace.recordTerminal({
			exitCode: 1,
			outcome: "failed",
			classification: "runtime_failed",
			failureMessage: message,
		});
	} catch {
		// Preserve the original runtime-card failure. Trace write failures are surfaced by the original thrown path when they occur before this catch.
	}
}

/**
 * Render a human-readable summary of a runtime card to the console.
 *
 * Prints key runtime-card/v1 fields (issue, lifecycle, branch, pull request, linear status/freshness,
 * artifacts status, phase-exit status, next safe action) and any blockers to console.info.
 *
 * @param card - The RuntimeCard to render
 */
function renderRuntimeCardHuman(card: RuntimeCard): void {
	console.info("runtime-card/v1");
	console.info(`issue: ${card.issueKey ?? "unknown"}`);
	console.info(`lifecycle: ${card.lifecycle}`);
	console.info(`branch: ${card.branch.name ?? "unknown"}`);
	console.info(
		`pull-request: ${card.pullRequest.number ? `#${card.pullRequest.number}` : "unknown"}`,
	);
	console.info(`linear: ${card.linear.status ?? card.linear.freshness}`);
	console.info(`artifacts: ${card.artifacts.status}`);
	console.info(`phase-exit: ${card.phaseExit.status}`);
	console.info(`next: ${card.nextSafeAction}`);
	if (card.blockers.length > 0) {
		console.info("blockers:");
		for (const blocker of card.blockers) {
			console.info(`- ${blocker}`);
		}
	}
}

/**
 * Execute the `harness runtime-card` CLI: parse flags, build a `runtime-card/v1`, and emit or persist its output.
 *
 * Performs argument parsing and validation, optionally loads an evidence bundle constrained to `--repo`, builds the card using local or live providers based on flags, writes JSON artifacts to `--out` and `--evidence-out` when specified, and prints either pretty JSON or a human-readable view. On failure, prints a sanitized error in the selected output format.
 *
 * @param args - Command-line arguments (typically `process.argv.slice(2)`)
 * @returns Exit code: `0` on success, `1` on runtime error, or another code returned by the argument parser (for example, help or invalid arguments)
 */
export async function runRuntimeCardCLI(args: string[]): Promise<number> {
	const parsed = parseRuntimeCardArgs(args);
	if ("exitCode" in parsed) return parsed.exitCode;
	let trace: RuntimeCardTraceRecorder | undefined;
	try {
		trace = createTraceRecorder(parsed.options);
		trace?.recordStart();
		trace?.recordInputs();
		trace?.recordAdvisoryMode();
		const evidenceBundle = parsed.options.evidencePath
			? loadEvidenceBundle(parsed.options.repoRoot, parsed.options.evidencePath)
			: undefined;
		const buildOptions = {
			repoRoot: parsed.options.repoRoot,
			...(parsed.options.issueKey ? { issueKey: parsed.options.issueKey } : {}),
			...(parsed.options.phaseExitPath
				? { phaseExitPath: parsed.options.phaseExitPath }
				: {}),
			...(evidenceBundle !== undefined ? { evidenceBundle } : {}),
			requirePhaseExit: parsed.options.context !== "local",
		};
		const card = parsed.options.live
			? await buildLiveRuntimeCard(buildOptions)
			: buildLocalRuntimeCard(buildOptions);
		writeRuntimeCardArtifacts(parsed.options, card, trace);
		trace?.recordTerminal({
			exitCode: 0,
			outcome: "success",
			classification: "ok",
			card,
		});
		if (parsed.options.json) {
			console.info(JSON.stringify(card, null, 2));
		} else {
			renderRuntimeCardHuman(card);
		}
		return 0;
	} catch (error) {
		const message = sanitizeError(error);
		safelyRecordTraceFailure(trace, message);
		if (parsed.options.json) {
			console.info(
				JSON.stringify(
					{
						schemaVersion: "runtime-card-error/v1",
						status: "fail",
						error: message,
					},
					null,
					2,
				),
			);
		} else {
			console.error(`runtime-card: ${message}`);
		}
		return 1;
	}
}

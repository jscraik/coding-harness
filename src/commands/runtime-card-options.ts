/** Runtime context used when building runtime-card evidence. */
export type RuntimeCardContext = "local" | "pr" | "ci" | "closeout";

/** Parsed CLI options for `harness runtime-card`. */
export interface RuntimeCardCLIOptions {
	/** Whether to print JSON output. */
	json: boolean;
	/** Repository root used for git and artifact resolution. */
	repoRoot: string;
	/** Runtime context being summarized. */
	context: RuntimeCardContext;
	/** Optional tracker issue key. */
	issueKey?: string;
	/** Optional phase-exit artifact path. */
	phaseExitPath?: string;
	/** Optional runtime evidence bundle path. */
	evidencePath?: string;
	/** Optional runtime-card output path. */
	outPath?: string;
	/** Optional runtime evidence bundle output path. */
	evidenceOutPath?: string;
	/** Optional runtime-card handoff receipt output path. */
	handoffOutPath?: string;
	/** Optional canonical run-record event stream path. */
	traceOutPath?: string;
	/** Whether live provider state should be collected. */
	live: boolean;
}

const VALID_RUNTIME_CARD_CONTEXTS: readonly RuntimeCardContext[] = [
	"local",
	"pr",
	"ci",
	"closeout",
];

/** Return whether a raw CLI value is an admitted runtime-card context. */
export function isRuntimeCardContext(
	value: string,
): value is RuntimeCardContext {
	return VALID_RUNTIME_CARD_CONTEXTS.includes(value as RuntimeCardContext);
}

/** Print usage syntax for the `harness runtime-card` command. */
export function printRuntimeCardUsage(): void {
	console.info(
		"Usage: harness runtime-card [--json] [--live] [--repo <path>] [--context local|pr|ci|closeout] [--issue <key>] [--phase-exit <path>] [--evidence <path>] [--out <path>] [--evidence-out <path>] [--handoff-out <path>] [--trace-out artifacts/agent-runs/<runId>/events.jsonl]",
	);
	console.info("");
	console.info(
		"Build a runtime-card/v1 artifact from git, .harness evidence, normalized evidence bundles, and optional live provider state.",
	);
}

#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
	dispatchRegistryCommand,
	getRegistryCommandHelpRows,
} from "./lib/cli/command-registry.js";
import { renderCommandHelpRows } from "./lib/cli/help-renderer.js";
import { parseCsvList, parseIntegerArg } from "./lib/cli/parse-utils.js";
import { sanitizeError } from "./lib/input/sanitize.js";
import { getVersion } from "./lib/version.js";

// Consolidated error handler
function handleFatalError(type: string, error: unknown): never {
	console.error(`${type}:`, sanitizeError(error));
	if (process.env.DEBUG === "1") {
		console.error("Full error (DEBUG mode):", error);
	}
	process.exit(1);
}

process.on("unhandledRejection", (reason) => {
	handleFatalError("Unhandled Rejection", reason);
});

process.on("uncaughtException", (error) => {
	handleFatalError("Uncaught Exception", error);
});

/**
 * Display the CLI usage, available commands, and grouped option summaries.
 *
 * Writes a help listing to the console that includes legacy commands, registry-provided commands,
 * and categorized option descriptions for the CLI's various commands and gates.
 */
function printUsage(): void {
	const legacyCommandRows = [
		{ name: "init", summary: "Install harness in current directory" },
		{
			name: "eject",
			summary: "Eject harness configuration from the repository",
		},
		{
			name: "doctor",
			summary: "Check all gate prerequisites (tools, files, config, CI)",
		},
		{ name: "health", summary: "Unified gate status scorecard (all gates)" },
		{
			name: "ci-migrate",
			summary: "Safely migrate CI execution from GitHub Actions to CircleCI",
		},
		{ name: "risk-tier", summary: "Classify files by risk tier" },
		{ name: "gardener", summary: "Detect stale docs and broken links" },
		{
			name: "memory-gate",
			summary: "Validate local-memory workflow compliance",
		},
		{
			name: "silent-error",
			summary: "Detect silent error handling anti-patterns",
		},
		{ name: "brainstorm-gate", summary: "Validate brainstorm artifacts" },
		{ name: "plan-gate", summary: "Validate plan artifacts" },
		{ name: "prompt-gate", summary: "Validate prompt template usage" },
		{
			name: "blast-radius",
			summary: "Determine required checks from changed files",
		},
		{
			name: "remediate",
			summary: "Auto-plan and execute deterministic remediation",
		},
		{
			name: "gap-case",
			summary: "Manage production gap cases (create/list/resolve)",
		},
		{
			name: "observability-gate",
			summary: "Check cardinality limits in metrics",
		},
		{ name: "diff-budget", summary: "Enforce diff budget constraints" },
		{
			name: "drift-gate",
			summary: "Evaluate consistency drift across governance surfaces",
		},
		{
			name: "automation-run",
			summary: "Execute Pulse/Upskill/Green PRs/Drift Check idempotently",
		},
		{ name: "ui:fast", summary: "Storybook-first local development loop" },
		{ name: "ui:verify", summary: "Playwright smoke suite with evidence" },
		{
			name: "ui:explore",
			summary: "Agent browser exploratory testing",
		},
		{
			name: "context",
			summary: "Semantic search for relevant prior work",
		},
		{
			name: "search",
			summary: "Agent-first hybrid lexical + semantic search",
		},
		{
			name: "index-context",
			summary: "Bulk index governed and supporting context for search",
		},
		{
			name: "context-health",
			summary: "Generate advisory context-integrity scorecards",
		},
		{
			name: "pilot-evaluate",
			summary: "Evaluate pilot metrics and determine promotion",
		},
		{
			name: "pilot-rollback",
			summary: "Transition pilot mode (autonomous <-> manual)",
		},
		{
			name: "verify-coderabbit",
			summary: "Verify CodeRabbit setup and configuration",
		},
		{
			name: "simulate",
			summary: "Run counterfactual policy simulation",
		},
		{
			name: "preset",
			summary: "List and inspect bundled presets",
		},
		{
			name: "org-audit",
			summary: "Multi-repo governance visibility and drift detection",
		},
		{
			name: "tooling-audit",
			summary: "Multi-repo tooling baseline audit for managed repo surfaces",
		},
		{
			name: "upgrade",
			summary: "Upgrade harness scaffold to the latest version",
		},
		{
			name: "replay",
			summary: "Replay or list captured agent automation traces",
		},
	];

	console.info("Usage: harness <command> [options]");
	console.info("");
	console.info("Commands:");
	for (const line of renderCommandHelpRows([
		...legacyCommandRows,
		...getRegistryCommandHelpRows(),
	])) {
		console.info(line);
	}
	console.info("");
	console.info("Blast Radius Options:");
	console.info("  --contract       Path to harness.contract.json");
	console.info("  --files <paths>  Comma-separated list of changed file paths");
	console.info("  --json           Output as JSON");
	console.info("  --verbose        Include verbose summary output");
	console.info("");
	console.info("Check Authz Options:");
	console.info("  --contract       Path to harness.contract.json");
	console.info("  --repo           Repository to check (owner/repo format)");
	console.info("  --branch         Branch to check");
	console.info("  --check-scopes   Check GITHUB_TOKEN scopes against policy");
	console.info("  --json           Output as JSON");
	console.info("");
	console.info("Automation Run Options:");
	console.info(
		"  --name           pulse|upskill|green-prs|drift-check (required)",
	);
	console.info(
		"  --repo           Repository identifier owner/repo (required)",
	);
	console.info("  --head-sha       HEAD SHA for key binding (required)");
	console.info(
		"  --contract-version  Contract version for key binding (required)",
	);
	console.info(
		"  --input-fingerprint  Input fingerprint for key binding (required)",
	);
	console.info(
		"  --artifacts-dir  Artifact root (default: artifacts/automation)",
	);
	console.info("  --state-path     Idempotency state file path override");
	console.info("  --force          Override replay for terminal runs");
	console.info("  --simulate-failure  Test-only failure simulation");
	console.info("  --json           Output as JSON");
	console.info("");
	console.info("Check Environment Options:");
	console.info("  --contract       Path to harness.contract.json");
	console.info("  --check-secrets  Check for secrets in environment variables");
	console.info("  --attestation    Path to write attestation artifact");
	console.info("  --json           Output as JSON");
	console.info("");
	console.info("Local Memory Preflight Options:");
	console.info("  --config        Path to local-memory config.yaml");
	console.info("  --daemon-log    Path to local-memory daemon.log");
	console.info("  --json          Output as JSON");
	console.info("");
	console.info("Pilot Evaluate Options:");
	console.info("  --artifacts      Artifacts directory (required)");
	console.info("  --contract       Path to harness.contract.json");
	console.info("  --output         Write evaluation JSON to file");
	console.info("  --lane           advisory|health");
	console.info("  --kill-switch    Force manual safe mode");
	console.info("  --adapter-registry  Override adapter registry path");
	console.info("  --metric-registry   Override metric registry path");
	console.info("  --docs-gate-report  Trusted docs-gate machine report");
	console.info("  --evaluation-mode   local|pr|merge_group");
	console.info("  --rollout-stage    shadow|advisory|enforced");
	console.info("  --pr-template-status  passed|failed|missing");
	console.info("  --pr-template-ref     Trusted PR-template artifact ref");
	console.info("  --actor-id        Explicit actor identifier");
	console.info(
		"  --client-family   codex|claude_family|gemini_family|kimi_family|custom",
	);
	console.info("  --provider-id     Provider identifier");
	console.info("  --model-descriptor  Provider/model descriptor");
	console.info("  --execution-mode  interactive|automation|ci");
	console.info("  --operator-type   human_directed|automation|autonomous");
	console.info(
		"  --override-authorized-principal  Contract-authorized override principal",
	);
	console.info(
		"  --override-scope  advisory_hold|temporary_unblock|temporary_promote",
	);
	console.info("  --override-reason  Human-readable override reason");
	console.info("  --override-ticket  Ticket or approval reference");
	console.info("  --override-approved-by  Comma-separated approver principals");
	console.info("  --override-created-at  ISO timestamp for override creation");
	console.info("  --override-expires-at  ISO timestamp for override expiry");
	console.info("  --json            Output as JSON");
	console.info("");
	console.info("Docs Gate Options:");
	console.info("  --mode           advisory|required (default: advisory)");
	console.info("  --trigger        local|pull_request|merge_group|manual_ci");
	console.info("  --files          Comma-separated changed file paths");
	console.info("  --out            Write machine report to file");
	console.info("  --repo-root      Repository root to inspect (default: cwd)");
	console.info("  --trusted-base-ref      Base branch ref for truth loading");
	console.info("  --trusted-contract-sha  Expected contract file SHA");
	console.info("  --trusted-workflow-sha  Expected workflow file SHA");
	console.info("  --merge-queue-target-ref  Merge queue target branch");
	console.info("  --merge-queue-base-sha    Merge queue base SHA");
	console.info("  --json           Output as JSON");
	console.info("");
	console.info("Tooling Audit Options:");
	console.info("  --path           Directory containing repos to scan");
	console.info(
		"  --base           Base harness.contract.json for drift comparison",
	);
	console.info("  --format         json|markdown|table");
	console.info("  --include-missing  Include repos without contracts");
	console.info("  --json           Output as JSON");
	console.info("");
	console.info("Linear Workflow Options:");
	console.info("  linear <claim|handoff|close> --issue <id-or-url>");
	console.info("  linear prepare --issue <id-or-url> [--field <name>]");
	console.info("  --team           Optional team key/name filter");
	console.info("  --state          Override target workflow state");
	console.info(
		"  --assignee       Claim assignee (default: me, UUID supported)",
	);
	console.info("  --no-assign      Skip assignee updates during claim");
	console.info("  --comment        Add a handoff/closure note");
	console.info("  --branch         Include branch name in the Linear comment");
	console.info(
		"  --workspace      Include workspace/worktree path in the comment",
	);
	console.info("  --pr-url         Attach a pull request URL");
	console.info("  --evidence-url   Comma-separated evidence URLs to attach");
	console.info("  --links          Comma-separated reference URLs to attach");
	console.info(
		"  --branch-prefix  Override the generated branch prefix (default: codex)",
	);
	console.info(
		"  --field          branch|pr-title|pr-body|link-line|closing-line|issue-url",
	);
	console.info("  --token          Override LINEAR_API_KEY");
	console.info("  --json           Output as JSON");
	console.info("");
	console.info("Linear Sync Options:");
	console.info("  linear sync --findings <path|-> --team <key>");
	console.info(
		"  --findings       Path to findings JSON file (or - for stdin)",
	);
	console.info("  --team           Linear team key/name to create issues in");
	console.info("  --dry-run        Preview changes without writing to Linear");
	console.info("  --token          Override LINEAR_API_KEY");
	console.info("  --json           Output as JSON");
	console.info("");
	console.info("Linear Gate Options:");
	console.info("  --contract       Path to harness.contract.json");
	console.info("  --repo-root      Repository root to inspect (default: cwd)");
	console.info(
		"  --branch         Branch name to validate (defaults to git/env)",
	);
	console.info("  --pr-title       Pull request title to validate");
	console.info("  --pr-body        Pull request body to validate");
	console.info(
		"  --allow-missing-branch  Skip branch-name requirement when branch metadata is unavailable",
	);
	console.info(
		"  --allow-missing-pr  Skip PR-title/body requirement when PR metadata is unavailable",
	);
	console.info("  --json           Output as JSON");
	console.info("");
	console.info("PR Template Gate Options:");
	console.info("  --pr-body        Pull request body markdown to validate");
	console.info("  --pr-body-file   Path to markdown file (or - for stdin)");
	console.info("  --json           Output as JSON");
	console.info("");
	console.info("Remediate Options:");
	console.info(
		"  --findings       JSON file path for findings (or - for stdin)",
	);
	console.info("  --dry-run        Preview changes without applying");
	console.info("  --contract       Path to harness.contract.json");
	console.info("  --head-sha       HEAD SHA (defaults to current git HEAD)");
	console.info("  --mode           Override rollback mode (manual/autonomous)");
	console.info("  --completion-marker  Path to completion marker file");
	console.info("  --json           Output as JSON");
	console.info(
		"  check-authz      Validate authorization policy before mutative operations",
	);
	console.info(
		"  check-environment  Validate governance envelope before pilot operations",
	);
	console.info("");
	console.info("Init Options:");
	console.info("  --dry-run        Preview changes without writing");
	console.info("  --force          Overwrite existing files");
	console.info("  --track          Create manifest + backups for rollback");
	console.info("  --rollback       Restore from manifest (undo init)");
	console.info("  --check-updates  Check for tracked-template updates");
	console.info("  --update         Refresh tracked templates (prefer upgrade)");
	console.info(
		"  --explain-ownership  Show contract ownership decisions for --update",
	);
	console.info("  --interactive    Review and approve each change");
	console.info("  --json           Output as structured JSON");
	console.info(
		"  --migrate        Migrate contract schema only (not ci-migrate)",
	);
	console.info(
		"  --project-type   Override detected project type (cli|desktop|library|web)",
	);
	console.info("  --minimal        Use minimal mode without strict governance");
	console.info("  --issue-tracker  Set issue tracker (linear|github|none)");
	console.info("");
	console.info("Eject Options:");
	console.info(
		"  --force, -f      Bypass prompt and forcefully eject harness config",
	);
	console.info(
		"  --dry-run        Preview harness ejection without deleting files",
	);
	console.info("  --json           Output as structured JSON");
	console.info("");
	console.info("CI Migrate Options:");
	console.info("  ci-migrate [prepare|commit|abort|verify] [targetDir]");
	console.info("  --provider       Target CI provider (for example: circleci)");
	console.info("  --snapshot       Snapshot identifier");
	console.info(
		"  --action         prepare|commit|abort|verify (optional alternative)",
	);
	console.info("  --apply          Apply migration changes");
	console.info("  --dry-run        Preview migration changes");
	console.info("  --rollback       Restore from migration snapshot");
	console.info("  --break-glass-approval  Signed break-glass approval path");
	console.info(
		"  --merge-queue-evidence  Signed merge-queue cutover evidence path",
	);
	console.info(
		"  --merge-queue-orchestrator  Executable to orchestrate pause/drain/revalidate and emit signed evidence",
	);
	console.info(
		"  --auto-generate-proof-pack  Materialize trusted proof-pack inputs",
	);
	console.info("");
	console.info("Evidence Verify Options:");
	console.info(
		"  --files <paths>  Comma-separated list of evidence files to verify",
	);
	console.info("  --contract       Path to contract file (optional)");
	console.info("  --json           Output as JSON");
	console.info("");
	console.info("UI Loop Options:");
	console.info("  --mode           execute|prepare (default: prepare)");
	console.info("  --dry-run        Alias for --mode prepare");
	console.info("  --json           Output as JSON");
	console.info("  --contract       Path to harness.contract.json");
	console.info("");
	console.info("");
	console.info("Gardener Options:");
	console.info("  --docs           Path to docs directory (default: docs)");
	console.info("  --dry-run        Preview changes without writing");
	console.info("  --json           Output results as JSON");
	console.info("  --stale-days     Days before doc is stale (default: 30)");
	console.info("");
	console.info("Memory Gate Options:");
	console.info("  --memory         Path to memory.json (default: memory.json)");
	console.info(
		"  --forjamie       Path to session-log file (default: FORJAMIE.md; override with contract.memoryPolicy.sessionLogPath)",
	);
	console.info(
		"  --metrics        Path to metrics storage (default: .memory-metrics.json)",
	);
	console.info("  --json           Output results as JSON");
	console.info("");
	console.info("Preflight Gate Options:");
	console.info("  --contract       Path to harness.contract.json");
	console.info("  --files          Comma-separated file paths to check");
	console.info(
		"  --max-tier       Maximum allowed risk tier (high/medium/low)",
	);
	console.info("  --head-sha       HEAD SHA for determinism checks");
	console.info("  --strict         Treat warnings as errors");
	console.info("  --skip           Comma-separated check IDs to skip");
	console.info("  --json           Output results as JSON");
	console.info("");
	console.info("Diff Budget Options:");
	console.info("  --base           Base ref (default: main)");
	console.info("  --head           Head ref (default: HEAD)");
	console.info("  --contract       Path to harness.contract.json");
	console.info("  --override       Path to override file");
	console.info("  --json           Output results as JSON");
	console.info("");
	console.info("Drift Gate Options:");
	console.info("  --mode           advisory|health (default: advisory)");
	console.info(
		"  --out            Write machine report to file (default advisory path)",
	);
	console.info(
		"  --baseline       Baseline report path (default: artifacts/consistency-gate/consistency-baseline-latest.json)",
	);
	console.info(
		"  --seed-baseline  Write current state as baseline (initial seeding)",
	);
	console.info(
		"  --suppress <ids> Comma-separated check IDs to suppress from results",
	);
	console.info("  --json           Output results as JSON");
	console.info("");
	console.info("Symphony Check Options:");
	console.info("  --repo-root      Repository root to inspect (default: cwd)");
	console.info(
		"  --workflow       Path to WORKFLOW.md (default: WORKFLOW.md in repo root)",
	);
	console.info(
		"  --env-file       Override path to env file (default: ~/.codex/.env)",
	);
	console.info("  --json           Output as JSON");
	console.info("");
	console.info("Upgrade Options:");
	console.info("  --dry-run        Preview changes without writing");
	console.info("  --force          Overwrite even if already up to date");
	console.info("  --provider       CI provider targeting override");
	console.info(
		"  --skip-contract-migration  Skip contract schema migration step",
	);
	console.info("  --json           Output as JSON");
	console.info("");
	console.info("Replay Options:");
	console.info("  --trace-id       Trace ID to replay (or positional arg)");
	console.info("  --trace-dir      Directory containing trace files");
	console.info("  --list           List available trace IDs");
	console.info("  --dry-run        Show replay plan without executing");
	console.info("  --json           Output as JSON");
	console.info("");
	console.info("Review Gate Options:");
	console.info("  --token          GitHub token (required)");
	console.info("  --owner          Repository owner (required)");
	console.info("  --repo           Repository name (required)");
	console.info("  --pr             Pull request number (required)");
	console.info("  --sha            Head SHA to verify (required)");
	console.info("  --check          Check run name to look for");
	console.info("  --bot-login      Bot login for rerun-comment dedupe");
	console.info(
		"  --auto-resolve-bot-threads  Resolve unresolved bot-only threads after successful rerun",
	);
	console.info("  --contract       Path to harness.contract.json");
	console.info("  --json           Output as JSON");
	console.info("");
	console.info("Branch Protect Options:");
	console.info(
		"  --token          GitHub token (or env GITHUB_TOKEN / GITHUB_PERSONAL_ACCESS_TOKEN)",
	);
	console.info("  --owner          Repository owner (required)");
	console.info("  --repo           Repository name (required)");
	console.info("  --branch         Branch name (default: main)");
	console.info("  --ruleset        Ruleset name (default: protect)");
	console.info("  --checks         Comma-separated required status checks");
	console.info("  --required-approvals  Required PR approvals (default: 1)");
	console.info("  --dry-run        Preview payload without applying");
	console.info("  --json           Output as JSON");
	console.info("");
	console.info("");
	console.info("Brainstorm Gate Options:");
	console.info(
		"  --brainstorms    Path to brainstorms directory (default: docs/brainstorms)",
	);
	console.info("  --topic          Filter by topic");
	console.info("  --max-age        Max days old (default: 14)");
	console.info("  --strict         Require all sections");
	console.info("  --json           Output as JSON");
	console.info("");
	console.info("");
	console.info("Plan Gate Options:");
	console.info(
		"  --plans          Path to plans directory (default: docs/plans)",
	);
	console.info(
		"  --type           Filter by plan type (feature/refactor/bugfix/docs/architecture)",
	);
	console.info("  --max-age        Max days old (default: 30)");
	console.info("  --require-origin Require origin reference to brainstorm");
	console.info(
		"  --require-plan-id Require plan_id frontmatter on validated plans",
	);
	console.info(
		"  --require-acceptance-evidence Require evidence refs on completed acceptance items",
	);
	console.info(
		"  --require-traceability Require changed work to map back to plan IDs",
	);
	console.info("  --plan-ids       Comma-separated plan IDs to validate");
	console.info(
		"  --pr-title       Pull request title to extract plan IDs from",
	);
	console.info("  --pr-body        Pull request body to extract plan IDs from");
	console.info(
		"  --changed-files  Comma-separated changed file paths for traceability checks",
	);
	console.info("  --strict         Require all sections");
	console.info("  --json           Output as JSON");
	console.info("");
	console.info("");
	console.info("Verify CodeRabbit Options:");
	console.info(
		"  --token          GitHub token for ruleset checks (or env GITHUB_TOKEN / GITHUB_PERSONAL_ACCESS_TOKEN)",
	);
	console.info("  --owner          Repository owner for remote checks");
	console.info("  --repo           Repository name for remote checks");
	console.info("  --repo-path      Repository path for local file checks");
	console.info("  --verbose        Include detailed check output");
	console.info("  --json           Output as JSON");
	console.info("");
	console.info("");
	console.info("Options:");
	console.info("  --version, -v  Print version");
	console.info("  --help, -h     Print this help");
}
export { parseIntegerArg, parseCsvList };

/**
 * Entrypoint that parses CLI arguments, dispatches the selected subcommand, and exits with the command's exit code.
 *
 * Parses top-level flags (--version, --help), attempts registry-based dispatch, and otherwise routes known commands
 * to their respective handlers; prints usage or an unknown-command message when appropriate. This function performs
 * process-level side effects (console output and calling process.exit) and will call the global fatal error handler
 * on unhandled asynchronous failures.
 *
 * @param args - Command-line arguments excluding the node and executable path (e.g., process.argv.slice(2)).
 */
export function run(args: string[]): void {
	const version = getVersion();

	// Handle top-level --version and --help before parsing command
	// These work even without a command
	if (args.includes("--version") || args.includes("-v")) {
		console.info(`harness v${version}`);
		return;
	}

	// Only handle --help at top level
	// Commands that accept -h (like index-context) should handle it themselves
	if (args.includes("--help")) {
		console.info(`harness v${version}`);
		printUsage();
		return;
	}

	// Parse command
	const command = args[0];

	const registryDispatch = dispatchRegistryCommand(command, args);
	if (registryDispatch) {
		if (registryDispatch.result instanceof Promise) {
			registryDispatch.result
				.then((exitCode) => process.exit(exitCode))
				.catch((error) =>
					handleFatalError(registryDispatch.spec.errorLabel, error),
				);
			return;
		}
		process.exit(registryDispatch.result);
		return;
	}

	// No command recognized
	console.info(`harness v${version}`);
	if (args.length === 0) {
		printUsage();
	} else {
		console.info(`Unknown command: ${command}`);
		process.exit(1);
		return;
	}
}

function canonicalizeExecutablePath(filePath: string): string {
	const resolvedPath = resolve(filePath);
	try {
		return realpathSync(resolvedPath);
	} catch {
		return resolvedPath;
	}
}

export function isDirectExecution(
	entrypoint = process.argv[1],
	moduleUrl = import.meta.url,
): boolean {
	if (!entrypoint) {
		return false;
	}

	const entrypointHref = pathToFileURL(
		canonicalizeExecutablePath(entrypoint),
	).href;
	const moduleHref = pathToFileURL(
		canonicalizeExecutablePath(fileURLToPath(moduleUrl)),
	).href;

	return moduleHref === entrypointHref;
}

if (isDirectExecution()) {
	run(process.argv.slice(2));
}

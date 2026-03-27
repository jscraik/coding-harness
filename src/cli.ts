#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runAutomationRunCLI } from "./commands/automation-run.js";
import {
	type BlastRadiusOptions,
	runBlastRadiusCLI,
} from "./commands/blast-radius.js";
import { runBrainstormGateCLI } from "./commands/brainstorm-gate.js";
import {
	runCIMigrateCLI,
	runPromoteModeCLI,
	runSyncBranchProtectionCLI,
} from "./commands/ci-migrate.js";
import { runContextHealthCLI } from "./commands/context-health.js";
import { runContextCLI } from "./commands/context.js";
import { runContractCLI } from "./commands/contract.js";
import { runDiffBudgetCLI } from "./commands/diff-budget.js";
import { runDoctorCLI } from "./commands/doctor.js";
import { runDriftGateCLI } from "./commands/drift-gate.js";
import { runEjectCLI } from "./commands/eject.js";
import { runGapCaseCLI } from "./commands/gap-case.js";
import { runGardenerCLI } from "./commands/gardener.js";
import { runHealthCLI } from "./commands/health.js";
import { runIndexContextCLI } from "./commands/index-context.js";
import { runInitCLI, runInteractiveInitCLI } from "./commands/init.js";
import { runMemoryGateCLI } from "./commands/memory-gate.js";
import { runObservabilityGateCLI } from "./commands/observability-gate.js";
import { runOrgAuditCLI } from "./commands/org-audit.js";
import { runPilotEvaluateCLI } from "./commands/pilot-evaluate.js";
import {
	type PilotRollbackOptions,
	runPilotRollbackCLI,
} from "./commands/pilot-rollback.js";
import { runPlanGateCLI } from "./commands/plan-gate.js";
import { runPresetCLI } from "./commands/preset.js";
import { runPromptGateCLI } from "./commands/prompt-gate.js";
import {
	type RemediateOptions,
	runRemediateCLI,
} from "./commands/remediate.js";
import { runReplayCLI } from "./commands/replay.js";
import { runRiskTierCLI } from "./commands/risk-tier.js";
import { runSearchCLI } from "./commands/search.js";
import { runSilentErrorDetectorCLI } from "./commands/silent-error.js";
import { printSimulateUsage, runSimulateCLI } from "./commands/simulate.js";
import { runToolingAuditCLI } from "./commands/tooling-audit.js";
import {
	runUIExploreCLI,
	runUIFastCLI,
	runUIVerifyCLI,
} from "./commands/ui-loop.js";
import {
	type HarnessUpgradeOptions,
	runUpgradeCLI,
} from "./commands/upgrade.js";
import { runVerifyGreptileCLI } from "./commands/verify-greptile.js";
import {
	dispatchRegistryCommand,
	getRegistryCommandHelpRows,
} from "./lib/cli/command-registry.js";
import { renderCommandHelpRows } from "./lib/cli/help-renderer.js";
import {
	getFlagValue,
	parseCsvList,
	parseIntegerArg,
} from "./lib/cli/parse-utils.js";
import { sanitizeError } from "./lib/input/sanitize.js";
import type { PilotEvaluateOptions } from "./lib/pilot-evaluation/types.js";
import type { ProjectType } from "./lib/project-type/types.js";
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
			name: "simulate",
			summary: "Run counterfactual policy simulation",
		},
		{
			name: "verify-greptile",
			summary: "Verify Greptile setup and configuration",
		},
		{
			name: "request-greptile-review",
			summary: "Request a Greptile review on a PR",
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
	console.info(
		"  --migrate        Migrate contract schema only (not ci-migrate)",
	);
	console.info(
		"  --project-type   Override detected project type (cli|desktop|library|web)",
	);
	console.info("  --minimal        Use minimal mode without strict governance");
	console.info("  --no-greptile    Omit Greptile templates and configurations");
	console.info("  --issue-tracker  Set issue tracker (linear|github|none)");
	console.info("  --json           Output as structured JSON");
	console.info("");
	console.info("Eject Options:");
	console.info(
		"  --force, -f      Bypass prompt and forcefully eject harness config",
	);
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
	console.info("Verify Greptile Options:");
	console.info(
		"  --token          GitHub token for ruleset checks (or env GITHUB_TOKEN / GITHUB_PERSONAL_ACCESS_TOKEN)",
	);
	console.info("  --owner          Repository owner for remote checks");
	console.info("  --repo           Repository name for remote checks");
	console.info(
		"  --app-id         GitHub App ID for app-installation checks (or env GITHUB_APP_ID)",
	);
	console.info(
		"  --app-private-key-path  Path to GitHub App private key PEM (or env GITHUB_APP_PRIVATE_KEY_PATH)",
	);
	console.info("  --repo-path      Repository path for local file checks");
	console.info("  --verbose        Include detailed check output");
	console.info("  --json           Output as JSON");
	console.info("");
	console.info("Request Greptile Review Options:");
	console.info(
		"  --token          GitHub token (or env GITHUB_TOKEN / GITHUB_PERSONAL_ACCESS_TOKEN)",
	);
	console.info("  --owner          Repository owner");
	console.info("  --repo           Repository name");
	console.info("  --pr             Pull request number");
	console.info(
		"  --message        Custom message to post (default: '@greptileai please review the latest changes')",
	);
	console.info("  --json           Output as JSON");
	console.info("");
	console.info("");
	console.info("Options:");
	console.info("  --version, -v  Print version");
	console.info("  --help, -h     Print this help");
}
export { parseIntegerArg, parseCsvList };

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

	if (command === "risk-tier") {
		// Parse risk-tier options
		const jsonFlag = args.includes("--json");
		const filesIndex = args.indexOf("--files");
		const contractIndex = args.indexOf("--contract");

		const files: string[] = [];
		const filesArg = getFlagValue(args, filesIndex);
		files.push(...parseCsvList(filesArg));

		const contractArg = getFlagValue(args, contractIndex);
		const contractPath = contractArg ?? "harness.contract.json";

		const exitCode = runRiskTierCLI({
			contractPath,
			files,
			json: jsonFlag,
		});
		process.exit(exitCode);
		return;
	}

	if (command === "replay") {
		// Parse replay options
		const jsonFlag = args.includes("--json");
		const dryRunFlag = args.includes("--dry-run");
		const listFlag = args.includes("--list");
		const traceIdIndex = args.indexOf("--trace-id");
		const traceDirIndex = args.indexOf("--trace-dir");

		const options: {
			traceId?: string;
			list?: boolean;
			dryRun?: boolean;
			json?: boolean;
			traceDir?: string;
		} = {
			json: jsonFlag,
			dryRun: dryRunFlag,
			list: listFlag,
		};

		const traceIdValue = getFlagValue(args, traceIdIndex);
		if (traceIdValue) {
			options.traceId = traceIdValue;
		}

		const traceDirValue = getFlagValue(args, traceDirIndex);
		if (traceDirValue) {
			options.traceDir = traceDirValue;
		}

		// Also check for positional trace ID argument (must not start with -)
		if (!options.traceId && args[1] && !args[1].startsWith("-")) {
			options.traceId = args[1];
		}

		runReplayCLI(options)
			.then((exitCode) => process.exit(exitCode))
			.catch((error) => handleFatalError("Replay Error", error));
		return;
	}

	if (command === "gardener") {
		// Parse gardener options
		const dryRunFlag = args.includes("--dry-run");
		const jsonFlag = args.includes("--json");
		const docsIndex = args.indexOf("--docs");
		const staleDaysIndex = args.indexOf("--stale-days");

		const options: {
			docsPath?: string;
			dryRun?: boolean;
			json?: boolean;
			staleDays?: number;
		} = {};

		if (dryRunFlag) options.dryRun = true;
		if (jsonFlag) options.json = true;
		const docsArg = getFlagValue(args, docsIndex);
		if (docsArg) {
			options.docsPath = docsArg;
		}
		const staleDaysArg = getFlagValue(args, staleDaysIndex);
		if (staleDaysArg) {
			const staleDays = parseIntegerArg(staleDaysArg, 0);
			if (staleDays !== undefined) {
				options.staleDays = staleDays;
			}
		}

		const exitCode = runGardenerCLI(options);
		process.exit(exitCode);
		return;
	}

	if (command === "memory-gate") {
		// Parse memory-gate options
		const jsonFlag = args.includes("--json");
		const memoryIndex = args.indexOf("--memory");
		const forjamieIndex = args.indexOf("--forjamie");
		const metricsIndex = args.indexOf("--metrics");

		const options: {
			memoryPath?: string;
			forjamiePath?: string;
			json?: boolean;
			metricsPath?: string;
		} = {};

		if (jsonFlag) options.json = true;
		const memoryArg = getFlagValue(args, memoryIndex);
		if (memoryArg) {
			options.memoryPath = memoryArg;
		}
		const forjamieArg = getFlagValue(args, forjamieIndex);
		if (forjamieArg) {
			options.forjamiePath = forjamieArg;
		}
		const metricsArg = getFlagValue(args, metricsIndex);
		if (metricsArg) {
			options.metricsPath = metricsArg;
		}

		const exitCode = runMemoryGateCLI(options);
		process.exit(exitCode);
		return;
	}

	if (command === "silent-error") {
		// Parse silent-error options
		const jsonFlag = args.includes("--json");
		const strictFlag = args.includes("--strict");
		const suggestionsFlag = args.includes("--suggestions");
		const filesIndex = args.indexOf("--files");
		const dirsIndex = args.indexOf("--dirs");

		const options: {
			files?: string[];
			dirs?: string[];
			json?: boolean;
			strict?: boolean;
			suggestions?: boolean;
		} = {};

		if (jsonFlag) options.json = true;
		if (strictFlag) options.strict = true;
		if (suggestionsFlag) options.suggestions = true;
		const filesArg = getFlagValue(args, filesIndex);
		if (filesArg !== undefined) {
			options.files = parseCsvList(filesArg);
		}
		const dirsArg = getFlagValue(args, dirsIndex);
		if (dirsArg !== undefined) {
			options.dirs = parseCsvList(dirsArg);
		}

		const exitCode = runSilentErrorDetectorCLI(options);
		process.exit(exitCode);
		return;
	}

	if (command === "init") {
		// Parse init options
		const dryRunFlag = args.includes("--dry-run");
		const forceFlag = args.includes("--force");
		const trackFlag = args.includes("--track");
		const rollbackFlag = args.includes("--rollback");
		const checkUpdatesFlag = args.includes("--check-updates");
		const updateFlag = args.includes("--update");
		const explainOwnershipFlag = args.includes("--explain-ownership");
		const interactiveFlag = args.includes("--interactive");
		const migrateFlag = args.includes("--migrate");
		const jsonFlag = args.includes("--json");

		// --project-type <value>
		const projectTypeIndex = args.indexOf("--project-type");
		const projectTypeArg =
			projectTypeIndex !== -1 ? args[projectTypeIndex + 1] : undefined;

		// Solo Orchestration Flags
		const minimalFlag = args.includes("--minimal");
		const noGreptileFlag = args.includes("--no-greptile");

		const issueTrackerIndex = args.indexOf("--issue-tracker");
		const issueTrackerArg =
			issueTrackerIndex !== -1 ? args[issueTrackerIndex + 1] : undefined;

		// Validation: --minimal cannot be used with explicit granular overrides
		if (minimalFlag) {
			if (noGreptileFlag) {
				console.error(
					"Error: --no-greptile cannot be used with --minimal as minimal mode already drops parity layers.",
				);
				process.exit(2);
				return;
			}
			if (issueTrackerArg !== undefined) {
				console.error(
					"Error: --issue-tracker cannot be used with --minimal. Granular options conflict with minimal mode.",
				);
				process.exit(2);
				return;
			}
		}

		if (
			issueTrackerArg !== undefined &&
			!["linear", "github", "none"].includes(issueTrackerArg)
		) {
			console.error(
				`Error: Invalid --issue-tracker value: "${issueTrackerArg}". Valid values: linear | github | none.`,
			);
			process.exit(2);
			return;
		}

		// Get optional target directory (first non-flag arg after init)
		// Exclude both long flags (--) and short flags (-)
		// Also skip the values consumed by other flags
		const targetDir = args.slice(1).find((arg, i, arr) => {
			if (arg.startsWith("-")) return false;
			const prev = arr[i - 1];
			if (prev === "--project-type" || prev === "--issue-tracker") return false;
			return true;
		});

		const options = {
			dryRun: dryRunFlag,
			force: forceFlag,
			track: trackFlag,
			rollback: rollbackFlag,
			checkUpdates: checkUpdatesFlag,
			update: updateFlag,
			explainOwnership: explainOwnershipFlag,
			interactive: interactiveFlag,
			migrate: migrateFlag,
			json: jsonFlag,
			...(minimalFlag ? { minimal: true } : {}),
			...(issueTrackerArg !== undefined
				? { issueTracker: issueTrackerArg }
				: {}),
			...(noGreptileFlag ? { greptile: false } : {}),
			...(projectTypeArg ? { projectType: projectTypeArg as ProjectType } : {}),
		};

		// Handle interactive mode with async
		if (interactiveFlag) {
			runInteractiveInitCLI(targetDir, options)
				.then((exitCode) => process.exit(exitCode))
				.catch((error) => handleFatalError("Interactive Init Error", error));
			return;
		}

		const exitCode = runInitCLI(targetDir, options);
		process.exit(exitCode);
		return;
	}

	if (command === "eject") {
		const forceFlag = args.includes("--force") || args.includes("-f");
		const targetDir = args.slice(1).find((arg) => !arg.startsWith("-"));

		runEjectCLI(targetDir, { force: forceFlag })
			.then((exitCode: number) => process.exit(exitCode))
			.catch((error: unknown) => handleFatalError("Eject Error", error));
		return;
	}

	if (command === "contract") {
		// JSC-69: harness contract validate / harness contract schema
		const subArgs = args.slice(1); // remaining args after 'contract'
		const jsonFlag = args.includes("--json");
		const exitCode = runContractCLI(subArgs, { json: jsonFlag });
		process.exit(exitCode);
		return;
	}

	if (command === "upgrade") {
		// JSC-66: version-aware upgrade path
		const dryRunFlag = args.includes("--dry-run");
		const forceFlag = args.includes("--force");
		const skipContractFlag = args.includes("--skip-contract-migration");
		const providerIndex = args.indexOf("--provider");
		const provider = getFlagValue(args, providerIndex);
		const targetDir = args.slice(1).find((arg) => !arg.startsWith("-"));
		const upgradeOptions: HarnessUpgradeOptions = {
			dryRun: dryRunFlag,
			force: forceFlag,
			provider: provider ?? undefined,
			skipContractMigration: skipContractFlag,
		};
		const exitCode = runUpgradeCLI(targetDir, upgradeOptions);
		process.exit(exitCode);
		return;
	}

	if (command === "ci-migrate") {
		const providerIndex = args.indexOf("--provider");
		const snapshotIndex = args.indexOf("--snapshot");
		const actionIndex = args.indexOf("--action");
		const breakGlassApprovalIndex = args.indexOf("--break-glass-approval");
		const mergeQueueEvidenceIndex = args.indexOf("--merge-queue-evidence");
		const mergeQueueOrchestratorIndex = args.indexOf(
			"--merge-queue-orchestrator",
		);
		const commitModeIndex = args.indexOf("--commit-mode");
		const dryRunFlag = args.includes("--dry-run");
		const applyFlag = args.includes("--apply");
		const rollbackFlag = args.includes("--rollback");
		const autoGenerateProofPackFlag = args.includes(
			"--auto-generate-proof-pack",
		);
		const forceFlag = args.includes("--force");
		const valueFlags = new Set([
			"--provider",
			"--snapshot",
			"--action",
			"--break-glass-approval",
			"--merge-queue-evidence",
			"--merge-queue-orchestrator",
			"--commit-mode",
		]);
		const positionalArgs: string[] = [];
		for (let index = 1; index < args.length; index++) {
			const token = args[index];
			if (!token) {
				continue;
			}
			if (token.startsWith("--")) {
				if (valueFlags.has(token)) {
					const nextToken = args[index + 1];
					if (nextToken && !nextToken.startsWith("-")) {
						index += 1;
					}
				}
				continue;
			}
			if (token.startsWith("-")) {
				continue;
			}
			positionalArgs.push(token);
		}

		const validActions = new Set([
			"prepare",
			"commit",
			"abort",
			"verify",
			"bootstrap",
			"sync-branch-protection",
			"promote-mode",
		]);
		const actionArg = getFlagValue(args, actionIndex);
		let parsedAction = actionArg;
		if (
			!parsedAction &&
			positionalArgs[0] &&
			validActions.has(positionalArgs[0])
		) {
			parsedAction = positionalArgs.shift();
		}
		if (positionalArgs.length > 1) {
			console.error(
				"Error: ci-migrate accepts at most one target directory positional argument.",
			);
			process.exit(2);
			return;
		}
		const targetDir = positionalArgs[0];

		// JSC-60: sync-branch-protection is a standalone subcommand
		if (parsedAction === "sync-branch-protection") {
			const exitCode = runSyncBranchProtectionCLI(targetDir, args.slice(2));
			process.exit(exitCode);
			return;
		}

		// JSC-61: promote-mode is a standalone subcommand, not passed to runCIMigrateCLI
		if (parsedAction === "promote-mode") {
			const exitCode = runPromoteModeCLI(targetDir, args.slice(2));
			process.exit(exitCode);
			return;
		}

		const provider = getFlagValue(args, providerIndex);
		const snapshot = getFlagValue(args, snapshotIndex);
		const breakGlassApprovalPath = getFlagValue(args, breakGlassApprovalIndex);
		const mergeQueueEvidencePath = getFlagValue(args, mergeQueueEvidenceIndex);
		const mergeQueueOrchestratorPath = getFlagValue(
			args,
			mergeQueueOrchestratorIndex,
		);

		const commitModeRaw = getFlagValue(args, commitModeIndex);
		const commitMode =
			commitModeRaw === "solo" || commitModeRaw === "enterprise"
				? commitModeRaw
				: undefined;

		const exitCode = runCIMigrateCLI(targetDir, {
			provider,
			dryRun: dryRunFlag,
			apply: applyFlag,
			rollback: rollbackFlag,
			snapshot,
			action: parsedAction,
			breakGlassApprovalPath,
			mergeQueueEvidencePath,
			mergeQueueOrchestratorPath,
			autoGenerateProofPack: autoGenerateProofPackFlag,
			commitMode,
			force: forceFlag,
		});
		process.exit(exitCode);
		return;
	}

	if (command === "diff-budget") {
		// Parse diff-budget options
		const jsonFlag = args.includes("--json");
		const baseIndex = args.indexOf("--base");
		const headIndex = args.indexOf("--head");
		const contractIndex = args.indexOf("--contract");
		const overrideIndex = args.indexOf("--override");

		const options: {
			base?: string;
			head?: string;
			contractPath?: string;
			overridePath?: string;
			json?: boolean;
		} = {};

		if (jsonFlag) options.json = true;
		const baseArg = getFlagValue(args, baseIndex);
		if (baseArg) options.base = baseArg;
		const headArg = getFlagValue(args, headIndex);
		if (headArg) options.head = headArg;
		const contractArg = getFlagValue(args, contractIndex);
		if (contractArg) options.contractPath = contractArg;
		const overrideArg = getFlagValue(args, overrideIndex);
		if (overrideArg) options.overridePath = overrideArg;

		const exitCode = runDiffBudgetCLI(options);
		process.exit(exitCode);
		return;
	}

	if (command === "drift-gate") {
		// Parse drift-gate options
		const jsonFlag = args.includes("--json");
		const seedBaselineFlag = args.includes("--seed-baseline");
		const noSeedFlag = args.includes("--no-seed");
		const modeIndex = args.indexOf("--mode");
		const outIndex = args.indexOf("--out");
		const baselineIndex = args.indexOf("--baseline");
		const suppressIndex = args.indexOf("--suppress");

		const options: {
			mode?: "advisory" | "health";
			json?: boolean;
			outPath?: string;
			baselinePath?: string;
			seedBaseline?: boolean;
			suppressions?: string[];
		} = {};

		if (jsonFlag) options.json = true;
		if (seedBaselineFlag) options.seedBaseline = true;
		if (noSeedFlag) options.seedBaseline = false;
		const modeArg = getFlagValue(args, modeIndex);
		if (modeArg) {
			if (modeArg !== "advisory" && modeArg !== "health") {
				console.error("Error: --mode must be advisory or health");
				process.exit(2);
				return;
			}
			options.mode = modeArg;
		}
		const outArg = getFlagValue(args, outIndex);
		if (outArg) options.outPath = outArg;
		const baselineArg = getFlagValue(args, baselineIndex);
		if (baselineArg) options.baselinePath = baselineArg;
		const suppressArg = getFlagValue(args, suppressIndex);
		if (suppressArg) options.suppressions = parseCsvList(suppressArg);

		const exitCode = runDriftGateCLI(options);
		process.exit(exitCode);
		return;
	}
	if (command === "brainstorm-gate") {
		// Parse brainstorm-gate options
		const jsonFlag = args.includes("--json");
		const strictFlag = args.includes("--strict");
		const brainstormsIndex = args.indexOf("--brainstorms");
		const topicIndex = args.indexOf("--topic");
		const maxAgeIndex = args.indexOf("--max-age");

		const options: {
			brainstormsPath?: string;
			topic?: string;
			maxAgeDays?: number;
			strict?: boolean;
			json?: boolean;
		} = {};

		if (jsonFlag) options.json = true;
		if (strictFlag) options.strict = true;
		const brainstormsArg = getFlagValue(args, brainstormsIndex);
		if (brainstormsArg) options.brainstormsPath = brainstormsArg;
		const topicArg = getFlagValue(args, topicIndex);
		if (topicArg) options.topic = topicArg;
		const maxAgeArg = getFlagValue(args, maxAgeIndex);
		if (maxAgeArg) {
			const parsedMaxAge = parseIntegerArg(maxAgeArg, 0);
			if (parsedMaxAge !== undefined) options.maxAgeDays = parsedMaxAge;
		}

		const exitCode = runBrainstormGateCLI(options);
		process.exit(exitCode);
		return;
	}

	if (command === "plan-gate") {
		// Parse plan-gate options
		const jsonFlag = args.includes("--json");
		const strictFlag = args.includes("--strict");
		const requireOriginFlag = args.includes("--require-origin");
		const requirePlanIdFlag = args.includes("--require-plan-id");
		const requireAcceptanceEvidenceFlag = args.includes(
			"--require-acceptance-evidence",
		);
		const requireTraceabilityFlag = args.includes("--require-traceability");
		const plansIndex = args.indexOf("--plans");
		const typeIndex = args.indexOf("--type");
		const maxAgeIndex = args.indexOf("--max-age");
		const planIdsIndex = args.indexOf("--plan-ids");
		const prTitleIndex = args.indexOf("--pr-title");
		const prBodyIndex = args.indexOf("--pr-body");
		const changedFilesIndex = args.indexOf("--changed-files");

		const options: {
			plansPath?: string;
			type?: string;
			maxAge?: number;
			requireOrigin?: boolean;
			requirePlanId?: boolean;
			requireAcceptanceEvidence?: boolean;
			requireTraceability?: boolean;
			planIds?: string[];
			prTitle?: string;
			prBody?: string;
			changedFiles?: string[];
			strict?: boolean;
			json?: boolean;
		} = {};

		if (jsonFlag) options.json = true;
		if (strictFlag) options.strict = true;
		if (requireOriginFlag) options.requireOrigin = true;
		if (requirePlanIdFlag) options.requirePlanId = true;
		if (requireAcceptanceEvidenceFlag) options.requireAcceptanceEvidence = true;
		if (requireTraceabilityFlag) options.requireTraceability = true;
		const plansArg = getFlagValue(args, plansIndex);
		if (plansArg) options.plansPath = plansArg;
		const typeArg = getFlagValue(args, typeIndex);
		if (typeArg) options.type = typeArg;
		const maxAgeArg = getFlagValue(args, maxAgeIndex);
		if (maxAgeArg) {
			const parsedMaxAge = parseIntegerArg(maxAgeArg, 0);
			if (parsedMaxAge !== undefined) options.maxAge = parsedMaxAge;
		}
		const planIdsArg = getFlagValue(args, planIdsIndex);
		if (planIdsArg) options.planIds = parseCsvList(planIdsArg);
		const prTitleArg = getFlagValue(args, prTitleIndex);
		if (prTitleArg) options.prTitle = prTitleArg;
		const prBodyArg = getFlagValue(args, prBodyIndex);
		if (prBodyArg) options.prBody = prBodyArg;
		const changedFilesArg = getFlagValue(args, changedFilesIndex);
		if (changedFilesArg) options.changedFiles = parseCsvList(changedFilesArg);

		const exitCode = runPlanGateCLI(options);
		process.exit(exitCode);
		return;
	}

	if (command === "ui:fast") {
		// Parse ui:fast options
		const jsonFlag = args.includes("--json");
		const ciFlag = args.includes("--ci");
		const dryRunFlag = args.includes("--dry-run");
		const portIndex = args.indexOf("--port");
		const contractIndex = args.indexOf("--contract");
		const modeIndex = args.indexOf("--mode");

		const options: {
			port?: number;
			ci?: boolean;
			json?: boolean;
			contractPath?: string;
			dryRun?: boolean;
			mode?: "execute" | "prepare";
		} = {};

		if (jsonFlag) options.json = true;
		if (ciFlag) options.ci = true;
		if (dryRunFlag) options.dryRun = true;
		const portArg = getFlagValue(args, portIndex);
		if (portArg) {
			const parsedPort = parseIntegerArg(portArg, 1);
			if (parsedPort !== undefined) options.port = parsedPort;
		}
		const modeArg = getFlagValue(args, modeIndex);
		if (modeArg === "execute" || modeArg === "prepare") {
			options.mode = modeArg;
		}
		if (dryRunFlag) {
			options.mode = "prepare";
		}
		const contractArg = getFlagValue(args, contractIndex);
		if (contractArg) options.contractPath = contractArg;

		const exitCode = runUIFastCLI(options);
		process.exit(exitCode);
		return;
	}

	if (command === "ui:verify") {
		// Parse ui:verify options
		const jsonFlag = args.includes("--json");
		const dryRunFlag = args.includes("--dry-run");
		const outputIndex = args.indexOf("--output");
		const timeoutIndex = args.indexOf("--timeout");
		const shardIndex = args.indexOf("--shard");
		const contractIndex = args.indexOf("--contract");
		const modeIndex = args.indexOf("--mode");

		const options: {
			outputDir?: string;
			json?: boolean;
			timeout?: number;
			shard?: string;
			contractPath?: string;
			dryRun?: boolean;
			mode?: "execute" | "prepare";
		} = {};

		if (jsonFlag) options.json = true;
		if (dryRunFlag) options.dryRun = true;
		const outputArg = getFlagValue(args, outputIndex);
		if (outputArg) options.outputDir = outputArg;
		const timeoutArg = getFlagValue(args, timeoutIndex);
		if (timeoutArg) {
			const parsedTimeout = parseIntegerArg(timeoutArg, 1);
			if (parsedTimeout !== undefined) options.timeout = parsedTimeout;
		}
		const shardArg = getFlagValue(args, shardIndex);
		if (shardArg) options.shard = shardArg;
		const modeArg = getFlagValue(args, modeIndex);
		if (modeArg === "execute" || modeArg === "prepare") {
			options.mode = modeArg;
		}
		if (dryRunFlag) {
			options.mode = "prepare";
		}
		const contractArg = getFlagValue(args, contractIndex);
		if (contractArg) options.contractPath = contractArg;

		const exitCode = runUIVerifyCLI(options);
		process.exit(exitCode);
		return;
	}

	if (command === "ui:explore") {
		// Parse ui:explore options
		const jsonFlag = args.includes("--json");
		const interactionsFlag = args.includes("--interactions");
		const dryRunFlag = args.includes("--dry-run");
		const urlIndex = args.indexOf("--url");
		const outputIndex = args.indexOf("--output");
		const contractIndex = args.indexOf("--contract");
		const modeIndex = args.indexOf("--mode");

		const options: {
			url?: string;
			outputDir?: string;
			json?: boolean;
			interactions?: boolean;
			contractPath?: string;
			dryRun?: boolean;
			mode?: "execute" | "prepare";
		} = {};

		if (jsonFlag) options.json = true;
		if (interactionsFlag) options.interactions = true;
		if (dryRunFlag) options.dryRun = true;
		const urlArg = getFlagValue(args, urlIndex);
		if (urlArg) options.url = urlArg;
		const outputArg = getFlagValue(args, outputIndex);
		if (outputArg) options.outputDir = outputArg;
		const modeArg = getFlagValue(args, modeIndex);
		if (modeArg === "execute" || modeArg === "prepare") {
			options.mode = modeArg;
		}
		if (dryRunFlag) {
			options.mode = "prepare";
		}
		const contractArg = getFlagValue(args, contractIndex);
		if (contractArg) options.contractPath = contractArg;

		const exitCode = runUIExploreCLI(options);
		process.exit(exitCode);
		return;
	}

	if (command === "prompt-gate") {
		// Parse prompt-gate options
		const jsonFlag = args.includes("--json");
		const typeIndex = args.indexOf("--type");
		const fileIndex = args.indexOf("--file");

		// Get flag values, rejecting if the value is another flag (starts with -)
		const typeArg = getFlagValue(args, typeIndex);
		const fileArg = getFlagValue(args, fileIndex);

		if (!typeArg) {
			console.error(
				"Error: --type is required (feature|bugfix|refactor|release)",
			);
			process.exit(1);
			return;
		}

		if (!fileArg) {
			console.error("Error: --file is required");
			process.exit(1);
			return;
		}

		const validTypes = ["feature", "bugfix", "refactor", "release"] as const;
		if (!validTypes.includes(typeArg as (typeof validTypes)[number])) {
			console.error(
				`Error: Invalid type "${typeArg}". Must be one of: ${validTypes.join(", ")}`,
			);
			process.exit(1);
			return;
		}

		const exitCode = runPromptGateCLI({
			type: typeArg as (typeof validTypes)[number],
			file: fileArg,
			json: jsonFlag,
		});
		process.exit(exitCode);
		return;
	}

	if (command === "blast-radius") {
		// Parse blast-radius options
		const jsonFlag = args.includes("--json");
		const verboseFlag = args.includes("--verbose");
		const filesIndex = args.indexOf("--files");
		const contractIndex = args.indexOf("--contract");

		// Get flag value, rejecting if the value is another flag (starts with -)
		const filesArg = getFlagValue(args, filesIndex);

		if (!filesArg) {
			console.error("Error: --files is required (comma-separated paths)");
			process.exit(1);
			return;
		}

		const files = filesArg
			.split(",")
			.map((f) => f.trim())
			.filter(Boolean);

		const contractArg = getFlagValue(args, contractIndex);
		const blastRadiusOptions: BlastRadiusOptions = {
			files,
			json: jsonFlag,
			verbose: verboseFlag,
		};
		if (contractArg) blastRadiusOptions.contractPath = contractArg;

		const exitCode = runBlastRadiusCLI(blastRadiusOptions);
		process.exit(exitCode);
		return;
	}
	if (command === "automation-run") {
		const nameIndex = args.indexOf("--name");
		const repoIndex = args.indexOf("--repo");
		const headShaIndex = args.indexOf("--head-sha");
		const contractVersionIndex = args.indexOf("--contract-version");
		const inputFingerprintIndex = args.indexOf("--input-fingerprint");
		const artifactsDirIndex = args.indexOf("--artifacts-dir");
		const statePathIndex = args.indexOf("--state-path");
		const jsonFlag = args.includes("--json");
		const forceFlag = args.includes("--force");
		const simulateFailureFlag = args.includes("--simulate-failure");

		const name = getFlagValue(args, nameIndex) ?? "";
		const repo = getFlagValue(args, repoIndex) ?? "";
		const headSha = getFlagValue(args, headShaIndex) ?? "";
		const contractVersion = getFlagValue(args, contractVersionIndex) ?? "";
		const inputFingerprint = getFlagValue(args, inputFingerprintIndex) ?? "";
		const artifactsDir = getFlagValue(args, artifactsDirIndex);
		const statePath = getFlagValue(args, statePathIndex);

		const exitCode = runAutomationRunCLI({
			name,
			repo,
			headSha,
			contractVersion,
			inputFingerprint,
			...(artifactsDir ? { artifactsDir } : {}),
			...(statePath ? { statePath } : {}),
			force: forceFlag,
			simulateFailure: simulateFailureFlag,
			json: jsonFlag,
		});
		process.exit(exitCode);
		return;
	}
	if (command === "remediate") {
		const mode = args[1];
		if (mode !== "run" && mode !== "apply") {
			console.error(
				"Error: remediate command requires subcommand `run` or `apply`",
			);
			process.exit(2);
			return;
		}

		const ownerIndex = args.indexOf("--owner");
		const repoIndex = args.indexOf("--repo");
		const prIndex = args.indexOf("--pr");
		const shaIndex = args.indexOf("--sha");
		const providerIndex = args.indexOf("--provider");
		const dryRunFlag = args.includes("--dry-run");
		const noInputFlag = args.includes("--no-input");
		const forceFlag = args.includes("--force");
		const jsonFlag = args.includes("--json");
		const maxAutoTierIndex = args.indexOf("--max-auto-tier");
		const modeArg = args.indexOf("--mode");
		const markerIndex = args.indexOf("--completion-marker");
		const contractIndex = args.indexOf("--contract");
		const findingsIndex = args.indexOf("--findings");
		const headShaIndex = args.indexOf("--head-sha");

		const prValue = getFlagValue(args, prIndex);
		const maxAutoTierValue = getFlagValue(args, maxAutoTierIndex);

		const remediateOptions: RemediateOptions = {
			mode,
			owner: getFlagValue(args, ownerIndex) ?? "",
			repo: getFlagValue(args, repoIndex) ?? "",
			prNumber: parseIntegerArg(prValue, 1) ?? 0,
			headSha: getFlagValue(args, shaIndex) ?? "",
			provider:
				(getFlagValue(args, providerIndex) as "codeql" | "codex" | undefined) ??
				"codeql",
			dryRun: dryRunFlag,
			noInput: noInputFlag,
			force: forceFlag,
			json: jsonFlag,
		};
		const contractArg = getFlagValue(args, contractIndex);
		if (contractArg) {
			remediateOptions.contractPath = contractArg;
		}
		const findingsArg = getFlagValue(args, findingsIndex);
		if (findingsArg) {
			remediateOptions.findings = findingsArg;
		}
		const headShaArg = getFlagValue(args, headShaIndex);
		if (headShaArg) {
			remediateOptions.headSha = headShaArg;
		}
		const modeValue = getFlagValue(args, modeArg);
		if (modeValue === "manual" || modeValue === "autonomous") {
			remediateOptions.mode = modeValue;
		}
		const markerArg = getFlagValue(args, markerIndex);
		if (markerArg) {
			remediateOptions.completionMarkerPath = markerArg;
		}
		if (
			maxAutoTierValue === "low" ||
			maxAutoTierValue === "medium" ||
			maxAutoTierValue === "high"
		) {
			remediateOptions.maxAutoTier = maxAutoTierValue;
		}

		runRemediateCLI(remediateOptions)
			.then((exitCode) => process.exit(exitCode))
			.catch((error) => handleFatalError("Remediate Error", error));
		return;
	}
	if (command === "observability-gate") {
		// Parse observability-gate options
		const jsonFlag = args.includes("--json");
		const labelsIndex = args.indexOf("--labels");
		const maxCardIndex = args.indexOf("--max-cardinality");
		const maxLenIndex = args.indexOf("--max-length");

		const options: {
			labels?: string;
			json?: boolean;
			maxCardinality?: number;
			maxLength?: number;
		} = {};

		if (jsonFlag) options.json = true;
		const labelsValue = getFlagValue(args, labelsIndex);
		if (labelsValue) {
			options.labels = labelsValue;
		}
		const cardValue = getFlagValue(args, maxCardIndex);
		if (cardValue) {
			const val = parseIntegerArg(cardValue, 0);
			if (val !== undefined) options.maxCardinality = val;
		}
		const lenValue = getFlagValue(args, maxLenIndex);
		if (lenValue) {
			const val = parseIntegerArg(lenValue, 0);
			if (val !== undefined) options.maxLength = val;
		}

		const exitCode = runObservabilityGateCLI(options);
		process.exit(exitCode);
		return;
	}

	if (command === "context") {
		// Parse context options
		const argsAfterCommand = args.slice(1);
		runContextCLI(argsAfterCommand)
			.then((exitCode) => process.exit(exitCode))
			.catch((error) => handleFatalError("Context Error", error));
		return;
	}

	if (command === "search") {
		// Parse search options
		const argsAfterCommand = args.slice(1);
		runSearchCLI(argsAfterCommand)
			.then((exitCode) => process.exit(exitCode))
			.catch((error) => handleFatalError("Search Error", error));
		return;
	}

	if (command === "index-context") {
		// Parse index-context options
		const argsAfterCommand = args.slice(1);
		runIndexContextCLI(argsAfterCommand)
			.then((exitCode) => process.exit(exitCode))
			.catch((error) => handleFatalError("Index Context Error", error));
		return;
	}

	if (command === "context-health") {
		const argsAfterCommand = args.slice(1);
		process.exit(runContextHealthCLI(argsAfterCommand));
		return;
	}

	if (command === "pilot-rollback") {
		// Parse pilot-rollback options
		const jsonFlag = args.includes("--json");
		const incidentIndex = args.indexOf("--incident-id");
		const modeIndex = args.indexOf("--mode");
		const contractIndex = args.indexOf("--contract");
		const artifactsIndex = args.indexOf("--artifacts");
		const outputIndex = args.indexOf("--output");
		const markerIndex = args.indexOf("--completion-marker");
		const reasonIndex = args.indexOf("--reason");

		const modeArg = getFlagValue(args, modeIndex);
		if (modeArg !== "autonomous" && modeArg !== "manual") {
			console.error(
				"Error: --mode is required and must be 'autonomous' or 'manual'",
			);
			process.exit(2);
			return;
		}

		const options: PilotRollbackOptions = {
			incidentId: getFlagValue(args, incidentIndex) ?? "",
			mode: modeArg,
			json: jsonFlag,
		};

		const contractArg = getFlagValue(args, contractIndex);
		if (contractArg) options.contractPath = contractArg;

		const artifactsArg = getFlagValue(args, artifactsIndex);
		if (artifactsArg) options.artifactsDir = artifactsArg;

		const outputArg = getFlagValue(args, outputIndex);
		if (outputArg) options.outputPath = outputArg;

		const markerArg = getFlagValue(args, markerIndex);
		if (markerArg) options.completionMarkerPath = markerArg;

		const reasonArg = getFlagValue(args, reasonIndex);
		if (reasonArg) options.reason = reasonArg;

		runPilotRollbackCLI(options)
			.then((exitCode) => process.exit(exitCode))
			.catch((error) => handleFatalError("Pilot Rollback Error", error));
		return;
	}

	if (command === "pilot-evaluate") {
		// Parse pilot-evaluate options
		const jsonFlag = args.includes("--json");
		const killSwitchFlag = args.includes("--kill-switch");
		const contractIndex = args.indexOf("--contract");
		const artifactsIndex = args.indexOf("--artifacts");
		const outputIndex = args.indexOf("--output");
		const laneIndex = args.indexOf("--lane");
		const adapterRegistryIndex = args.indexOf("--adapter-registry");
		const metricRegistryIndex = args.indexOf("--metric-registry");
		const docsGateReportIndex = args.indexOf("--docs-gate-report");
		const evaluationModeIndex = args.indexOf("--evaluation-mode");
		const rolloutStageIndex = args.indexOf("--rollout-stage");
		const prTemplateStatusIndex = args.indexOf("--pr-template-status");
		const prTemplateRefIndex = args.indexOf("--pr-template-ref");
		const actorIdIndex = args.indexOf("--actor-id");
		const clientFamilyIndex = args.indexOf("--client-family");
		const providerIdIndex = args.indexOf("--provider-id");
		const modelDescriptorIndex = args.indexOf("--model-descriptor");
		const executionModeIndex = args.indexOf("--execution-mode");
		const operatorTypeIndex = args.indexOf("--operator-type");
		const overrideAuthorizedPrincipalIndex = args.indexOf(
			"--override-authorized-principal",
		);
		const overrideScopeIndex = args.indexOf("--override-scope");
		const overrideReasonIndex = args.indexOf("--override-reason");
		const overrideTicketIndex = args.indexOf("--override-ticket");
		const overrideApprovedByIndex = args.indexOf("--override-approved-by");
		const overrideCreatedAtIndex = args.indexOf("--override-created-at");
		const overrideExpiresAtIndex = args.indexOf("--override-expires-at");

		const artifactsArg = getFlagValue(args, artifactsIndex);
		if (!artifactsArg) {
			console.error("Error: --artifacts is required");
			process.exit(2);
			return;
		}

		const options: PilotEvaluateOptions = {
			artifactsDir: artifactsArg,
		};

		if (jsonFlag) options.json = true;
		if (killSwitchFlag) options.killSwitch = true;
		const contractArg = getFlagValue(args, contractIndex);
		if (contractArg) options.contractPath = contractArg;
		const outputArg = getFlagValue(args, outputIndex);
		if (outputArg) options.outputPath = outputArg;
		const laneArg = getFlagValue(args, laneIndex);
		if (laneArg === "advisory" || laneArg === "health") {
			options.lane = laneArg;
		}
		const adapterRegistryArg = getFlagValue(args, adapterRegistryIndex);
		if (adapterRegistryArg) options.adapterRegistryPath = adapterRegistryArg;
		const metricRegistryArg = getFlagValue(args, metricRegistryIndex);
		if (metricRegistryArg) options.metricRegistryPath = metricRegistryArg;
		const docsGateReportArg = getFlagValue(args, docsGateReportIndex);
		if (docsGateReportArg) options.docsGateReportPath = docsGateReportArg;
		const evaluationModeArg = getFlagValue(args, evaluationModeIndex);
		if (
			evaluationModeArg === "local" ||
			evaluationModeArg === "pr" ||
			evaluationModeArg === "merge_group"
		) {
			options.evaluationMode = evaluationModeArg;
		}
		const rolloutStageArg = getFlagValue(args, rolloutStageIndex);
		if (
			rolloutStageArg === "shadow" ||
			rolloutStageArg === "advisory" ||
			rolloutStageArg === "enforced"
		) {
			options.rolloutStage = rolloutStageArg;
		}
		const prTemplateStatusArg = getFlagValue(args, prTemplateStatusIndex);
		if (
			prTemplateStatusArg === "passed" ||
			prTemplateStatusArg === "failed" ||
			prTemplateStatusArg === "missing"
		) {
			options.prTemplateStatus = prTemplateStatusArg;
		}
		const prTemplateRefArg = getFlagValue(args, prTemplateRefIndex);
		if (prTemplateRefArg) options.prTemplateRef = prTemplateRefArg;
		const actorIdArg = getFlagValue(args, actorIdIndex);
		if (actorIdArg) options.actorId = actorIdArg;
		const clientFamilyArg = getFlagValue(args, clientFamilyIndex);
		if (
			clientFamilyArg === "codex" ||
			clientFamilyArg === "claude_family" ||
			clientFamilyArg === "gemini_family" ||
			clientFamilyArg === "kimi_family" ||
			clientFamilyArg === "custom"
		) {
			options.clientFamily = clientFamilyArg;
		}
		const providerIdArg = getFlagValue(args, providerIdIndex);
		if (providerIdArg) options.providerId = providerIdArg;
		const modelDescriptorArg = getFlagValue(args, modelDescriptorIndex);
		if (modelDescriptorArg) options.modelDescriptor = modelDescriptorArg;
		const executionModeArg = getFlagValue(args, executionModeIndex);
		if (
			executionModeArg === "interactive" ||
			executionModeArg === "automation" ||
			executionModeArg === "ci"
		) {
			options.executionMode = executionModeArg;
		}
		const operatorTypeArg = getFlagValue(args, operatorTypeIndex);
		if (
			operatorTypeArg === "human_directed" ||
			operatorTypeArg === "automation" ||
			operatorTypeArg === "autonomous"
		) {
			options.operatorType = operatorTypeArg;
		}
		const overrideAuthorizedPrincipalArg = getFlagValue(
			args,
			overrideAuthorizedPrincipalIndex,
		);
		if (overrideAuthorizedPrincipalArg) {
			options.overrideAuthorizedPrincipal = overrideAuthorizedPrincipalArg;
		}
		const overrideScopeArg = getFlagValue(args, overrideScopeIndex);
		if (
			overrideScopeArg === "advisory_hold" ||
			overrideScopeArg === "temporary_unblock" ||
			overrideScopeArg === "temporary_promote"
		) {
			options.overrideScope = overrideScopeArg;
		}
		const overrideReasonArg = getFlagValue(args, overrideReasonIndex);
		if (overrideReasonArg) options.overrideReason = overrideReasonArg;
		const overrideTicketArg = getFlagValue(args, overrideTicketIndex);
		if (overrideTicketArg) options.overrideTicketRef = overrideTicketArg;
		const overrideApprovedByArg = getFlagValue(args, overrideApprovedByIndex);
		if (overrideApprovedByArg !== undefined) {
			options.overrideApprovedBy = parseCsvList(overrideApprovedByArg);
		}
		const overrideCreatedAtArg = getFlagValue(args, overrideCreatedAtIndex);
		if (overrideCreatedAtArg) {
			options.overrideCreatedAt = overrideCreatedAtArg;
		}
		const overrideExpiresAtArg = getFlagValue(args, overrideExpiresAtIndex);
		if (overrideExpiresAtArg) {
			options.overrideExpiresAt = overrideExpiresAtArg;
		}

		const exitCode = runPilotEvaluateCLI(options);
		process.exit(exitCode);
		return;
	}

	// No command recognized

	if (command === "simulate") {
		// Handle help
		if (args.includes("--help") || args.includes("-h")) {
			printSimulateUsage();
			process.exit(0);
			return;
		}

		// Parse simulate options
		const jsonFlag = args.includes("--json");
		const ciSoftFlag = args.includes("--ci-soft");
		const verboseFlag = args.includes("--verbose");

		const contractAIndex = args.indexOf("--contract-a");
		const contractBIndex = args.indexOf("--contract-b");
		const artifactsIndex = args.indexOf("--artifacts");
		const tracesIndex = args.indexOf("--traces");
		const outputIndex = args.indexOf("--output");

		const contractA = getFlagValue(args, contractAIndex);
		const contractB = getFlagValue(args, contractBIndex);

		if (!contractA) {
			console.error("Error: --contract-a is required");
			process.exit(1);
			return;
		}

		if (!contractB) {
			console.error("Error: --contract-b is required");
			process.exit(1);
			return;
		}

		const options: {
			contractA: string;
			contractB: string;
			artifactsDir?: string;
			tracesDir?: string;
			outputPath?: string;
			json?: boolean;
			ciSoft?: boolean;
			verbose?: boolean;
		} = {
			contractA,
			contractB,
		};

		if (jsonFlag) options.json = true;
		if (ciSoftFlag) options.ciSoft = true;
		if (verboseFlag) options.verbose = true;

		const artifactsArg = getFlagValue(args, artifactsIndex);
		if (artifactsArg) options.artifactsDir = artifactsArg;

		const tracesArg = getFlagValue(args, tracesIndex);
		if (tracesArg) options.tracesDir = tracesArg;

		const outputArg = getFlagValue(args, outputIndex);
		if (outputArg) options.outputPath = outputArg;

		const exitCode = runSimulateCLI(options);
		process.exit(exitCode);
		return;
	}
	if (command === "verify-greptile") {
		const jsonFlag = args.includes("--json");
		const verboseFlag = args.includes("--verbose");
		const tokenIndex = args.indexOf("--token");
		const ownerIndex = args.indexOf("--owner");
		const repoIndex = args.indexOf("--repo");
		const repoPathIndex = args.indexOf("--repo-path");
		const appIdIndex = args.indexOf("--app-id");
		const appPrivateKeyPathIndex = args.indexOf("--app-private-key-path");

		const options: {
			token?: string;
			owner?: string;
			repo?: string;
			repoPath?: string;
			appId?: string;
			appPrivateKeyPath?: string;
			json?: boolean;
			verbose?: boolean;
		} = {};

		if (jsonFlag) options.json = true;
		if (verboseFlag) options.verbose = true;
		const tokenArg = getFlagValue(args, tokenIndex);
		if (tokenArg) options.token = tokenArg;
		const ownerArg = getFlagValue(args, ownerIndex);
		if (ownerArg) options.owner = ownerArg;
		const repoArg = getFlagValue(args, repoIndex);
		if (repoArg) options.repo = repoArg;
		const repoPathArg = getFlagValue(args, repoPathIndex);
		if (repoPathArg) options.repoPath = repoPathArg;
		const appIdArg = getFlagValue(args, appIdIndex);
		if (appIdArg) options.appId = appIdArg;
		const appPrivateKeyPathArg = getFlagValue(args, appPrivateKeyPathIndex);
		if (appPrivateKeyPathArg) options.appPrivateKeyPath = appPrivateKeyPathArg;

		runVerifyGreptileCLI(options)
			.then((exitCode) => process.exit(exitCode))
			.catch((error) => handleFatalError("Verify Greptile Error", error));
		return;
	}
	if (command === "request-greptile-review") {
		const jsonFlag = args.includes("--json");
		const tokenIndex = args.indexOf("--token");
		const ownerIndex = args.indexOf("--owner");
		const repoIndex = args.indexOf("--repo");
		const prIndex = args.indexOf("--pr");
		const messageIndex = args.indexOf("--message");

		const options: {
			token?: string;
			owner?: string;
			repo?: string;
			pr?: number;
			message?: string;
			json?: boolean;
		} = {};

		if (jsonFlag) options.json = true;
		const tokenArg = getFlagValue(args, tokenIndex);
		if (tokenArg) options.token = tokenArg;
		const ownerArg = getFlagValue(args, ownerIndex);
		if (ownerArg) options.owner = ownerArg;
		const repoArg = getFlagValue(args, repoIndex);
		if (repoArg) options.repo = repoArg;
		const prArg = getFlagValue(args, prIndex);
		if (prArg) {
			const parsed = parseIntegerArg(prArg, 1);
			if (parsed !== undefined) options.pr = parsed;
		}
		const messageArg = getFlagValue(args, messageIndex);
		if (messageArg) options.message = messageArg;

		import("./commands/request-greptile-review.js")
			.then(({ runRequestGreptileReviewCLI }) =>
				runRequestGreptileReviewCLI(options),
			)
			.then((exitCode) => process.exit(exitCode))
			.catch((error) =>
				handleFatalError("Request Greptile Review Error", error),
			);
		return;
	}
	if (command === "gap-case") {
		const jsonFlag = args.includes("--json");
		const contractIndex = args.indexOf("--contract");
		const storeIndex = args.indexOf("--store");

		const action = args[1] as "open" | "resolve" | undefined;
		if (action !== "open" && action !== "resolve") {
			console.error("Error: action must be 'open' or 'resolve'");
			process.exit(1);
			return;
		}

		const incidentIdIndex = args.indexOf("--incident-id");
		const summaryIndex = args.indexOf("--summary");
		const severityIndex = args.indexOf("--severity");
		const ownerIndex = args.indexOf("--owner");
		const providerIndex = args.indexOf("--provider");
		const findingIdIndex = args.indexOf("--finding-id");
		const prNumberIndex = args.indexOf("--pr-number");
		const headShaIndex = args.indexOf("--head-sha");
		const slaHoursIndex = args.indexOf("--sla-hours");

		const caseIdIndex = args.indexOf("--case-id");
		const evidenceUrlIndex = args.indexOf("--evidence-url");
		const fixPrIndex = args.indexOf("--fix-pr");
		const noteIndex = args.indexOf("--note");
		const resolvedByIndex = args.indexOf("--resolved-by");

		const options: {
			action: "open" | "resolve";
			json?: boolean;
			contractPath?: string;
			storePath?: string;
			incidentId?: string;
			summary?: string;
			severity?: string;
			owner?: string;
			provider?: string;
			findingId?: string;
			prNumber?: number;
			headSha?: string;
			slaHours?: number;
			caseId?: string;
			evidenceUrl?: string;
			fixPr?: number;
			note?: string;
			resolvedBy?: string;
		} = { action };

		if (jsonFlag) options.json = true;
		const contractArg = getFlagValue(args, contractIndex);
		if (contractArg) options.contractPath = contractArg;
		const storeArg = getFlagValue(args, storeIndex);
		if (storeArg) options.storePath = storeArg;

		const incidentIdArg = getFlagValue(args, incidentIdIndex);
		if (incidentIdArg) options.incidentId = incidentIdArg;
		const summaryArg = getFlagValue(args, summaryIndex);
		if (summaryArg) options.summary = summaryArg;
		const severityArg = getFlagValue(args, severityIndex);
		if (severityArg) options.severity = severityArg;
		const ownerArg = getFlagValue(args, ownerIndex);
		if (ownerArg) options.owner = ownerArg;
		const providerArg = getFlagValue(args, providerIndex);
		if (providerArg) options.provider = providerArg;
		const findingIdArg = getFlagValue(args, findingIdIndex);
		if (findingIdArg) options.findingId = findingIdArg;
		const prNumberArg = getFlagValue(args, prNumberIndex);
		if (prNumberArg) {
			const parsed = parseIntegerArg(prNumberArg, 1);
			if (parsed !== undefined) options.prNumber = parsed;
		}
		const headShaArg = getFlagValue(args, headShaIndex);
		if (headShaArg) options.headSha = headShaArg;
		const slaHoursArg = getFlagValue(args, slaHoursIndex);
		if (slaHoursArg) {
			const parsed = parseIntegerArg(slaHoursArg, 1);
			if (parsed !== undefined) options.slaHours = parsed;
		}

		const caseIdArg = getFlagValue(args, caseIdIndex);
		if (caseIdArg) options.caseId = caseIdArg;
		const evidenceUrlArg = getFlagValue(args, evidenceUrlIndex);
		if (evidenceUrlArg) options.evidenceUrl = evidenceUrlArg;
		const fixPrArg = getFlagValue(args, fixPrIndex);
		if (fixPrArg) {
			const parsed = parseIntegerArg(fixPrArg, 1);
			if (parsed !== undefined) options.fixPr = parsed;
		}
		const noteArg = getFlagValue(args, noteIndex);
		if (noteArg) options.note = noteArg;
		const resolvedByArg = getFlagValue(args, resolvedByIndex);
		if (resolvedByArg) options.resolvedBy = resolvedByArg;

		const exitCode = runGapCaseCLI(options);
		process.exit(exitCode);
		return;
	}

	if (command === "org-audit") {
		runOrgAuditCLI(args.slice(1))
			.then((result) => process.exit(result.exitCode))
			.catch((error) => handleFatalError("Org Audit Error", error));
		return;
	}

	if (command === "tooling-audit") {
		runToolingAuditCLI(args.slice(1))
			.then((result) => process.exit(result.exitCode))
			.catch((error) => handleFatalError("Tooling Audit Error", error));
		return;
	}

	if (command === "preset") {
		const subcommandArgs = args.slice(1);
		runPresetCLI(subcommandArgs)
			.then((result) => process.exit(result.exitCode))
			.catch((error) => handleFatalError("Preset Error", error));
		return;
	}

	if (command === "doctor") {
		const exitCode = runDoctorCLI(args.slice(1), getVersion);
		process.exit(exitCode);
		return;
	}

	if (command === "health") {
		const exitCode = runHealthCLI(args.slice(1), getVersion);
		process.exit(exitCode);
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

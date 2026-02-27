#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { runBlastRadiusCLI } from "./commands/blast-radius.js";
import { runBrainstormGateCLI } from "./commands/brainstorm-gate.js";
import { runContextCLI } from "./commands/context.js";
import { runDiffBudgetCLI } from "./commands/diff-budget.js";
import { runEvidenceVerifyCLI } from "./commands/evidence-verify.js";
import {
	type CreateGapCaseOptions,
	type GapSeverity,
	type ListGapCaseOptions,
	type ResolveGapCaseOptions,
	runGapCaseCLI,
} from "./commands/gap-case.js";
import { runGardenerCLI } from "./commands/gardener.js";
import { runIndexContextCLI } from "./commands/index-context.js";
import { runInitCLI, runInteractiveInitCLI } from "./commands/init.js";
import { runMemoryGateCLI } from "./commands/memory-gate.js";
import { runObservabilityGateCLI } from "./commands/observability-gate.js";
import {
	type PilotRollbackOptions,
	runPilotRollbackCLI,
} from "./commands/pilot-rollback.js";
import { runPlanGateCLI } from "./commands/plan-gate.js";
import { runPreflightGateCLI } from "./commands/preflight-gate.js";
import { runPromptGateCLI } from "./commands/prompt-gate.js";
import {
	type RemediateOptions,
	runRemediateCLI,
} from "./commands/remediate.js";
import { runReplayCLI } from "./commands/replay.js";
import { runReviewGateCLI } from "./commands/review-gate.js";
import { runRiskTierCLI } from "./commands/risk-tier.js";
import { runSilentErrorDetectorCLI } from "./commands/silent-error.js";
import {
	runUIExploreCLI,
	runUIFastCLI,
	runUIVerifyCLI,
} from "./commands/ui-loop.js";
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

function printUsage(): void {
	console.info("Usage: harness <command> [options]");
	console.info("");
	console.info("Commands:");
	console.info("  init             Install harness in current directory");
	console.info("  risk-tier        Classify files by risk tier");
	console.info("  evidence-verify  Verify evidence files (screenshots)");
	console.info("  gardener         Detect stale docs and broken links");
	console.info("  memory-gate      Validate local-memory workflow compliance");
	console.info(
		"  preflight-gate   Fast policy checks before expensive operations",
	);
	console.info("  silent-error     Detect silent error handling anti-patterns");
	console.info("  review-gate      Review gate with SHA enforcement");
	console.info("  brainstorm-gate  Validate brainstorm artifacts");
	console.info("  plan-gate        Validate plan artifacts");
	console.info("  prompt-gate      Validate prompt template usage");
	console.info(
		"  blast-radius     Determine required checks from changed files",
	);
	console.info(
		"  remediate        Auto-plan and execute deterministic remediation",
	);
	console.info(
		"  gap-case         Manage production gap cases (create/list/resolve)",
	);
	console.info("  observability-gate  Check cardinality limits in metrics");
	console.info("  diff-budget      Enforce diff budget constraints");
	console.info("  ui:fast          Storybook-first local development loop");
	console.info("  ui:verify        Playwright smoke suite with evidence");
	console.info("  ui:explore       Agent browser exploratory testing");
	console.info("  context          Semantic search for relevant prior work");
	console.info("  index-context    Bulk index brainstorms/plans for search");
	console.info(
		"  pilot-rollback   Transition pilot mode (autonomous <-> manual)",
	);
	console.info("");
	console.info("Init Options:");
	console.info("  --dry-run        Preview changes without writing");
	console.info("  --force          Overwrite existing files");
	console.info("  --track          Create manifest + backups for rollback");
	console.info("  --rollback       Restore from manifest (undo init)");
	console.info("  --check-updates  Check for template updates");
	console.info("  --update         Apply available template updates");
	console.info("  --interactive    Review and approve each change");
	console.info("  --migrate        Migrate contract schema to latest version");
	console.info("");
	console.info("Evidence Verify Options:");
	console.info(
		"  --files <paths>  Comma-separated list of evidence files to verify",
	);
	console.info("  --contract       Path to contract file (optional)");
	console.info("  --json           Output as JSON");
	console.info("");
	console.info("Gardener Options:");
	console.info("  --docs           Path to docs directory (default: docs)");
	console.info("  --dry-run        Preview changes without writing");
	console.info("  --json           Output results as JSON");
	console.info("  --stale-days     Days before doc is stale (default: 30)");
	console.info("");
	console.info("Memory Gate Options:");
	console.info("  --memory         Path to memory.json (default: memory.json)");
	console.info("  --forjamie       Path to FORJAMIE.md (default: FORJAMIE.md)");
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
	console.info("Review Gate Options:");
	console.info("  --token          GitHub token (required)");
	console.info("  --owner          Repository owner (required)");
	console.info("  --repo           Repository name (required)");
	console.info("  --pr             Pull request number (required)");
	console.info("  --sha            Head SHA to verify (required)");
	console.info("  --check          Check run name to look for");
	console.info("  --contract       Path to harness.contract.json");
	console.info("  --json           Output as JSON");
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
	console.info("Plan Gate Options:");
	console.info(
		"  --plans          Path to plans directory (default: docs/plans)",
	);
	console.info(
		"  --type           Filter by plan type (feature/refactor/bugfix/docs/architecture)",
	);
	console.info("  --max-age        Max days old (default: 30)");
	console.info("  --require-origin Require origin reference to brainstorm");
	console.info("  --strict         Require all sections");
	console.info("  --json           Output as JSON");
	console.info("");
	console.info("Options:");
	console.info("  --version, -v  Print version");
	console.info("  --help, -h     Print this help");
}

export function parseIntegerArg(
	value: string | undefined,
	min: number = Number.NEGATIVE_INFINITY,
): number | undefined {
	if (value === undefined) {
		return undefined;
	}
	const trimmed = value.trim();
	if (!/^-?\d+$/.test(trimmed)) {
		return undefined;
	}
	const parsed = Number.parseInt(trimmed, 10);
	if (!Number.isFinite(parsed) || parsed < min) {
		return undefined;
	}
	return parsed;
}

export function parseCsvList(value: string | undefined): string[] {
	if (value === undefined) {
		return [];
	}
	return value
		.split(",")
		.map((item) => item.trim())
		.filter((item) => item.length > 0);
}

/**
 * Safely get a flag value from args, returning undefined if the flag is missing
 * or if the next argument is another flag (starts with -- or -).
 */
function getFlagValue(args: string[], flagIndex: number): string | undefined {
	if (flagIndex === -1) return undefined;
	const value = args[flagIndex + 1];
	if (value === undefined || value.startsWith("-")) return undefined;
	return value;
}

export function run(args: string[]): void {
	const version = getVersion();

	if (args.includes("--version") || args.includes("-v")) {
		console.info(`harness v${version}`);
		return;
	}

	if (args.includes("--help") || args.includes("-h")) {
		console.info(`harness v${version}`);
		printUsage();
		return;
	}

	// Parse command
	const command = args[0];

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

		// Also check for positional trace ID argument
		if (!options.traceId && args[1] && !args[1].startsWith("--")) {
			options.traceId = args[1];
		}

		runReplayCLI(options)
			.then((exitCode) => process.exit(exitCode))
			.catch((error) => handleFatalError("Replay Error", error));
		return;
	}

	if (command === "evidence-verify") {
		// Parse evidence-verify options
		const jsonFlag = args.includes("--json");
		const filesIndex = args.indexOf("--files");
		const contractIndex = args.indexOf("--contract");
		const changedIndex = args.indexOf("--changed");

		const files: string[] = [];
		const filesArg = getFlagValue(args, filesIndex);
		files.push(...parseCsvList(filesArg));

		const contractArg = getFlagValue(args, contractIndex);

		const changedFiles: string[] = [];
		const changedArg = getFlagValue(args, changedIndex);
		changedFiles.push(...parseCsvList(changedArg));

		const exitCode = runEvidenceVerifyCLI({
			files,
			contract: contractArg,
			json: jsonFlag,
			changed: changedFiles.length > 0 ? changedFiles : undefined,
		});
		process.exit(exitCode);
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

	if (command === "preflight-gate") {
		// Parse preflight-gate options
		const jsonFlag = args.includes("--json");
		const strictFlag = args.includes("--strict");
		const contractIndex = args.indexOf("--contract");
		const filesIndex = args.indexOf("--files");
		const maxTierIndex = args.indexOf("--max-tier");
		const skipIndex = args.indexOf("--skip");

		const options: {
			contractPath?: string;
			files?: string[];
			maxTier?: "high" | "medium" | "low";
			strict?: boolean;
			skip?: string[];
			json?: boolean;
		} = {};

		if (jsonFlag) options.json = true;
		if (strictFlag) options.strict = true;
		const contractArg = getFlagValue(args, contractIndex);
		if (contractArg) {
			options.contractPath = contractArg;
		}
		const filesArg = getFlagValue(args, filesIndex);
		if (filesArg) {
			options.files = parseCsvList(filesArg);
		}
		const maxTierArg = getFlagValue(args, maxTierIndex);
		if (
			maxTierArg === "high" ||
			maxTierArg === "medium" ||
			maxTierArg === "low"
		) {
			options.maxTier = maxTierArg;
		}
		const skipArg = getFlagValue(args, skipIndex);
		if (skipArg) {
			options.skip = parseCsvList(skipArg);
		}

		// Handle async preflight gate
		runPreflightGateCLI(options)
			.then((exitCode) => process.exit(exitCode))
			.catch((error) => handleFatalError("Preflight Gate Error", error));
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
		if (filesArg) {
			options.files = parseCsvList(filesArg);
		}
		const dirsArg = getFlagValue(args, dirsIndex);
		if (dirsArg) {
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
		const interactiveFlag = args.includes("--interactive");
		const migrateFlag = args.includes("--migrate");

		// Get optional target directory (first non-flag arg after init)
		const targetDir = args.slice(1).find((arg) => !arg.startsWith("-"));

		const options = {
			dryRun: dryRunFlag,
			force: forceFlag,
			track: trackFlag,
			rollback: rollbackFlag,
			checkUpdates: checkUpdatesFlag,
			update: updateFlag,
			interactive: interactiveFlag,
			migrate: migrateFlag,
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

	if (command === "review-gate") {
		// Parse review-gate options
		const jsonFlag = args.includes("--json");
		const tokenIndex = args.indexOf("--token");
		const ownerIndex = args.indexOf("--owner");
		const repoIndex = args.indexOf("--repo");
		const prIndex = args.indexOf("--pr");
		const shaIndex = args.indexOf("--sha");
		const checkIndex = args.indexOf("--check");
		const contractIndex = args.indexOf("--contract");

		const options: {
			token: string;
			owner: string;
			repo: string;
			prNumber: number;
			headSha: string;
			checkName: string;
			contractPath: string;
			json?: boolean;
		} = {
			token: "",
			owner: "",
			repo: "",
			prNumber: 0,
			headSha: "",
			checkName: "code-review",
			contractPath: "harness.contract.json",
		};

		if (jsonFlag) options.json = true;
		const tokenArg = getFlagValue(args, tokenIndex);
		if (tokenArg) options.token = tokenArg;
		const ownerArg = getFlagValue(args, ownerIndex);
		if (ownerArg) options.owner = ownerArg;
		const repoArg = getFlagValue(args, repoIndex);
		if (repoArg) options.repo = repoArg;
		const prArg = getFlagValue(args, prIndex);
		if (prArg) {
			const parsedPr = parseIntegerArg(prArg, 1);
			if (parsedPr !== undefined) options.prNumber = parsedPr;
		}
		const shaArg = getFlagValue(args, shaIndex);
		if (shaArg) options.headSha = shaArg;
		const checkArg = getFlagValue(args, checkIndex);
		if (checkArg) options.checkName = checkArg;
		const contractArg = getFlagValue(args, contractIndex);
		if (contractArg) options.contractPath = contractArg;

		runReviewGateCLI(options)
			.then((exitCode) => process.exit(exitCode))
			.catch((error) => handleFatalError("Review Gate Error", error));
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
		const plansIndex = args.indexOf("--plans");
		const typeIndex = args.indexOf("--type");
		const maxAgeIndex = args.indexOf("--max-age");

		const options: {
			plansPath?: string;
			type?: string;
			maxAge?: number;
			requireOrigin?: boolean;
			strict?: boolean;
			json?: boolean;
		} = {};

		if (jsonFlag) options.json = true;
		if (strictFlag) options.strict = true;
		if (requireOriginFlag) options.requireOrigin = true;
		const plansArg = getFlagValue(args, plansIndex);
		if (plansArg) options.plansPath = plansArg;
		const typeArg = getFlagValue(args, typeIndex);
		if (typeArg) options.type = typeArg;
		const maxAgeArg = getFlagValue(args, maxAgeIndex);
		if (maxAgeArg) {
			const parsedMaxAge = parseIntegerArg(maxAgeArg, 0);
			if (parsedMaxAge !== undefined) options.maxAge = parsedMaxAge;
		}

		const exitCode = runPlanGateCLI(options);
		process.exit(exitCode);
		return;
	}

	if (command === "ui:fast") {
		// Parse ui:fast options
		const jsonFlag = args.includes("--json");
		const ciFlag = args.includes("--ci");
		const portIndex = args.indexOf("--port");
		const contractIndex = args.indexOf("--contract");

		const options: {
			port?: number;
			ci?: boolean;
			json?: boolean;
			contractPath?: string;
		} = {};

		if (jsonFlag) options.json = true;
		if (ciFlag) options.ci = true;
		const portArg = getFlagValue(args, portIndex);
		if (portArg) {
			const parsedPort = parseIntegerArg(portArg, 1);
			if (parsedPort !== undefined) options.port = parsedPort;
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
		const outputIndex = args.indexOf("--output");
		const timeoutIndex = args.indexOf("--timeout");
		const shardIndex = args.indexOf("--shard");
		const contractIndex = args.indexOf("--contract");

		const options: {
			outputDir?: string;
			json?: boolean;
			timeout?: number;
			shard?: string;
			contractPath?: string;
		} = {};

		if (jsonFlag) options.json = true;
		const outputArg = getFlagValue(args, outputIndex);
		if (outputArg) options.outputDir = outputArg;
		const timeoutArg = getFlagValue(args, timeoutIndex);
		if (timeoutArg) {
			const parsedTimeout = parseIntegerArg(timeoutArg, 1);
			if (parsedTimeout !== undefined) options.timeout = parsedTimeout;
		}
		const shardArg = getFlagValue(args, shardIndex);
		if (shardArg) options.shard = shardArg;
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
		const urlIndex = args.indexOf("--url");
		const outputIndex = args.indexOf("--output");
		const contractIndex = args.indexOf("--contract");

		const options: {
			url?: string;
			outputDir?: string;
			json?: boolean;
			interactions?: boolean;
			contractPath?: string;
		} = {};

		if (jsonFlag) options.json = true;
		if (interactionsFlag) options.interactions = true;
		const urlArg = getFlagValue(args, urlIndex);
		if (urlArg) options.url = urlArg;
		const outputArg = getFlagValue(args, outputIndex);
		if (outputArg) options.outputDir = outputArg;
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

		const typeArg = getFlagValue(args, typeIndex);
		if (!typeArg) {
			console.error(
				"Error: --type is required (feature|bugfix|refactor|release)",
			);
			process.exit(1);
			return;
		}

		const fileArg = getFlagValue(args, fileIndex);
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

		const exitCode = runBlastRadiusCLI({
			files,
			json: jsonFlag,
			verbose: verboseFlag,
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

	if (command === "gap-case") {
		const action = args[1];
		const jsonFlag = args.includes("--json");
		const caseStoreIndex = args.indexOf("--case-store");
		const caseStore = getFlagValue(args, caseStoreIndex);

		// Parse --contract flag for all gap-case actions
		const contractIndex = args.indexOf("--contract");
		const contractPath = getFlagValue(args, contractIndex);

		if (
			action !== "create" &&
			action !== "list" &&
			action !== "resolve" &&
			action !== "update-causality"
		) {
			console.error(
				"Error: gap-case command requires subcommand `create`, `list`, `resolve`, or `update-causality`",
			);
			process.exit(2);
			return;
		}

		if (action === "create") {
			const incidentIndex = args.indexOf("--incident-id");
			const ownerIndex = args.indexOf("--owner");
			const severityIndex = args.indexOf("--severity");
			const linkedPrIndex = args.indexOf("--linked-pr");
			const findingSummaryIndex = args.indexOf("--finding-summary");
			const dueDaysIndex = args.indexOf("--due-days");
			const caseIdIndex = args.indexOf("--case-id");
			const caseIdPrefixIndex = args.indexOf("--case-id-prefix");
			const evidenceIndex = args.indexOf("--evidence");

			const dueDaysValue = getFlagValue(args, dueDaysIndex);
			const parsedDueDays = dueDaysValue
				? parseIntegerArg(dueDaysValue, 1)
				: undefined;

			const severityArg = getFlagValue(args, severityIndex);
			const createOptions: CreateGapCaseOptions = {
				action: "create",
				incidentId: getFlagValue(args, incidentIndex) ?? "",
				owner: getFlagValue(args, ownerIndex) ?? "",
				severity: (severityArg as GapSeverity | undefined) ?? "low",
				linkedPr: getFlagValue(args, linkedPrIndex) ?? "",
				evidence: parseCsvList(getFlagValue(args, evidenceIndex)),
				json: jsonFlag,
			};
			const findingSummaryValue = getFlagValue(args, findingSummaryIndex);
			if (findingSummaryValue) {
				createOptions.findingSummary = findingSummaryValue;
			}
			if (parsedDueDays !== undefined) {
				createOptions.dueDays = parsedDueDays;
			}
			const caseIdValue = getFlagValue(args, caseIdIndex);
			if (caseIdValue) {
				createOptions.caseId = caseIdValue;
			}
			const caseIdPrefixValue = getFlagValue(args, caseIdPrefixIndex);
			if (caseIdPrefixValue) {
				createOptions.caseIdPrefix = caseIdPrefixValue;
			}
			if (caseStore) {
				createOptions.caseStore = caseStore;
			}
			if (contractPath) {
				createOptions.contractPath = contractPath;
			}
			const exitCode = runGapCaseCLI(createOptions);
			process.exit(exitCode);
			return;
		}

		if (action === "list") {
			const openFlag = args.includes("--open");
			const overdueFlag = args.includes("--overdue");
			const listOptions: ListGapCaseOptions = {
				action: "list",
				open: openFlag,
				overdue: overdueFlag,
				json: jsonFlag,
			};
			if (caseStore) {
				listOptions.caseStore = caseStore;
			}
			if (contractPath) {
				listOptions.contractPath = contractPath;
			}
			const exitCode = runGapCaseCLI(listOptions);
			process.exit(exitCode);
			return;
		}

		const positionalCaseId =
			args[2] && !args[2].startsWith("--") ? args[2] : "";
		const caseIdArgIndex = args.indexOf("--case-id");
		const caseIdArg = getFlagValue(args, caseIdArgIndex) ?? "";
		if (positionalCaseId && caseIdArg && positionalCaseId !== caseIdArg) {
			console.error("Error: positional case id and --case-id must match");
			process.exit(2);
			return;
		}
		const caseId = caseIdArg || positionalCaseId;
		if (!caseId) {
			console.error("Error: gap-case resolve requires a case id");
			process.exit(2);
			return;
		}

		const incidentIndex = args.indexOf("--incident-id");
		const resolvedByIndex = args.indexOf("--resolved-by");
		const linkedPrIndex = args.indexOf("--linked-pr");
		const evidenceIndex = args.indexOf("--evidence");
		const closeReasonIndex = args.indexOf("--close-reason");
		const forceFlag = args.includes("--force");

		const resolveOptions: ResolveGapCaseOptions = {
			action: "resolve",
			caseId,
			incidentId: getFlagValue(args, incidentIndex) ?? "",
			resolvedBy: getFlagValue(args, resolvedByIndex) ?? "",
			linkedPr: getFlagValue(args, linkedPrIndex) ?? "",
			evidence: parseCsvList(getFlagValue(args, evidenceIndex)),
			force: forceFlag,
			json: jsonFlag,
		};
		const closeReasonValue = getFlagValue(args, closeReasonIndex);
		if (closeReasonValue) {
			resolveOptions.closeReason = closeReasonValue;
		}
		if (caseStore) {
			resolveOptions.caseStore = caseStore;
		}
		if (contractPath) {
			resolveOptions.contractPath = contractPath;
		}
		const exitCode = runGapCaseCLI(resolveOptions);
		process.exit(exitCode);
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
		if (cardValue && /^\d+$/.test(cardValue)) {
			const val = Number.parseInt(cardValue, 10);
			if (!Number.isNaN(val)) options.maxCardinality = val;
		}
		const lenValue = getFlagValue(args, maxLenIndex);
		if (lenValue && /^\d+$/.test(lenValue)) {
			const val = Number.parseInt(lenValue, 10);
			if (!Number.isNaN(val)) options.maxLength = val;
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

	if (command === "index-context") {
		// Parse index-context options
		const argsAfterCommand = args.slice(1);
		runIndexContextCLI(argsAfterCommand)
			.then((exitCode) => process.exit(exitCode))
			.catch((error) => handleFatalError("Index Context Error", error));
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

		const reasonArg = getFlagValue(args, reasonIndex);
		if (reasonArg) options.reason = reasonArg;

		runPilotRollbackCLI(options)
			.then((exitCode) => process.exit(exitCode))
			.catch((error) => handleFatalError("Pilot Rollback Error", error));
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

function isDirectExecution(): boolean {
	const entrypoint = process.argv[1];
	if (!entrypoint) {
		return false;
	}
	return import.meta.url === pathToFileURL(entrypoint).href;
}

if (isDirectExecution()) {
	run(process.argv.slice(2));
}

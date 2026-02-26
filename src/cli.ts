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
	console.info("  --contract      Path to harness.contract.json");
	console.info("  ui:verify        Playwright smoke suite with evidence");
	console.info("  --contract      Path to harness.contract.json");
	console.info("  ui:explore       Agent browser exploratory testing");
	console.info("  --contract      Path to harness.contract.json");
	console.info("  context          Semantic search for relevant prior work");
	console.info("  index-context    Bulk index brainstorms/plans for search");
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
		const filesArg = filesIndex !== -1 ? args[filesIndex + 1] : undefined;
		files.push(...parseCsvList(filesArg));

		const contractArg =
			contractIndex !== -1 ? args[contractIndex + 1] : undefined;
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

		if (traceIdIndex !== -1 && args[traceIdIndex + 1]) {
			const traceIdValue = args[traceIdIndex + 1];
			if (traceIdValue !== undefined) {
				options.traceId = traceIdValue;
			}
		}

		if (traceDirIndex !== -1 && args[traceDirIndex + 1]) {
			const traceDirValue = args[traceDirIndex + 1];
			if (traceDirValue !== undefined) {
				options.traceDir = traceDirValue;
			}
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
		const filesArg = filesIndex !== -1 ? args[filesIndex + 1] : undefined;
		files.push(...parseCsvList(filesArg));

		const contractArg =
			contractIndex !== -1 ? args[contractIndex + 1] : undefined;

		const changedFiles: string[] = [];
		const changedArg = changedIndex !== -1 ? args[changedIndex + 1] : undefined;
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
		if (docsIndex !== -1) {
			const docsArg = args[docsIndex + 1];
			if (docsArg) {
				options.docsPath = docsArg;
			}
		}
		if (staleDaysIndex !== -1 && args[staleDaysIndex + 1]) {
			const staleDays = parseIntegerArg(args[staleDaysIndex + 1], 0);
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
		if (memoryIndex !== -1) {
			const memoryArg = args[memoryIndex + 1];
			if (memoryArg) {
				options.memoryPath = memoryArg;
			}
		}
		if (forjamieIndex !== -1) {
			const forjamieArg = args[forjamieIndex + 1];
			if (forjamieArg) {
				options.forjamiePath = forjamieArg;
			}
		}
		if (metricsIndex !== -1) {
			const metricsArg = args[metricsIndex + 1];
			if (metricsArg) {
				options.metricsPath = metricsArg;
			}
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
		if (contractIndex !== -1) {
			const contractArg = args[contractIndex + 1];
			if (contractArg) {
				options.contractPath = contractArg;
			}
		}
		if (filesIndex !== -1) {
			const filesArg = args[filesIndex + 1];
			options.files = parseCsvList(filesArg);
		}
		if (maxTierIndex !== -1) {
			const maxTierArg = args[maxTierIndex + 1];
			if (
				maxTierArg === "high" ||
				maxTierArg === "medium" ||
				maxTierArg === "low"
			) {
				options.maxTier = maxTierArg;
			}
		}
		if (skipIndex !== -1) {
			const skipArg = args[skipIndex + 1];
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
		if (filesIndex !== -1) {
			const filesArg = args[filesIndex + 1];
			options.files = parseCsvList(filesArg);
		}
		if (dirsIndex !== -1) {
			const dirsArg = args[dirsIndex + 1];
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
		const targetDir = args.slice(1).find((arg) => !arg.startsWith("--"));

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
		if (baseIndex !== -1) {
			const baseArg = args[baseIndex + 1];
			if (baseArg) options.base = baseArg;
		}
		if (headIndex !== -1) {
			const headArg = args[headIndex + 1];
			if (headArg) options.head = headArg;
		}
		if (contractIndex !== -1) {
			const contractArg = args[contractIndex + 1];
			if (contractArg) options.contractPath = contractArg;
		}
		if (overrideIndex !== -1) {
			const overrideArg = args[overrideIndex + 1];
			if (overrideArg) options.overridePath = overrideArg;
		}

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
		if (tokenIndex !== -1) {
			const tokenArg = args[tokenIndex + 1];
			if (tokenArg) options.token = tokenArg;
		}
		if (ownerIndex !== -1) {
			const ownerArg = args[ownerIndex + 1];
			if (ownerArg) options.owner = ownerArg;
		}
		if (repoIndex !== -1) {
			const repoArg = args[repoIndex + 1];
			if (repoArg) options.repo = repoArg;
		}
		if (prIndex !== -1) {
			const prArg = args[prIndex + 1];
			const parsedPr = parseIntegerArg(prArg, 1);
			if (parsedPr !== undefined) options.prNumber = parsedPr;
		}
		if (shaIndex !== -1) {
			const shaArg = args[shaIndex + 1];
			if (shaArg) options.headSha = shaArg;
		}
		if (checkIndex !== -1) {
			const checkArg = args[checkIndex + 1];
			if (checkArg) options.checkName = checkArg;
		}
		if (contractIndex !== -1) {
			const contractArg = args[contractIndex + 1];
			if (contractArg) options.contractPath = contractArg;
		}

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
		if (brainstormsIndex !== -1) {
			const brainstormsArg = args[brainstormsIndex + 1];
			if (brainstormsArg) options.brainstormsPath = brainstormsArg;
		}
		if (topicIndex !== -1) {
			const topicArg = args[topicIndex + 1];
			if (topicArg) options.topic = topicArg;
		}
		if (maxAgeIndex !== -1) {
			const maxAgeArg = args[maxAgeIndex + 1];
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
		if (plansIndex !== -1) {
			const plansArg = args[plansIndex + 1];
			if (plansArg) options.plansPath = plansArg;
		}
		if (typeIndex !== -1) {
			const typeArg = args[typeIndex + 1];
			if (typeArg) options.type = typeArg;
		}
		if (maxAgeIndex !== -1) {
			const maxAgeArg = args[maxAgeIndex + 1];
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
		if (portIndex !== -1) {
			const portArg = args[portIndex + 1];
			const parsedPort = parseIntegerArg(portArg, 1);
			if (parsedPort !== undefined) options.port = parsedPort;
		}
		if (contractIndex !== -1) {
			const contractArg = args[contractIndex + 1];
			if (contractArg) options.contractPath = contractArg;
		}

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
		if (outputIndex !== -1) {
			const outputArg = args[outputIndex + 1];
			if (outputArg) options.outputDir = outputArg;
		}
		if (timeoutIndex !== -1) {
			const timeoutArg = args[timeoutIndex + 1];
			const parsedTimeout = parseIntegerArg(timeoutArg, 1);
			if (parsedTimeout !== undefined) options.timeout = parsedTimeout;
		}
		if (shardIndex !== -1) {
			const shardArg = args[shardIndex + 1];
			if (shardArg) options.shard = shardArg;
		}
		if (contractIndex !== -1) {
			const contractArg = args[contractIndex + 1];
			if (contractArg) options.contractPath = contractArg;
		}

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
		if (urlIndex !== -1) {
			const urlArg = args[urlIndex + 1];
			if (urlArg) options.url = urlArg;
		}
		if (outputIndex !== -1) {
			const outputArg = args[outputIndex + 1];
			if (outputArg) options.outputDir = outputArg;
		}
		if (contractIndex !== -1) {
			const contractArg = args[contractIndex + 1];
			if (contractArg) options.contractPath = contractArg;
		}

		const exitCode = runUIExploreCLI(options);
		process.exit(exitCode);
		return;
	}

	if (command === "prompt-gate") {
		// Parse prompt-gate options
		const jsonFlag = args.includes("--json");
		const typeIndex = args.indexOf("--type");
		const fileIndex = args.indexOf("--file");

		if (typeIndex === -1 || !args[typeIndex + 1]) {
			console.error(
				"Error: --type is required (feature|bugfix|refactor|release)",
			);
			process.exit(1);
			return;
		}

		if (fileIndex === -1 || !args[fileIndex + 1]) {
			console.error("Error: --file is required");
			process.exit(1);
			return;
		}

		const typeArg = args[typeIndex + 1];
		const validTypes = ["feature", "bugfix", "refactor", "release"] as const;
		if (!validTypes.includes(typeArg as (typeof validTypes)[number])) {
			console.error(
				`Error: Invalid type "${typeArg}". Must be one of: ${validTypes.join(", ")}`,
			);
			process.exit(1);
			return;
		}

		const fileArg = args[fileIndex + 1];
		if (!fileArg) {
			console.error("Error: --file requires a value");
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

		if (filesIndex === -1 || !args[filesIndex + 1]) {
			console.error("Error: --files is required (comma-separated paths)");
			process.exit(1);
			return;
		}

		const filesArg = args[filesIndex + 1];
		if (!filesArg) {
			console.error("Error: --files requires a value");
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

		const prValue = prIndex !== -1 ? args[prIndex + 1] : undefined;
		const maxAutoTierValue =
			maxAutoTierIndex !== -1 ? args[maxAutoTierIndex + 1] : undefined;

		const remediateOptions: RemediateOptions = {
			mode,
			owner: ownerIndex !== -1 ? (args[ownerIndex + 1] ?? "") : "",
			repo: repoIndex !== -1 ? (args[repoIndex + 1] ?? "") : "",
			prNumber: parseIntegerArg(prValue, 1) ?? 0,
			headSha: shaIndex !== -1 ? (args[shaIndex + 1] ?? "") : "",
			provider:
				(providerIndex !== -1
					? (args[providerIndex + 1] as "codeql" | "codex" | undefined)
					: undefined) ?? "codeql",
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
		const caseStore =
			caseStoreIndex !== -1 ? args[caseStoreIndex + 1] : undefined;

		if (action !== "create" && action !== "list" && action !== "resolve") {
			console.error(
				"Error: gap-case command requires subcommand `create`, `list`, or `resolve`",
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

			const dueDaysValue =
				dueDaysIndex !== -1 ? args[dueDaysIndex + 1] : undefined;
			const parsedDueDays = dueDaysValue
				? parseIntegerArg(dueDaysValue, 1)
				: undefined;

			const createOptions: CreateGapCaseOptions = {
				action: "create",
				incidentId: incidentIndex !== -1 ? (args[incidentIndex + 1] ?? "") : "",
				owner: ownerIndex !== -1 ? (args[ownerIndex + 1] ?? "") : "",
				severity:
					severityIndex !== -1
						? ((args[severityIndex + 1] as GapSeverity | undefined) ?? "low")
						: "low",
				linkedPr: linkedPrIndex !== -1 ? (args[linkedPrIndex + 1] ?? "") : "",
				evidence:
					evidenceIndex !== -1 ? parseCsvList(args[evidenceIndex + 1]) : [],
				json: jsonFlag,
			};
			const findingSummaryValue =
				findingSummaryIndex !== -1 ? args[findingSummaryIndex + 1] : undefined;
			if (findingSummaryValue) {
				createOptions.findingSummary = findingSummaryValue;
			}
			if (parsedDueDays !== undefined) {
				createOptions.dueDays = parsedDueDays;
			}
			const caseIdValue =
				caseIdIndex !== -1 ? args[caseIdIndex + 1] : undefined;
			if (caseIdValue) {
				createOptions.caseId = caseIdValue;
			}
			const caseIdPrefixValue =
				caseIdPrefixIndex !== -1 ? args[caseIdPrefixIndex + 1] : undefined;
			if (caseIdPrefixValue) {
				createOptions.caseIdPrefix = caseIdPrefixValue;
			}
			if (caseStore) {
				createOptions.caseStore = caseStore;
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
			const exitCode = runGapCaseCLI(listOptions);
			process.exit(exitCode);
			return;
		}

		const positionalCaseId =
			args[2] && !args[2].startsWith("--") ? args[2] : "";
		const caseIdArgIndex = args.indexOf("--case-id");
		const caseIdArg =
			caseIdArgIndex !== -1 ? (args[caseIdArgIndex + 1] ?? "") : "";
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
			incidentId: incidentIndex !== -1 ? (args[incidentIndex + 1] ?? "") : "",
			resolvedBy:
				resolvedByIndex !== -1 ? (args[resolvedByIndex + 1] ?? "") : "",
			linkedPr: linkedPrIndex !== -1 ? (args[linkedPrIndex + 1] ?? "") : "",
			evidence:
				evidenceIndex !== -1 ? parseCsvList(args[evidenceIndex + 1]) : [],
			force: forceFlag,
			json: jsonFlag,
		};
		const closeReasonValue =
			closeReasonIndex !== -1 ? args[closeReasonIndex + 1] : undefined;
		if (closeReasonValue) {
			resolveOptions.closeReason = closeReasonValue;
		}
		if (caseStore) {
			resolveOptions.caseStore = caseStore;
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
		if (labelsIndex !== -1 && args[labelsIndex + 1]) {
			const labelsValue = args[labelsIndex + 1];
			if (labelsValue !== undefined) {
				options.labels = labelsValue;
			}
		}
		if (maxCardIndex !== -1 && args[maxCardIndex + 1]) {
			const cardValue = args[maxCardIndex + 1];
			if (cardValue !== undefined) {
				const val = Number.parseInt(cardValue, 10);
				if (!Number.isNaN(val)) options.maxCardinality = val;
			}
		}
		if (maxLenIndex !== -1 && args[maxLenIndex + 1]) {
			const lenValue = args[maxLenIndex + 1];
			if (lenValue !== undefined) {
				const val = Number.parseInt(lenValue, 10);
				if (!Number.isNaN(val)) options.maxLength = val;
			}
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

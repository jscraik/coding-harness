#!/usr/bin/env node
import { runGardenerCLI } from "./commands/gardener.js";
import { runInitCLI, runInteractiveInitCLI } from "./commands/init.js";
import { runMemoryGateCLI } from "./commands/memory-gate.js";
import { runPreflightGateCLI } from "./commands/preflight-gate.js";
import { runRiskTierCLI } from "./commands/risk-tier.js";
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
	console.info("  init           Install harness in current directory");
	console.info("  risk-tier      Classify files by risk tier");
	console.info("  gardener       Detect stale docs and broken links");
	console.info("  memory-gate    Validate local-memory workflow compliance");
	console.info(
		"  preflight-gate Fast policy checks before expensive operations",
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
	console.info("Options:");
	console.info("  --version, -v  Print version");
	console.info("  --help, -h     Print this help");
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
		if (filesArg) {
			files.push(...filesArg.split(",").map((f) => f.trim()));
		}

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
			options.staleDays = Number.parseInt(args[staleDaysIndex + 1] ?? "30", 10);
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
			if (filesArg) {
				options.files = filesArg.split(",").map((f) => f.trim());
			}
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
			if (skipArg) {
				options.skip = skipArg.split(",").map((s) => s.trim());
			}
		}

		// Handle async preflight gate
		runPreflightGateCLI(options)
			.then((exitCode) => process.exit(exitCode))
			.catch((error) => handleFatalError("Preflight Gate Error", error));
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

		// Get optional target directory (first non-flag arg after 'init')
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

	// No command recognized
	console.info(`harness v${version}`);
	if (args.length === 0) {
		printUsage();
	} else {
		console.info(`Unknown command: ${command}`);
	}
}

run(process.argv.slice(2));

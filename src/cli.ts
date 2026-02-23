#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runInitCLI } from "./commands/init.js";
import { runRiskTierCLI } from "./commands/risk-tier.js";
import { sanitizeError } from "./lib/input/sanitize.js";

// Typed package.json reader (avoids any from JSON.parse)
interface PackageJson {
	version: string;
}

function readPackageJson(path: string): PackageJson {
	const content = readFileSync(path, "utf-8");
	const data = JSON.parse(content) as unknown;
	if (typeof data !== "object" || data === null) {
		throw new Error("Invalid package.json: not an object");
	}
	if (!("version" in data) || typeof data.version !== "string") {
		throw new Error("Invalid package.json: missing or invalid version");
	}
	return { version: data.version };
}

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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getVersion(): string {
	const pkgPath = join(__dirname, "..", "package.json");
	const pkg = readPackageJson(pkgPath);
	return pkg.version;
}

function printUsage(): void {
	console.info("Usage: harness <command> [options]");
	console.info("");
	console.info("Commands:");
	console.info("  init       Install harness in current directory");
	console.info("  risk-tier  Classify files by risk tier");
	console.info("");
	console.info("Init Options:");
	console.info("  --dry-run      Preview changes without writing");
	console.info("  --force        Overwrite existing files");
	console.info("  --track        Create manifest + backups for rollback");
	console.info("  --rollback     Restore from manifest (undo init)");
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

	if (command === "init") {
		// Parse init options
		const dryRunFlag = args.includes("--dry-run");
		const forceFlag = args.includes("--force");
		const trackFlag = args.includes("--track");
		const rollbackFlag = args.includes("--rollback");

		// Get optional target directory (first non-flag arg after 'init')
		const targetDir = args.slice(1).find((arg) => !arg.startsWith("--"));

		const exitCode = runInitCLI(targetDir, {
			dryRun: dryRunFlag,
			force: forceFlag,
			track: trackFlag,
			rollback: rollbackFlag,
		});
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

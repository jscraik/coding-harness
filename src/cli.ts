#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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

// Sanitize error output to prevent information disclosure
function sanitizeError(error: unknown): string {
	if (error instanceof Error) {
		const message = error.message
			.replace(/[a-zA-Z0-9_-]{20,}/g, "[REDACTED]")
			.replace(/\/Users\/[^/]+/g, "[HOME]")
			.replace(/\/home\/[^/]+/g, "[HOME]");
		return `${error.name}: ${message}`;
	}
	return String(error).replace(/[a-zA-Z0-9_-]{20,}/g, "[REDACTED]");
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

export function run(args: string[]): void {
	const version = getVersion();

	if (args.includes("--version") || args.includes("-v")) {
		console.info(`harness v${version}`);
		return;
	}

	// No commands implemented yet - Phase 1 is bootstrap only
	console.info(`harness v${version}`);
	console.info(
		"No commands implemented yet. Run with --version to see version.",
	);
}

run(process.argv.slice(2));

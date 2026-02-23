import { existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { cwd } from "node:process";
import { randomUUID } from "node:crypto";
import { sanitizeError } from "../lib/input/sanitize.js";

// Exit codes for programmatic consumption
export const EXIT_CODES = {
	SUCCESS: 0,
	PATH_TRAVERSAL: 1,
	WRITE_ERROR: 2,
	INVALID_PATH: 3,
} as const;

export interface InitOptions {
	dryRun: boolean;
	force: boolean;
}

export interface InitOutput {
	packageManager: string;
	created: string[];
	skipped: string[];
}

export interface InitErrorOutput {
	code: string;
	message: string;
	path?: string;
}

export type InitResult =
	| { ok: true; output: InitOutput }
	| { ok: false; error: InitErrorOutput };

// === Templates (inline) ===

interface Template {
	path: string;
	render: (pm: string) => string;
}

const TEMPLATES: Template[] = [
	{
		path: "harness.contract.json",
		render: () =>
			JSON.stringify(
				{
					version: "1.0",
					riskTierRules: {},
					reviewPolicy: { timeoutSeconds: 600, timeoutAction: "fail" },
				},
				null,
				2,
			),
	},
	{
		path: ".github/workflows/pr-pipeline.yml",
		render: (pm) => `name: Harness PR Pipeline

on: pull_request

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: ${pm} install
      - run: ${pm} test
`,
	},
];

// === Package Manager Detection ===

function detectPackageManager(dir: string): string {
	if (existsSync(resolve(dir, "pnpm-lock.yaml"))) return "pnpm";
	if (existsSync(resolve(dir, "yarn.lock"))) return "yarn";
	if (existsSync(resolve(dir, "package-lock.json"))) return "npm";
	return "npm";
}

// === Path Sanitization ===

type PathResult =
	| { ok: true; value: string }
	| { ok: false; error: InitErrorOutput };

function sanitizePath(base: string, relativePath: string): PathResult {
	// Validate inputs
	if (!base || typeof base !== "string") {
		return {
			ok: false,
			error: { code: "INVALID_PATH", message: "Base directory must be a non-empty string" },
		};
	}

	if (!relativePath || typeof relativePath !== "string") {
		return {
			ok: false,
			error: { code: "INVALID_PATH", message: "Relative path must be a non-empty string" },
		};
	}

	// Normalize paths
	const normalizedBase = resolve(base);
	const resolved = resolve(base, relativePath);

	// Ensure base ends with separator for proper prefix matching
	// This prevents /app from matching /app-secrets
	const baseWithSep = normalizedBase.endsWith(sep) ? normalizedBase : normalizedBase + sep;

	// Check if resolved is exactly base or starts with base + separator
	if (resolved !== normalizedBase && !resolved.startsWith(baseWithSep)) {
		return {
			ok: false,
			error: {
				code: "PATH_TRAVERSAL",
				message: `Path traversal blocked: ${relativePath} resolves outside target directory`,
				path: relativePath,
			},
		};
	}

	return { ok: true, value: resolved };
}

// === Atomic Write ===

type WriteResult =
	| { ok: true; value: undefined }
	| { ok: false; error: InitErrorOutput };

function atomicWrite(filePath: string, content: string): WriteResult {
	const tempPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;

	try {
		mkdirSync(dirname(filePath), { recursive: true });
		writeFileSync(tempPath, content, "utf-8");
		renameSync(tempPath, filePath);
		return { ok: true, value: undefined };
	} catch (e) {
		return {
			ok: false,
			error: {
				code: "WRITE_ERROR",
				message: `Failed to write file: ${sanitizeError(e)}`,
				path: filePath,
			},
		};
	}
}

/**
 * Run harness init and return structured result.
 * This function is usable as a library (does not output to console).
 */
export function runInit(
	targetDir: string | undefined,
	options: InitOptions,
): InitResult {
	const dir = targetDir ?? cwd();
	const packageManager = detectPackageManager(dir);

	const created: string[] = [];
	const skipped: string[] = [];

	for (const template of TEMPLATES) {
		// Sanitize the template path
		const pathResult = sanitizePath(dir, template.path);
		if (!pathResult.ok) {
			return pathResult;
		}

		const targetPath = pathResult.value;
		const exists = existsSync(targetPath);

		// Skip existing files unless --force
		if (exists && !options.force) {
			skipped.push(template.path);
			continue;
		}

		// Dry-run: don't write, just track what would happen
		if (options.dryRun) {
			created.push(template.path); // Track as "would create"
			continue;
		}

		// Render and write
		const content = template.render(packageManager);
		const writeResult = atomicWrite(targetPath, content);
		if (!writeResult.ok) {
			return writeResult;
		}

		created.push(template.path);
	}

	return {
		ok: true,
		output: {
			packageManager,
			created,
			skipped,
		},
	};
}

/**
 * CLI entry point with output formatting and exit codes.
 */
export function runInitCLI(targetDir: string | undefined, options: InitOptions): number {
	const result = runInit(targetDir, options);

	if (result.ok) {
		const { packageManager, created, skipped } = result.output;

		console.info(`Installing harness (package manager: ${packageManager})\n`);

		// Show what happened
		for (const path of skipped) {
			console.info(`  skip ${path} (exists)`);
		}
		for (const path of created) {
			if (options.dryRun) {
				console.info(`  would create ${path}`);
			} else {
				console.info(`  + ${path}`);
			}
		}

		if (options.dryRun) {
			console.info("\nDry run complete. No files were modified.");
			console.info("  Run without --dry-run to apply changes.");
		} else {
			console.info(`\n✓ Harness installed!`);
			console.info(`  Created: ${created.length}, Skipped: ${skipped.length}`);
			if (created.length > 0) {
				console.info("\n  Tip: Review changes with 'git diff', undo with 'git checkout .'");
			}
		}

		return EXIT_CODES.SUCCESS;
	}

	// Error output
	console.error(`Error: ${result.error.message}`);
	if (result.error.path) {
		console.error(`  Path: ${result.error.path}`);
	}
	console.error("\n  Try: harness init --dry-run to preview changes");

	if (result.error.code === "PATH_TRAVERSAL") {
		return EXIT_CODES.PATH_TRAVERSAL;
	}
	if (result.error.code === "WRITE_ERROR") {
		return EXIT_CODES.WRITE_ERROR;
	}
	return EXIT_CODES.INVALID_PATH;
}

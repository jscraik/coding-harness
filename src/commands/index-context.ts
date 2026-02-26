/**
 * Index Context CLI command
 *
 * Bulk index brainstorms, plans, and solutions for semantic search.
 */

import { existsSync, readdirSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { validatePath } from "../lib/input/validator.js";
import {
	DEFAULT_DB_FILENAME,
	DEFAULT_HARNESS_DIR,
} from "../lib/context-compound/constants.js";
import {
	type IndexResult,
	brainstormIndexOptions,
	indexBatch,
	planIndexOptions,
} from "../lib/context-compound/indexer.js";
import { OllamaClient } from "../lib/context-compound/ollama.js";
import { VectorStore } from "../lib/context-compound/store.js";

// Exit codes for programmatic consumption
export const EXIT_CODES = {
	SUCCESS: 0,
	NO_FILES: 1,
	OLLAMA_UNAVAILABLE: 2,
	ERROR: 3,
	PARTIAL_SUCCESS: 4,
} as const;

export interface IndexContextOptions {
	/** Output as JSON */
	json?: boolean | undefined;
	/** Base directory */
	baseDir?: string | undefined;
	/** Harness directory name */
	harnessDir?: string | undefined;
	/** Force reindex even if unchanged */
	force?: boolean | undefined;
}

export interface IndexContextOutput {
	/** Whether the indexing succeeded */
	success: boolean;
	/** Number of files indexed */
	indexed: number;
	/** Number of files skipped (unchanged) */
	skipped: number;
	/** Number of errors */
	errors: number;
	/** Detailed results */
	results: IndexResult[];
	/** Error message if failed */
	error?: string;
}

function getValidatedHarnessDir(baseDir: string, candidatePath: string): string {
	const resolvedCandidate = resolve(baseDir, candidatePath);
	const relativeCandidate = relative(baseDir, resolvedCandidate);
	if (
		relativeCandidate === ".." ||
		relativeCandidate.startsWith(`..${sep}`) ||
		isAbsolute(relativeCandidate)
	) {
		throw new Error("path escapes base directory");
	}

	return validatePath(baseDir, candidatePath);
}

/**
 * Find all markdown files in a directory.
 */
function findMarkdownFiles(dir: string): string[] {
	if (!existsSync(dir)) return [];

	const files: string[] = [];
	const entries = readdirSync(dir, { withFileTypes: true });

	for (const entry of entries) {
		const fullPath = join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...findMarkdownFiles(fullPath));
		} else if (entry.isFile() && entry.name.endsWith(".md")) {
			files.push(fullPath);
		}
	}

	return files;
}

/**
 * Run bulk indexing.
 *
 * @param options - Index options
 * @returns Exit code
 */
export async function runIndexContext(
	options: IndexContextOptions,
): Promise<number> {
	const baseDir = options.baseDir ?? process.cwd();
	const harnessDir = options.harnessDir ?? DEFAULT_HARNESS_DIR;
	let validatedHarnessDir: string;
	try {
		validatedHarnessDir = getValidatedHarnessDir(baseDir, harnessDir);
	} catch {
		const error = "Invalid harness directory: path escapes base directory";
		if (options.json) {
			console.info(
				JSON.stringify({
					success: false,
					indexed: 0,
					skipped: 0,
					errors: 0,
					results: [],
					error,
				}),
			);
		} else {
			console.error(`✗ ${error}`);
		}
		return EXIT_CODES.ERROR;
	}
	const dbPath = join(validatedHarnessDir, DEFAULT_DB_FILENAME);

	// Collect files to index
	const brainstormsDir = join(baseDir, "docs/brainstorms");
	const plansDir = join(baseDir, "docs/plans");
	const solutionsDir = join(baseDir, "docs/solutions");

	const brainstormFiles = findMarkdownFiles(brainstormsDir);
	const planFiles = findMarkdownFiles(plansDir);
	const solutionFiles = findMarkdownFiles(solutionsDir);

	const allFiles = [
		...brainstormFiles.map((f) => ({
			...brainstormIndexOptions(f, baseDir),
			force: options.force,
		})),
		...planFiles.map((f) => ({
			...planIndexOptions(f, baseDir),
			force: options.force,
		})),
		...solutionFiles.map((f) => ({
			filepath: f,
			type: "solution" as const,
			basePath: baseDir,
			force: options.force,
		})),
	];

	if (allFiles.length === 0) {
		const error = "No files found to index";
		if (options.json) {
			console.info(
				JSON.stringify({
					success: false,
					indexed: 0,
					skipped: 0,
					errors: 0,
					results: [],
					error,
				}),
			);
		} else {
			console.error(`✗ ${error}`);
			console.error("   Expected files in:");
			console.error(`   - ${brainstormsDir}`);
			console.error(`   - ${plansDir}`);
			console.error(`   - ${solutionsDir}`);
		}
		return EXIT_CODES.NO_FILES;
	}

	// Initialize store
	const store = new VectorStore(dbPath);
	const initResult = store.init();

	if (!initResult.ok) {
		const error = `Failed to initialize store: ${initResult.error.message}`;
		if (options.json) {
			console.info(
				JSON.stringify({
					success: false,
					indexed: 0,
					skipped: 0,
					errors: 0,
					results: [],
					error,
				}),
			);
		} else {
			console.error(`✗ ${error}`);
		}
		return EXIT_CODES.ERROR;
	}

	// Check Ollama availability
	const ollama = new OllamaClient();
	const isAvailable = await ollama.isAvailable();

	if (!isAvailable) {
		const error = "Ollama not available. Please start Ollama or install it.";
		if (options.json) {
			console.info(
				JSON.stringify({
					success: false,
					indexed: 0,
					skipped: 0,
					errors: 0,
					results: [],
					error,
				}),
			);
		} else {
			console.error(`✗ ${error}`);
			console.error("   Install: https://ollama.com");
			console.error("   Start: ollama serve");
		}
		store.close();
		return EXIT_CODES.OLLAMA_UNAVAILABLE;
	}

	// Warmup Ollama for faster indexing
	if (!options.json) {
		console.info("Warming up embedding model...");
	}
	await ollama.warmup();

	// Index files
	if (!options.json) {
		console.info(`Indexing ${allFiles.length} files...`);
	}

	const results: IndexResult[] = [];
	let indexed = 0;
	let skipped = 0;
	let errors = 0;

	for (const [i, file] of allFiles.entries()) {
		if (!options.json) {
			process.stdout.write(
				`\r  ${i + 1}/${allFiles.length}: ${relative(baseDir, file.filepath)}`,
			);
		}

		const batchResults = await indexBatch([file], ollama, store, {
			concurrency: 1,
		});

		for (const result of batchResults) {
			results.push(result);
			if (result.indexed) {
				indexed++;
			} else if (result.error) {
				errors++;
			} else {
				skipped++;
			}
		}
	}

	if (!options.json) {
		process.stdout.write(`\r${" ".repeat(80)}\r`); // Clear line
	}

	store.close();

	// Output results
	const success = errors === 0;

	if (options.json) {
		const output: IndexContextOutput = {
			success,
			indexed,
			skipped,
			errors,
			results,
		};
		console.info(JSON.stringify(output, null, 2));
	} else {
		console.info("Indexing complete:");
		console.info(`  ✓ Indexed: ${indexed}`);
		console.info(`  ⏭ Skipped: ${skipped}`);
		if (errors > 0) {
			console.info(`  ✗ Errors: ${errors}`);
			for (const result of results) {
				if (result.error) {
					console.error(`    - ${result.path}: ${result.error.message}`);
				}
			}
		}
	}

	if (errors > 0) return EXIT_CODES.PARTIAL_SUCCESS;
	if (indexed === 0 && skipped > 0) return EXIT_CODES.SUCCESS; // All up to date
	return EXIT_CODES.SUCCESS;
}

/**
 * CLI entry point for index-context command
 */
export async function runIndexContextCLI(args: string[]): Promise<number> {
	// Parse arguments
	let json = false;
	let harnessDir: string | undefined;
	let force = false;

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];

		if (arg === "--json" || arg === "-j") {
			json = true;
		} else if (arg === "--harness-dir") {
			const harnessDirArg = args[i + 1];
			if (!harnessDirArg || harnessDirArg.startsWith("-")) {
				console.error("Error: --harness-dir requires a value");
				return EXIT_CODES.ERROR;
			}
			harnessDir = harnessDirArg;
			i++;
		} else if (arg === "--force" || arg === "-f") {
			force = true;
		} else if (arg === "--help" || arg === "-h") {
			console.info("Usage: harness index-context [options]");
			console.info("");
			console.info("Options:");
			console.info("  --json, -j        Output as JSON");
			console.info(
				"  --harness-dir     Directory for context database (default: .harness)",
			);
			console.info("  --force, -f       Force reindex even if unchanged");
			console.info("  --help, -h        Show this help");
			console.info("");
			console.info("Examples:");
			console.info("  harness index-context");
			console.info("  harness index-context --json");
			return EXIT_CODES.SUCCESS;
		}
	}

	return runIndexContext({ json, harnessDir, force });
}

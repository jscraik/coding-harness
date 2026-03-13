/**
 * Index Context CLI command
 *
 * Bulk index governed and supporting context surfaces for semantic search.
 */

import { existsSync, lstatSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import {
	DEFAULT_DB_FILENAME,
	DEFAULT_HARNESS_DIR,
} from "../lib/context-compound/constants.js";
import {
	type IndexResult,
	indexBatch,
} from "../lib/context-compound/indexer.js";
import { normalizeStoreInitError } from "../lib/context-compound/init-error.js";
import {
	discoverContextSources,
	writeLexicalIndex,
} from "../lib/context-compound/lexical-fallback.js";
import { OllamaClient } from "../lib/context-compound/ollama.js";
import {
	CP4B_ENABLED_ENV,
	isCp4bLexicalFallbackEnabled,
} from "../lib/context-compound/rollout.js";
import { VectorStore } from "../lib/context-compound/store.js";
import {
	CONTEXT_SOURCE_DEFINITIONS,
	discoverContextSourceDocuments,
	writeContextSourceInventory,
} from "../lib/context-integrity/sources.js";
import { validatePath } from "../lib/input/validator.js";
import { type CliResult, createError, err, ok } from "../lib/result/types.js";

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
	/** Explicitly enable CP4b lexical fallback when semantic backend is unavailable */
	lexicalFallback?: boolean | undefined;
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
	/** Indexing mode used for this run */
	mode?: "semantic" | "lexical_degraded";
	/** Lexical index artifact path when degraded mode is used */
	lexicalIndexPath?: string;
	/** Source inventory artifact path */
	inventoryPath?: string;
	/** Error message if failed */
	error?: string;
}

/**
 * Validate harness directory path for security (path traversal protection).
 */
function getValidatedHarnessDir(
	baseDir: string,
	candidatePath: string,
): CliResult<string> {
	const resolvedCandidate = resolve(baseDir, candidatePath);
	const relativeCandidate = relative(baseDir, resolvedCandidate);
	if (
		relativeCandidate === ".." ||
		relativeCandidate.startsWith(`..${sep}`) ||
		isAbsolute(relativeCandidate)
	) {
		return err(
			createError(
				"PATH_TRAVERSAL",
				"Invalid harness directory: path escapes base directory",
			),
		);
	}

	if (existsSync(resolvedCandidate)) {
		try {
			if (lstatSync(resolvedCandidate).isSymbolicLink()) {
				return err(
					createError(
						"PATH_TRAVERSAL",
						"Invalid harness directory: path escapes base directory",
					),
				);
			}
		} catch (error) {
			if (
				error instanceof Error &&
				error.message !== "path escapes base directory"
			) {
				return err(
					createError(
						"SYSTEM_ERROR",
						`Failed to validate harness directory: ${error.message}`,
						undefined,
						error,
					),
				);
			}
			return err(
				createError(
					"PATH_TRAVERSAL",
					"Invalid harness directory: path escapes base directory",
				),
			);
		}
	}

	try {
		return ok(validatePath(baseDir, candidatePath));
	} catch (error) {
		return err(
			createError(
				"VALIDATION_ERROR",
				error instanceof Error ? error.message : "Invalid harness directory",
				undefined,
				error instanceof Error ? error : undefined,
			),
		);
	}
}

/**
 * Run bulk indexing and return structured result.
 */
export async function runIndexContext(
	options: IndexContextOptions,
): Promise<CliResult<IndexContextOutput>> {
	const baseDir = options.baseDir ?? process.cwd();
	const harnessDir = options.harnessDir ?? DEFAULT_HARNESS_DIR;

	const validatedHarnessResult = getValidatedHarnessDir(baseDir, harnessDir);
	if (!validatedHarnessResult.ok) {
		return err(validatedHarnessResult.error);
	}

	const validatedHarnessDir = validatedHarnessResult.value;
	const dbPath = join(validatedHarnessDir, DEFAULT_DB_FILENAME);
	const lexicalFallbackEnabled = isCp4bLexicalFallbackEnabled(
		options.lexicalFallback,
	);

	const sourceDocuments = discoverContextSourceDocuments(baseDir);
	const allFiles = sourceDocuments.map((document) => ({
		filepath: document.filepath,
		type: document.type,
		basePath: baseDir,
		force: options.force,
		metadata: {
			authority: document.authority,
			family: document.family,
			stalenessState: document.stalenessState,
		},
	}));

	if (allFiles.length === 0) {
		return err(
			createError("NOT_FOUND", "No files found to index", {
				expectedDirs: CONTEXT_SOURCE_DEFINITIONS.map(({ path }) => path),
			}),
		);
	}

	if (lexicalFallbackEnabled) {
		const ollama = new OllamaClient();
		const isAvailable = await ollama.isAvailable();
		if (!isAvailable) {
			const lexicalIndex = writeLexicalIndex(baseDir, harnessDir);
			const inventory = writeContextSourceInventory(
				baseDir,
				sourceDocuments.map((document) => document.relativePath),
			);
			return ok({
				success: true,
				indexed: lexicalIndex.indexed,
				skipped: 0,
				errors: 0,
				results: discoverContextSources(baseDir).map(({ filepath }) => ({
					indexed: true,
					path: filepath,
				})),
				mode: "lexical_degraded",
				lexicalIndexPath: lexicalIndex.path,
				inventoryPath: inventory.path,
			});
		}
	}

	// Initialize store
	const store = new VectorStore(dbPath);
	const initResult = store.init();

	if (!initResult.ok) {
		const normalized = normalizeStoreInitError(initResult.error.message);
		return err(
			createError(
				"SYSTEM_ERROR",
				`Failed to initialize store: ${normalized.message}`,
			),
		);
	}

	// Check Ollama availability
	const ollama = new OllamaClient();
	const isAvailable = await ollama.isAvailable();

	if (!isAvailable) {
		store.close();
		return err(
			createError(
				"API_ERROR",
				"Ollama not available. Please start Ollama or install it.",
				{
					installUrl: "https://ollama.com",
					startCommand: "ollama serve",
				},
			),
		);
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

	const success = errors === 0;
	const indexedRelativePaths = results
		.filter((result) => result.indexed || !result.error)
		.map((result) => relative(baseDir, result.path).split("\\").join("/"));
	const inventory = writeContextSourceInventory(baseDir, indexedRelativePaths);

	return ok({
		success,
		indexed,
		skipped,
		errors,
		results,
		mode: "semantic",
		inventoryPath: inventory.path,
	});
}

/**
 * CLI entry point for index-context command.
 */

export async function runIndexContextCLI(args: string[]): Promise<number> {
	// Parse arguments
	let json = false;
	let harnessDir: string | undefined;
	let force = false;
	let lexicalFallback = false;

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];

		if (arg === "--json" || arg === "-j") {
			json = true;
		} else if (arg === "--lexical-fallback") {
			lexicalFallback = true;
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
			console.info(
				`  --lexical-fallback  Use CP4b lexical fallback when enabled or ${CP4B_ENABLED_ENV}=1`,
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

	const result = await runIndexContext({
		json,
		harnessDir,
		force,
		lexicalFallback,
	});

	if (!result.ok) {
		const { error } = result;
		if (json) {
			console.info(
				JSON.stringify({
					success: false,
					indexed: 0,
					skipped: 0,
					errors: 0,
					results: [],
					error: error.message,
				}),
			);
		} else {
			console.error(`✗ ${error.message}`);
			if (error.code === "NOT_FOUND") {
				console.error("   Expected files in:");
				for (const definition of CONTEXT_SOURCE_DEFINITIONS) {
					console.error(`   - ${definition.path}`);
				}
			} else if (error.code === "API_ERROR") {
				console.error("   Install: https://ollama.com");
				console.error("   Start: ollama serve");
			}
		}

		// Map error codes to exit codes
		switch (error.code) {
			case "PATH_TRAVERSAL":
			case "VALIDATION_ERROR":
				return EXIT_CODES.ERROR;
			case "NOT_FOUND":
				return EXIT_CODES.NO_FILES;
			case "API_ERROR":
				return EXIT_CODES.OLLAMA_UNAVAILABLE;
			default:
				return EXIT_CODES.ERROR;
		}
	}

	const { value: output } = result;

	if (json) {
		console.info(JSON.stringify(output, null, 2));
	} else {
		console.info("Indexing complete:");
		console.info(`  ✓ Indexed: ${output.indexed}`);
		console.info(`  ⏭ Skipped: ${output.skipped}`);
		if (output.mode === "lexical_degraded") {
			console.info("  Mode: lexical_degraded");
			if (output.lexicalIndexPath) {
				console.info(`  Lexical index: ${output.lexicalIndexPath}`);
			}
		}
		if (output.errors > 0) {
			console.info(`  ✗ Errors: ${output.errors}`);
			for (const item of output.results) {
				if (item.error) {
					console.error(`    - ${item.path}: ${item.error.message}`);
				}
			}
		}
	}

	if (output.errors > 0) return EXIT_CODES.PARTIAL_SUCCESS;
	if (output.indexed === 0 && output.skipped > 0) return EXIT_CODES.SUCCESS; // All up to date
	return EXIT_CODES.SUCCESS;
}

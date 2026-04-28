#!/usr/bin/env node
/**
 * Workflow Generate Command
 *
 * Generates compact operational specs from source markdown files with
 * workflow annotations. Supports S|E|G|A|P|R|N format with plugin capabilities.
 */

import { watch, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { PathTraversalError, validatePath } from "../lib/input/validator.js";
import {
	REQUIRED_ERROR_CODES,
	REQUIRED_LOG_FIELDS,
	type WorkflowGenerateOptions,
	parseSourceFile,
} from "./workflow-generate-parser.js";
import { generateSpecOutput } from "./workflow-generate-render.js";
export { generateMermaidDiagram } from "./workflow-generate-render.js";

export { parseSourceFile } from "./workflow-generate-parser.js";
export type {
	WorkflowGenerateOptions,
	WorkflowSpec,
} from "./workflow-generate-parser.js";

/**
 * Parse CLI args for the workflow generate command.
 */
export function parseWorkflowGenerateArgs(
	args: string[],
): WorkflowGenerateOptions {
	const sourceIndex = args.indexOf("--source");
	const outputIndex = args.indexOf("--output");
	const formatIndex = args.indexOf("--format");

	const formatCandidate = formatIndex >= 0 ? args[formatIndex + 1] : undefined;
	const format =
		formatCandidate === "segarn" || formatCandidate === "segaprn"
			? formatCandidate
			: undefined;

	return {
		source: sourceIndex >= 0 ? args[sourceIndex + 1] : undefined,
		output: outputIndex >= 0 ? args[outputIndex + 1] : undefined,
		format,
		json: args.includes("--json"),
		dryRun: args.includes("--dry-run"),
		watch: args.includes("--watch"),
	};
}

function generateWorkflowSpec(
	sourcePath: string,
	options: {
		json?: boolean | undefined;
		format?: "segarn" | "segaprn" | undefined;
		dryRun?: boolean | undefined;
		output?: string | undefined;
	},
): number {
	const spec = parseSourceFile(sourcePath);

	if (!spec) {
		return 1;
	}

	const errors: string[] = [];

	if (spec.transitions.length === 0) {
		errors.push("No transitions found in source file");
	}

	for (const code of REQUIRED_ERROR_CODES) {
		if (!spec.errors.some((e) => e.code === code)) {
			errors.push(`Missing required error code: ${code}`);
		}
	}

	for (const field of REQUIRED_LOG_FIELDS) {
		if (!spec.logs.fields.includes(field)) {
			errors.push(`Missing required log field: ${field}`);
		}
	}

	if (errors.length > 0) {
		console.error("Validation errors:");
		for (const error of errors) {
			console.error(`  - ${error}`);
		}
		return 1;
	}

	const outputContent = generateSpecOutput(
		spec,
		options.json ? "json" : (options.format ?? "segarn"),
	);

	if (options.dryRun) {
		console.info("Dry-run mode: generated spec (not written)");
		console.info("---");
		console.info(outputContent);
		return 0;
	}

	if (options.output) {
		let outputPath: string;
		try {
			outputPath = validatePath(process.cwd(), options.output);
		} catch (error) {
			if (error instanceof PathTraversalError) {
				console.error(
					`Output path escapes working directory: ${options.output}`,
				);
				return 1;
			}
			console.error(
				`Invalid output path: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
			return 1;
		}
		writeFileSync(outputPath, outputContent, "utf8");
		console.info(`Generated operational spec: ${outputPath}`);
	} else {
		console.info(outputContent);
	}

	return 0;
}

/**
 * Execute the workflow generate command with parsed options.
 */
export function runWorkflowGenerateCLI(
	options: WorkflowGenerateOptions = {},
): number {
	const {
		source,
		output,
		format = "segarn",
		json = false,
		dryRun = false,
		watch: watchMode = false,
	} = options;

	if (!source) {
		console.error("Error: --source is required");
		console.error(
			"Usage: harness workflow:generate --source <path> [--output <path>] [--format <segarn|segaprn>] [--json] [--dry-run] [--watch]",
		);
		return 1;
	}

	let sourcePath: string;
	try {
		sourcePath = validatePath(process.cwd(), source);
	} catch (error) {
		if (error instanceof PathTraversalError) {
			console.error(`Source path escapes working directory: ${source}`);
			return 1;
		}
		console.error(
			`Invalid source path: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
		return 1;
	}

	if (!watchMode) {
		return generateWorkflowSpec(sourcePath, {
			json,
			format,
			dryRun,
			output,
		});
	}

	if (!output) {
		console.error("Error: --output is required when using --watch");
		return 1;
	}

	console.info(`Watching: ${sourcePath}`);
	console.info(`Output: ${resolve(output)}`);
	console.info("Press Ctrl+C to stop\n");

	let lastResult = generateWorkflowSpec(sourcePath, {
		json,
		format,
		dryRun: false,
		output,
	});

	const watcher = watch(sourcePath, (eventType) => {
		if (eventType === "change") {
			console.info(
				`\n[${new Date().toISOString()}] File changed, regenerating...`,
			);
			lastResult = generateWorkflowSpec(sourcePath, {
				json,
				format,
				dryRun: false,
				output,
			});
			if (lastResult === 0) {
				console.info("✓ Regenerated successfully\n");
			} else {
				console.info("✗ Regeneration failed\n");
			}
		}
	});

	process.on("SIGINT", () => {
		console.info("\nStopping watcher...");
		watcher.close();
		process.exit(0);
	});

	process.on("SIGTERM", () => {
		watcher.close();
		process.exit(0);
	});

	return lastResult;
}

if (import.meta.url === `file://${process.argv[1]}`) {
	const options = parseWorkflowGenerateArgs(process.argv.slice(2));

	const exitCode = runWorkflowGenerateCLI(options);
	if (!options.watch) {
		process.exit(exitCode);
	}
}

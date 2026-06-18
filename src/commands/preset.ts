/**
 * Preset command - List and inspect bundled presets
 *
 * Provides commands for:
 * - `harness preset list`: List all available bundled presets
 * - `harness preset show <name>`: Display a specific preset's configuration
 */

import {
	getBundledPreset,
	listBundledPresets,
} from "../lib/contract/preset-resolver.js";
import type { HarnessContract } from "../lib/contract/types.js";
import { validateIdentifier } from "../lib/input/validation.js";

// Re-export ecosystem detection for auto-preset consumers
export {
	detectEcosystem,
	detectEcosystemDetailed,
	getDefaultPresetForEcosystem,
	getEcosystemDescription,
	ecosystemSupportsTypeCheck,
	getEcosystemCommands,
	type Ecosystem,
	type EcosystemMarker,
} from "../lib/preset-detection.js";

// Exit codes for programmatic consumption
export const EXIT_CODES = {
	SUCCESS: 0,
	PRESET_NOT_FOUND: 1,
	INVALID_ARGUMENT: 2,
} as const;

/** Supported output encodings for preset command results. */
export type OutputFormat = "json" | "yaml" | "table";

/** Options for listing bundled presets. */
export interface PresetListOptions {
	/** Preferred output encoding. Defaults to table output. */
	format?: OutputFormat;
}

/** Options for showing one bundled preset. */
export interface PresetShowOptions {
	/** Preferred output encoding. Defaults to pretty JSON output. */
	format?: OutputFormat;
}

/** Machine-readable result returned by preset list operations. */
export interface PresetListOutput {
	/** Bundled preset names available in the harness package. */
	presets: string[];
	/** Number of bundled presets returned. */
	count: number;
}

/** Machine-readable result returned by preset show operations. */
export interface PresetShowOutput {
	/** Requested bundled preset name. */
	name: string;
	/** Bundled preset contract, when found. */
	preset: HarnessContract | undefined;
}

/** Structured preset command error result. */
export interface PresetErrorOutput {
	/** Process exit code associated with the error. */
	code: number;
	/** Human-readable error message. */
	message: string;
}

/** Result envelope returned by preset command helpers. */
export type PresetResult =
	| { ok: true; value: PresetListOutput | PresetShowOutput }
	| { ok: false; error: PresetErrorOutput };

function toYaml(value: unknown, indent = 0): string {
	const spacing = "  ".repeat(indent);

	if (value === null) return "null";
	if (value === undefined) return "null";
	if (typeof value === "string") {
		return JSON.stringify(value);
	}
	if (typeof value === "number" || typeof value === "boolean") {
		return String(value);
	}
	if (Array.isArray(value)) {
		if (value.length === 0) return "[]";
		return value
			.map((item) => {
				if (item !== null && typeof item === "object" && !Array.isArray(item)) {
					const nested = toYaml(item, indent + 1);
					return `${spacing}-\n${nested}`;
				}
				return `${spacing}- ${toYaml(item, indent + 1)}`;
			})
			.join("\n");
	}

	const entries = Object.entries(value as Record<string, unknown>);
	if (entries.length === 0) return "{}";
	return entries
		.map(([key, nestedValue]) => {
			if (
				nestedValue !== null &&
				typeof nestedValue === "object" &&
				!Array.isArray(nestedValue)
			) {
				return `${spacing}${key}:\n${toYaml(nestedValue, indent + 1)}`;
			}
			if (Array.isArray(nestedValue)) {
				if (nestedValue.length === 0) {
					return `${spacing}${key}: []`;
				}
				const nested = nestedValue
					.map((item) => {
						if (
							item !== null &&
							typeof item === "object" &&
							!Array.isArray(item)
						) {
							return `${spacing}  -\n${toYaml(item, indent + 2)}`;
						}
						return `${spacing}  - ${toYaml(item, indent + 2)}`;
					})
					.join("\n");
				return `${spacing}${key}:\n${nested}`;
			}
			return `${spacing}${key}: ${toYaml(nestedValue, indent + 1)}`;
		})
		.join("\n");
}

/**
 * Get preset descriptions for human-friendly output
 */
function getPresetDescription(name: string): string {
	const descriptions: Record<string, string> = {
		"typescript-base": "Full governance for TypeScript/JavaScript projects",
		"python-base": "Full governance for Python projects",
		"rust-base": "Full governance for Rust projects",
		"go-base": "Full governance for Go projects",
		"swift-base": "Full governance for Swift projects",
		minimal: "Minimal governance - security scan only",
		strict: "High-security baseline with stricter checks",
	};
	return descriptions[name] ?? "Bundled preset";
}

/**
 * List all available bundled presets
 */
export function listPresets(options: PresetListOptions = {}): PresetResult {
	try {
		const presets = listBundledPresets();

		if (options.format === "json") {
			return {
				ok: true,
				value: {
					presets,
					count: presets.length,
				},
			};
		}
		if (options.format === "yaml") {
			const output = {
				presets,
				count: presets.length,
			};
			console.info(toYaml(output));
			return {
				ok: true,
				value: output,
			};
		}

		// Table format (default)
		console.info("Available presets:");
		console.info("");
		for (const preset of presets) {
			console.info(`  ${preset.padEnd(20)} ${getPresetDescription(preset)}`);
		}
		console.info("");
		console.info(
			`Use 'harness preset show <name>' to view a preset's configuration.`,
		);

		return {
			ok: true,
			value: {
				presets,
				count: presets.length,
			},
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		return {
			ok: false,
			error: {
				code: EXIT_CODES.INVALID_ARGUMENT,
				message,
			},
		};
	}
}

/**
 * Show a specific preset's configuration
 */
export function showPreset(
	name: string,
	options: PresetShowOptions = {},
): PresetResult {
	try {
		const preset = getBundledPreset(name);

		if (!preset) {
			const available = listBundledPresets();
			return {
				ok: false,
				error: {
					code: EXIT_CODES.PRESET_NOT_FOUND,
					message: `Preset '${name}' not found. Available: ${available.join(", ")}`,
				},
			};
		}

		if (options.format === "json") {
			return {
				ok: true,
				value: {
					name,
					preset,
				},
			};
		}
		if (options.format === "yaml") {
			const output = {
				name,
				preset,
			};
			console.info(toYaml(output));
			return {
				ok: true,
				value: output,
			};
		}

		// Pretty print (default)
		console.info(`Preset: ${name}`);
		console.info(`Description: ${getPresetDescription(name)}`);
		console.info("");
		console.info(JSON.stringify(preset, null, 2));

		return {
			ok: true,
			value: {
				name,
				preset,
			},
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		return {
			ok: false,
			error: {
				code: EXIT_CODES.INVALID_ARGUMENT,
				message,
			},
		};
	}
}

function outputFormat(args: readonly string[]): OutputFormat {
	if (args.includes("--json")) return "json";
	if (args.includes("--yaml")) return "yaml";
	return "table";
}

function exitCodeFor(result: PresetResult): number {
	return result.ok ? EXIT_CODES.SUCCESS : result.error.code;
}

function printJsonResult(result: PresetResult): void {
	if (result.ok) {
		console.info(JSON.stringify(result.value, null, 2));
	}
}

function runPresetListCLI(args: readonly string[]): { exitCode: number } {
	const format = outputFormat(args);
	const result = listPresets({ format });
	if (format === "json") {
		printJsonResult(result);
	}
	return { exitCode: exitCodeFor(result) };
}

function validatePresetCliName(
	rawName: string | undefined,
): string | undefined {
	if (!rawName) {
		console.error(
			"Error: Preset name required. Usage: harness preset show <name>",
		);
		return undefined;
	}
	const nameValidation = validateIdentifier(rawName, undefined, "preset name");
	if (!nameValidation.ok) {
		console.error(`Error: ${nameValidation.error.message}`);
		return undefined;
	}
	return nameValidation.value;
}

function runPresetShowCLI(args: readonly string[]): { exitCode: number } {
	const name = validatePresetCliName(args[0]);
	if (!name) return { exitCode: EXIT_CODES.INVALID_ARGUMENT };
	const format = outputFormat(args);
	const result = showPreset(name, { format });
	if (!result.ok) {
		console.error(`Error: ${result.error.message}`);
	} else if (format === "json") {
		printJsonResult(result);
	}
	return { exitCode: exitCodeFor(result) };
}

function printPresetUsage(): void {
	console.info("Usage: harness preset <command>");
	console.info("");
	console.info("Commands:");
	console.info("  list          List all available bundled presets");
	console.info("  show <name>   Display a specific preset's configuration");
	console.info("");
	console.info("Options:");
	console.info("  --json        Output in JSON format");
	console.info("  --yaml        Output in YAML format");
}

/**
 * Run the preset command CLI
 */
export async function runPresetCLI(
	args: string[],
): Promise<{ exitCode: number; output?: string }> {
	const [subcommand, ...rest] = args;

	switch (subcommand) {
		case "list": {
			return runPresetListCLI(rest);
		}

		case "show": {
			return runPresetShowCLI(rest);
		}

		default: {
			printPresetUsage();
			return { exitCode: EXIT_CODES.SUCCESS };
		}
	}
}

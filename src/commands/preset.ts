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
import { validateIdentifier } from "../lib/input/validation.js";

// Exit codes for programmatic consumption
export const EXIT_CODES = {
	SUCCESS: 0,
	PRESET_NOT_FOUND: 1,
	INVALID_ARGUMENT: 2,
} as const;

// Output formatting options
export type OutputFormat = "json" | "yaml" | "table";

export interface PresetListOptions {
	format?: OutputFormat;
}

export interface PresetShowOptions {
	format?: OutputFormat;
}

export interface PresetListOutput {
	presets: string[];
	count: number;
}

export interface PresetShowOutput {
	name: string;
	preset: Record<string, unknown> | undefined;
}

export interface PresetErrorOutput {
	code: number;
	message: string;
}

export type PresetResult =
	| { ok: true; value: PresetListOutput | PresetShowOutput }
	| { ok: false; error: PresetErrorOutput };

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
					preset: preset as unknown as Record<string, unknown>,
				},
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
				preset: preset as unknown as Record<string, unknown>,
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
 * Run the preset command CLI
 */
export async function runPresetCLI(
	args: string[],
): Promise<{ exitCode: number; output?: string }> {
	const [subcommand, ...rest] = args;

	switch (subcommand) {
		case "list": {
			const format = rest.includes("--json")
				? "json"
				: rest.includes("--yaml")
					? "yaml"
					: "table";
			const result = listPresets({ format });
			return {
				exitCode: result.ok ? EXIT_CODES.SUCCESS : result.error.code,
			};
		}

		case "show": {
			const rawName = rest[0];
			if (!rawName) {
				console.error(
					"Error: Preset name required. Usage: harness preset show <name>",
				);
				return { exitCode: EXIT_CODES.INVALID_ARGUMENT };
			}

			// Validate preset name (identifier only - no path traversal)
			const nameValidation = validateIdentifier(
				rawName,
				undefined,
				"preset name",
			);
			if (!nameValidation.ok) {
				console.error(`Error: ${nameValidation.error.message}`);
				return { exitCode: EXIT_CODES.INVALID_ARGUMENT };
			}
			const name = nameValidation.value;

			const format = rest.includes("--json")
				? "json"
				: rest.includes("--yaml")
					? "yaml"
					: "table";
			const result = showPreset(name, { format });
			if (!result.ok) {
				console.error(`Error: ${result.error.message}`);
			}
			return {
				exitCode: result.ok ? EXIT_CODES.SUCCESS : result.error.code,
			};
		}

		default: {
			console.info("Usage: harness preset <command>");
			console.info("");
			console.info("Commands:");
			console.info("  list          List all available bundled presets");
			console.info("  show <name>   Display a specific preset's configuration");
			console.info("");
			console.info("Options:");
			console.info("  --json        Output in JSON format");
			console.info("  --yaml        Output in YAML format");
			return { exitCode: EXIT_CODES.SUCCESS };
		}
	}
}

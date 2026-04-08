/**
 * JSC-69 / JSC-123: `harness contract` subcommands.
 *
 * Subcommands:
 * - `harness contract init [--preset minimal|standard|full] [--output path] [--force]`
 *   → Generates a harness.contract.json starter file for the given preset.
 *   → Defaults to `standard` preset and `./harness.contract.json`.
 *   → Errors if the output file already exists unless --force is passed.
 *
 * - `harness contract validate [contractPath]`
 *   → Validates the contract file against the schema and cross-field checks.
 *   → Exits non-zero with annotated error list if invalid.
 *   → Supports --json for machine-readable output.
 *
 * - `harness contract schema`
 *   → Prints the JSON Schema for harness.contract.json to stdout.
 *   → Redirect to a file for $schema-driven editor autocomplete.
 *
 * Usage:
 *   harness contract init
 *   harness contract init --preset minimal
 *   harness contract init --preset full --output ./config/harness.contract.json
 *   harness contract validate
 *   harness contract validate ./path/to/harness.contract.json
 *   harness contract validate --json
 *   harness contract schema
 *   harness contract schema > harness.contract.schema.json
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { cwd } from "node:process";
import {
	CONTRACT_PRESETS,
	type ContractPreset,
	PRESET_DESCRIPTIONS,
	buildContractPreset,
} from "../lib/contract/contract-presets.js";
import {
	SCHEMA_VERSION,
	buildContractJsonSchema,
} from "../lib/contract/json-schema.js";
import {
	type ValidationError,
	validateContract,
} from "../lib/contract/validator.js";
import { sanitizeError } from "../lib/input/sanitize.js";
import { normalizeRequiredChecksManifest } from "../lib/policy/required-checks.js";

/** Default contract filename relative to targetDir. */
const DEFAULT_CONTRACT_FILE = "harness.contract.json";

const DEFAULT_PRESET: ContractPreset = "standard";
const DEFAULT_REQUIRED_CHECKS_MANIFEST = ".harness/ci-required-checks.json";

export interface ContractValidateOptions {
	/** Output in JSON format (machine-readable). */
	json?: boolean | undefined;
	/** Override contract file path. */
	contractPath?: string | undefined;
}

export interface ContractNormalizeRequiredChecksOptions {
	manifestPath?: string | undefined;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatError(err: ValidationError, index: number): string {
	const lines = [`  ${index + 1}. Path: ${err.path}`, `     ${err.message}`];
	if (err.expected) lines.push(`     Expected: ${err.expected}`);
	if (err.received) lines.push(`     Got:      ${err.received}`);
	if (err.fix) lines.push(`     Fix:      ${err.fix}`);
	return lines.join("\n");
}

function severityIcon(code: string): string {
	if (code.includes("MISSING") || code.includes("FORBIDDEN")) return "✗";
	return "⚠️ ";
}

// ─── contract init ────────────────────────────────────────────────────────────

export interface ContractInitOptions {
	/** Complexity preset. Defaults to "standard". */
	preset?: ContractPreset | undefined;
	/** Output file path. Defaults to ./harness.contract.json. */
	output?: string | undefined;
	/** Overwrite an existing file without prompting. */
	force?: boolean | undefined;
	/** Output in JSON format (machine-readable). */
	json?: boolean | undefined;
}

/**
 * `harness contract init` entrypoint.
 *
 * Generates a starter harness.contract.json for the given preset tier.
 * Returns exit code 0 on success, 1 on error.
 */
export function runContractInitCLI(options: ContractInitOptions): number {
	const preset = options.preset ?? DEFAULT_PRESET;
	const outputPath = resolve(options.output ?? DEFAULT_CONTRACT_FILE);

	if (!CONTRACT_PRESETS.includes(preset)) {
		const msg = `Unknown preset: "${preset}". Valid presets: ${CONTRACT_PRESETS.join(", ")}`;
		if (options.json) {
			console.info(JSON.stringify({ status: "error", error: msg }));
		} else {
			console.error(`✗ ${msg}`);
		}
		return 2;
	}

	if (existsSync(outputPath) && !options.force) {
		const msg = `${outputPath} already exists. Use --force to overwrite.`;
		if (options.json) {
			console.info(JSON.stringify({ status: "error", error: msg, outputPath }));
		} else {
			console.error(
				[
					`✗ ${msg}`,
					"",
					"  To overwrite:",
					`    harness contract init --preset ${preset} --force`,
					"",
					"  To validate the existing contract:",
					"    harness contract validate",
				].join("\n"),
			);
		}
		return 1;
	}

	const contract = buildContractPreset(preset);
	const content = `${JSON.stringify(contract, null, 2)}\n`;

	try {
		writeFileSync(outputPath, content, "utf-8");
	} catch (err) {
		const msg = `Could not write contract file: ${sanitizeError(err)}`;
		if (options.json) {
			console.info(JSON.stringify({ status: "error", error: msg, outputPath }));
		} else {
			console.error(`✗ ${msg}`);
		}
		return 1;
	}

	if (options.json) {
		console.info(
			JSON.stringify({
				status: "created",
				preset,
				outputPath,
				sections: Object.keys(contract).length,
				bytes: content.length,
			}),
		);
	} else {
		console.info(
			[
				"",
				`✅ Created ${outputPath}`,
				`   Preset:   ${preset} — ${PRESET_DESCRIPTIONS[preset]}`,
				`   Sections: ${Object.keys(contract).length}`,
				`   Size:     ${content.length} bytes`,
				"",
				"Next steps:",
				"  1. Edit the riskTierRules paths to match your repo layout.",
				"  2. Add your CI checks to branchProtection.requiredChecks.",
				"  3. Run: harness contract validate",
				"",
				preset === "minimal"
					? "  Upgrade when ready: harness contract init --preset standard --force"
					: "",
			]
				.filter((l) => l !== "")
				.join("\n"),
		);
	}

	return 0;
}

// ─── contract validate ────────────────────────────────────────────────────────

/**
 * `harness contract validate` entrypoint.
 *
 * Returns exit code 0 (valid) or 1 (invalid / not found).
 */
export function runContractValidateCLI(
	targetDir: string | undefined,
	options: ContractValidateOptions,
): number {
	const dir = targetDir ?? cwd();
	const contractPath = options.contractPath
		? resolve(options.contractPath)
		: resolve(dir, DEFAULT_CONTRACT_FILE);

	if (!existsSync(contractPath)) {
		const msg = `Contract file not found: ${contractPath}`;
		if (options.json) {
			console.info(
				JSON.stringify({
					valid: false,
					contractPath,
					schemaVersion: SCHEMA_VERSION,
					errors: [{ path: "root", message: msg, code: "FILE_NOT_FOUND" }],
				}),
			);
		} else {
			console.error(`✗ ${msg}`);
			console.error(
				"\n  Run `harness init` to create a contract file, or specify a path:\n" +
					"    harness contract validate ./path/to/harness.contract.json",
			);
		}
		return 1;
	}

	let raw: unknown;
	try {
		raw = JSON.parse(readFileSync(contractPath, "utf-8"));
	} catch (err) {
		const msg = `Could not parse contract file: ${sanitizeError(err)}`;
		if (options.json) {
			console.info(
				JSON.stringify({
					valid: false,
					contractPath,
					schemaVersion: SCHEMA_VERSION,
					errors: [{ path: "root", message: msg, code: "PARSE_ERROR" }],
				}),
			);
		} else {
			console.error(`✗ ${msg}`);
		}
		return 1;
	}

	const result = validateContract(raw);

	if (options.json) {
		console.info(
			JSON.stringify(
				{
					valid: result.success,
					contractPath,
					schemaVersion: SCHEMA_VERSION,
					errors: result.success ? [] : result.errors,
				},
				null,
				2,
			),
		);
		return result.success ? 0 : 1;
	}

	// Human-readable output
	if (result.success) {
		console.info(
			[
				"",
				"✅ harness.contract.json is valid",
				`   Schema version: ${SCHEMA_VERSION}`,
				`   Contract path:  ${contractPath}`,
				"",
			].join("\n"),
		);
		return 0;
	}

	const errors = result.errors;
	console.error(
		[
			"",
			`✗ harness.contract.json has ${errors.length} validation error${errors.length === 1 ? "" : "s"}`,
			"",
			...errors.map((e, i) => `${severityIcon(e.code)}${formatError(e, i)}`),
			"",
			"Fix the errors above and re-run:",
			"  harness contract validate",
			"",
			"For machine-readable output:",
			"  harness contract validate --json",
			"",
		].join("\n"),
	);
	return 1;
}

// ─── contract schema ──────────────────────────────────────────────────────────

/**
 * `harness contract schema` entrypoint.
 *
 * Prints the JSON Schema for harness.contract.json to stdout.
 */
export function runContractSchemaCLI(): number {
	const schema = buildContractJsonSchema();
	console.info(JSON.stringify(schema, null, 2));
	return 0;
}

export function runContractNormalizeRequiredChecksCLI(
	targetDir: string | undefined,
	options: ContractNormalizeRequiredChecksOptions = {},
): number {
	const dir = targetDir ?? cwd();
	const manifestPath = options.manifestPath
		? resolve(options.manifestPath)
		: resolve(dir, DEFAULT_REQUIRED_CHECKS_MANIFEST);

	if (!existsSync(manifestPath)) {
		console.error(`Required checks manifest not found: ${manifestPath}`);
		return 1;
	}

	let rawManifest: unknown;
	try {
		rawManifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
	} catch (error) {
		console.error(
			`Failed to parse required checks manifest: ${sanitizeError(error)}`,
		);
		return 1;
	}

	const normalized = normalizeRequiredChecksManifest(rawManifest);
	if (!normalized.ok) {
		console.error(`Required checks manifest is invalid: ${normalized.error}`);
		return 1;
	}

	console.info(JSON.stringify(normalized.value));
	return 0;
}

// ─── Top-level dispatch ───────────────────────────────────────────────────────

export interface ContractCLIOptions extends ContractValidateOptions {
	subcommand: "init" | "validate" | "schema" | "normalize-required-checks";
}

/**
 * Main entry for `harness contract <subcommand>`.
 */
export function runContractCLI(
	subArgs: string[],
	options: { json?: boolean | undefined },
): number {
	// Subcommand is the first positional token (not a flag).
	const subcommand = subArgs.find((a) => !a.startsWith("-"));

	if (subcommand === "schema") {
		return runContractSchemaCLI();
	}

	if (subcommand === "normalize-required-checks") {
		const rest = subArgs.slice(1);
		const manifestIdx = rest.findIndex((a) => a === "--manifest" || a === "-m");
		const manifestPath = manifestIdx !== -1 ? rest[manifestIdx + 1] : undefined;
		return runContractNormalizeRequiredChecksCLI(undefined, { manifestPath });
	}

	if (subcommand === "init") {
		const rest = subArgs.slice(1);
		const presetIdx = rest.findIndex((a) => a === "--preset" || a === "-p");
		const preset =
			presetIdx !== -1
				? (rest[presetIdx + 1] as ContractPreset | undefined)
				: undefined;
		const outputIdx = rest.findIndex((a) => a === "--output" || a === "-o");
		const output = outputIdx !== -1 ? rest[outputIdx + 1] : undefined;
		const force = rest.includes("--force");
		return runContractInitCLI({ preset, output, force, json: options.json });
	}

	if (subcommand === "validate" || subcommand === undefined) {
		// Extract positional path: harness contract validate ./foo.json --json
		// Skip anything that starts with '-' so flags are never mistaken for paths.
		const positionalArgs = (
			subcommand === "validate" ? subArgs.slice(1) : subArgs
		).filter((a) => !a.startsWith("-"));
		const maybePath = positionalArgs[0];
		return runContractValidateCLI(undefined, {
			json: options.json,
			contractPath: maybePath,
		});
	}

	console.error(
		[
			`Unknown subcommand: harness contract ${subcommand}`,
			"",
			"Available subcommands:",
			"  harness contract init [--preset minimal|standard|full] [--output path] [--force]",
			"  harness contract validate [path] [--json]",
			"  harness contract schema",
			"  harness contract normalize-required-checks [--manifest path]",
		].join("\n"),
	);
	return 1;
}

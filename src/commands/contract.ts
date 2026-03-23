/**
 * JSC-69: `harness contract` subcommands.
 *
 * Subcommands:
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
 *   harness contract validate
 *   harness contract validate ./path/to/harness.contract.json
 *   harness contract validate --json
 *   harness contract schema
 *   harness contract schema > harness.contract.schema.json
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cwd } from "node:process";
import { sanitizeError } from "../lib/input/sanitize.js";
import { buildContractJsonSchema, SCHEMA_VERSION } from "../lib/contract/json-schema.js";
import { validateContract, type ValidationError } from "../lib/contract/validator.js";

/** Default contract filename relative to targetDir. */
const DEFAULT_CONTRACT_FILE = "harness.contract.json";

export interface ContractValidateOptions {
	/** Output in JSON format (machine-readable). */
	json?: boolean | undefined;
	/** Override contract file path. */
	contractPath?: string | undefined;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatError(err: ValidationError, index: number): string {
	const lines = [
		`  ${index + 1}. Path: ${err.path}`,
		`     ${err.message}`,
	];
	if (err.expected) lines.push(`     Expected: ${err.expected}`);
	if (err.received) lines.push(`     Got:      ${err.received}`);
	if (err.fix) lines.push(`     Fix:      ${err.fix}`);
	return lines.join("\n");
}

function severityIcon(code: string): string {
	if (code.includes("MISSING") || code.includes("FORBIDDEN")) return "✗";
	return "⚠️ ";
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
				`✅ harness.contract.json is valid`,
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

// ─── Top-level dispatch ───────────────────────────────────────────────────────

export interface ContractCLIOptions extends ContractValidateOptions {
	subcommand: "validate" | "schema";
}

/**
 * Main entry for `harness contract <subcommand>`.
 */
export function runContractCLI(
	subArgs: string[],
	options: { json?: boolean | undefined },
): number {
	const subcommand = subArgs[0];

	if (subcommand === "schema") {
		return runContractSchemaCLI();
	}

	if (subcommand === "validate" || subcommand === undefined) {
		// Support positional path: harness contract validate ./foo.json
		const maybePath = subcommand === "validate" ? subArgs[1] : undefined;
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
			"  harness contract validate [path] [--json]",
			"  harness contract schema",
		].join("\n"),
	);
	return 1;
}

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { mergeContracts } from "../contract/merger.js";
import { DEFAULT_CONTRACT, type HarnessContract } from "../contract/types.js";
import { atomicWrite } from "../init/migration.js";
import {
	formatMigrationChanges,
	migrateContractSchema,
} from "../init/schema-migrate.js";
import { sanitizeError } from "../input/sanitize.js";

/** Apply harness contract schema migrations during upgrade. */
export function applyContractMigration(
	targetDir: string,
	fromVersion: string,
	toVersion: string,
	dryRun: boolean,
): { ok: true; summary: string } | { ok: false; error: string } {
	const contractPath = resolve(targetDir, "harness.contract.json");
	if (!existsSync(contractPath)) {
		return { ok: true, summary: "" };
	}

	let contract: Record<string, unknown>;
	try {
		contract = JSON.parse(readFileSync(contractPath, "utf-8")) as Record<
			string,
			unknown
		>;
	} catch (err) {
		return {
			ok: false,
			error: `Could not parse harness.contract.json: ${sanitizeError(err)}`,
		};
	}

	const migrationResult = migrateContractSchema(contract, fromVersion);
	const summary = formatMigrationChanges(
		migrationResult.changes,
		fromVersion,
		toVersion,
	);

	if (migrationResult.changes.length > 0 && !dryRun) {
		const writeResult = atomicWrite(
			contractPath,
			JSON.stringify(migrationResult.contract, null, 2),
		);
		if (!writeResult.ok) {
			return {
				ok: false,
				error: `Failed to write migrated contract: ${writeResult.error.message}`,
			};
		}
	}

	return { ok: true, summary };
}

/** Backfill newly introduced default contract keys while preserving local values. */
export function backfillContractDefaults(
	targetDir: string,
	dryRun: boolean,
):
	| { ok: true; summary: string; changed: boolean }
	| { ok: false; error: string } {
	const contractPath = resolve(targetDir, "harness.contract.json");
	if (!existsSync(contractPath)) {
		return { ok: true, summary: "", changed: false };
	}

	let existingContract: Record<string, unknown>;
	try {
		existingContract = JSON.parse(
			readFileSync(contractPath, "utf-8"),
		) as Record<string, unknown>;
	} catch (err) {
		return {
			ok: false,
			error: `Could not parse harness.contract.json: ${sanitizeError(err)}`,
		};
	}

	const mergedContract = mergeContracts(
		DEFAULT_CONTRACT,
		existingContract as Partial<HarnessContract>,
	) as unknown as Record<string, unknown>;
	if (typeof existingContract.version === "string") {
		mergedContract.version = existingContract.version;
	}

	const changed =
		JSON.stringify(existingContract) !== JSON.stringify(mergedContract);
	if (!changed) {
		return { ok: true, summary: "", changed: false };
	}

	if (!dryRun) {
		const writeResult = atomicWrite(
			contractPath,
			`${JSON.stringify(mergedContract, null, 2)}\n`,
		);
		if (!writeResult.ok) {
			return {
				ok: false,
				error: `Failed to write healed contract defaults: ${writeResult.error.message}`,
			};
		}
	}

	return {
		ok: true,
		summary:
			"Contract defaults backfilled (including missing policy keys such as docsGatePolicy).",
		changed: true,
	};
}

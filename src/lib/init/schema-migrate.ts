/**
 * JSC-66: Contract schema migration transforms.
 *
 * Applies incremental, non-destructive field additions to harness.contract.json
 * when upgrading between harness versions. Each transform is idempotent and
 * preserves existing field values.
 *
 * Usage:
 *   const result = migrateContractSchema(contractObj, "0.7.4");
 *   // result.changes lists what was added
 *   // result.contract is the updated contract
 */

import semver from "semver";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ContractMigrationChange {
	/** Human-readable description of what was added or changed */
	description: string;
	/** Dotted field path that was added/changed */
	field: string;
	/** The default value applied */
	defaultValue: unknown;
}

export interface ContractMigrationResult {
	/** Updated contract object (same reference if no changes) */
	contract: Record<string, unknown>;
	/** List of changes applied */
	changes: ContractMigrationChange[];
}

// ─── Individual transforms ─────────────────────────────────────────────────────

type ContractTransform = {
	/** Minimum harness version that introduced this schema change */
	sinceVersion: string;
	/** Friendly description for changelog */
	description: string;
	/** Apply the transform; return true if a change was made */
	apply(contract: Record<string, unknown>): ContractMigrationChange | null;
};

/**
 * All known contract schema transforms, in ascending version order.
 * Each transform must be idempotent.
 */
const CONTRACT_TRANSFORMS: ContractTransform[] = [
	// v0.8.0: ciProviderPolicy.mode field (shadow → required promotion)
	{
		sinceVersion: "0.8.0",
		description: 'ciProviderPolicy.mode defaults to "shadow" for new installs',
		apply(contract) {
			const policy = getOrCreateObject(contract, "ciProviderPolicy");
			if (typeof policy.mode !== "string") {
				policy.mode = "shadow";
				return {
					description: 'Added ciProviderPolicy.mode = "shadow"',
					field: "ciProviderPolicy.mode",
					defaultValue: "shadow",
				};
			}
			return null;
		},
	},

	// v0.8.0: ciProviderPolicy.migrationStage
	{
		sinceVersion: "0.8.0",
		description: 'ciProviderPolicy.migrationStage defaults to "pre-migration"',
		apply(contract) {
			const policy = getOrCreateObject(contract, "ciProviderPolicy");
			if (typeof policy.migrationStage !== "string") {
				policy.migrationStage = "pre-migration";
				return {
					description:
						'Added ciProviderPolicy.migrationStage = "pre-migration"',
					field: "ciProviderPolicy.migrationStage",
					defaultValue: "pre-migration",
				};
			}
			return null;
		},
	},

	// v0.8.1: branchProtection.requiredChecks
	{
		sinceVersion: "0.8.1",
		description: "branchProtection.requiredChecks defaults to empty array",
		apply(contract) {
			const bp = getOrCreateObject(contract, "branchProtection");
			if (!Array.isArray(bp.requiredChecks)) {
				bp.requiredChecks = [];
				return {
					description: "Added branchProtection.requiredChecks = []",
					field: "branchProtection.requiredChecks",
					defaultValue: [],
				};
			}
			return null;
		},
	},

	// v0.8.2: ciProviderPolicy.commitMode for solo/enterprise classification
	{
		sinceVersion: "0.8.2",
		description: "ciProviderPolicy.commitMode documents solo vs enterprise",
		apply(contract) {
			const policy = getOrCreateObject(contract, "ciProviderPolicy");
			// Only add if enterprise fields are absent (solo repo detection)
			const hasTrustedRef =
				typeof policy.trustedPolicyRef === "string" &&
				policy.trustedPolicyRef.trim().length > 0;
			const hasAuthority =
				typeof policy.authorityConfigPath === "string" &&
				policy.authorityConfigPath.trim().length > 0;
			if (
				!hasTrustedRef &&
				!hasAuthority &&
				typeof policy.commitMode !== "string"
			) {
				policy.commitMode = "solo";
				return {
					description:
						'Added ciProviderPolicy.commitMode = "solo" (auto-detected from absent enterprise fields)',
					field: "ciProviderPolicy.commitMode",
					defaultValue: "solo",
				};
			}
			return null;
		},
	},
];

// ─── Helper ──────────────────────────────────────────────────────────────────

function getOrCreateObject(
	parent: Record<string, unknown>,
	key: string,
): Record<string, unknown> {
	if (
		typeof parent[key] !== "object" ||
		parent[key] === null ||
		Array.isArray(parent[key])
	) {
		parent[key] = {};
	}
	return parent[key] as Record<string, unknown>;
}

// ─── Main migration entry point ────────────────────────────────────────────────

/**
 * JSC-66: Apply all schema transforms that were introduced after `fromVersion`.
 *
 * Transforms are applied in ascending version order, skipping transforms
 * whose sinceVersion ≤ fromVersion (already applied at install time).
 *
 * @param contract  Parsed harness.contract.json object (mutated in-place)
 * @param fromVersion  The harness version at install time (e.g. "0.7.4")
 */
export function migrateContractSchema(
	contract: Record<string, unknown>,
	fromVersion: string,
): ContractMigrationResult {
	const validFrom = semver.valid(fromVersion) ? fromVersion : "0.0.0";
	const changes: ContractMigrationChange[] = [];

	for (const transform of CONTRACT_TRANSFORMS) {
		// Skip if this transform was already in place at the installed version
		if (semver.gte(validFrom, transform.sinceVersion)) {
			continue;
		}
		const change = transform.apply(contract);
		if (change !== null) {
			changes.push(change);
		}
	}

	return { contract, changes };
}

/**
 * Format upgrade migration changes for CLI output.
 */
export function formatMigrationChanges(
	changes: ContractMigrationChange[],
	fromVersion: string,
	toVersion: string,
): string {
	if (changes.length === 0) {
		return `✅ Contract schema: no migration needed (${fromVersion} → ${toVersion}).`;
	}

	const lines = [
		`📋 Contract schema migration: ${fromVersion} → ${toVersion}`,
		`   Applied ${changes.length} field addition(s):`,
		"",
	];
	for (const change of changes) {
		const valStr = JSON.stringify(change.defaultValue);
		lines.push(`   + ${change.field} = ${valStr}`);
		lines.push(`     ${change.description}`);
	}
	lines.push("");
	lines.push(
		"   Review harness.contract.json to verify these defaults are appropriate.",
	);
	lines.push("");

	return lines.join("\n");
}

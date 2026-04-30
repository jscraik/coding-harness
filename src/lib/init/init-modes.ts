import { collectProposedChanges } from "./interactive.js";
import { CONTRACT_FILE, executeMigration } from "./migration.js";
import { executeRollback, loadManifest } from "./rollback.js";
import {
	type CIProvider,
	type InitOptions,
	type InitResult,
	type InitUpdateDetail,
	MANIFEST_FILE,
	type RestoreManifest,
} from "./types.js";
import { checkForUpdates, executeUpdate } from "./update.js";

type SuccessfulInitOutput = Extract<InitResult, { ok: true }>["output"];
type UpdateOutputMetadata = Pick<
	SuccessfulInitOutput,
	"trackedManifest" | "updateMode"
>;

function updateReason(
	status: InitUpdateDetail["status"],
	reason: Exclude<InitUpdateDetail["reason"], "template-current-or-repo-owned">,
): InitUpdateDetail["reason"] {
	return status === "skipped" ? "template-current-or-repo-owned" : reason;
}

function updateDetailFor(
	path: string,
	status: InitUpdateDetail["status"],
): InitUpdateDetail {
	if (path === CONTRACT_FILE) {
		return {
			path,
			status,
			category: "contract",
			reason: updateReason(status, "contract-template-drift"),
		};
	}
	if (path === ".coderabbit.yaml") {
		return {
			path,
			status,
			category: "code-review",
			reason: updateReason(status, "code-review-policy-template-drift"),
		};
	}
	if (
		path.startsWith(".circleci/") ||
		path.startsWith(".github/workflows/") ||
		path === ".harness/ci-required-checks.json"
	) {
		return {
			path,
			status,
			category: "ci",
			reason: updateReason(status, "ci-policy-template-drift"),
		};
	}
	if (path.includes("semgrep") || path === ".gitleaks.toml") {
		return {
			path,
			status,
			category: "security",
			reason: updateReason(status, "security-template-drift"),
		};
	}
	if (
		path.startsWith(".harness/knowledge/") ||
		path.startsWith(".harness/memory/")
	) {
		return {
			path,
			status,
			category: "project-brain",
			reason: updateReason(status, "project-brain-template-drift"),
		};
	}
	if (
		path === "package.json" ||
		path === "Makefile" ||
		path === ".mise.toml" ||
		path === "prek.toml" ||
		path === "biome.json" ||
		path.startsWith("scripts/")
	) {
		return {
			path,
			status,
			category: "tooling",
			reason: updateReason(status, "tooling-template-drift"),
		};
	}
	if (
		path === ".github/PULL_REQUEST_TEMPLATE.md" ||
		path === "CONTRIBUTING.md"
	) {
		return {
			path,
			status,
			category: "workflow",
			reason: updateReason(status, "workflow-template-drift"),
		};
	}
	if (path.endsWith(".md") || path.startsWith("codestyle/")) {
		return {
			path,
			status,
			category: "docs",
			reason: updateReason(status, "docs-template-drift"),
		};
	}
	return {
		path,
		status,
		category: "other",
		reason:
			status === "skipped"
				? "template-current-or-repo-owned"
				: "tooling-template-drift",
	};
}

function buildUpdateOutput(
	packageManager: string,
	updateResult: Extract<ReturnType<typeof executeUpdate>, { ok: true }>,
	metadata: UpdateOutputMetadata,
): SuccessfulInitOutput {
	return {
		packageManager,
		...metadata,
		updated: updateResult.value.updated,
		updateDetails: [
			...updateResult.value.updated.map((path) =>
				updateDetailFor(path, "updated"),
			),
			...updateResult.value.skipped.map((path) =>
				updateDetailFor(path, "skipped"),
			),
		],
		// Compatibility: older JSON consumers read update-mode paths from
		// `created`. Keep it populated while exposing the accurate field.
		created: updateResult.value.updated,
		skipped: updateResult.value.skipped,
		...(updateResult.value.ownershipDecisions
			? { ownershipDecisions: updateResult.value.ownershipDecisions }
			: {}),
	};
}

/**
 * Execute rollback mode: restore files from manifest.
 */
export function handleRollback(
	dir: string,
	existingManifest: RestoreManifest | null,
	ciProvider: CIProvider,
	packageManager: string,
): InitResult {
	const manifestResult =
		existingManifest !== null
			? ({ ok: true, value: existingManifest } as const)
			: loadManifest(dir);
	if (!manifestResult.ok) {
		return manifestResult;
	}
	if (
		manifestResult.value.ciProvider &&
		manifestResult.value.ciProvider !== ciProvider
	) {
		return {
			ok: false,
			error: {
				code: "INVALID_PATH",
				message: `manifest provider "${manifestResult.value.ciProvider}" does not match current CI provider "${ciProvider}"`,
				path: MANIFEST_FILE,
			},
		};
	}

	const rollbackResult = executeRollback(dir, manifestResult.value);
	if (!rollbackResult.ok) {
		return rollbackResult;
	}

	return {
		ok: true,
		output: {
			packageManager,
			created: [], // Rollback doesn't create files
			skipped: rollbackResult.value.restored.concat(
				rollbackResult.value.deleted,
			),
		},
	};
}

/**
 * Execute check-updates mode: compare installed vs current template versions.
 */
export function handleCheckUpdates(
	dir: string,
	ciProvider: CIProvider,
	packageManager: string,
): InitResult {
	const checkResult = checkForUpdates(dir, ciProvider);
	if (!checkResult.ok) {
		return checkResult;
	}

	return {
		ok: true,
		output: {
			packageManager,
			created: [], // Check doesn't create files
			skipped: [], // Check doesn't skip files
			updateCheck: checkResult.value,
		},
	};
}

/**
 * Execute update mode: apply template updates from tracked manifest.
 */
export function handleUpdate(
	dir: string,
	existingManifest: RestoreManifest | null,
	ciProvider: CIProvider,
	packageManager: string,
	options: InitOptions,
): InitResult {
	const manifestResult =
		existingManifest !== null
			? ({ ok: true, value: existingManifest } as const)
			: loadManifest(dir, {
					requireMetadata: true,
					operation: "update",
					preferredCiProvider: ciProvider,
				});
	if (!manifestResult.ok) {
		if (
			options.dryRun &&
			manifestResult.error.path === MANIFEST_FILE &&
			manifestResult.error.message.includes("No restore manifest found")
		) {
			const updateResult = executeUpdate(
				dir,
				{ harnessVersion: "0.0.0", ciProvider, files: [] },
				ciProvider,
				{ dryRun: true },
			);
			if (!updateResult.ok) {
				return updateResult;
			}
			return {
				ok: true,
				output: buildUpdateOutput(packageManager, updateResult, {
					trackedManifest: false,
					updateMode: "adoption-preview",
				}),
			};
		}
		return manifestResult;
	}
	if (
		manifestResult.value.ciProvider &&
		manifestResult.value.ciProvider !== ciProvider
	) {
		return {
			ok: false,
			error: {
				code: "INVALID_PATH",
				message: `manifest provider "${manifestResult.value.ciProvider}" does not match current CI provider "${ciProvider}"`,
				path: MANIFEST_FILE,
			},
		};
	}

	const updateResult = executeUpdate(dir, manifestResult.value, ciProvider, {
		dryRun: options.dryRun,
	});
	if (!updateResult.ok) {
		return updateResult;
	}

	return {
		ok: true,
		output: buildUpdateOutput(packageManager, updateResult, {
			trackedManifest: true,
			updateMode: "tracked-update",
		}),
	};
}

/**
 * Execute migrate mode: apply schema migrations to contract.
 */
export function handleMigrate(dir: string, packageManager: string): InitResult {
	const migrationResult = executeMigration(dir);
	if (!migrationResult.ok) {
		return migrationResult;
	}

	return {
		ok: true,
		output: {
			packageManager,
			created:
				migrationResult.value.migrationsApplied.length > 0
					? [CONTRACT_FILE]
					: [],
			skipped: [],
		},
	};
}

/**
 * Execute interactive mode: collect proposed changes without writing.
 */
export function handleInteractive(
	dir: string,
	options: InitOptions,
	ciProvider: CIProvider,
	packageManager: string,
): InitResult {
	const proposedChanges = collectProposedChanges(dir, options, ciProvider);
	return {
		ok: true,
		output: {
			packageManager,
			created: [],
			skipped: [],
			proposedChanges,
		},
	};
}

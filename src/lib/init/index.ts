/**
 * Barrel file for init command modules.
 * Re-exports types and provides access to the runInit function.
 *
 * @module lib/init
 */

export {
	EXIT_CODES,
	BACKUPS_DIR,
	HARNESS_DIR,
	MANIFEST_FILE,
	MAX_INTERACTIVE_FILE_BYTES,
	type BackupResult,
	type ContractSchema,
	type InitErrorOutput,
	type InitOptions,
	type InitResult,
	type ManifestEntry,
	type ManifestResult,
	type Migration,
	type MigrationResult,
	type MigrationResultType,
	type PackageManager,
	type ProposedChange,
	type RestoreManifest,
	type RollbackResult,
	type Template,
	type TemplateRenderContext,
	type UpdateCheckResult,
	type UpdateResult,
	CURRENT_SCHEMA_VERSION,
	CODEX_ENVIRONMENT_TEMPLATE_PATH,
	type CodexActionIcon,
	type CodexAction,
	type PackageJsonLike,
	type HarnessContract,
} from "./types.js";

export { runInit } from "../../commands/init.js";

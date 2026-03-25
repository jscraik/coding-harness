/**
 * Shared types for the init command and its submodules.
 *
 * This module provides type-safe interfaces for:
 * - Init options and results
 * - Rollback/restore operations
 * - Update detection
 * - Interactive mode
 * - Schema migration
 *
 * @module lib/init/types
 */

import type { HarnessContract } from "../contract/types.js";
import type { DetectionResult, ProjectType } from "../project-type/types.js";

// === Exit Codes ===

/** Exit codes for programmatic consumption */
export const EXIT_CODES = {
	SUCCESS: 0,
	PATH_TRAVERSAL: 1,
	WRITE_ERROR: 2,
	INVALID_PATH: 3,
} as const;

// === Init Options ===

export interface InitOptions {
	dryRun: boolean;
	force: boolean;
	track?: boolean; // Create manifest + backups for rollback
	rollback?: boolean; // Restore from manifest
	checkUpdates?: boolean; // Check for template updates
	update?: boolean; // Apply template updates
	interactive?: boolean; // Interactive prompts for each change
	migrate?: boolean; // Migrate contract schema to latest version
	ciProvider?: string; // CI provider template set
	projectType?: ProjectType; // Explicit override from --project-type flag; undefined = auto-detect
	json?: boolean; // Emit structured JSON output instead of human-readable
}

export type CIProvider = "github-actions" | "circleci";

// === Rollback Types ===

/** Discriminated union for type-safe rollback handling */
export type ManifestEntry =
	| { path: string; action: "created" } // New file, no backup
	| { path: string; action: "modified"; backupHash: string }; // Existing file, backed up

/** Minimal manifest - no YAGNI metadata */
export interface RestoreManifest {
	harnessVersion?: string; // CLI version at install/update time
	ciProvider?: CIProvider; // CI provider used during tracked install/update
	files: ManifestEntry[];
}

/** Result types for rollback operations */
export type BackupResult =
	| { ok: true; value: string | null } // backupHash or null for new files
	| { ok: false; error: InitErrorOutput };

export type ManifestResult =
	| { ok: true; value: RestoreManifest }
	| { ok: false; error: InitErrorOutput };

export type RollbackResult =
	| { ok: true; value: { restored: string[]; deleted: string[] } }
	| { ok: false; error: InitErrorOutput };

// === Update Detection Types ===

export interface UpdateCheckInfo {
	currentVersion: string;
	installedVersion: string;
	updateAvailable: boolean;
}

export type UpdateCheckResult =
	| { ok: true; value: UpdateCheckInfo }
	| { ok: false; error: InitErrorOutput };

export type UpdateResult =
	| { ok: true; value: { updated: string[]; skipped: string[] } }
	| { ok: false; error: InitErrorOutput };

// === Interactive Mode Types ===

export interface ProposedChange {
	path: string;
	action: "create" | "modify" | "skip";
	currentContent: string | null; // null for new files
	newContent: string;
}

// === Schema Migration Types ===

/** Typed contract schema for version-aware handling */
export interface ContractSchema {
	version: string;
	projectType?: ProjectType;
	riskTierRules?: Record<string, unknown>;
	reviewPolicy?:
		| {
				timeoutSeconds: number;
				timeoutAction: "fail" | "warn";
				requiredChecks?: string[];
				enforceReviewerIndependence?: boolean;
		  }
		| undefined;
	branchProtection?: {
		requiredChecks?: string[];
		restrictDeletions?: boolean;
		blockForcePushes?: boolean;
		requireLinearHistory?: boolean;
		requirePullRequest?: boolean;
		requiredApprovingReviewCount?: number;
		dismissStaleReviewsOnPush?: boolean;
		requireConversationResolution?: boolean;
		requireCodeOwnerReview?: boolean;
		requireLastPushApproval?: boolean;
		requireBranchesUpToDate?: boolean;
		allowedMergeMethods?: {
			mergeCommit?: boolean;
			squash?: boolean;
			rebase?: boolean;
		};
		codeQuality?: {
			required?: boolean;
			severity?: unknown;
		};
		publicCodeScanning?: {
			required?: boolean;
			publicOnly?: boolean;
			tool?: unknown;
			alertsThreshold?: unknown;
			securityAlertsThreshold?: unknown;
		};
	};
	toolingPolicy?: {
		requiredDocumentationTerms?: string[];
		requiredBinaries?: string[];
		requiredMiseTools?: Array<{
			tool?: unknown;
			version?: unknown;
		}>;
		miseFilePath?: unknown;
		readinessScriptPath?: unknown;
		codexEnvironment?: {
			path?: unknown;
			requiredActions?: Array<{
				name?: unknown;
				icon?: unknown;
			}>;
		};
		makefile?: {
			path?: unknown;
			requiredTargets?: string[];
		};
		packagePolicy?: {
			packageJsonPath?: unknown;
			explicitCapabilities?: string[];
			capabilityDetectors?: Array<{
				capability?: unknown;
				dependencyMarkers?: string[];
			}>;
			requiredPackages?: Array<{
				package?: unknown;
				dependencyType?: unknown;
				requiredWhenCapabilities?: string[];
			}>;
		};
	};
	ciProviderPolicy?: {
		activeProvider?: unknown;
		mode?: unknown;
		authorityConfigPath?: unknown;
		requiredCheckManifestPath?: unknown;
		trustedPolicyRef?: unknown;
	};
	contextIntegrityPolicy?: unknown;
	issueTrackingPolicy?: unknown;
	evidencePolicy?: {
		requiredFor: unknown[];
		allowedTypes: unknown[];
		maxFileSizeBytes?: unknown;
	};
	mergePolicy?: unknown;
	docsDriftRules?: Record<string, unknown>;
	diffBudget?: {
		maxFiles?: unknown;
		maxNetLOC?: unknown;
		overrideLabel?: unknown;
	};
	runtimePolicy?: unknown;
	memoryPolicy?: unknown;
	memoryMaintenancePolicy?: unknown;
	memoryEvalPolicy?: unknown;
	observabilityPolicy?: unknown;
	packageManagerPolicy?: unknown;
	remediationPolicy?: unknown;
	gapCasePolicy?: unknown;
	uiLoopPolicy?: {
		fastCommand?: unknown;
		verifyCommand?: unknown;
		exploreCommand?: unknown;
		sloTargets?: {
			fastLoopSeconds?: unknown;
			verifyLoopSeconds?: unknown;
		};
	};
	[key: string]: unknown; // Allow additional user-defined fields
}

/** Migration function that transforms a contract from one version to the next */
export interface Migration {
	fromVersion: string;
	toVersion: string;
	description: string;
	migrate: (contract: ContractSchema) => ContractSchema;
}

/** Result of a migration operation */
export interface MigrationResult {
	originalVersion: string;
	finalVersion: string;
	migrationsApplied: string[]; // List of migration descriptions
	migratedContract: ContractSchema;
}

export type MigrationResultType =
	| { ok: true; value: MigrationResult }
	| { ok: false; error: InitErrorOutput };

/** Current latest schema version (must match template) */
export const CURRENT_SCHEMA_VERSION = "1.5.0";

// === Init Output Types ===

export interface InitOutput {
	packageManager: string;
	created: string[];
	skipped: string[];
	updateCheck?: UpdateCheckInfo; // Populated when --check-updates used
	proposedChanges?: ProposedChange[]; // Populated in interactive dry-run
	projectTypeDetection?: DetectionResult; // Populated on all normal init runs
}

export interface InitErrorOutput {
	code: string;
	message: string;
	path?: string;
}

export type InitResult =
	| { ok: true; output: InitOutput }
	| { ok: false; error: InitErrorOutput };

// === Template Types ===

export interface TemplateRenderContext {
	targetDir: string;
	ciProvider?: CIProvider;
	packageScripts: string[];
	issueTrackingUrl?: string;
	/** Project name extracted from package.json for WORKFLOW.md rendering */
	projectName?: string;
	/** Repository URL extracted from package.json for workspace hooks */
	repoUrl?: string;
	/** Linear project slug extracted from issue tracking URL */
	linearProjectSlug?: string;
	/** Detected or operator-specified project type, persisted to harness.contract.json */
	projectType?: ProjectType;
	/** Security contact email for GitHub issue template config; resolved from contract.owner.email,
	 * env var HARNESS_SECURITY_EMAIL, or falls back to 'security@example.com'. */
	securityEmail?: string;
}

export interface Template {
	path: string;
	render: (pm: string, context: TemplateRenderContext) => string;
}

export type PackageManager = "pnpm" | "yarn" | "npm";

// === Codex Environment Types ===

/** Path where codex-environment.toml is generated */
export const CODEX_ENVIRONMENT_TEMPLATE_PATH =
	".codex/environments/environment.toml";

/** Icon types for Codex actions */
export type CodexActionIcon = "tool" | "run" | "debug" | "test";

/** Codex action definition for environment.toml */
export interface CodexAction {
	name: string;
	icon: CodexActionIcon;
	command: string;
}

/** Minimal package.json shape for script/issue/repo extraction */
export interface PackageJsonLike {
	name?: string;
	scripts?: Record<string, unknown>;
	bugs?: string | { url?: unknown } | undefined;
	repository?:
		| string
		| { type?: string; url?: string; directory?: string }
		| undefined;
}

// === Rollback Constants ===

export const HARNESS_DIR = ".harness";
export const BACKUPS_DIR = "backups";
export const MANIFEST_FILE = "restore-manifest.json";

/** Max size for interactive content reads to prevent DoS via large/special files */
export const MAX_INTERACTIVE_FILE_BYTES = 1024 * 1024; // 1 MiB

// Re-export HarnessContract for convenience
export type { HarnessContract };

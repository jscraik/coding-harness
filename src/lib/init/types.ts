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

/** Flags and operator selections accepted by the init command. */
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
	explainOwnership?: boolean; // Show ownership decisions for schema-aware update paths
	minimal?: boolean; // Opt-out of strict enterprise governance layers
	issueTracker?: IssueTracker;
}

/** Supported CI template families for scaffolded governance files. */
export type CIProvider = "github-actions" | "circleci";
/** Supported issue tracker integrations for workflow scaffolding. */
export type IssueTracker = "linear" | "github" | "none";

// === Rollback Types ===

/** Discriminated union for type-safe rollback handling */
export type ManifestEntry =
	| { path: string; action: "created" } // New file, no backup
	| { path: string; action: "modified"; backupHash: string }; // Existing file, backed up

/** Minimal manifest - no YAGNI metadata */
export interface RestoreManifest {
	harnessVersion?: string; // CLI version at install/update time
	ciProvider?: CIProvider; // CI provider used during tracked install/update
	minimal?: boolean;
	issueTracker?: IssueTracker;
	files: ManifestEntry[];
}

/** Result types for rollback operations */
export type BackupResult =
	| { ok: true; value: string | null } // backupHash or null for new files
	| { ok: false; error: InitErrorOutput };

/** Result from reading or validating a restore manifest. */
export type ManifestResult =
	| { ok: true; value: RestoreManifest }
	| { ok: false; error: InitErrorOutput };

/** Result from restoring tracked scaffold files from a manifest. */
export type RollbackResult =
	| { ok: true; value: { restored: string[]; deleted: string[] } }
	| { ok: false; error: InitErrorOutput };

// === Update Detection Types ===

/** Version comparison details for init update checks. */
export interface UpdateCheckInfo {
	currentVersion: string;
	installedVersion: string;
	updateAvailable: boolean;
}

/** Schema-aware ownership action recorded while merging template updates. */
export interface OwnershipDecision {
	file: string;
	path: string;
	owner: "repo" | "template";
	action: "preserved" | "added" | "updated";
}

/** Structured reason for a template update preview or skip entry. */
export interface InitUpdateDetail {
	path: string;
	status: "updated" | "skipped";
	category:
		| "contract"
		| "ci"
		| "code-review"
		| "security"
		| "project-brain"
		| "tooling"
		| "workflow"
		| "docs"
		| "other";
	reason:
		| "contract-template-drift"
		| "ci-policy-template-drift"
		| "code-review-policy-template-drift"
		| "security-template-drift"
		| "project-brain-template-drift"
		| "tooling-template-drift"
		| "workflow-template-drift"
		| "docs-template-drift"
		| "template-current-or-repo-owned";
}

/** Result from checking whether the installed scaffold can be updated. */
export type UpdateCheckResult =
	| { ok: true; value: UpdateCheckInfo }
	| { ok: false; error: InitErrorOutput };

/** Result from applying scaffold template updates. */
export type UpdateResult =
	| {
			ok: true;
			value: {
				updated: string[];
				skipped: string[];
				ownershipDecisions?: OwnershipDecision[];
			};
	  }
	| { ok: false; error: InitErrorOutput };

// === Interactive Mode Types ===

/** Proposed file mutation shown during interactive or dry-run init flows. */
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

/** Result from migrating a harness contract schema. */
export type MigrationResultType =
	| { ok: true; value: MigrationResult }
	| { ok: false; error: InitErrorOutput };

/** Current latest schema version (must match template) */
export const CURRENT_SCHEMA_VERSION = "1.6.0";

// === Init Output Types ===

/** Machine-readable successful output emitted by init modes. */
export interface InitOutput {
	packageManager: string;
	created: string[];
	updated?: string[];
	skipped: string[];
	updateMode?: "tracked-update" | "adoption-preview";
	trackedManifest?: boolean;
	updateDetails?: InitUpdateDetail[];
	updateCheck?: UpdateCheckInfo; // Populated when --check-updates used
	proposedChanges?: ProposedChange[]; // Populated in interactive dry-run
	projectTypeDetection?: DetectionResult; // Populated on all normal init runs
	ownershipDecisions?: OwnershipDecision[]; // Populated for schema-aware update paths
}

/** Machine-readable error payload emitted by init modes. */
export interface InitErrorOutput {
	code: string;
	message: string;
	path?: string;
}

/** Top-level result envelope returned by init orchestration. */
export type InitResult =
	| { ok: true; output: InitOutput }
	| { ok: false; error: InitErrorOutput };

// === Template Types ===

/** Data passed to template renderers while scaffold files are generated. */
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
	/** Whether to emit a minimal contract and bypass strict governance/parity layers */
	minimal?: boolean;
	/** Specific issue tracker selection ('linear', 'github', 'none') */
	issueTracker?: IssueTracker;
}

/** Packaged scaffold template renderer and destination path. */
export interface Template {
	path: string;
	render: (pm: string, context: TemplateRenderContext) => string;
}

/** Package managers supported by init package-script rendering. */
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

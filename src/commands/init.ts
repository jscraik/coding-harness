import { createHash, randomUUID } from "node:crypto";
import {
	copyFileSync,
	existsSync,
	lstatSync,
	mkdirSync,
	readFileSync,
	renameSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { cwd } from "node:process";
import { diffLines } from "diff";
import semver from "semver";
import {
	DEFAULT_CONTRACT,
	type HarnessContract,
} from "../lib/contract/types.js";
import { sanitizeError } from "../lib/input/sanitize.js";
import {
	BRANCH_PROTECTION_REQUIRED_CHECKS,
	REVIEW_POLICY_REQUIRED_CHECKS,
} from "../lib/policy/required-checks.js";
import { getVersion } from "../lib/version.js";

// Exit codes for programmatic consumption
export const EXIT_CODES = {
	SUCCESS: 0,
	PATH_TRAVERSAL: 1,
	WRITE_ERROR: 2,
	INVALID_PATH: 3,
} as const;

export interface InitOptions {
	dryRun: boolean;
	force: boolean;
	track?: boolean; // Create manifest + backups for rollback
	rollback?: boolean; // Restore from manifest
	checkUpdates?: boolean; // Check for template updates
	update?: boolean; // Apply template updates
	interactive?: boolean; // Interactive prompts for each change
	migrate?: boolean; // Migrate contract schema to latest version
}

// === Rollback Types ===

// Discriminated union for type-safe rollback handling
export type ManifestEntry =
	| { path: string; action: "created" } // New file, no backup
	| { path: string; action: "modified"; backupHash: string }; // Existing file, backed up

// Minimal manifest - no YAGNI metadata
export interface RestoreManifest {
	harnessVersion?: string; // CLI version at install/update time
	files: ManifestEntry[];
}

// Result types for rollback operations
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
	};
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

// Current latest schema version (must match template)
export const CURRENT_SCHEMA_VERSION = "1.2.0";

function addSchemaDefaults(contract: ContractSchema): ContractSchema {
	return {
		...DEFAULT_CONTRACT,
		...contract,
		version: contract.version,
		riskTierRules: contract.riskTierRules ?? DEFAULT_CONTRACT.riskTierRules,
		reviewPolicy: contract.reviewPolicy ?? DEFAULT_CONTRACT.reviewPolicy,
		evidencePolicy: contract.evidencePolicy ?? DEFAULT_CONTRACT.evidencePolicy,
		mergePolicy: contract.mergePolicy ?? DEFAULT_CONTRACT.mergePolicy,
		docsDriftRules: contract.docsDriftRules ?? DEFAULT_CONTRACT.docsDriftRules,
		diffBudget: contract.diffBudget ?? DEFAULT_CONTRACT.diffBudget,
		uiLoopPolicy:
			(contract.uiLoopPolicy as HarnessContract["uiLoopPolicy"]) ??
			DEFAULT_CONTRACT.uiLoopPolicy,
		runtimePolicy:
			contract.runtimePolicy ??
			(DEFAULT_CONTRACT.runtimePolicy as HarnessContract["runtimePolicy"]),
		memoryPolicy:
			contract.memoryPolicy ??
			(DEFAULT_CONTRACT.memoryPolicy as HarnessContract["memoryPolicy"]),
		memoryMaintenancePolicy:
			contract.memoryMaintenancePolicy ??
			(DEFAULT_CONTRACT.memoryMaintenancePolicy as HarnessContract["memoryMaintenancePolicy"]),
		memoryEvalPolicy:
			contract.memoryEvalPolicy ??
			(DEFAULT_CONTRACT.memoryEvalPolicy as HarnessContract["memoryEvalPolicy"]),
		observabilityPolicy:
			contract.observabilityPolicy ??
			(DEFAULT_CONTRACT.observabilityPolicy as HarnessContract["observabilityPolicy"]),
		packageManagerPolicy:
			contract.packageManagerPolicy ??
			(DEFAULT_CONTRACT.packageManagerPolicy as HarnessContract["packageManagerPolicy"]),
		remediationPolicy:
			contract.remediationPolicy ??
			(DEFAULT_CONTRACT.remediationPolicy as HarnessContract["remediationPolicy"]),
		gapCasePolicy:
			contract.gapCasePolicy ??
			(DEFAULT_CONTRACT.gapCasePolicy as HarnessContract["gapCasePolicy"]),
		branchProtection:
			contract.branchProtection ??
			(DEFAULT_CONTRACT.branchProtection as HarnessContract["branchProtection"]),
	} as ContractSchema;
}

/**
 * Migration registry - ordered list of schema migrations.
 * Each migration transforms a contract from fromVersion to toVersion.
 * Migrations are applied sequentially to bring a contract up to date.
 */
/**
 * Migration registry - ordered list of schema migrations.
 * Each migration transforms a contract from fromVersion to toVersion.
 * Migrations are applied sequentially to bring a contract up to date.
 * Note: Version normalization via semver.coerce() converts "1.0" → "1.0.0"
 * before migration, so migrations should use semver-normalized versions.
 */
const MIGRATIONS: Migration[] = [
	{
		fromVersion: "1.0.0",
		toVersion: "1.1.0",
		description:
			"Normalize v1.0.0 schema to v1.1.0 and inject default policy surfaces",
		migrate: (contract) =>
			({
				...addSchemaDefaults(contract),
				version: "1.1.0",
			}) as ContractSchema,
	},
	{
		fromVersion: "1.1.0",
		toVersion: "1.2.0",
		description: "Inject remediation and gap-case policy defaults",
		migrate: (contract) =>
			({
				...addSchemaDefaults(contract),
				version: "1.2.0",
			}) as ContractSchema,
	},
];

export interface InitOutput {
	packageManager: string;
	created: string[];
	skipped: string[];
	updateCheck?: UpdateCheckInfo; // Populated when --check-updates used
	proposedChanges?: ProposedChange[]; // Populated in interactive dry-run
}

export interface InitErrorOutput {
	code: string;
	message: string;
	path?: string;
}

export type InitResult =
	| { ok: true; output: InitOutput }
	| { ok: false; error: InitErrorOutput };

// === Rollback Constants ===

const HARNESS_DIR = ".harness";
const BACKUPS_DIR = "backups";
const MANIFEST_FILE = "restore-manifest.json";
const CODEX_ENVIRONMENT_TEMPLATE_PATH = ".codex/environments/environment.toml";
const CODEX_ENVIRONMENT_AUTOGENERATED_HEADER =
	"# THIS IS AUTOGENERATED. DO NOT EDIT MANUALLY";

// === Templates (inline) ===

interface TemplateRenderContext {
	targetDir: string;
	packageScripts: string[];
}

interface Template {
	path: string;
	render: (pm: string, context: TemplateRenderContext) => string;
}

type PackageManager = "pnpm" | "yarn" | "npm";

function renderScriptCommand(packageManager: string, script: string): string {
	if (packageManager === "npm") {
		return `npm run ${script}`;
	}
	return `${packageManager} ${script}`;
}

function renderInstallCommand(packageManager: string): string {
	return `${packageManager} install`;
}

function renderMemoryValidateCommand(): string {
	return `test -f memory.json && jq -e '.meta.version == "1.0" and (.preamble.bootstrap | type == "boolean") and (.preamble.search | type == "boolean") and (.entries | type == "array")' memory.json >/dev/null`;
}

interface PackageJsonLike {
	scripts?: Record<string, unknown>;
}

type CodexActionIcon = "tool" | "run" | "debug" | "test";

interface CodexAction {
	name: string;
	icon: CodexActionIcon;
	command: string;
}

function readPackageScripts(targetDir: string): string[] {
	const packageJsonPath = resolve(targetDir, "package.json");
	if (!existsSync(packageJsonPath)) {
		return [];
	}

	try {
		const parsed = JSON.parse(
			readFileSync(packageJsonPath, "utf-8"),
		) as unknown;
		if (!parsed || typeof parsed !== "object") {
			return [];
		}
		const { scripts } = parsed as PackageJsonLike;
		if (!scripts || typeof scripts !== "object") {
			return [];
		}
		return Object.entries(scripts)
			.filter(
				([name, value]) =>
					typeof name === "string" && typeof value === "string",
			)
			.map(([name]) => name);
	} catch {
		return [];
	}
}

function createTemplateRenderContext(targetDir: string): TemplateRenderContext {
	return {
		targetDir,
		packageScripts: readPackageScripts(targetDir),
	};
}

function scriptContainsToken(scriptName: string, token: string): boolean {
	const lower = scriptName.toLowerCase();
	return (
		lower === token ||
		lower.startsWith(`${token}:`) ||
		lower.endsWith(`:${token}`) ||
		lower.includes(`:${token}:`)
	);
}

function inferScriptIcon(scriptName: string): CodexActionIcon {
	const testTokens = ["test", "spec", "e2e", "integration", "unit", "coverage"];
	if (testTokens.some((token) => scriptContainsToken(scriptName, token))) {
		return "test";
	}

	const runTokens = ["dev", "start", "serve", "preview", "watch"];
	if (runTokens.some((token) => scriptContainsToken(scriptName, token))) {
		return "run";
	}

	const debugTokens = [
		"debug",
		"check",
		"lint",
		"typecheck",
		"verify",
		"validate",
		"doctor",
		"preflight",
	];
	if (debugTokens.some((token) => scriptContainsToken(scriptName, token))) {
		return "debug";
	}

	return "tool";
}

function renderMissingScriptActionCommand(actionType: string): string {
	return `set -euo pipefail

echo "[codex] no ${actionType} script found in package.json"
exit 1`;
}

function renderScriptActionCommand(
	packageManager: string,
	script: string,
): string {
	return `set -euo pipefail

${renderScriptCommand(packageManager, script)}`;
}

function pickScriptForIcon(
	packageScripts: string[],
	icon: CodexActionIcon,
): string | null {
	return (
		packageScripts.find((script) => inferScriptIcon(script) === icon) ?? null
	);
}

function escapeTomlString(value: string): string {
	return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function renderCodexActionBlock(action: CodexAction): string {
	return `[[actions]]
name = "${escapeTomlString(action.name)}"
icon = "${action.icon}"
command = '''
${action.command}
'''`;
}

function isAutogeneratedCodexEnvironment(path: string): boolean {
	if (!existsSync(path)) {
		return false;
	}

	try {
		const firstLine = readFileSync(path, "utf-8").split("\n", 1)[0] ?? "";
		return firstLine.trim() === CODEX_ENVIRONMENT_AUTOGENERATED_HEADER;
	} catch {
		return false;
	}
}

function shouldAutoUpdateTemplate(
	templatePath: string,
	targetPath: string,
): boolean {
	if (templatePath !== CODEX_ENVIRONMENT_TEMPLATE_PATH) {
		return false;
	}
	return isAutogeneratedCodexEnvironment(targetPath);
}

function renderCodexEnvironmentTemplate(
	packageManager: string,
	context: TemplateRenderContext,
): string {
	const installCommand = renderInstallCommand(packageManager);
	const runScript = pickScriptForIcon(context.packageScripts, "run");
	const debugScript = pickScriptForIcon(context.packageScripts, "debug");
	const testScript = pickScriptForIcon(context.packageScripts, "test");

	const actions: CodexAction[] = [
		{
			name: "Tools",
			icon: "tool",
			command: `set -euo pipefail

${installCommand}`,
		},
		{
			name: "Run",
			icon: "run",
			command: runScript
				? renderScriptActionCommand(packageManager, runScript)
				: renderMissingScriptActionCommand("run"),
		},
		{
			name: "Debug",
			icon: "debug",
			command: debugScript
				? renderScriptActionCommand(packageManager, debugScript)
				: renderMissingScriptActionCommand("debug"),
		},
		{
			name: "Test",
			icon: "test",
			command: testScript
				? renderScriptActionCommand(packageManager, testScript)
				: renderMissingScriptActionCommand("test"),
		},
	];

	for (const script of context.packageScripts) {
		actions.push({
			name: `Script: ${script}`,
			icon: inferScriptIcon(script),
			command: renderScriptActionCommand(packageManager, script),
		});
	}

	const actionBlocks = actions
		.map((action) => renderCodexActionBlock(action))
		.join("\n\n");

	return `${CODEX_ENVIRONMENT_AUTOGENERATED_HEADER}
version = 1
name = "harness local environment"

[setup]
script = '''
set -euo pipefail

${installCommand}
'''

${actionBlocks}
`;
}

const TEMPLATES: Template[] = [
	{
		path: "harness.contract.json",
		render: (pm) =>
			JSON.stringify(
				{
					version: "1.2.0",
					riskTierRules: {
						"src/auth/**": "high",
						"src/api/**": "high",
						"src/lib/**": "medium",
						"**/*.test.ts": "low",
					},
					mergePolicy: {
						high: ["review-gate", "evidence-verify"],
						medium: ["review-gate"],
						low: [],
					},
					docsDriftRules: {},
					reviewPolicy: {
						timeoutSeconds: 600,
						timeoutAction: "fail" as const,
						requiredChecks: [...REVIEW_POLICY_REQUIRED_CHECKS],
						enforceReviewerIndependence: true,
					},
					branchProtection: {
						requiredChecks: [...BRANCH_PROTECTION_REQUIRED_CHECKS],
					},
					evidencePolicy: {
						requiredFor: [],
						allowedTypes: ["png", "jpeg"],
						maxFileSizeBytes: 1048576,
					},
					diffBudget: {
						maxFiles: 10,
						maxNetLOC: 400,
						overrideLabel: "diff-budget-override",
					},
					uiLoopPolicy: {
						fastCommand: renderScriptCommand(pm, "ui:fast"),
						verifyCommand: renderScriptCommand(pm, "ui:verify"),
						exploreCommand: renderScriptCommand(pm, "ui:explore"),
						sloTargets: {
							fastLoopSeconds: 30,
							verifyLoopSeconds: 120,
						},
					},
					runtimePolicy: {
						nodeVersion: "20.x",
						createIssueOnAgentFindings: true,
					},
					memoryPolicy: {
						enabled: true,
						provider: "local",
						sessionIdTemplate: "repo:<name>:task:<id>",
						domain: "default",
						requiredTags: ["repo", "area", "type"],
						maxObservationsPerStep: 3,
						allowedLevels: ["observation", "learning", "pattern"],
						requireStartRead: true,
						requireCloseoutSummary: true,
						forbiddenContentPatterns: [
							"token",
							"api[_-]?key",
							"secret",
							"password",
							"credential",
						],
					},
					memoryMaintenancePolicy: {
						validateSchedule: "weekly",
						reflectSchedule: "weekly",
						questionSlaDays: 7,
						duplicateThreshold: 0.8,
					},
					memoryEvalPolicy: {
						trialsPerTask: 3,
						requiredMetrics: ["pass^k", "tool_errors", "duplicate_rate"],
						passPowKThreshold: 0.8,
					},
					observabilityPolicy: {
						provider: "logs",
						collectorEndpoint: "http://localhost:4318",
					},
					packageManagerPolicy: {
						allowedManagers: ["pnpm", "npm", "yarn"],
						requiredManager: null,
					},
					remediationPolicy: {
						providerDefaults: {
							greptile: {
								autoApplyMaxTier: "medium",
								dryRunOnlyByDefault: false,
							},
							codex: {
								autoApplyMaxTier: "medium",
								dryRunOnlyByDefault: false,
							},
						},
						marker: "[auto-remediate]",
						timeoutMinutes: 10,
						retryLimit: 3,
						requireEvidence: true,
					},
					loopStageContracts: {
						"risk-policy-gate": {
							inputs: ["changed_files", "harness.contract.json"],
							outputs: ["risk-policy-gate.result"],
							schema: "loop-stage-contract/v1",
							failPolicy: "fail_closed" as const,
							if: "always()",
							permissions: ["contents:read", "pull-requests:read"],
							timeoutMinutes: 15,
							concurrency: "none",
						},
						"review-gate": {
							inputs: [
								"risk-policy-gate.result",
								"head_sha",
								"harness.contract.json",
							],
							outputs: ["review-gate.result"],
							schema: "loop-stage-contract/v1",
							failPolicy: "fail_closed" as const,
							if: "always()",
							permissions: ["contents:read", "pull-requests:read"],
							timeoutMinutes: 15,
							concurrency: "none",
						},
						"evidence-verify": {
							inputs: [
								"review-gate.result",
								"evidence_files",
								"harness.contract.json",
							],
							outputs: ["evidence-verify.result", "browser-evidence-artifacts"],
							schema: "loop-stage-contract/v1",
							failPolicy: "fail_closed" as const,
							if: "always()",
							permissions: ["contents:read"],
							timeoutMinutes: 15,
							concurrency: "none",
						},
						"remediation-decision": {
							inputs: [
								"evidence-verify.result",
								"findings.json",
								"harness.contract.json",
							],
							outputs: [
								"remediation-decision.result",
								"remediation-decision-artifacts",
							],
							schema: "loop-stage-contract/v1",
							failPolicy: "fail_closed" as const,
							if: "always()",
							permissions: ["contents:read", "pull-requests:write"],
							timeoutMinutes: 15,
							concurrency: "none",
						},
					},
					pilotGapCasePolicy: {
						enabled: false,
						defaultSlaHours: 72,
						requireClosureEvidence: true,
						storePath: ".harness/gap-cases.v1.json",
					},
					pilotRollbackPolicy: {
						autoTrigger: true,
						requireManualRelease: true,
						completionMarkerPath: ".harness/rollback-marker.json",
						mode: "manual" as const,
					},
					pilotAuthzPolicy: {
						githubScopeAllowlist: [
							"pull_requests:write",
							"contents:read",
							"issues:write",
						],
						repoAllowlist: [],
						branchAllowlist: [],
						protectedBranchDenylist: ["main", "master", "release/*"],
						enforceBranchProtection: true,
					},
				},
				null,
				2,
			),
	},
	{
		path: "memory.json",
		render: () =>
			JSON.stringify(
				{
					repo: "replace-with-repo-name",
					session_id: "bootstrap/init",
					preamble: {
						bootstrap: true,
						search: true,
					},
					entries: [
						{
							level: "observation",
							content:
								"Harness memory baseline initialized. Replace with task-specific observations.",
							tags: ["repo:unknown", "area:bootstrap", "type:setup"],
							session_id: "bootstrap/init",
							source: "harness init",
							observed_at: "2026-01-01T00:00:00.000Z",
						},
					],
					closeout: {
						forjamie_updated: false,
						date: "2026-01-01T00:00:00.000Z",
					},
					meta: {
						created_at: "2026-01-01T00:00:00.000Z",
						version: "1.0",
					},
				},
				null,
				2,
			),
	},
	{
		path: ".github/workflows/pr-pipeline.yml",
		render: (pm) => {
			const installCommand = renderInstallCommand(pm);
			const lintCommand = renderScriptCommand(pm, "lint");
			const typecheckCommand = renderScriptCommand(pm, "typecheck");
			const testCommand = renderScriptCommand(pm, "test");
			const auditCommand = renderScriptCommand(pm, "audit");
			const checkCommand = renderScriptCommand(pm, "check");
			const memoryValidateCommand = renderMemoryValidateCommand();
			return `name: Harness PR Pipeline

on:
  pull_request:
  merge_group:

permissions:
  contents: read
  pull-requests: read

jobs:
  pr-template:
    name: pr-template
    runs-on: ubuntu-latest
    steps:
      - name: Validate PR template completion
        if: github.event_name == 'pull_request'
        uses: actions/github-script@f28e40c7f34bde8b3046d885e986cb6290c5673b # v7
        with:
          script: |
            const body = context.payload.pull_request?.body ?? '';
            const errors = [];

            if (body.trim().length === 0) {
              errors.push('PR body is empty. Fill out the full PR template.');
            }

            const requiredSections = [
              '## Summary',
              '## Checklist',
              '## Testing',
              '## Review artifacts',
              '## Notes',
            ];
            for (const section of requiredSections) {
              if (!body.includes(section)) {
                errors.push('Missing required section: ' + section);
              }
            }

            const checklistMatch = body.match(/## Checklist([\\s\\S]*?)(?:\\n## |\\n# |$)/i);
            if (!checklistMatch) {
              errors.push('Missing checklist block.');
            } else {
              const checklistBody = checklistMatch[1] ?? '';
              const checklistItems = checklistBody
                .split('\\n')
                .map((line) => line.trim())
                .filter((line) => /^- \\[[ xX]\\]/.test(line));

              if (checklistItems.length === 0) {
                errors.push('Checklist has no checkbox items.');
              }

              const unchecked = checklistItems.filter((line) => /^- \\[ \\]/.test(line));
              if (unchecked.length > 0) {
                errors.push(
                  'Checklist has unchecked item(s):\\n' + unchecked.join('\\n'),
                );
              }
            }

            const placeholders = [
              'pass/fail',
              '<link / artifact path / comment ID>',
              '<0-5>',
              '<reviewer + link>',
              'Add one-paragraph merge rationale here.',
            ];
            for (const placeholder of placeholders) {
              if (body.includes(placeholder)) {
                errors.push('Replace template placeholder: ' + placeholder);
              }
            }

            const reviewArtifactsMatch = body.match(/## Review artifacts([\\s\\S]*?)(?:\\n## |\\n# |$)/i);
            if (reviewArtifactsMatch) {
              const reviewArtifactsBody = reviewArtifactsMatch[1] ?? '';
              const unresolvedTokens = reviewArtifactsBody.match(/<[^>\\n]+>/g) ?? [];
              for (const token of unresolvedTokens) {
                errors.push('Replace unresolved placeholder token: ' + token);
              }
            }

            if (errors.length > 0) {
              core.setFailed(errors.join('\\n'));
            }
      - name: Skip PR template enforcement for merge queue
        if: github.event_name == 'merge_group'
        run: echo "merge_group event detected; PR template enforcement is pull_request-only."

  risk-policy-gate:
    name: risk-policy-gate
    runs-on: ubuntu-latest
    needs: [pr-template]
    if: ${"${{ always() && (github.event_name == 'merge_group' || needs.pr-template.result == 'success') }}"}
    steps:
      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4
        with:
          node-version: "24"
      - name: Enable corepack
        run: corepack enable
      - name: Install dependencies
        run: ${installCommand}
      - name: Run fast preflight policy gate
        run: |
          if [[ "${"${{ github.event_name }}"}" == "pull_request" ]]; then
            BASE_SHA="${"${{ github.event.pull_request.base.sha }}"}"
            HEAD_SHA="${"${{ github.event.pull_request.head.sha }}"}"
          else
            BASE_SHA="${"${{ github.event.merge_group.base_sha }}"}"
            HEAD_SHA="${"${{ github.event.merge_group.head_sha }}"}"
          fi
          CHANGED_FILES="$(git diff --name-only "$BASE_SHA" "$HEAD_SHA" | paste -sd, -)"
          if [[ -z "$CHANGED_FILES" ]]; then
            CHANGED_FILES="$(git ls-files | paste -sd, -)"
          fi
          pnpm exec tsx src/cli.ts preflight-gate \\
            --contract harness.contract.json \\
            --max-tier medium \\
            --files "${"${CHANGED_FILES}"}" \\
            --json

  dependency-review:
    name: dependency-review
    runs-on: ubuntu-latest
    needs: [risk-policy-gate]
    permissions:
      contents: read
      pull-requests: read
    steps:
      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4
      - name: Detect dependency review support
        id: dependency-review-support
        if: github.event_name == 'pull_request'
        uses: actions/github-script@f28e40c7f34bde8b3046d885e986cb6290c5673b # v7
        with:
          script: |
            const { owner, repo } = context.repo;
            const response = await github.rest.repos.get({ owner, repo });
            const security = response.data.security_and_analysis ?? {};
            const advanced = security.advanced_security?.status === 'enabled';
            const dependencyGraph = security.dependency_graph?.status === 'enabled';
            core.setOutput('supported', advanced && dependencyGraph ? 'true' : 'false');
      - name: Run dependency review (pull_request)
        if: github.event_name == 'pull_request' && ${"${{ steps.dependency-review-support.outputs.supported == 'true' }}"}
        uses: actions/dependency-review-action@2031cfc080254a8a887f58cffee85186f0e49e48 # v4.9.0
        with:
          fail-on-severity: high
      - name: Skip dependency review when repository support is unavailable
        if: github.event_name == 'pull_request' && ${"${{ steps.dependency-review-support.outputs.supported != 'true' }}"}
        run: echo "Dependency review unsupported (requires dependency graph + advanced security); skipping."
      - name: Skip dependency review for merge queue
        if: github.event_name == 'merge_group'
        run: echo "Dependency review enforced on pull_request; merge_group runs are no-op."

  actions-pinning:
    name: actions-pinning
    runs-on: ubuntu-latest
    needs: [risk-policy-gate]
    steps:
      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4
      - name: Enforce pinned GitHub Actions
        shell: bash
        run: |
          set -euo pipefail
          violations=0
          while IFS=: read -r file line raw; do
            ref="$(printf "%s" "$raw" | sed -E 's/^[[:space:]]*(-[[:space:]]*)?uses:[[:space:]]*([^[:space:]#]+).*/\\2/')"
            if [[ "$ref" == ./* ]] || [[ "$ref" == docker://* ]]; then
              continue
            fi
            if [[ ! "$ref" =~ @[0-9a-f]{40}$ ]]; then
              echo "::error file=$file,line=$line::Action is not pinned to a full commit SHA: $ref"
              violations=1
            fi
          done < <(rg -n "^[[:space:]]*(-[[:space:]]*)?uses:[[:space:]]*[^[:space:]]+" .github/workflows/*.yml)
          exit "$violations"

  consistency-drift-advisory:
    name: consistency-drift-advisory
    runs-on: ubuntu-latest
    needs: [risk-policy-gate]
    permissions:
      contents: read
      pull-requests: read
      actions: write
    steps:
      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4
        with:
          node-version: "24"
      - name: Enable corepack
        run: corepack enable
      - name: Install dependencies
        run: ${installCommand}
      - name: Prepare baseline seed fallback
        run: |
          mkdir -p artifacts/consistency-gate
          if [[ ! -f artifacts/consistency-gate/consistency-baseline-latest.json ]]; then
            cat > artifacts/consistency-gate/consistency-baseline-latest.json <<'JSON'
          {
            "schemaVersion": "1.0.0",
            "findings": []
          }
          JSON
          fi
      - name: Run advisory drift gate
        run: |
          pnpm exec tsx src/cli.ts drift-gate \\
            --mode advisory \\
            --json \\
            --out artifacts/consistency-gate/consistency-drift-advisory-latest.json
      - name: Advisory guard (soft-fail)
        run: |
          if [[ ! -s artifacts/consistency-gate/consistency-drift-advisory-latest.json ]]; then
            echo "::warning::advisory report missing; writing fallback stub."
            cat > artifacts/consistency-gate/consistency-drift-advisory-latest.json <<'JSON'
          {
            "schemaVersion": "1.0.0",
            "command": "drift-gate",
            "mode": "advisory",
            "status": "blocked",
            "outcome": "error",
            "error_class": "io",
            "generated_at": "1970-01-01T00:00:00.000Z",
            "repo_root": ".",
            "baseline": { "path": "artifacts/consistency-gate/consistency-baseline-latest.json", "loaded": false, "reason": "missing_report_output" },
            "summary": { "finding_count": 1, "new_count": 1, "preexisting_count": 0, "error_count": 1 },
            "findings": [
              {
                "rule_id": "report.output.missing",
                "surface": "status",
                "rule_result": "error",
                "severity": "error",
                "baseline_state": "new",
                "message": "Advisory report missing; generated fallback stub."
              }
            ]
          }
          JSON
          fi
      - name: Upload advisory artifact
        if: always()
        uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4
        with:
          name: consistency-drift-advisory-latest
          path: artifacts/consistency-gate/consistency-drift-advisory-latest.json

  consistency-drift-health:
    name: consistency-drift-health
    runs-on: ubuntu-latest
    needs: [risk-policy-gate]
    permissions:
      contents: read
      pull-requests: read
      actions: write
    steps:
      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4
        with:
          node-version: "24"
      - name: Enable corepack
        run: corepack enable
      - name: Install dependencies
        run: ${installCommand}
      - name: Detect baseline seed
        id: baseline-seed
        run: |
          mkdir -p artifacts/consistency-gate
          if [[ -f artifacts/consistency-gate/consistency-baseline-latest.json ]]; then
            echo "seeded=true" >> "$GITHUB_OUTPUT"
          else
            echo "seeded=false" >> "$GITHUB_OUTPUT"
          fi
      - name: Run health drift gate
        if: steps.baseline-seed.outputs.seeded == 'true'
        run: |
          pnpm exec tsx src/cli.ts drift-gate \\
            --mode health \\
            --json \\
            --out artifacts/consistency-gate/health.json
      - name: Bootstrap health warning (first-run)
        if: steps.baseline-seed.outputs.seeded != 'true'
        run: |
          cat > artifacts/consistency-gate/health.json <<'JSON'
          {
            "schemaVersion": "1.0.0",
            "command": "drift-gate",
            "mode": "health",
            "status": "partial",
            "outcome": "ok",
            "error_class": "none",
            "generated_at": "1970-01-01T00:00:00.000Z",
            "repo_root": ".",
            "baseline": { "path": "artifacts/consistency-gate/consistency-baseline-latest.json", "loaded": false, "reason": "bootstrap_seed_missing" },
            "summary": { "finding_count": 1, "new_count": 1, "preexisting_count": 0, "error_count": 0 },
            "findings": [
              {
                "rule_id": "baseline.seed.bootstrap",
                "surface": "status",
                "rule_result": "not_applicable",
                "severity": "info",
                "baseline_state": "new",
                "message": "Health check running in bootstrap mode until baseline seed is published on default branch."
              }
            ]
          }
          JSON
          echo "::warning::consistency-drift-health running in bootstrap mode (baseline seed missing)."
      - name: Upload health artifact
        if: always()
        uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4
        with:
          name: consistency-drift-health-latest
          path: artifacts/consistency-gate/health.json

  lint:
    name: lint
    runs-on: ubuntu-latest
    needs: [risk-policy-gate]
    steps:
      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4
        with:
          node-version: "24"
      - name: Enable corepack
        run: corepack enable
      - name: Install dependencies
        run: ${installCommand}
      - name: Run lint
        run: ${lintCommand}

  typecheck:
    name: typecheck
    runs-on: ubuntu-latest
    needs: [risk-policy-gate]
    steps:
      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4
        with:
          node-version: "24"
      - name: Enable corepack
        run: corepack enable
      - name: Install dependencies
        run: ${installCommand}
      - name: Run typecheck
        run: ${typecheckCommand}

  test:
    name: test
    runs-on: ubuntu-latest
    needs: [risk-policy-gate]
    steps:
      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4
        with:
          node-version: "24"
      - name: Enable corepack
        run: corepack enable
      - name: Install dependencies
        run: ${installCommand}
      - name: Run tests
        run: ${testCommand}

  audit:
    name: audit
    runs-on: ubuntu-latest
    needs: [risk-policy-gate]
    steps:
      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4
        with:
          node-version: "24"
      - name: Enable corepack
        run: corepack enable
      - name: Install dependencies
        run: ${installCommand}
      - name: Run audit
        run: ${auditCommand}

  check:
    name: check
    runs-on: ubuntu-latest
    needs: [risk-policy-gate]
    steps:
      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4
        with:
          node-version: "24"
      - name: Enable corepack
        run: corepack enable
      - name: Install dependencies
        run: ${installCommand}
      - name: Run full check
        run: ${checkCommand}

  memory:
    name: memory
    runs-on: ubuntu-latest
    needs: [risk-policy-gate]
    steps:
      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4
      - name: Validate memory.json
        run: ${memoryValidateCommand}
`;
		},
	},
	{
		path: ".github/workflows/secret-scan.yml",
		render: () => `name: security-scan

on:
  push:
    branches: ["main"]
  pull_request:
  merge_group:

permissions:
  contents: read

jobs:
  secret-scan:
    name: security-scan
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4
        with:
          fetch-depth: 0

      - name: Gitleaks Scan
        uses: gitleaks/gitleaks-action@ff98106e4c7b2bc287b24eaf42907196329070c7 # v2
        env:
          GITHUB_TOKEN: ${"${{ secrets.GITHUB_TOKEN }}"}

      - name: Trivy Scan
        uses: aquasecurity/trivy-action@97e0b3872f55f89b95b2f65b3dbab56962816478 # 0.34.2
        with:
          scan-type: fs
          scan-ref: .
          scanners: vuln
          ignore-unfixed: true
          severity: HIGH,CRITICAL
          exit-code: 1

      - name: Semgrep Scan
        run: |
          set -euo pipefail
          python3 -m venv "${"${RUNNER_TEMP}"}/semgrep-venv"
          "${"${RUNNER_TEMP}"}/semgrep-venv/bin/python" -m pip install --quiet --upgrade pip semgrep
          "${"${RUNNER_TEMP}"}/semgrep-venv/bin/semgrep" scan \\
            --config p/security-audit \\
            --error \\
            --severity ERROR \\
            --exclude node_modules \\
            --exclude dist \\
            .
`,
	},
	{
		path: "CONTRIBUTING.md",
		render: (pm) => {
			const lintCommand = renderScriptCommand(pm, "lint");
			const typecheckCommand = renderScriptCommand(pm, "typecheck");
			const testCommand = renderScriptCommand(pm, "test");
			const auditCommand = renderScriptCommand(pm, "audit");
			const checkCommand = renderScriptCommand(pm, "check");
			const memoryValidateCommand = renderMemoryValidateCommand();
			return `# Contributing

## Table of Contents

- [Minimum workflow contract](#minimum-workflow-contract)
- [Why this workflow exists](#why-this-workflow-exists)
- [Branching and PR rule](#branching-and-pr-rule)
- [Branch name policy](#branch-name-policy)
- [Required pre-merge gates](#required-pre-merge-gates)
- [Greptile setup baseline](#greptile-setup-baseline)
- [Greptile config hierarchy](#greptile-config-hierarchy)
- [Greptile merge logic for multi-scope pull requests](#greptile-merge-logic-for-multi-scope-pull-requests)
- [Greptile confidence score policy](#greptile-confidence-score-policy)
- [Greptile strictness policy](#greptile-strictness-policy)
- [Greptile training and feedback loop](#greptile-training-and-feedback-loop)
- [Recommended security scanner baseline](#recommended-security-scanner-baseline)
- [Review artifacts requirement](#review-artifacts-requirement)
- [Credential-safe evidence snippets](#credential-safe-evidence-snippets)
- [Branch protection recommendation](#branch-protection-recommendation)

## Minimum workflow contract

- Branch off \`main\` for every change.
- No direct push to \`main\`.
- Pull request required for every merge.
- Required checks must pass before merge.
- Greptile + Codex review artifacts are required before merge.
- Greptile must be configured correctly using the \`grepfile\` skill with all required Greptile files present.
- The coding agent must not approve its own PR; review must be independent.
- Merge only after all gates pass.
- Delete branch/worktree after merge.

## Why this workflow exists

This workflow keeps delivery auditable, reversible, and consistent even for solo development.

## Branching and PR rule

1. Create a dedicated branch/worktree for each task:
   - Agent-created branch: \`git switch -c codex/<short-description>\`
   - Agent-created worktree: \`git worktree add ../tmp-worktree -b codex/<short-description>\`
   - Human-authored branch prefixes (when not using \`codex/\`): \`feat/\`, \`fix/\`, \`docs/\`, \`refactor/\`, \`chore/\`, \`test/\`
2. Keep commits small and focused.
3. Open a PR to merge into \`main\`.
4. Do not merge until checks, reviews, and checklist items are complete.
5. After merge, delete the remote branch and remove local worktree/branch.

## Branch name policy

- Use lower-case, kebab-case slugs.
- Agent-created branches must use \`codex/<short-description>\`.
- Human-authored branches may use: \`feat/\`, \`fix/\`, \`docs/\`, \`refactor/\`, \`chore/\`, \`test/\`.
- Avoid \`main\`-like names and do not include secrets or issue-pii.

## Required pre-merge gates

- ${lintCommand}
- ${typecheckCommand}
- ${testCommand}
- ${auditCommand}
- ${checkCommand}
- ${memoryValidateCommand}

## Recommended security scanner baseline

For repositories that use Harness, recommend installing these scanners as project prerequisites:

- Gitleaks
- Trivy
- Semgrep

Recommended policy:

- Keep scanner binaries available in local development environments and CI runners.
- Run scanner checks in CI on pull requests and pushes to protected branches.
- Treat scanner findings as merge blockers unless explicitly waived with rationale.

## Review artifacts requirement

Each PR must include:

- Greptile review artifact (URL, report, or comment reference).
- Codex review artifact (URL, report, or comment reference).
- Greptile confidence score for the PR.
- Confirmation that reviewer agent is independent from coding agent.

If either artifact is missing, block merge until it is added or explicitly waived by repository policy.

## Credential-safe evidence snippets

- Never use command substitution in commit messages, PR bodies, or evidence notes for secrets.
- Do **not** use \`$(gh auth token)\` (or similar) inside \`git commit -m ...\` / \`gh pr create --body ...\`.
- Use placeholders in text output:
  - ✅ \`$GITHUB_TOKEN\`
  - ✅ \`\${GITHUB_TOKEN}\`
  - ❌ expanded token values
- If a token value is ever exposed in commit/PR text, treat it as compromised: rotate/revoke, rewrite history where applicable, and document remediation in the issue/PR.

## Branch protection recommendation

Configure GitHub branch protection (or rulesets) on \`main\`:

- Bootstrap baseline via harness:
  - \`harness branch-protect --owner <owner> --repo <repo>\`
- Token resolution for \`branch-protect\`:
  - \`--token <PAT>\` or env \`GITHUB_TOKEN\` / \`GITHUB_PERSONAL_ACCESS_TOKEN\`
- Require pull request before merge.
- Require at least one approval.
- Require status checks: \`pr-template\`, \`risk-policy-gate\`, \`dependency-review\`, \`actions-pinning\`, \`consistency-drift-health\`, \`lint\`, \`typecheck\`, \`test\`, \`audit\`, \`check\`, \`memory\`, \`security-scan\`.
- Require workflows to pin third-party actions to full commit SHAs.
- Configure required checks workflows to run on both \`pull_request\` and \`merge_group\` when using merge queue.
- Block direct pushes to \`main\`.
`;
		},
	},
	{
		path: ".github/PULL_REQUEST_TEMPLATE.md",
		render: (pm) => {
			const lintCommand = renderScriptCommand(pm, "lint");
			const typecheckCommand = renderScriptCommand(pm, "typecheck");
			const testCommand = renderScriptCommand(pm, "test");
			const auditCommand = renderScriptCommand(pm, "audit");
			const checkCommand = renderScriptCommand(pm, "check");
			const memoryValidateCommand = renderMemoryValidateCommand();
			return `# Pull request checklist

## Summary

- What changed (brief):
- Why this change was needed:
- Risk and rollback plan:

## Checklist

- [ ] I did not push directly to \`main\`; this PR is from a dedicated branch.
- [ ] Branch name follows policy (\`codex/*\` for agent-created branches).
- [ ] Required local gates run: \`${lintCommand}\`, \`${typecheckCommand}\`, \`${testCommand}\`, \`${auditCommand}\`, \`${checkCommand}\`, \`${memoryValidateCommand}\`.
- [ ] Greptile review completed and findings handled (or explicitly waived).
- [ ] Codex review completed and findings handled (or explicitly waived).
- [ ] Greptile review was performed by an independent reviewer (not the coding agent).
- [ ] Greptile confidence score is \`>= 4/5\` for merge eligibility.
- [ ] Merge is blocked until all required checks pass.
- [ ] I will delete branch/worktree after merge.

## Testing

- Command: \`${lintCommand}\` -> pass/fail
- Command: \`${typecheckCommand}\` -> pass/fail
- Command: \`${testCommand}\` -> pass/fail
- Command: \`${auditCommand}\` -> pass/fail
- Command: \`${checkCommand}\` -> pass/fail
- Command: \`${memoryValidateCommand}\` -> pass/fail
- Any other command(s):

## Review artifacts

- Greptile: <link / artifact path / comment ID>
- Greptile confidence score: <0-5>
- Independent reviewer evidence: <reviewer + link>
- Codex: <link / artifact path / comment ID>
- Additional evidence (if any):

## Notes

Add one-paragraph merge rationale here.
`;
		},
	},
	{
		path: "scripts/validate-commit-msg.js",
		render: () => `#!/usr/bin/env node
/**
 * Commit message validation hook
 *
 * Validates commit messages follow governance requirements:
 * - Conventional commit format (feat|fix|chore|docs|refactor|test|style)
 * - Subject line <= 72 chars
 * - Blank line between subject and body/trailers
 * - Co-authored-by trailer on agent branches
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const COMMIT_MSG_FILE = process.argv[2];
const CONVENTIONAL_COMMIT_REGEX =
	/^(feat|fix|chore|docs|refactor|test|style|perf|ci|build|revert)(\\(.+\\))?!?:\\s.+/;
const CO_AUTHOR_LINE_REGEX = /^Co-authored-by:\\s*.+$/gim;
const CODEX_CO_AUTHOR_REGEX =
	/^Co-authored-by:\\s*Codex <noreply@openai\\.com>\\s*$/im;

function main() {
	if (!COMMIT_MSG_FILE) {
		console.error("Usage: validate-commit-msg.js <commit-msg-file>");
		process.exit(1);
	}

	let commitMsg;
	try {
		commitMsg = readFileSync(COMMIT_MSG_FILE, "utf-8");
	} catch (e) {
		console.error(\`Failed to read commit message file: \${e.message}\`);
		process.exit(1);
	}

	const errors = [];
	const lines = commitMsg
		.split(/\\r?\\n/)
		.filter((line) => !line.startsWith("#"));
	const firstLineIndex = lines.findIndex((line) => line.trim().length > 0);
	const firstLine = firstLineIndex >= 0 ? lines[firstLineIndex].trim() : "";

	// Check 1: Subject exists and follows conventional commit format
	if (!firstLine) {
		errors.push("Commit message subject is required");
	} else if (!CONVENTIONAL_COMMIT_REGEX.test(firstLine)) {
		errors.push(
			"Subject must follow conventional commit format: type(scope)!: description",
		);
	}

	// Check 2: Subject length
	if (firstLine && firstLine.length > 72) {
		errors.push(\`Subject exceeds 72 characters (\${firstLine.length} chars)\`);
	}

	// Check 3: Body/trailers must be separated by a blank line
	const hasAdditionalContent = lines
		.slice(Math.max(firstLineIndex + 1, 0))
		.some((line) => line.trim().length > 0);
	if (hasAdditionalContent && lines[firstLineIndex + 1]?.trim() !== "") {
		errors.push(
			"Add a blank line between the subject and the rest of the commit message",
		);
	}

	// Check 4: Co-authorship for agent branches (enforced)
	const coAuthorLines = commitMsg.match(CO_AUTHOR_LINE_REGEX) ?? [];
	const branchName = getBranchName();
	const isAgentBranch = /codex|claude|agent/i.test(branchName);

	if (isAgentBranch && coAuthorLines.length !== 1) {
		errors.push(
			"Agent branches require exactly one Co-authored-by trailer for auditability",
		);
	}
	if (isAgentBranch && !CODEX_CO_AUTHOR_REGEX.test(commitMsg)) {
		errors.push(
			"Agent branches must include: Co-authored-by: Codex <noreply@openai.com>",
		);
	}

	// Output results
	if (errors.length > 0) {
		console.error("\\n❌ Commit message validation failed:\\n");
		for (const error of errors) {
			console.error(\`  ✗ \${error}\`);
		}
		console.error(
			"\\nCommit message format example:\\n  feat(scope): add new feature\\n\\n  Why this change is needed and what it impacts.\\n\\n  Co-authored-by: Codex <noreply@openai.com>",
		);
		process.exit(1);
	}
	process.exit(0);
}

function getBranchName() {
	try {
		// Using execFileSync for safety - no shell interpolation
		const output = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
			encoding: "utf-8",
			stdio: ["pipe", "pipe", "pipe"],
		});
		return output.trim();
	} catch {
		return "";
	}
}

main();
		`,
	},
	{
		path: "scripts/setup-git-hooks.js",
		render: () => `#!/usr/bin/env node
/**
 * Setup script for simple-git-hooks
 *
 * Run this script after 'harness init' to wire pre-commit hooks into package.json:
 *   node scripts/setup-git-hooks.js
 *
 * This script:
 *   1. Adds simple-git-hooks to devDependencies (if not present)
 *   2. Adds postinstall script to run simple-git-hooks
 *   3. Enforces required simple-git-hooks configuration
 *   4. Runs package-manager install to activate hooks
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

const PACKAGE_JSON_PATH = resolve(process.cwd(), "package.json");
const REQUIRED_HOOKS = {
	"pre-commit": "pnpm lint && pnpm docs:lint && pnpm typecheck",
	"commit-msg": "node scripts/validate-commit-msg.js $1",
	"pre-push": "pnpm test && pnpm audit",
};
const POSTINSTALL_BOOTSTRAP =
	"command -v simple-git-hooks >/dev/null 2>&1 && simple-git-hooks || true";

function main() {
	if (!existsSync(PACKAGE_JSON_PATH)) {
		console.error("Error: package.json not found in current directory");
		console.error("  Run this script from your project root.");
		process.exit(1);
	}

	let packageJson;
	try {
		packageJson = JSON.parse(readFileSync(PACKAGE_JSON_PATH, "utf-8"));
	} catch {
		console.error("Error: Failed to parse package.json");
		process.exit(1);
	}

	let modified = false;

	// Ensure devDependencies exists
	if (!packageJson.devDependencies) {
		packageJson.devDependencies = {};
	}

	// Add simple-git-hooks if not present
	const deps = packageJson.devDependencies;
	if (!deps["simple-git-hooks"]) {
		deps["simple-git-hooks"] = "^2.13.1";
		console.info("✓ Added simple-git-hooks to devDependencies");
		modified = true;
	} else {
		console.info("✓ simple-git-hooks already in devDependencies");
	}

	// Ensure scripts exists
	if (!packageJson.scripts) {
		packageJson.scripts = {};
	}

	// Add postinstall script if not present
	const scripts = packageJson.scripts;
	if (!scripts.postinstall) {
		scripts.postinstall = POSTINSTALL_BOOTSTRAP;
		console.info("✓ Added postinstall script");
		modified = true;
	} else if (!scripts.postinstall.includes("simple-git-hooks")) {
		// Prepend simple-git-hooks to existing postinstall
		scripts.postinstall = \`\${POSTINSTALL_BOOTSTRAP} && \${scripts.postinstall}\`;
		console.info("✓ Prepended simple-git-hooks to postinstall");
		modified = true;
	}

	// Enforce required simple-git-hooks configuration
	const existingHooks = packageJson["simple-git-hooks"] ?? {};
	const mergedHooks = { ...existingHooks, ...REQUIRED_HOOKS };
	if (JSON.stringify(existingHooks) !== JSON.stringify(mergedHooks)) {
		packageJson["simple-git-hooks"] = mergedHooks;
		console.info("✓ Enforced required simple-git-hooks configuration");
		modified = true;
	} else {
		console.info("✓ Required simple-git-hooks configuration already present");
	}

	// Write changes if modified
	if (modified) {
		writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(packageJson, null, 2) + "\\n");
		console.info("\\n✓ package.json updated");
	}

	// Run install to activate hooks (using execFileSync for safety)
	console.info("\\nInstalling dependencies to activate hooks...");
	try {
		execFileSync("pnpm", ["install"], { stdio: "inherit" });
		console.info("\\n✓ Git hooks installed and active!");
		console.info("\\nHooks enabled:");
		console.info("  • pre-commit: pnpm lint && pnpm docs:lint && pnpm typecheck");
		console.info("  • commit-msg: validates conventional commit format");
		console.info("  • pre-push: pnpm test && pnpm audit");
	} catch {
		console.error("\\n⚠️  Failed to run pnpm install. Run it manually to activate hooks.");
	}
}

main();
`,
	},
	{
		path: ".diagram/.gitkeep",
		render: () => "",
	},
	{
		path: ".diagram/context/diagram-context.md",
		render: () => `# Diagram Context Pack

This file is auto-generated by the diagram-refresh CI job on every PR.

When source files change, the CI pipeline:
1. Runs \`@brainwav/diagram\` to generate Mermaid diagrams
2. Updates this file with current architecture
3. Commits changes back to the PR branch

## Usage for Agents

Reference this file to understand:
- Project structure and component relationships
- Module dependencies and data flows
- Test coverage patterns

## Manual refresh

To refresh diagrams locally:

\`\`\`bash
# Install the tool
pnpm add -D @brainwav/diagram

# Generate diagrams
pnpm exec diagram all . --output-dir .diagram

# Update context
./scripts/refresh-diagram-context.sh --force
\`\`\`
`,
	},
	{
		path: ".diagramrc",
		render: () => `{
	"ignore": ["node_modules", "dist", "coverage", "artifacts", ".git", ".diagram"]
}
`,
	},
	{
		path: "biome.json",
		render: () => `{
	"$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
	"vcs": {
		"enabled": true,
		"clientKind": "git",
		"useIgnoreFile": true,
		"defaultBranch": "main"
	},
	"files": {
		"ignoreUnknown": true,
		"ignore": [
			"node_modules",
			"dist",
			"coverage",
			"artifacts"
		]
	},
	"overrides": [
		{
			"include": ["*.config.ts", "vite.config.ts", "vitest.config.ts"],
			"linter": {
				"rules": {
					"style": {
						"noDefaultExport": "off"
					}
				}
			}
		}
	],
	"linter": {
		"enabled": true,
		"rules": {
			"recommended": true,
			"correctness": {
				"noUnusedImports": "error",
				"noUnusedVariables": "error"
			},
			"suspicious": {
				"noEmptyBlockStatements": "error",
				"noExplicitAny": "warn",
				"noConsoleLog": "warn",
				"noDebugger": "error"
			},
			"style": {
				"noDefaultExport": "error",
				"useConst": "error",
				"useImportType": "error"
			}
		}
	},
	"organizeImports": {
		"enabled": true
	}
}
`,
	},
	{
		path: ".gitleaks.toml",
		render: () => `title = "Project gitleaks config"

[extend]
useDefault = true

[allowlist]
description = "Allowlist for test fixtures and examples."
paths = [
  "(^|/)docs?/",
  "(^|/)examples?/",
  "(^|/)test/",
  "(^|/)tests?/",
  "(^|/)spec/",
  "(^|/)__tests__/",
  "(^|/)test-data/",
  "(^|/)[^.]+\\\\.(test|spec)\\\\.[^.]+$",
]
regexes = [
  "\\\\[REDACTED\\\\]",
]
`,
	},
	{
		path: "prek.toml",
		render: (pm) => {
			const lintCmd = pm === "npm" ? "npm run lint" : `${pm} lint`;
			const docsLintCmd =
				pm === "npm" ? "npm run docs:lint" : `${pm} docs:lint`;
			const typecheckCmd =
				pm === "npm" ? "npm run typecheck" : `${pm} typecheck`;
			const testCmd = pm === "npm" ? "npm run test" : `${pm} test`;
			const auditCmd = pm === "npm" ? "npm run audit" : `${pm} audit`;
			return `# Prek configuration (Rust-based pre-commit replacement)
# Install prek: mise install cargo-prek || cargo install prek
# Run: prek install && prek run --all-files

[hooks]
pre-commit = ["${lintCmd}", "${docsLintCmd}", "${typecheckCmd}"]
pre-push = ["${testCmd}", "${auditCmd}"]

[tools]
biome = "1.9.4"
typescript = "5.7"
vitest = "3.2"
`;
		},
	},
	{
		path: ".mise.toml",
		render: () => `[tools]
node = "24.13.1"
pnpm = "10.0.0"
python = "3.12"
uv = "0.9.5"

[env]
CLAUDE_APPROVAL_POSTURE = "require"
`,
	},
	{
		path: "scripts/check-environment.sh",
		render: () => `#!/usr/bin/env bash
# Local environment preflight (strict)
# Fails fast when required tooling is missing.

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${"${"}BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
CONTRACT_PATH="$REPO_ROOT/harness.contract.json"
ATTESTATION_PATH="$REPO_ROOT/artifacts/policy/environment-attestation.json"
MISE_PATH="$REPO_ROOT/.mise.toml"
TOOLING_DOC_PATH="\${TOOLING_DOC_PATH:-$HOME/dev/config/codex/instructions/tooling.md}"

if [[ ! -f "$CONTRACT_PATH" ]]; then
	echo "Error: missing contract file at $CONTRACT_PATH"
	exit 1
fi

if ! command -v rg >/dev/null 2>&1; then
	echo "Error: required binary 'rg' is not installed or not on PATH"
	exit 1
fi

if [[ ! -f "$MISE_PATH" ]]; then
	echo "Error: missing mise config at $MISE_PATH"
	exit 1
fi

required_mise_tools=(node pnpm python uv)
for tool in "\${required_mise_tools[@]}"; do
	if ! rg -q "^[[:space:]]*\${tool}[[:space:]]*=" "$MISE_PATH"; then
		echo "Error: required tool '\$tool' is not pinned in $MISE_PATH [tools]"
		echo "Fix: add '\$tool = \"<version>\"' to $MISE_PATH."
		exit 1
	fi
done

if [[ -f "$TOOLING_DOC_PATH" ]]; then
	required_tooling_doc_terms=(node pnpm python uv rg fd jq)
	for term in "\${required_tooling_doc_terms[@]}"; do
		if ! rg -qi "(^|[^A-Za-z0-9_-])\${term}([^A-Za-z0-9_-]|$)" "$TOOLING_DOC_PATH"; then
			echo "Error: tooling doc missing expected term '\$term': $TOOLING_DOC_PATH"
			echo "Fix: update tooling inventory and keep it aligned with $MISE_PATH."
			echo "Interactive flow: run a Codex AskQuestion/request_user_input prompt before applying installs."
			exit 1
		fi
	done
else
	echo "Warning: tooling doc not found at $TOOLING_DOC_PATH; skipping doc sync check."
fi

required_bins=(pnpm node jq rg fd)
for bin in "\${required_bins[@]}"; do
	if ! command -v "$bin" >/dev/null 2>&1; then
		echo "Error: required binary '$bin' is not installed or not on PATH"
		exit 1
	fi
done

mkdir -p "$REPO_ROOT/artifacts/policy"

echo "Running harness environment preflight..."
pnpm exec tsx src/cli.ts check-environment \\
	--contract "$CONTRACT_PATH" \\
	--json \\
	--attestation "$ATTESTATION_PATH"

jq -e '.passed == true' "$ATTESTATION_PATH" >/dev/null
echo "Environment check passed (attestation: $ATTESTATION_PATH)"
`,
	},
	{
		path: CODEX_ENVIRONMENT_TEMPLATE_PATH,
		render: (pm, context) => renderCodexEnvironmentTemplate(pm, context),
	},
	{
		path: ".github/ISSUE_TEMPLATE/config.yml",
		render: () => `# Issue template configuration
blank_issues_enabled: false
contact_links:
  - name: Linear work intake
    url: https://linear.app/jscraik/project/coding-harness-bb735dbbda79
    about: Create or update bugs, features, policy gaps, automation work, and release follow-ups in Linear.
  - name: Repository docs
    url: https://github.com/jscraik/coding-harness#readme
    about: Review setup, workflow, and command documentation before opening new work.
  - name: Private security disclosure
    url: mailto:jamie@brainwav.ai
    about: Report security vulnerabilities privately instead of using public issue flows.
`,
	},
	{
		path: ".github/CODEOWNERS",
		render: () => `# Governance-sensitive surfaces
/.github/workflows/** @jscraik
/harness.contract.json @jscraik
/CONTRIBUTING.md @jscraik
/AGENTS.md @jscraik
/scripts/check-environment.sh @jscraik
`,
	},
	{
		path: "Makefile",
		render: () => `# Harness Development Makefile
# Run \`make help\` to see available commands

.PHONY: help install setup hooks dev build lint docs-lint fmt typecheck test check audit secrets security clean reset ci diagrams env-check

# Default target
help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\\n", $$1, $$2}' $(MAKEFILE_LIST)

# === Setup ===

install: ## Install dependencies
	pnpm install

setup: install hooks ## Full setup: install deps and configure git hooks

hooks: ## Setup git hooks
	node scripts/setup-git-hooks.js

# === Development ===

dev: ## Start development server
	pnpm dev

build: ## Build for production
	pnpm build

# === Quality ===

lint: ## Run linter
	pnpm lint

docs-lint: ## Lint markdown/docs
	pnpm docs:lint

fmt: ## Format code
	pnpm fmt

typecheck: ## Run TypeScript type checking
	pnpm typecheck

test: ## Run tests
	pnpm test

check: ## Run all required quality gates
	pnpm check

# === Security ===

audit: ## Run security audit
	pnpm audit

secrets: ## Scan for secrets with gitleaks
	@gitleaks detect --source . --verbose || (echo "Install gitleaks: brew install gitleaks" && exit 1)

security: audit secrets ## Run all security checks

# === Maintenance ===

clean: ## Clean build artifacts and caches
	rm -rf dist coverage artifacts .test-traces* .traces
	rm -rf node_modules/.cache

reset: clean ## Full reset: clean and reinstall
	pnpm install

# === CI ===

ci: ## Run CI-equivalent local checks
	pnpm check

# === Diagrams ===

diagrams: ## Generate architecture diagrams
	pnpm exec diagram all . --output-dir .diagram

# === Environment ===

env-check: ## Check environment policy envelope
	@./scripts/check-environment.sh
`,
	},
];

// === Package Manager Detection ===

function detectPackageManager(dir: string): PackageManager {
	if (existsSync(resolve(dir, "pnpm-lock.yaml"))) return "pnpm";
	if (existsSync(resolve(dir, "yarn.lock"))) return "yarn";
	if (existsSync(resolve(dir, "package-lock.json"))) return "npm";
	return "npm";
}

// === Path Sanitization ===

type PathResult =
	| { ok: true; value: string }
	| { ok: false; error: InitErrorOutput };

function sanitizePath(base: string, relativePath: string): PathResult {
	// Validate inputs
	if (!base || typeof base !== "string") {
		return {
			ok: false,
			error: {
				code: "INVALID_PATH",
				message: "Base directory must be a non-empty string",
			},
		};
	}

	if (!relativePath || typeof relativePath !== "string") {
		return {
			ok: false,
			error: {
				code: "INVALID_PATH",
				message: "Relative path must be a non-empty string",
			},
		};
	}

	// Normalize paths
	const normalizedBase = resolve(base);
	const resolved = resolve(base, relativePath);

	// Ensure base ends with separator for proper prefix matching
	// This prevents /app from matching /app-secrets
	const baseWithSep = normalizedBase.endsWith(sep)
		? normalizedBase
		: normalizedBase + sep;

	// Check if resolved is exactly base or starts with base + separator
	if (resolved !== normalizedBase && !resolved.startsWith(baseWithSep)) {
		return {
			ok: false,
			error: {
				code: "PATH_TRAVERSAL",
				message: `Path traversal blocked: ${relativePath} resolves outside target directory`,
				path: relativePath,
			},
		};
	}

	return { ok: true, value: resolved };
}

// === Atomic Write ===

type WriteResult =
	| { ok: true; value: undefined }
	| { ok: false; error: InitErrorOutput };

function atomicWrite(filePath: string, content: string): WriteResult {
	const tempPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;

	try {
		mkdirSync(dirname(filePath), { recursive: true });
		writeFileSync(tempPath, content, "utf-8");
		renameSync(tempPath, filePath);
		return { ok: true, value: undefined };
	} catch (e) {
		// Cleanup temp file on failure
		try {
			rmSync(tempPath, { force: true });
		} catch {
			// Best-effort cleanup; ignore failures
		}
		return {
			ok: false,
			error: {
				code: "WRITE_ERROR",
				message: `Failed to write file: ${sanitizeError(e)}`,
				path: filePath,
			},
		};
	}
}

// === Backup Functions ===

/**
 * Create backup of existing file with symlink detection and hash-based naming.
 * Returns backupHash (16-char SHA256 prefix) or null for new files.
 */
function createBackup(targetDir: string, relativePath: string): BackupResult {
	const pathResult = sanitizePath(targetDir, relativePath);
	if (!pathResult.ok) return pathResult;

	const source = pathResult.value;

	// Check if file exists
	if (!existsSync(source)) {
		return { ok: true, value: null }; // New file, no backup needed
	}

	// CRITICAL: Reject symlinks to prevent arbitrary file read
	try {
		const stat = lstatSync(source);
		if (stat.isSymbolicLink()) {
			return {
				ok: false,
				error: {
					code: "WRITE_ERROR",
					message: `Symlink detected at ${relativePath} - rejected for security`,
					path: relativePath,
				},
			};
		}
	} catch (e) {
		return {
			ok: false,
			error: {
				code: "WRITE_ERROR",
				message: `Failed to check file type: ${sanitizeError(e)}`,
				path: relativePath,
			},
		};
	}

	// Use SHA256 hash of relative path for collision-safe naming
	// foo/bar.yml -> a1b2c3d4e5f6g7h8.bak (not foo-bar.yml.bak)
	const backupHash = createHash("sha256")
		.update(relativePath)
		.digest("hex")
		.slice(0, 16);
	const backupPath = resolve(
		targetDir,
		HARNESS_DIR,
		BACKUPS_DIR,
		`${backupHash}.bak`,
	);

	try {
		mkdirSync(dirname(backupPath), { recursive: true });
		copyFileSync(source, backupPath);
		return { ok: true, value: backupHash };
	} catch (e) {
		return {
			ok: false,
			error: {
				code: "WRITE_ERROR",
				message: `Failed to create backup: ${sanitizeError(e)}`,
				path: relativePath,
			},
		};
	}
}

// === Rollback Functions ===

/**
 * Load and validate manifest from disk.
 * Re-validates all paths to prevent manifest tampering.
 */
function loadManifest(targetDir: string): ManifestResult {
	const manifestPath = resolve(targetDir, HARNESS_DIR, MANIFEST_FILE);

	if (!existsSync(manifestPath)) {
		return {
			ok: false,
			error: {
				code: "WRITE_ERROR",
				message: "No restore manifest found. Run `harness init --track` first.",
				path: MANIFEST_FILE,
			},
		};
	}

	try {
		const content = readFileSync(manifestPath, "utf-8");
		const data = JSON.parse(content) as unknown;

		// Validate manifest structure
		if (typeof data !== "object" || data === null) {
			return {
				ok: false,
				error: {
					code: "WRITE_ERROR",
					message: "Restore manifest is corrupted: not an object",
					path: MANIFEST_FILE,
				},
			};
		}

		const manifest = data as Record<string, unknown>;

		if (!Array.isArray(manifest.files)) {
			return {
				ok: false,
				error: {
					code: "WRITE_ERROR",
					message: "Restore manifest is corrupted: missing files array",
					path: MANIFEST_FILE,
				},
			};
		}

		// CRITICAL: Re-validate all paths to prevent manifest tampering attacks
		const validatedFiles: ManifestEntry[] = [];
		for (const entry of manifest.files) {
			if (typeof entry !== "object" || entry === null) {
				return {
					ok: false,
					error: {
						code: "WRITE_ERROR",
						message: "Restore manifest is corrupted: invalid entry",
						path: MANIFEST_FILE,
					},
				};
			}

			const e = entry as Record<string, unknown>;
			if (typeof e.path !== "string") {
				return {
					ok: false,
					error: {
						code: "WRITE_ERROR",
						message: "Restore manifest is corrupted: missing path",
						path: MANIFEST_FILE,
					},
				};
			}

			// Re-apply path sanitization to every entry
			const pathResult = sanitizePath(targetDir, e.path);
			if (!pathResult.ok) {
				return {
					ok: false,
					error: {
						code: "WRITE_ERROR",
						message: `Path traversal blocked in manifest: ${e.path}`,
						path: e.path,
					},
				};
			}

			// Validate action and backupHash
			if (e.action === "created") {
				validatedFiles.push({ path: e.path, action: "created" });
			} else if (e.action === "modified" && typeof e.backupHash === "string") {
				// Validate backupHash format (16-char hex)
				if (!/^[a-f0-9]{16}$/.test(e.backupHash)) {
					return {
						ok: false,
						error: {
							code: "WRITE_ERROR",
							message: `Invalid backup hash format: ${e.backupHash}`,
							path: e.path,
						},
					};
				}
				validatedFiles.push({
					path: e.path,
					action: "modified",
					backupHash: e.backupHash,
				});
			} else {
				return {
					ok: false,
					error: {
						code: "WRITE_ERROR",
						message: `Invalid manifest entry: action=${e.action}, backupHash=${e.backupHash}`,
						path: e.path,
					},
				};
			}
		}

		// Extract harnessVersion (defaults to "0.0.0" for backward compatibility)
		const harnessVersion =
			typeof manifest.harnessVersion === "string"
				? manifest.harnessVersion
				: "0.0.0";

		return {
			ok: true,
			value: { harnessVersion, files: validatedFiles },
		};
	} catch (e) {
		return {
			ok: false,
			error: {
				code: "WRITE_ERROR",
				message: `Failed to load manifest: ${sanitizeError(e)}`,
				path: MANIFEST_FILE,
			},
		};
	}
}

/**
 * Execute rollback: restore files from backups, delete created files.
 * Cleans up backups and manifest after successful restore.
 */
function executeRollback(
	targetDir: string,
	manifest: RestoreManifest,
): RollbackResult {
	const restored: string[] = [];
	const deleted: string[] = [];
	const backupDir = resolve(targetDir, HARNESS_DIR, BACKUPS_DIR);

	try {
		for (const entry of manifest.files) {
			// Re-validate path (defense in depth)
			const pathResult = sanitizePath(targetDir, entry.path);
			if (!pathResult.ok) {
				return {
					ok: false,
					error: {
						code: "WRITE_ERROR",
						message: `Path validation failed during rollback: ${entry.path}`,
						path: entry.path,
					},
				};
			}

			const targetPath = pathResult.value;

			if (entry.action === "created") {
				// Delete created file
				if (existsSync(targetPath)) {
					rmSync(targetPath, { force: true });
					deleted.push(entry.path);
				}
			} else {
				// Restore from backup
				const backupPath = resolve(backupDir, `${entry.backupHash}.bak`);
				if (!existsSync(backupPath)) {
					return {
						ok: false,
						error: {
							code: "WRITE_ERROR",
							message: `Backup file missing: ${entry.backupHash}`,
							path: entry.path,
						},
					};
				}
				copyFileSync(backupPath, targetPath);
				restored.push(entry.path);
			}
		}

		// Cleanup backups and manifest
		rmSync(backupDir, { recursive: true, force: true });
		rmSync(resolve(targetDir, HARNESS_DIR, MANIFEST_FILE), { force: true });

		// Try to remove .harness dir if empty
		try {
			rmSync(resolve(targetDir, HARNESS_DIR), { recursive: true });
		} catch {
			// Directory not empty, leave it
		}

		return { ok: true, value: { restored, deleted } };
	} catch (e) {
		return {
			ok: false,
			error: {
				code: "WRITE_ERROR",
				message: `Rollback failed: ${sanitizeError(e)}`,
			},
		};
	}
}

// === Update Detection Functions ===

/**
 * Check if template updates are available.
 * Compares manifest version against current CLI version.
 */
function checkForUpdates(targetDir: string): UpdateCheckResult {
	const manifestResult = loadManifest(targetDir);
	if (!manifestResult.ok) {
		return manifestResult;
	}

	const currentVersion = getVersion();
	const installedVersion = manifestResult.value.harnessVersion || "0.0.0";

	// Validate versions
	if (!semver.valid(currentVersion)) {
		return {
			ok: false,
			error: {
				code: "WRITE_ERROR",
				message: `Invalid current version: ${currentVersion}`,
			},
		};
	}

	if (!semver.valid(installedVersion)) {
		return {
			ok: false,
			error: {
				code: "WRITE_ERROR",
				message: `Invalid installed version: ${installedVersion}`,
			},
		};
	}

	const updateAvailable = semver.gt(currentVersion, installedVersion);

	return {
		ok: true,
		value: {
			currentVersion,
			installedVersion,
			updateAvailable,
		},
	};
}

/**
 * Execute template updates.
 * Re-renders all tracked templates and updates manifest version.
 */
function executeUpdate(
	targetDir: string,
	manifest: RestoreManifest,
): UpdateResult {
	const packageManager = detectPackageManager(targetDir);
	const renderContext = createTemplateRenderContext(targetDir);
	const updated: string[] = [];
	const skipped: string[] = [];

	for (const entry of manifest.files) {
		// Find matching template
		const template = TEMPLATES.find((t) => t.path === entry.path);
		if (!template) {
			// Template no longer exists, skip
			skipped.push(entry.path);
			continue;
		}

		// Re-validate path
		const pathResult = sanitizePath(targetDir, entry.path);
		if (!pathResult.ok) {
			return {
				ok: false,
				error: pathResult.error,
			};
		}

		const targetPath = pathResult.value;

		// Check if file exists
		if (!existsSync(targetPath)) {
			skipped.push(entry.path);
			continue;
		}

		// Render and write
		const content = template.render(packageManager, renderContext);
		const writeResult = atomicWrite(targetPath, content);
		if (!writeResult.ok) {
			return writeResult;
		}

		updated.push(entry.path);
	}

	// Update manifest version
	const newManifest: RestoreManifest = {
		...manifest,
		harnessVersion: getVersion(),
	};
	const manifestPath = resolve(targetDir, HARNESS_DIR, MANIFEST_FILE);
	const manifestResult = atomicWrite(
		manifestPath,
		JSON.stringify(newManifest, null, 2),
	);
	if (!manifestResult.ok) {
		return manifestResult;
	}

	return { ok: true, value: { updated, skipped } };
}

// === Schema Migration Functions ===

const CONTRACT_FILE = "harness.contract.json";

/**
 * Detect the version of an existing contract file.
 * Returns null if file doesn't exist or doesn't have a valid version.
 */
export function detectContractVersion(targetDir: string): string | null {
	const contractPath = resolve(targetDir, CONTRACT_FILE);

	if (!existsSync(contractPath)) {
		return null;
	}

	try {
		const content = readFileSync(contractPath, "utf-8");
		const data = JSON.parse(content) as unknown;

		if (typeof data !== "object" || data === null) {
			return null;
		}

		const contract = data as Record<string, unknown>;
		if (typeof contract.version !== "string") {
			return null;
		}

		return contract.version;
	} catch {
		return null;
	}
}

/**
 * Load and validate a contract file.
 * Returns the parsed contract or an error.
 */
function loadContract(
	targetDir: string,
): { ok: true; value: ContractSchema } | { ok: false; error: InitErrorOutput } {
	const contractPath = resolve(targetDir, CONTRACT_FILE);

	if (!existsSync(contractPath)) {
		return {
			ok: false,
			error: {
				code: "WRITE_ERROR",
				message: `Contract file not found: ${CONTRACT_FILE}`,
				path: CONTRACT_FILE,
			},
		};
	}

	try {
		const content = readFileSync(contractPath, "utf-8");
		const data = JSON.parse(content) as unknown;

		if (typeof data !== "object" || data === null) {
			return {
				ok: false,
				error: {
					code: "WRITE_ERROR",
					message: "Contract file is not a valid JSON object",
					path: CONTRACT_FILE,
				},
			};
		}

		const contract = data as ContractSchema;

		// Validate required fields
		if (typeof contract.version !== "string") {
			return {
				ok: false,
				error: {
					code: "WRITE_ERROR",
					message: "Contract file missing required 'version' field",
					path: CONTRACT_FILE,
				},
			};
		}

		return { ok: true, value: contract };
	} catch (e) {
		return {
			ok: false,
			error: {
				code: "WRITE_ERROR",
				message: `Failed to parse contract: ${sanitizeError(e)}`,
				path: CONTRACT_FILE,
			},
		};
	}
}

/**
 * Apply all applicable migrations to bring a contract up to the latest version.
 * Chains migrations sequentially, preserving user customizations.
 */
function migrateContract(contract: ContractSchema): MigrationResult {
	const originalVersion = contract.version;
	const migrationsApplied: string[] = [];
	let currentContract = { ...contract };

	// Find and apply migrations sequentially
	for (const migration of MIGRATIONS) {
		if (currentContract.version === migration.fromVersion) {
			currentContract = migration.migrate(currentContract);
			migrationsApplied.push(
				`${migration.fromVersion} → ${migration.toVersion}: ${migration.description}`,
			);
		}
	}

	return {
		originalVersion,
		finalVersion: currentContract.version,
		migrationsApplied,
		migratedContract: currentContract,
	};
}

/**
 * Check if contract needs migration by comparing versions.
 */
function needsMigration(contractVersion: string): boolean {
	const normalizedVersion = semver.coerce(contractVersion)?.version;
	if (!normalizedVersion) {
		return false;
	}
	return semver.lt(normalizedVersion, CURRENT_SCHEMA_VERSION);
}

/**
 * Execute contract schema migration.
 * Loads contract, applies migrations, and writes result.
 */
function executeMigration(targetDir: string): MigrationResultType {
	const loadResult = loadContract(targetDir);
	if (!loadResult.ok) {
		return loadResult;
	}

	const contract = loadResult.value;
	const normalizedVersion = semver.coerce(contract.version)?.version;

	// Surface error for unparseable versions instead of silently skipping
	if (!normalizedVersion) {
		return {
			ok: false,
			error: {
				code: "E_INVALID_VERSION",
				message: `Cannot parse contract version: "${contract.version}". Version must be semver-compatible (e.g., "1.0.0").`,
			},
		};
	}

	const normalizedContract = { ...contract, version: normalizedVersion };

	// Check if migration is needed
	if (!needsMigration(normalizedContract.version)) {
		return {
			ok: true,
			value: {
				originalVersion: normalizedContract.version,
				finalVersion: normalizedContract.version,
				migrationsApplied: [],
				migratedContract: normalizedContract,
			},
		};
	}

	// Apply migrations
	const result = migrateContract(normalizedContract);

	// Write migrated contract
	const contractPath = resolve(targetDir, CONTRACT_FILE);
	const writeResult = atomicWrite(
		contractPath,
		JSON.stringify(result.migratedContract, null, 2),
	);

	if (!writeResult.ok) {
		return writeResult;
	}

	return { ok: true, value: result };
}
function collectProposedChanges(
	targetDir: string,
	options: InitOptions,
): ProposedChange[] {
	const packageManager = detectPackageManager(targetDir);
	const renderContext = createTemplateRenderContext(targetDir);
	const proposed: ProposedChange[] = [];

	for (const template of TEMPLATES) {
		// Sanitize the template path
		const pathResult = sanitizePath(targetDir, template.path);
		if (!pathResult.ok) {
			// Skip invalid paths - they would fail in actual run anyway
			continue;
		}

		const targetPath = pathResult.value;
		const exists = existsSync(targetPath);
		const newContent = template.render(packageManager, renderContext);
		const autoUpdate =
			exists && shouldAutoUpdateTemplate(template.path, targetPath);

		if (exists && !options.force && !autoUpdate) {
			// File exists and not forcing - would skip
			proposed.push({
				path: template.path,
				action: "skip",
				currentContent: readFileSync(targetPath, "utf-8"),
				newContent,
			});
		} else if (exists) {
			// File exists and forcing - would modify
			proposed.push({
				path: template.path,
				action: "modify",
				currentContent: readFileSync(targetPath, "utf-8"),
				newContent,
			});
		} else {
			// File doesn't exist - would create
			proposed.push({
				path: template.path,
				action: "create",
				currentContent: null,
				newContent,
			});
		}
	}

	return proposed;
}

/**
 * Generate a unified diff for a proposed change.
 * Returns a formatted diff string suitable for display.
 */
export function generateDiff(change: ProposedChange): string {
	const lines: string[] = [];

	if (change.action === "create") {
		// For new files, show all content as additions
		lines.push("--- /dev/null");
		lines.push(`+++ b/${change.path}`);
		const contentLines = change.newContent.split("\n");
		for (const line of contentLines) {
			lines.push(`+${line}`);
		}
	} else if (change.action === "modify") {
		// For modifications, use diffLines for unified diff
		lines.push(`--- a/${change.path}`);
		lines.push(`+++ b/${change.path}`);

		const changes = diffLines(change.currentContent ?? "", change.newContent);

		for (const changePart of changes) {
			const prefix = changePart.added ? "+" : changePart.removed ? "-" : " ";
			const contentLines = changePart.value.split("\n");
			// Remove trailing empty string if content ends with newline
			if (contentLines[contentLines.length - 1] === "") {
				contentLines.pop();
			}
			for (const line of contentLines) {
				lines.push(`${prefix}${line}`);
			}
		}
	}
	// For "skip" action, no diff needed

	return lines.join("\n");
}

/**
 * Apply a single proposed change to the filesystem.
 * Used by interactive mode after user approval.
 */
function applyProposedChange(
	targetDir: string,
	change: ProposedChange,
): { ok: true } | { ok: false; error: InitErrorOutput } {
	// Skip actions don't need to write anything
	if (change.action === "skip") {
		return { ok: true };
	}

	// Validate and sanitize path
	const pathResult = sanitizePath(targetDir, change.path);
	if (!pathResult.ok) {
		return pathResult;
	}

	const targetPath = pathResult.value;

	// Ensure parent directory exists
	const parentDir = dirname(targetPath);
	try {
		mkdirSync(parentDir, { recursive: true });
	} catch (e) {
		return {
			ok: false,
			error: {
				code: "WRITE_ERROR",
				message: `Failed to create directory: ${sanitizeError(e)}`,
				path: change.path,
			},
		};
	}

	// Write the file
	const writeResult = atomicWrite(targetPath, change.newContent);
	if (!writeResult.ok) {
		return writeResult;
	}

	return { ok: true };
}

/**
 * Run harness init and return structured result.
 * This function is usable as a library (does not output to console).
 */
export function runInit(
	targetDir: string | undefined,
	options: InitOptions,
): InitResult {
	const dir = targetDir ?? cwd();
	const packageManager = detectPackageManager(dir);
	const renderContext = createTemplateRenderContext(dir);

	// Handle --rollback: restore from manifest
	if (options.rollback) {
		const manifestResult = loadManifest(dir);
		if (!manifestResult.ok) {
			return manifestResult;
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

	// Handle --check-updates: compare versions
	if (options.checkUpdates) {
		const checkResult = checkForUpdates(dir);
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

	// Handle --update: apply template updates
	if (options.update) {
		const manifestResult = loadManifest(dir);
		if (!manifestResult.ok) {
			return manifestResult;
		}

		const updateResult = executeUpdate(dir, manifestResult.value);
		if (!updateResult.ok) {
			return updateResult;
		}

		return {
			ok: true,
			output: {
				packageManager,
				created: updateResult.value.updated,
				skipped: updateResult.value.skipped,
			},
		};
	}

	// Handle --migrate: apply schema migrations to contract
	if (options.migrate) {
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

	// Handle --interactive: collect proposed changes without writing
	if (options.interactive) {
		const proposedChanges = collectProposedChanges(dir, options);
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

	const created: string[] = [];
	const skipped: string[] = [];
	const manifestEntries: ManifestEntry[] = [];

	// Ensure .harness dir exists if tracking
	if (options.track && !options.dryRun) {
		mkdirSync(resolve(dir, HARNESS_DIR), { recursive: true });
		mkdirSync(resolve(dir, HARNESS_DIR, BACKUPS_DIR), { recursive: true });
	}

	for (const template of TEMPLATES) {
		// Sanitize the template path
		const pathResult = sanitizePath(dir, template.path);
		if (!pathResult.ok) {
			return pathResult;
		}

		const targetPath = pathResult.value;
		const exists = existsSync(targetPath);
		const autoUpdate =
			exists && shouldAutoUpdateTemplate(template.path, targetPath);

		// Skip existing files unless --force
		if (exists && !options.force && !autoUpdate) {
			skipped.push(template.path);
			continue;
		}

		// Dry-run: don't write, just track what would happen
		if (options.dryRun) {
			created.push(template.path); // Track as "would create"
			continue;
		}

		// Create backup if tracking and file exists
		if (options.track && exists) {
			const backupResult = createBackup(dir, template.path);
			if (!backupResult.ok) {
				return backupResult;
			}
			if (backupResult.value !== null) {
				manifestEntries.push({
					path: template.path,
					action: "modified",
					backupHash: backupResult.value,
				});
			} else {
				manifestEntries.push({
					path: template.path,
					action: "created",
				});
			}
		} else if (options.track) {
			// New file, track as created
			manifestEntries.push({
				path: template.path,
				action: "created",
			});
		}

		// Render and write
		const content = template.render(packageManager, renderContext);
		const writeResult = atomicWrite(targetPath, content);
		if (!writeResult.ok) {
			return writeResult;
		}

		created.push(template.path);
	}

	// Write manifest if tracking
	if (options.track && !options.dryRun && manifestEntries.length > 0) {
		const manifest: RestoreManifest = {
			harnessVersion: getVersion(),
			files: manifestEntries,
		};
		const manifestPath = resolve(dir, HARNESS_DIR, MANIFEST_FILE);
		const manifestResult = atomicWrite(
			manifestPath,
			JSON.stringify(manifest, null, 2),
		);
		if (!manifestResult.ok) {
			return manifestResult;
		}
	}

	return {
		ok: true,
		output: {
			packageManager,
			created,
			skipped,
		},
	};
}

/**
 * Async CLI entry point for interactive mode.
 * Prompts user for each proposed change and applies approved ones.
 */
export async function runInteractiveInitCLI(
	targetDir: string | undefined,
	options: InitOptions,
): Promise<number> {
	// Dynamic import for ESM compatibility with inquirer
	const { select, confirm } = await import("@inquirer/prompts");

	const dir = targetDir ?? cwd();
	const packageManager = detectPackageManager(dir);

	// Check TTY - fall back to non-interactive if not a terminal
	if (!process.stdin.isTTY) {
		console.info("Warning: Not a TTY, falling back to non-interactive mode");
		return runInitCLI(targetDir, { ...options, interactive: false });
	}

	console.info(`Installing harness (package manager: ${packageManager})\n`);

	// Collect proposed changes
	const result = runInit(targetDir, { ...options, interactive: true });
	if (!result.ok) {
		console.error(`Error: ${result.error.message}`);
		if (result.error.path) {
			console.error(`  Path: ${result.error.path}`);
		}
		if (result.error.code === "PATH_TRAVERSAL") {
			return EXIT_CODES.PATH_TRAVERSAL;
		}
		if (result.error.code === "WRITE_ERROR") {
			return EXIT_CODES.WRITE_ERROR;
		}
		return EXIT_CODES.INVALID_PATH;
	}

	const proposedChanges = result.output.proposedChanges ?? [];
	const approved: ProposedChange[] = [];
	const rejected: string[] = [];

	// Process each proposed change
	for (const change of proposedChanges) {
		// Format the prompt message based on action type
		let message: string;
		if (change.action === "create") {
			message = `${change.path} does not exist. Create?`;
		} else if (change.action === "modify") {
			message = `${change.path} exists. Overwrite?`;
		} else {
			// Skip action - no prompt needed, just record
			rejected.push(change.path);
			continue;
		}

		try {
			const answer = await select({
				message,
				choices: [
					{ value: "yes", name: "Yes" },
					{ value: "no", name: "No" },
					{ value: "diff", name: "Show diff" },
				],
				default: change.action === "create" ? "yes" : "no",
			});

			if (answer === "diff") {
				// Show the diff
				console.info(`\n${generateDiff(change)}\n`);

				// Confirm after showing diff
				const confirmApply = await confirm({
					message: "Apply this change?",
					default: false,
				});

				if (confirmApply) {
					approved.push(change);
				} else {
					rejected.push(change.path);
				}
			} else if (answer === "yes") {
				approved.push(change);
			} else {
				rejected.push(change.path);
			}
		} catch (e) {
			// Handle Ctrl+C gracefully
			if (e instanceof Error && e.name === "ExitPromptError") {
				console.info("\nCancelled by user");
				return EXIT_CODES.SUCCESS;
			}
			throw e;
		}
	}

	// Apply approved changes
	const applied: string[] = [];
	const failed: string[] = [];

	for (const change of approved) {
		const applyResult = applyProposedChange(dir, change);
		if (applyResult.ok) {
			applied.push(change.path);
			console.info(`  ✓ ${change.path}`);
		} else {
			failed.push(change.path);
			console.error(`  ✗ ${change.path}: ${applyResult.error.message}`);
		}
	}

	// Summary
	console.info("\n✓ Harness installed!");
	console.info(`  Created: ${applied.length}, Skipped: ${rejected.length}`);

	if (failed.length > 0) {
		console.info(`  Failed: ${failed.length}`);
		return EXIT_CODES.WRITE_ERROR;
	}

	// Show rollback tip if tracking enabled
	if (options.track && applied.length > 0) {
		console.info("\n  Rollback: harness init --rollback");
	} else if (applied.length > 0) {
		console.info(
			"\n  Tip: Review changes with 'git diff', undo with 'git checkout .'",
		);
	}

	return EXIT_CODES.SUCCESS;
}

/**
 * CLI entry point with output formatting and exit codes.
 */
export function runInitCLI(
	targetDir: string | undefined,
	options: InitOptions,
): number {
	const result = runInit(targetDir, options);

	if (result.ok) {
		const { packageManager, created, skipped, updateCheck } = result.output;

		// Handle rollback output
		if (options.rollback) {
			console.info("Rollback complete\n");
			for (const path of skipped) {
				console.info(`  restored ${path}`);
			}
			console.info("\n✓ Restored to pre-install state");
			return EXIT_CODES.SUCCESS;
		}

		// Handle --check-updates output
		if (options.checkUpdates && updateCheck) {
			if (updateCheck.updateAvailable) {
				console.info(
					`Update available: v${updateCheck.installedVersion} → v${updateCheck.currentVersion}`,
				);
				console.info("\n  Run: harness init --update");
			} else {
				console.info(`Up to date (v${updateCheck.currentVersion})`);
			}
			return EXIT_CODES.SUCCESS;
		}

		// Handle --update output
		if (options.update) {
			if (created.length === 0 && skipped.length === 0) {
				console.info("Already up to date.");
			} else {
				console.info(`Updating harness (v${getVersion()})\n`);
				for (const path of created) {
					console.info(`  updated ${path}`);
				}
				for (const path of skipped) {
					console.info(`  skipped ${path}`);
				}
				console.info(`\n✓ Updated ${created.length} file(s)`);
			}
			return EXIT_CODES.SUCCESS;
		}

		// Handle --migrate output
		if (options.migrate) {
			const contractVersion = detectContractVersion(targetDir ?? cwd());
			if (created.length === 0) {
				console.info(
					`Contract already up to date (v${contractVersion ?? "unknown"})`,
				);
			} else {
				console.info("Migrating contract schema\n");
				console.info(
					`  ${CONTRACT_FILE}: v${contractVersion ?? "unknown"} → v${CURRENT_SCHEMA_VERSION}`,
				);
				console.info("\n✓ Contract migrated");
			}
			return EXIT_CODES.SUCCESS;
		}

		console.info(`Installing harness (package manager: ${packageManager})\n`);

		// Show what happened
		for (const path of skipped) {
			console.info(`  skip ${path} (exists)`);
		}
		for (const path of created) {
			if (options.dryRun) {
				console.info(`  would create ${path}`);
			} else {
				console.info(`  + ${path}`);
			}
		}

		if (options.dryRun) {
			console.info("\nDry run complete. No files were modified.");
			console.info("  Run without --dry-run to apply changes.");
		} else {
			console.info("\n✓ Harness installed!");
			console.info(`  Created: ${created.length}, Skipped: ${skipped.length}`);

			// Show rollback tip if tracking enabled
			if (options.track) {
				console.info("\n  Rollback: harness init --rollback");
			} else if (created.length > 0) {
				console.info(
					"\n  Tip: Review changes with 'git diff', undo with 'git checkout .'",
				);
			}
		}

		return EXIT_CODES.SUCCESS;
	}

	// Error output
	console.error(`Error: ${result.error.message}`);
	if (result.error.path) {
		console.error(`  Path: ${result.error.path}`);
	}
	console.error("\n  Try: harness init --dry-run to preview changes");

	if (result.error.code === "PATH_TRAVERSAL") {
		return EXIT_CODES.PATH_TRAVERSAL;
	}
	if (result.error.code === "WRITE_ERROR") {
		return EXIT_CODES.WRITE_ERROR;
	}
	return EXIT_CODES.INVALID_PATH;
}

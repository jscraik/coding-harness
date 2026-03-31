import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type {
	ContextContradictionCategory,
	ContextIntegrityPolicy,
	DocsGatePolicy,
	DocsImpactCategory,
	HarnessContract,
} from "../lib/contract/types.js";
import { validateContract } from "../lib/contract/validator.js";
import { sanitizeError } from "../lib/input/sanitize.js";
import { validatePath } from "../lib/input/validator.js";
import { normaliseDocsGateResult } from "../lib/output/normalise.js";

export type DocsGateMode = "advisory" | "required";
export type DocsGateTrigger =
	| "local"
	| "pull_request"
	| "merge_group"
	| "manual_ci";
export type DocsGateStatus = "success" | "partial" | "blocked";
export type DocsGateOutcome =
	| "ok"
	| "drift_detected"
	| "bootstrap_gap"
	| "trust_mismatch"
	| "policy_error"
	| "runtime_error";
export type DocsGateErrorClass =
	| "none"
	| "io"
	| "schema"
	| "runtime"
	| "trust_loading";
export type DocsRuleResult = "pass" | "fail" | "not_applicable" | "error";
export type DocsSeverity = "info" | "warning" | "error";

export interface DocsGateOptions {
	mode?: DocsGateMode;
	trigger?: DocsGateTrigger;
	json?: boolean;
	outPath?: string;
	changedFiles?: string[];
	repoRoot?: string;
	trustedBaseRef?: string;
	trustedContractSha?: string;
	trustedWorkflowSha?: string;
	mergeQueueTargetRef?: string;
	mergeQueueBaseSha?: string;
}

export interface DocsFinding {
	rule_id: string;
	category: DocsImpactCategory | ContextContradictionCategory | "system";
	surface: string;
	rule_result: DocsRuleResult;
	result: "pass" | "fail" | "not_applicable" | "error";
	severity: DocsSeverity;
	message: string;
	path?: string;
	details?: string;
	source_of_truth_ref?: string;
}

export interface DocsGateExecutionContext {
	trigger: DocsGateTrigger;
	policyMode: DocsGateMode;
	mergeAuthoritative: boolean;
	trustedBaseAvailable: boolean;
	trustedBaseRef: string | undefined;
	trustedContractSha: string | undefined;
	trustedWorkflowSha: string | undefined;
	evaluatedSha: string | undefined;
	mergeQueueTargetRef: string | undefined;
	mergeQueueBaseSha: string | undefined;
	bootstrapState: "fully_wired" | "shadow_only" | "missing_wiring";
	changedFilesSource: "explicit_flag" | "git_diff" | "full_repo_fallback";
	outputRoot: string;
}

export interface DocsGateReport {
	schemaVersion: "1.0.0";
	command: "docs-gate";
	mode: DocsGateMode;
	status: DocsGateStatus;
	outcome: DocsGateOutcome;
	error_class: DocsGateErrorClass;
	generated_at: string;
	repo_root: string;
	base_ref: string | undefined;
	execution_context: DocsGateExecutionContext;
	changed_files: string[];
	categories: DocsImpactCategory[];
	summary: {
		finding_count: number;
		error_count: number;
		warning_count: number;
		required_surface_count: number;
		missing_surface_count: number;
		contradiction_count: number;
		bootstrap_gap_count: number;
		unknown_category_count: number;
	};
	findings: DocsFinding[];
}

export interface DocsGateResult {
	report: DocsGateReport;
	exitCode: number;
}

const DEFAULT_OUT_PATH = "artifacts/consistency-gate/docs-gate-report.json";
const CONTRACT_PATH = "harness.contract.json";
const PACKAGE_JSON_PATH = "package.json";
const WORKFLOW_PATH = ".github/workflows/pr-pipeline.yml";
const CONTRADICTION_HISTORY_PATH =
	"artifacts/context-integrity/contradiction-history.jsonl";
const NON_WORKFLOW_REQUIRED_CHECKS = new Set([
	"CodeRabbit",
	"Greptile Review",
	"security-scan",
]);

interface LoadedContract {
	contract: HarnessContract;
}

interface ContradictionRecord {
	findingId: string;
	category: ContextContradictionCategory;
	status: "open" | "resolved";
	message: string;
	sourcePaths: string[];
	detectedAt: string;
	resolvedAt?: string;
}

interface ContradictionFinding extends DocsFinding {
	finding_id: string;
	source_paths: string[];
}

/**
 * Load and validate the docs-gate policy from contract.
 * Returns undefined if policy is missing or invalid.
 */
function loadValidatedContract(
	repoRoot: string,
	contractPath: string,
): { loaded?: LoadedContract; error?: string } {
	const resolvedPath = resolve(repoRoot, contractPath);
	if (!existsSync(resolvedPath)) {
		return { error: `Contract file not found: ${contractPath}` };
	}

	try {
		const raw = readFileSync(resolvedPath, "utf-8");
		const parsed = JSON.parse(raw) as unknown;
		const validation = validateContract(parsed);

		if (!validation.success) {
			const errorMessage = validation.errors
				.map((e) => `${e.path}: ${e.message}`)
				.join("; ");
			return { error: `Contract validation failed: ${errorMessage}` };
		}

		const contractData = validation.data;
		if (!contractData) {
			return { error: "Contract validation returned no data" };
		}
		return { loaded: { contract: contractData } };
	} catch (error) {
		return { error: `Failed to load contract: ${sanitizeError(error)}` };
	}
}

function loadFileIfPresent(path: string): string | null {
	if (!existsSync(path)) {
		return null;
	}
	return readFileSync(path, "utf-8");
}

function inferExpectedPackageManager(
	contract: HarnessContract,
	repoRoot: string,
): string | null {
	const packageManagerFromContract =
		contract.packageManagerPolicy?.requiredManager;
	if (packageManagerFromContract) {
		return packageManagerFromContract;
	}

	const packageJsonRaw = loadFileIfPresent(join(repoRoot, PACKAGE_JSON_PATH));
	if (!packageJsonRaw) {
		return null;
	}

	try {
		const packageJson = JSON.parse(packageJsonRaw) as {
			packageManager?: string;
		};
		if (typeof packageJson.packageManager === "string") {
			return packageJson.packageManager.split("@")[0] ?? null;
		}
	} catch {
		return null;
	}

	return null;
}

function extractCommandManagers(content: string): string[] {
	const managers = new Set<string>();
	for (const line of content.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) {
			continue;
		}
		const matches = trimmed.match(
			/\b(pnpm|npm|yarn)\b(?=\s+(?:install|run|exec|test|lint|typecheck|check|audit|build|add))/g,
		);
		if (!matches) {
			continue;
		}
		for (const match of matches) {
			managers.add(match);
		}
	}
	return Array.from(managers);
}

function parseWorkflowCheckNames(repoRoot: string): Set<string> {
	const workflowPath = join(repoRoot, WORKFLOW_PATH);
	const content = loadFileIfPresent(workflowPath);
	if (!content) {
		return new Set();
	}

	const checks = new Set<string>();
	for (const line of content.split(/\r?\n/)) {
		const match = line.match(/^ {2}[a-z0-9_-]+:\s*$/i);
		if (match) {
			continue;
		}
		const nameMatch = line.match(/^ {4}name:\s*(.+?)\s*$/);
		if (nameMatch?.[1]) {
			checks.add(nameMatch[1].trim().replace(/^['"]|['"]$/g, ""));
		}
	}
	return checks;
}

function buildFindingId(
	category: ContextContradictionCategory,
	surface: string,
	message: string,
): string {
	return createHash("sha256")
		.update(`${category}\n${surface}\n${message}`)
		.digest("hex")
		.slice(0, 16);
}

function resolveContradictionSeverity(
	policy: ContextIntegrityPolicy | undefined,
	category: ContextContradictionCategory,
): DocsSeverity {
	return (
		policy?.contradictionCatalog.find((entry) => entry.category === category)
			?.severity ?? "error"
	);
}

function collectContradictionFindings(
	repoRoot: string,
	contract: HarnessContract,
	mode: DocsGateMode,
): ContradictionFinding[] {
	const findings: ContradictionFinding[] = [];
	const contextIntegrityPolicy = contract.contextIntegrityPolicy;

	for (const source of contextIntegrityPolicy?.truthSources ?? []) {
		if (source.required && !existsSync(join(repoRoot, source.path))) {
			const message = `Required truth source '${source.path}' is missing`;
			findings.push({
				finding_id: buildFindingId(
					"source_truth_missing",
					source.path,
					message,
				),
				rule_id: "context-integrity.source_truth_missing",
				category: "source_truth_missing",
				surface: source.path,
				rule_result: "fail",
				result: "fail",
				severity: resolveContradictionSeverity(
					contextIntegrityPolicy,
					"source_truth_missing",
				),
				message,
				path: source.path,
				source_paths: [source.path],
			});
		}
	}

	const expectedPackageManager = inferExpectedPackageManager(
		contract,
		repoRoot,
	);
	if (expectedPackageManager) {
		for (const sourcePath of [
			"README.md",
			"AGENTS.md",
			"CLAUDE.md",
			"CONTRIBUTING.md",
		]) {
			const content = loadFileIfPresent(join(repoRoot, sourcePath));
			if (!content) {
				continue;
			}
			const managers = extractCommandManagers(content).filter(
				(manager) => manager !== expectedPackageManager,
			);
			if (managers.length === 0) {
				continue;
			}
			const unexpectedManagers = Array.from(new Set(managers)).sort();
			const message = `Canonical command guidance uses ${unexpectedManagers.join(", ")} but package manager contract requires ${expectedPackageManager}`;
			findings.push({
				finding_id: buildFindingId(
					"command_contract_conflict",
					sourcePath,
					message,
				),
				rule_id: "context-integrity.command_contract_conflict",
				category: "command_contract_conflict",
				surface: sourcePath,
				rule_result: "fail",
				result: "fail",
				severity:
					mode === "required"
						? resolveContradictionSeverity(
								contextIntegrityPolicy,
								"command_contract_conflict",
							)
						: "warning",
				message,
				path: sourcePath,
				source_paths: [sourcePath, PACKAGE_JSON_PATH],
			});
		}
	}

	const requiredChecks = contract.branchProtection?.requiredChecks ?? [];
	if (requiredChecks.length > 0) {
		const workflowChecks = parseWorkflowCheckNames(repoRoot);
		const missingChecks = requiredChecks.filter(
			(check) =>
				!NON_WORKFLOW_REQUIRED_CHECKS.has(check) && !workflowChecks.has(check),
		);
		if (missingChecks.length > 0) {
			const message = `Workflow is missing required checks: ${missingChecks.join(", ")}`;
			findings.push({
				finding_id: buildFindingId(
					"required_check_conflict",
					WORKFLOW_PATH,
					message,
				),
				rule_id: "context-integrity.required_check_conflict",
				category: "required_check_conflict",
				surface: WORKFLOW_PATH,
				rule_result: "fail",
				result: "fail",
				severity:
					mode === "required"
						? resolveContradictionSeverity(
								contextIntegrityPolicy,
								"required_check_conflict",
							)
						: "warning",
				message,
				path: WORKFLOW_PATH,
				source_paths: [WORKFLOW_PATH, CONTRACT_PATH],
				details: `Missing workflow checks: ${missingChecks.join(", ")}`,
			});
		}
	}

	return findings;
}

function loadOpenContradictions(
	repoRoot: string,
): Map<string, ContradictionRecord> {
	const historyPath = join(repoRoot, CONTRADICTION_HISTORY_PATH);
	const history = new Map<string, ContradictionRecord>();
	const content = loadFileIfPresent(historyPath);
	if (!content) {
		return history;
	}

	for (const line of content.split(/\r?\n/)) {
		if (!line.trim()) {
			continue;
		}
		try {
			const entry = JSON.parse(line) as ContradictionRecord;
			history.set(entry.findingId, entry);
		} catch {
			// Ignore malformed history rows so a single bad line does not hide valid contradictions.
		}
	}

	return history;
}

function appendContradictionHistory(
	repoRoot: string,
	findings: ContradictionFinding[],
): void {
	const historyPath = validatePath(repoRoot, CONTRADICTION_HISTORY_PATH);
	const existing = loadOpenContradictions(repoRoot);
	const timestamp = new Date().toISOString();
	const currentIds = new Set(findings.map((finding) => finding.finding_id));
	const appendEntries: ContradictionRecord[] = [];

	for (const finding of findings) {
		const previous = existing.get(finding.finding_id);
		if (previous?.status === "open") {
			continue;
		}
		appendEntries.push({
			findingId: finding.finding_id,
			category: finding.category as ContextContradictionCategory,
			status: "open",
			message: finding.message,
			sourcePaths: finding.source_paths,
			detectedAt: timestamp,
		});
	}

	for (const [findingId, previous] of existing.entries()) {
		if (previous.status !== "open" || currentIds.has(findingId)) {
			continue;
		}
		appendEntries.push({
			...previous,
			status: "resolved",
			resolvedAt: timestamp,
		});
	}

	if (appendEntries.length === 0) {
		return;
	}

	mkdirSync(dirname(historyPath), { recursive: true });
	const existingContent = loadFileIfPresent(historyPath) ?? "";
	const serializedEntries = appendEntries
		.map((entry) => JSON.stringify(entry))
		.join("\n");
	const output = existingContent
		? `${existingContent.trimEnd()}\n${serializedEntries}\n`
		: `${serializedEntries}\n`;
	writeFileSync(historyPath, output, "utf-8");
}

/**
 * Classify changed files into impact categories.
 * v1: Simple path-based classification.
 */
function classifyChanges(
	changedFiles: string[],
	_repoRoot: string,
): { categories: DocsImpactCategory[]; unknownFiles: string[] } {
	const categories = new Set<DocsImpactCategory>();
	const unknownFiles: string[] = [];

	// Governance-sensitive path prefixes that should trigger unknown_governance_change
	// These are paths where an unmatched file might still be governance-relevant
	const governancePrefixes = [
		".github/workflows/",
		".github/policy/",
		"harness.",
		"scripts/setup",
		"scripts/init",
		".codex/environments/",
		"AI/diagrams/",
		"AI/context/",
		".diagram/",
		"ops/",
	];
	const workflowAuthorityDocs = new Set([
		"docs/agents/01-instruction-map.md",
		"docs/agents/04-validation.md",
		"docs/agents/08-release-and-change-control.md",
		"docs/agents/10-agent-testing-gates.md",
		"docs/agents/13-linear-production-workflow.md",
		"docs/agents/14-docs-gate-rollout.md",
		"docs/agents/15-context-integrity-compact.md",
		"docs/agents/16-linear-production-compact.md",
	]);

	for (const file of changedFiles) {
		let matched = false;

		// CLI surface changes
		if (
			file.startsWith("src/cli.") ||
			file.startsWith("src/lib/cli/") ||
			file.includes("command-registry")
		) {
			categories.add("cli_surface");
			matched = true;
		}

		// Contract policy changes
		if (
			file === "harness.contract.json" ||
			file.includes("src/lib/contract/")
		) {
			categories.add("contract_policy");
			matched = true;
		}

		// CI workflow changes
		if (file.startsWith(".github/workflows/")) {
			categories.add("ci_workflow");
			matched = true;
		}

		// Required checks / branch protection changes
		if (file.includes("required-checks") || file.includes("branch-protect")) {
			categories.add("branch_protection_or_required_checks");
			matched = true;
		}

		// Init scaffolding changes
		if (file.startsWith("src/commands/init.") || file.includes("template")) {
			categories.add("init_scaffolding");
			matched = true;
		}

		// Tooling/runtime policy and local hook changes
		if (
			file === "Makefile" ||
			file === ".mise.toml" ||
			file === "prek.toml" ||
			file === ".codex/environments/environment.toml" ||
			file.startsWith("scripts/check-environment") ||
			file.startsWith("scripts/setup-git-hooks") ||
			file.includes("tooling-baseline") ||
			file.startsWith("src/commands/tooling-audit.") ||
			file.startsWith("src/commands/check-environment.")
		) {
			categories.add("tooling_runtime");
			matched = true;
		}

		// Diagram and architecture context changes
		if (
			file.startsWith("AI/diagrams/") ||
			file.startsWith("AI/context/") ||
			file.startsWith(".diagram/") ||
			file.startsWith("scripts/refresh-diagram-context") ||
			file.startsWith("scripts/check-diagram-freshness") ||
			file.startsWith("docs/architecture/")
		) {
			categories.add("architecture_context");
			matched = true;
		}

		// Workflow-authoritative routing and compact runbooks
		if (workflowAuthorityDocs.has(file)) {
			categories.add("workflow_authority");
			matched = true;
		}

		// Compound workflow artifacts
		if (file.startsWith("docs/adr/")) {
			categories.add("adr_artifact");
			matched = true;
		}

		if (file.startsWith("docs/specs/")) {
			categories.add("spec_artifact");
			matched = true;
		}

		if (file.startsWith("docs/plans/")) {
			categories.add("plan_artifact");
			matched = true;
		}

		if (file.startsWith("docs/brainstorms/")) {
			categories.add("brainstorm_artifact");
			matched = true;
		}

		// Agent governance changes
		if (
			file === "AGENTS.md" ||
			(file.startsWith("docs/agents/") && !workflowAuthorityDocs.has(file)) ||
			file.includes("agent-governance")
		) {
			categories.add("agent_governance");
			matched = true;
		}

		// Doc-only changes (governance docs)
		if (
			file.endsWith(".md") &&
			(file === "README.md" ||
				file === "CONTRIBUTING.md" ||
				file.startsWith("docs/"))
		) {
			categories.add("doc_only");
			matched = true;
		}

		if (!matched) {
			// Only mark as unknown if it looks like it might be governance-relevant
			const mightBeGovernance = governancePrefixes.some((prefix) =>
				file.startsWith(prefix),
			);
			if (mightBeGovernance) {
				unknownFiles.push(file);
			}
		}
	}

	// Only add unknown_governance_change if there are unknown files AND no specific categories matched
	// This prevents files that were already categorized from also triggering unknown findings
	if (unknownFiles.length > 0 && categories.size === 0) {
		categories.add("unknown_governance_change");
	}

	return {
		categories: Array.from(categories),
		unknownFiles,
	};
}

/**
 * Determine required documentation surfaces based on impact categories.
 */
function resolveRequiredSurfaces(
	categories: DocsImpactCategory[],
	policy: DocsGatePolicy,
): { surfaces: string[]; ruleFindings: DocsFinding[] } {
	const surfaces = new Set<string>();
	const ruleFindings: DocsFinding[] = [];

	for (const rule of policy.rules) {
		// Check if rule applies to any of the categories
		const applies =
			rule.when.categories?.some((cat) => categories.includes(cat)) ?? false;

		if (applies) {
			for (const doc of rule.requireDocs) {
				surfaces.add(doc);
			}
			ruleFindings.push({
				rule_id: rule.ruleId,
				category: rule.when.categories?.[0] ?? "unknown_governance_change",
				surface: rule.requireDocs.join(", ") || "none",
				rule_result: "pass",
				result: "pass",
				severity: "info",
				message: `Rule '${rule.ruleId}' applies: requires ${rule.requireDocs.join(", ") || "no docs"}`,
			});
		}
	}

	return { surfaces: Array.from(surfaces), ruleFindings };
}

/**
 * Check if required surfaces are present in changed files.
 */
function checkSurfacePresence(
	requiredSurfaces: string[],
	changedFiles: string[],
	policy: DocsGatePolicy,
): { present: string[]; missing: string[]; findings: DocsFinding[] } {
	const present: string[] = [];
	const missing: string[] = [];
	const findings: DocsFinding[] = [];

	for (const surface of requiredSurfaces) {
		const isDirectorySurface = surface.endsWith("/");
		const isChanged = changedFiles.some((f) =>
			isDirectorySurface
				? f.startsWith(surface)
				: f === surface || f.endsWith(`/${surface}`),
		);

		if (isChanged) {
			present.push(surface);
			findings.push({
				rule_id: "docs.surface.present",
				category: "system",
				surface,
				rule_result: "pass",
				result: "pass",
				severity: "info",
				message: `Required documentation surface '${surface}' was updated`,
				path: surface,
			});
		} else {
			missing.push(surface);
			findings.push({
				rule_id: "docs.surface.missing",
				category: "system",
				surface,
				rule_result: "fail",
				result: "fail",
				severity: policy.mode === "required" ? "error" : "warning",
				message: `Required documentation surface '${surface}' was not updated for this change`,
				path: surface,
			});
		}
	}

	return { present, missing, findings };
}

/**
 * Build execution context based on options and environment.
 */
function buildExecutionContext(
	options: DocsGateOptions,
	policy?: DocsGatePolicy,
): DocsGateExecutionContext {
	const trigger = options.trigger ?? "local";
	const policyMode = policy?.mode ?? options.mode ?? "advisory";

	// Merge authoritative: CI contexts are authoritative for merge
	const mergeAuthoritative =
		trigger === "pull_request" || trigger === "merge_group";

	// Bootstrap state detection
	let bootstrapState: "fully_wired" | "shadow_only" | "missing_wiring" =
		"fully_wired";
	if (!policy) {
		bootstrapState = "missing_wiring";
	} else if (policy.mode === "advisory") {
		bootstrapState = "shadow_only";
	}

	return {
		trigger,
		policyMode,
		mergeAuthoritative,
		trustedBaseAvailable: !!options.trustedBaseRef,
		trustedBaseRef: options.trustedBaseRef,
		trustedContractSha: options.trustedContractSha,
		trustedWorkflowSha: options.trustedWorkflowSha,
		evaluatedSha: undefined, // Would be populated from git in full implementation
		mergeQueueTargetRef: options.mergeQueueTargetRef,
		mergeQueueBaseSha: options.mergeQueueBaseSha,
		bootstrapState,
		changedFilesSource: options.changedFiles ? "explicit_flag" : "git_diff",
		outputRoot: "artifacts/consistency-gate",
	};
}

/**
 * Run the docs-gate evaluation.
 */
export function runDocsGate(options: DocsGateOptions = {}): DocsGateResult {
	const mode: DocsGateMode = options.mode ?? "advisory";
	const repoRoot = resolve(options.repoRoot ?? process.cwd());
	const changedFiles = options.changedFiles ?? [];

	// Initialize with defaults
	let outcome: DocsGateOutcome = "ok";
	const errorClass: DocsGateErrorClass = "none";
	let status: DocsGateStatus = "success";
	const findings: DocsFinding[] = [];

	// Load policy from contract
	const contractResult = loadValidatedContract(repoRoot, CONTRACT_PATH);
	const contract = contractResult.loaded?.contract;
	const policy = contract?.docsGatePolicy;

	// Build execution context
	const executionContext = buildExecutionContext(options, policy);

	// Handle bootstrap gap
	if (contractResult.error || !contract || !policy) {
		outcome = "bootstrap_gap";
		if (mode === "required") {
			status = "blocked";
		} else {
			status = "partial";
		}
		findings.push({
			rule_id: "docs.gate.bootstrap_gap",
			category: "system",
			surface: "docsGatePolicy",
			rule_result: "error",
			result: "error",
			severity: mode === "required" ? "error" : "warning",
			message:
				contractResult.error ?? "docsGatePolicy is missing from contract",
			details:
				"Add docsGatePolicy to harness.contract.json, run 'harness upgrade --dry-run' for the safe upgrade path, or use 'harness init --update' when tracked baseline files must be re-scaffolded",
		});

		const report: DocsGateReport = {
			schemaVersion: "1.0.0",
			command: "docs-gate",
			mode,
			status,
			outcome,
			error_class: errorClass,
			generated_at: new Date().toISOString(),
			repo_root: repoRoot,
			base_ref: undefined,
			execution_context: executionContext,
			changed_files: changedFiles,
			categories: [],
			summary: {
				finding_count: findings.length,
				error_count: findings.filter((f) => f.severity === "error").length,
				warning_count: findings.filter((f) => f.severity === "warning").length,
				required_surface_count: 0,
				missing_surface_count: 0,
				contradiction_count: 0,
				bootstrap_gap_count: 1,
				unknown_category_count: 0,
			},
			findings,
		};

		// Write stub report
		const outPath = options.outPath ?? DEFAULT_OUT_PATH;
		try {
			const resolvedOutPath = validatePath(repoRoot, outPath);
			mkdirSync(dirname(resolvedOutPath), { recursive: true });
			writeFileSync(
				resolvedOutPath,
				`${JSON.stringify(report, null, 2)}\n`,
				"utf-8",
			);
		} catch (_error) {
			// Warn instead of silently swallowing: we're already in an error
			// state but a missing artifact can cause confusing CI behaviour.
			console.warn(
				`[docs-gate] Warning: failed to write stub report to '${options.outPath ?? DEFAULT_OUT_PATH}': ${_error instanceof Error ? _error.message : String(_error)}`,
			);
		}

		const exitCode = mode === "required" ? 11 : 0; // 11 = bootstrap_gap
		return { report, exitCode };
	}

	// Skip if disabled
	if (!policy.enabled) {
		findings.push({
			rule_id: "docs.gate.disabled",
			category: "system",
			surface: "docsGatePolicy",
			rule_result: "not_applicable",
			result: "not_applicable",
			severity: "info",
			message: "docs-gate is disabled in contract policy",
		});

		const report: DocsGateReport = {
			schemaVersion: "1.0.0",
			command: "docs-gate",
			mode,
			status: "success",
			outcome: "ok",
			error_class: "none",
			generated_at: new Date().toISOString(),
			repo_root: repoRoot,
			base_ref: undefined,
			execution_context: executionContext,
			changed_files: changedFiles,
			categories: [],
			summary: {
				finding_count: 0,
				error_count: 0,
				warning_count: 0,
				required_surface_count: 0,
				missing_surface_count: 0,
				contradiction_count: 0,
				bootstrap_gap_count: 0,
				unknown_category_count: 0,
			},
			findings,
		};

		return { report, exitCode: 0 };
	}

	// Classify changes
	const { categories, unknownFiles } = classifyChanges(changedFiles, repoRoot);

	// Add findings for unknown governance changes
	if (unknownFiles.length > 0) {
		outcome = "drift_detected";
		findings.push({
			rule_id: "docs.gate.unknown_governance_change",
			category: "unknown_governance_change",
			surface: "unknown",
			rule_result: "fail",
			result: "fail",
			severity: mode === "required" ? "error" : "warning",
			message: `Files changed without clear governance category: ${unknownFiles.join(", ")}`,
			details:
				"These files may require documentation updates but no rule covers them yet",
		});
	}

	// Resolve required surfaces
	const { surfaces: requiredSurfaces, ruleFindings } = resolveRequiredSurfaces(
		categories,
		policy,
	);
	findings.push(...ruleFindings);

	// Check surface presence
	const { missing, findings: presenceFindings } = checkSurfacePresence(
		requiredSurfaces,
		changedFiles,
		policy,
	);
	findings.push(...presenceFindings);

	if (missing.length > 0) {
		outcome = "drift_detected";
	}

	const contradictionFindings = collectContradictionFindings(
		repoRoot,
		contract,
		mode,
	);
	findings.push(...contradictionFindings);
	if (
		contradictionFindings.some(
			(finding) => finding.category === "source_truth_missing",
		)
	) {
		outcome = "policy_error";
	} else if (
		contradictionFindings.some(
			(finding) => finding.category === "required_check_conflict",
		)
	) {
		outcome = "trust_mismatch";
	} else if (contradictionFindings.length > 0) {
		outcome = "drift_detected";
	}

	// Determine status
	const errorCount = findings.filter((f) => f.severity === "error").length;
	const warningCount = findings.filter((f) => f.severity === "warning").length;

	if (errorCount > 0) {
		status = mode === "required" ? "blocked" : "partial";
	} else if (warningCount > 0) {
		status = "partial";
	}

	// Build report
	const report: DocsGateReport = {
		schemaVersion: "1.0.0",
		command: "docs-gate",
		mode,
		status,
		outcome,
		error_class: errorClass,
		generated_at: new Date().toISOString(),
		repo_root: repoRoot,
		base_ref: options.trustedBaseRef,
		execution_context: executionContext,
		changed_files: changedFiles,
		categories,
		summary: {
			finding_count: findings.length,
			error_count: errorCount,
			warning_count: warningCount,
			required_surface_count: requiredSurfaces.length,
			missing_surface_count: missing.length,
			contradiction_count: contradictionFindings.length,
			bootstrap_gap_count: 0,
			unknown_category_count: unknownFiles.length,
		},
		findings,
	};

	// Write report
	const outPath = options.outPath ?? DEFAULT_OUT_PATH;
	try {
		const resolvedOutPath = validatePath(repoRoot, outPath);
		mkdirSync(dirname(resolvedOutPath), { recursive: true });
		writeFileSync(
			resolvedOutPath,
			`${JSON.stringify(report, null, 2)}\n`,
			"utf-8",
		);
		appendContradictionHistory(repoRoot, contradictionFindings);
	} catch (error) {
		report.outcome = "runtime_error";
		report.error_class = "io";
		report.status = "blocked";
		findings.push({
			rule_id: "report.output.write_error",
			category: "system",
			surface: "report",
			rule_result: "error",
			result: "error",
			severity: "error",
			message: `Failed to write report output: ${sanitizeError(error)}`,
			path: outPath,
		});
		report.summary.finding_count = findings.length;
		report.summary.error_count = findings.filter(
			(f) => f.severity === "error",
		).length;
	}

	// Exit codes per spec
	let exitCode = 0;
	if (report.outcome === "drift_detected") {
		// drift_detected: fail in required mode; pass with artifact in advisory mode
		exitCode = mode === "required" ? 10 : 0;
	} else if (report.outcome === "bootstrap_gap") exitCode = 11;
	else if (report.outcome === "trust_mismatch") exitCode = 12;
	else if (report.outcome === "policy_error") exitCode = 13;
	else if (report.outcome === "runtime_error") exitCode = 14;

	return { report, exitCode };
}

/**
 * CLI entry point for docs-gate.
 */
export function runDocsGateCLI(options: DocsGateOptions = {}): number {
	const result = runDocsGate(options);

	if (options.json) {
		const gateResult = normaliseDocsGateResult(result);
		process.stdout.write(`${JSON.stringify(gateResult, null, 2)}\n`);
	} else {
		const icon =
			result.report.status === "success"
				? "✓"
				: result.report.status === "partial"
					? "⚠"
					: "✗";
		console.info(
			`${icon} docs-gate (${result.report.mode}) ${result.report.status} - ${result.report.outcome}`,
		);
		console.info(`Findings: ${result.report.summary.finding_count}`);
		console.info(
			`Surfaces: ${result.report.summary.required_surface_count} required, ${result.report.summary.missing_surface_count} missing`,
		);

		if (result.report.findings.length > 0) {
			console.info("");
			for (const finding of result.report.findings) {
				const level =
					finding.severity === "error"
						? "ERROR"
						: finding.severity === "warning"
							? "WARN"
							: "INFO";
				const suffix = finding.path ? ` (${finding.path})` : "";
				console.info(
					`- [${level}] ${finding.rule_id}: ${finding.message}${suffix}`,
				);
			}
		}
	}

	return result.exitCode;
}

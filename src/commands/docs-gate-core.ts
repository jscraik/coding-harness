import { execFileSync } from "node:child_process";
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
import { DEFAULT_DOCS_GATE_POLICY } from "../lib/contract/types.js";
import { validateContract } from "../lib/contract/validator.js";
import { collectFrontmatterMetadataViolations } from "../lib/docs-surface/frontmatter-metadata-gate.js";
import { sanitizeError } from "../lib/input/sanitize.js";
import { validatePath } from "../lib/input/validator.js";
import {
	normaliseDocsGateResult,
	renderGateDecision,
} from "../lib/output/normalise.js";
import { isNonWorkflowRequiredCheck } from "../lib/policy/required-checks.js";

/** Docs Gate Mode. */
export type DocsGateMode = "advisory" | "required";
/** Docs Gate Trigger. */
export type DocsGateTrigger =
	| "local"
	| "pull_request"
	| "merge_group"
	| "manual_ci";
/** Docs Gate Status. */
export type DocsGateStatus = "success" | "partial" | "blocked";
/** Docs Gate Outcome. */
export type DocsGateOutcome =
	| "ok"
	| "drift_detected"
	| "bootstrap_gap"
	| "trust_mismatch"
	| "policy_error"
	| "runtime_error";
/** Docs Gate Error Class. */
export type DocsGateErrorClass =
	| "none"
	| "io"
	| "schema"
	| "runtime"
	| "trust_loading";
/** Docs Rule Result. */
export type DocsRuleResult = "pass" | "fail" | "not_applicable" | "error";
/** Docs Severity. */
export type DocsSeverity = "info" | "warning" | "error";

/** Docs Gate Options. */
export interface DocsGateOptions {
	mode?: DocsGateMode;
	trigger?: DocsGateTrigger;
	json?: boolean;
	outPath?: string;
	changedFiles?: string[];
	deletedFiles?: string[];
	repoRoot?: string;
	trustedBaseRef?: string;
	trustedContractSha?: string;
	trustedWorkflowSha?: string;
	mergeQueueTargetRef?: string;
	mergeQueueBaseSha?: string;
}

/** Docs Finding. */
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

/** Docs Gate Execution Context. */
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

/** Docs Gate Report. */
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

/** Docs Gate Result. */
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
const INSTRUCTION_PRECEDENCE_SOURCE_PATHS = [
	"AGENTS.md",
	"README.md",
	"CONTRIBUTING.md",
] as const;
const WORKFLOW_AUTHORITY_DOC_PATHS = Array.from(
	new Set(
		(DEFAULT_DOCS_GATE_POLICY.surfaces ?? [])
			.filter((surface) => surface.requiredFor.includes("workflow_authority"))
			.map((surface) => surface.path)
			.filter((path) => path.endsWith(".md")),
	),
);
const WORKFLOW_POLICY_ADDITIONAL_SOURCE_PATHS = [
	"docs/agents/17-ci-required-checks.md",
] as const;
const WORKFLOW_POLICY_SOURCE_PATHS: readonly string[] = Array.from(
	new Set([
		...INSTRUCTION_PRECEDENCE_SOURCE_PATHS,
		...WORKFLOW_AUTHORITY_DOC_PATHS,
		...WORKFLOW_POLICY_ADDITIONAL_SOURCE_PATHS,
	]),
);
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

interface ChangedFilesResolution {
	changedFiles: string[];
	deletedFiles: string[];
	source: DocsGateExecutionContext["changedFilesSource"];
	error?: string;
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

function extractDeclaredPathToken(value: string): string | undefined {
	const markdownLinkMatch = value.match(/\[[^\]]+\]\(([^)]+)\)/);
	const backtickMatch = value.match(/`([^`]+)`/);
	const token =
		markdownLinkMatch?.[1] ??
		backtickMatch?.[1] ??
		value.match(
			/(?:^|\s)(?:~\/|\.{1,2}\/|\/)?[A-Za-z0-9._/-]+(?:\.md)?(?:#\w[\w-]*)?(?=$|[\s),.;])/,
		)?.[0];
	if (!token) {
		return undefined;
	}
	const normalized = token
		.trim()
		.replace(/^<|>$/g, "")
		.replace(/^[\s(]+|[\s).,;]+$/g, "")
		.replace(/^\.\/+/, "")
		.replace(/#.*$/, "");
	return normalized.length > 0 ? normalized : undefined;
}

function extractDiscoveryFirstSource(content: string): string | undefined {
	const headingMatch = content.match(
		/(?:^|\n)#{1,6}\s*codex discovery order\b[^\n]*\n([\s\S]*?)(?=\n#{1,6}\s|$)/i,
	);
	const sectionBody = headingMatch?.[1];
	if (sectionBody) {
		for (const line of sectionBody.split(/\r?\n/)) {
			const firstStepMatch = line.match(/^\s*1\.\s+(.+)$/);
			if (!firstStepMatch?.[1]) {
				continue;
			}
			const declaredPath = extractDeclaredPathToken(firstStepMatch[1]);
			if (declaredPath) {
				return declaredPath;
			}
		}
	}

	for (const line of content.split(/\r?\n/)) {
		const readFirstMatch = line.match(
			/\b(?:read|open|follow)\s+(.+?)\s+first\b/i,
		);
		if (!readFirstMatch?.[1]) {
			continue;
		}
		const declaredPath = extractDeclaredPathToken(readFirstMatch[1]);
		if (declaredPath) {
			return declaredPath;
		}
	}
	return undefined;
}

function normalizeProviderToken(value: string): string | undefined {
	const normalized = value.trim().toLowerCase();
	if (normalized.length === 0) {
		return undefined;
	}
	if (
		normalized === "github-actions" ||
		normalized === "github actions" ||
		normalized === "github"
	) {
		return "github-actions";
	}
	if (normalized === "circleci" || normalized === "circle ci") {
		return "circleci";
	}
	return normalized;
}

function extractDeclaredActiveProvider(content: string): string | undefined {
	for (const line of content.split(/\r?\n/)) {
		const normalizedLine = line.trim();
		if (normalizedLine.length === 0 || normalizedLine.startsWith("#")) {
			continue;
		}
		const match = normalizedLine.match(
			/(?:^|[{\s])(?:"(?:activeprovider|active(?:\s+ci)?\s+provider)"|\b(?:active(?:\s+ci)?\s+provider|activeprovider)\b)\s*(?::|=|is)\s*(?:["'`])?([a-z0-9 _-]+)(?:["'`])?/i,
		);
		if (!match?.[1]) {
			continue;
		}
		const provider = normalizeProviderToken(match[1]);
		if (provider) {
			return provider;
		}
	}
	return undefined;
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
	const activeProvider = contract.ciProviderPolicy?.activeProvider;

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
		for (const sourcePath of ["README.md", "AGENTS.md", "CONTRIBUTING.md"]) {
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
	if (requiredChecks.length > 0 && activeProvider !== "circleci") {
		const workflowChecks = parseWorkflowCheckNames(repoRoot);
		const missingChecks = requiredChecks.filter(
			(check) =>
				!isNonWorkflowRequiredCheck(check) && !workflowChecks.has(check),
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

	const precedenceDeclarations = INSTRUCTION_PRECEDENCE_SOURCE_PATHS.flatMap(
		(sourcePath) => {
			const content = loadFileIfPresent(join(repoRoot, sourcePath));
			if (!content) {
				return [];
			}
			const firstSource = extractDiscoveryFirstSource(content);
			if (!firstSource) {
				return [];
			}
			return [{ sourcePath, firstSource }];
		},
	);
	const uniqueFirstSources = Array.from(
		new Set(precedenceDeclarations.map((entry) => entry.firstSource)),
	);
	if (uniqueFirstSources.length > 1) {
		const sourcePaths = precedenceDeclarations.map((entry) => entry.sourcePath);
		const declarationSummary = precedenceDeclarations
			.map((entry) => `${entry.sourcePath} -> ${entry.firstSource}`)
			.join("; ");
		for (const declaration of precedenceDeclarations) {
			const message = `Instruction precedence conflict: canonical docs disagree on first discovery source (${declarationSummary})`;
			findings.push({
				finding_id: buildFindingId(
					"instruction_precedence_conflict",
					declaration.sourcePath,
					message,
				),
				rule_id: "context-integrity.instruction_precedence_conflict",
				category: "instruction_precedence_conflict",
				surface: declaration.sourcePath,
				rule_result: "fail",
				result: "fail",
				severity:
					mode === "required"
						? resolveContradictionSeverity(
								contextIntegrityPolicy,
								"instruction_precedence_conflict",
							)
						: "warning",
				message,
				path: declaration.sourcePath,
				source_paths: sourcePaths,
			});
		}
	}

	const providerDeclarations = WORKFLOW_POLICY_SOURCE_PATHS.flatMap(
		(sourcePath) => {
			const content = loadFileIfPresent(join(repoRoot, sourcePath));
			if (!content) {
				return [];
			}
			const provider = extractDeclaredActiveProvider(content);
			if (!provider) {
				return [];
			}
			return [{ sourcePath, provider }];
		},
	);
	const uniqueDeclaredProviders = Array.from(
		new Set(providerDeclarations.map((entry) => entry.provider)),
	);
	const interDocConflictPaths = new Set<string>();
	if (uniqueDeclaredProviders.length > 1) {
		const sourcePaths = providerDeclarations.map((entry) => entry.sourcePath);
		for (const sourcePath of sourcePaths) {
			interDocConflictPaths.add(sourcePath);
		}
		const summary = providerDeclarations
			.map((entry) => `${entry.sourcePath} -> ${entry.provider}`)
			.join("; ");
		const message = `Workflow policy conflict: docs declare inconsistent active providers (${summary})`;
		findings.push({
			finding_id: buildFindingId(
				"workflow_policy_conflict",
				sourcePaths.join(","),
				message,
			),
			rule_id: "context-integrity.workflow_policy_conflict",
			category: "workflow_policy_conflict",
			surface: sourcePaths[0] ?? "docs/agents",
			rule_result: "fail",
			result: "fail",
			severity:
				mode === "required"
					? resolveContradictionSeverity(
							contextIntegrityPolicy,
							"workflow_policy_conflict",
						)
					: "warning",
			message,
			...(sourcePaths[0] ? { path: sourcePaths[0] } : {}),
			source_paths: sourcePaths,
		});
	}

	const normalizedActiveProvider =
		typeof activeProvider === "string"
			? normalizeProviderToken(activeProvider)
			: undefined;
	if (normalizedActiveProvider) {
		for (const declaration of providerDeclarations) {
			if (interDocConflictPaths.has(declaration.sourcePath)) {
				continue;
			}
			if (declaration.provider === normalizedActiveProvider) {
				continue;
			}
			const message = `Workflow policy conflict: ${declaration.sourcePath} declares active provider '${declaration.provider}' but contract requires '${normalizedActiveProvider}'`;
			findings.push({
				finding_id: buildFindingId(
					"workflow_policy_conflict",
					declaration.sourcePath,
					message,
				),
				rule_id: "context-integrity.workflow_policy_conflict",
				category: "workflow_policy_conflict",
				surface: declaration.sourcePath,
				rule_result: "fail",
				result: "fail",
				severity:
					mode === "required"
						? resolveContradictionSeverity(
								contextIntegrityPolicy,
								"workflow_policy_conflict",
							)
						: "warning",
				message,
				path: declaration.sourcePath,
				source_paths: [declaration.sourcePath, CONTRACT_PATH],
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
	const workflowAuthorityDocs = new Set(
		WORKFLOW_POLICY_SOURCE_PATHS.filter((path) =>
			path.startsWith("docs/agents/"),
		),
	);

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
	deletedFiles: Set<string>,
): { present: string[]; missing: string[]; findings: DocsFinding[] } {
	const present: string[] = [];
	const missing: string[] = [];
	const findings: DocsFinding[] = [];

	for (const surface of requiredSurfaces) {
		const isDirectorySurface = surface.endsWith("/");
		const matchingChangedFiles = changedFiles.filter((f) =>
			isDirectorySurface
				? f.startsWith(surface)
				: f === surface || f.endsWith(`/${surface}`),
		);
		const isChanged = matchingChangedFiles.some(
			(filePath) => !deletedFiles.has(filePath),
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
 * Constructs the runtime execution context used during gate evaluation.
 *
 * The context encodes chosen trigger, resolved policy mode, merge-authoritative
 * status, bootstrap wiring state, sources for changed-files, trusted refs, and
 * output paths/identifiers used by the evaluation.
 *
 * @param options - Invocation options and environment hints that influence the context (e.g., trigger, trusted refs, changedFiles).
 * @param policy - Optional loaded docs-gate policy whose presence and `mode` affect bootstrap state and the effective policy mode.
 * @returns The assembled DocsGateExecutionContext with fields such as `trigger`, `policyMode`, `mergeAuthoritative`, `bootstrapState`, `changedFilesSource`, trusted refs, and `outputRoot`.
 */
function buildExecutionContext(
	options: DocsGateOptions,
	policy?: DocsGatePolicy,
	changedFilesSource: DocsGateExecutionContext["changedFilesSource"] = "git_diff",
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
		changedFilesSource,
		outputRoot: "artifacts/consistency-gate",
	};
}

function parseGitFileList(output: string): string[] {
	return output
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
}

function parseGitNameStatus(output: string): {
	changedFiles: string[];
	deletedFiles: string[];
} {
	const changedFiles: string[] = [];
	const deletedFiles = new Set<string>();

	for (const line of output.split(/\r?\n/)) {
		if (line.trim().length === 0) {
			continue;
		}
		const fields = line.split("\t");
		const statusField = fields[0]?.trim() ?? "";
		const status = statusField[0] ?? "";
		let filePath = "";

		if ((status === "R" || status === "C") && fields.length >= 3) {
			filePath = fields[2]?.trim() ?? "";
		} else if (fields.length >= 2) {
			filePath = fields[1]?.trim() ?? "";
		}

		if (filePath.length === 0) {
			continue;
		}

		changedFiles.push(filePath);
		if (status === "D") {
			deletedFiles.add(filePath);
		}
	}

	return { changedFiles, deletedFiles: [...deletedFiles] };
}

function resolveChangedFiles(
	options: DocsGateOptions,
	repoRoot: string,
): ChangedFilesResolution {
	if (options.changedFiles) {
		return {
			changedFiles: options.changedFiles,
			deletedFiles: options.deletedFiles ?? [],
			source: "explicit_flag",
		};
	}

	try {
		const trackedDiffArgs = [
			"-C",
			repoRoot,
			"diff",
			"--name-status",
			"--diff-filter=ACMRD",
		] as const;
		const workingTreeDiffArgs = [
			"-C",
			repoRoot,
			"diff",
			"--name-status",
			"--diff-filter=ACMRD",
		] as const;
		const stagedDiffArgs = [
			"-C",
			repoRoot,
			"diff",
			"--name-status",
			"--cached",
			"--diff-filter=ACMRD",
		] as const;
		const baseRefCandidates = [
			options.mergeQueueBaseSha,
			options.trustedBaseRef,
			"origin/main",
			"origin/master",
		].filter(
			(value): value is string =>
				typeof value === "string" && value.trim().length > 0,
		);
		let trackedOutput: string | undefined;
		for (const baseRef of baseRefCandidates) {
			try {
				const mergeBase = execFileSync(
					"git",
					["-C", repoRoot, "merge-base", baseRef, "HEAD"],
					{
						encoding: "utf-8",
						stdio: ["ignore", "pipe", "pipe"],
					},
				).trim();
				if (mergeBase.length === 0) {
					continue;
				}
				trackedOutput = execFileSync(
					"git",
					[...trackedDiffArgs, `${mergeBase}...HEAD`],
					{
						encoding: "utf-8",
						stdio: ["ignore", "pipe", "pipe"],
					},
				);
				break;
			} catch {
				// Try the next base candidate.
			}
		}
		if (trackedOutput === undefined) {
			throw new Error(
				"unable to resolve git merge-base for docs-gate; provide --trusted-base-ref or configure origin/main",
			);
		}
		const trackedFileLists = parseGitNameStatus(trackedOutput);
		let workingTreeTrackedFileLists = {
			changedFiles: [] as string[],
			deletedFiles: [] as string[],
		};
		try {
			const workingTreeOutput = execFileSync("git", workingTreeDiffArgs, {
				encoding: "utf-8",
				stdio: ["ignore", "pipe", "pipe"],
			});
			workingTreeTrackedFileLists = parseGitNameStatus(workingTreeOutput);
		} catch {
			// Keep merge-base diff results if local tracked-file discovery fails.
		}
		let stagedTrackedFileLists = {
			changedFiles: [] as string[],
			deletedFiles: [] as string[],
		};
		try {
			const stagedOutput = execFileSync("git", stagedDiffArgs, {
				encoding: "utf-8",
				stdio: ["ignore", "pipe", "pipe"],
			});
			stagedTrackedFileLists = parseGitNameStatus(stagedOutput);
		} catch {
			// Keep merge-base diff results if staged tracked-file discovery fails.
		}
		let untrackedFiles: string[] = [];
		try {
			const untrackedOutput = execFileSync(
				"git",
				["-C", repoRoot, "ls-files", "--others", "--exclude-standard"],
				{
					encoding: "utf-8",
					stdio: ["ignore", "pipe", "pipe"],
				},
			);
			untrackedFiles = parseGitFileList(untrackedOutput);
		} catch {
			// Keep tracked diff results if untracked discovery fails.
		}
		const changedFiles = [
			...new Set([
				...trackedFileLists.changedFiles,
				...workingTreeTrackedFileLists.changedFiles,
				...stagedTrackedFileLists.changedFiles,
				...untrackedFiles,
			]),
		];
		const deletedFiles = new Set<string>([
			...trackedFileLists.deletedFiles,
			...workingTreeTrackedFileLists.deletedFiles,
			...stagedTrackedFileLists.deletedFiles,
		]);
		return {
			changedFiles,
			deletedFiles: [...deletedFiles],
			source: "git_diff",
		};
	} catch (error) {
		return {
			changedFiles: [],
			deletedFiles: [],
			source: "full_repo_fallback",
			error: `Unable to resolve changed files from git history: ${sanitizeError(error)}`,
		};
	}
}

/**
 * Execute the docs-gate evaluation for the repository and produce a JSON report and an exit code.
 *
 * Performs contract/policy validation, classifies changed files, derives required documentation surfaces,
 * checks presence, collects context-integrity contradictions, writes a report artifact, and appends contradiction history when applicable.
 *
 * @param options - Optional configuration for evaluation (mode, trigger, explicit changedFiles, repo root, trusted refs, output path, and related flags).
 * @returns An object with `report` (the generated DocsGateReport) and `exitCode` (numeric code indicating the outcome).
 *          Relevant exit codes: 0 for success/advisory pass, 10 for detected drift in required mode, 11 for bootstrap gap,
 *          12 for trust mismatch, 13 for policy error, and 14 for runtime/IO errors.
 */
export function runDocsGate(options: DocsGateOptions = {}): DocsGateResult {
	const mode: DocsGateMode = options.mode ?? "advisory";
	const repoRoot = resolve(options.repoRoot ?? process.cwd());
	const changedFilesResolution = resolveChangedFiles(options, repoRoot);
	const { changedFiles } = changedFilesResolution;
	const deletedFiles = new Set(changedFilesResolution.deletedFiles);
	const hasChangedFilesResolutionError = Boolean(changedFilesResolution.error);
	const changedFilesResolutionIsBlocking =
		hasChangedFilesResolutionError && mode === "required";

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
	const executionContext = buildExecutionContext(
		options,
		policy,
		changedFilesResolution.source,
	);

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
				"Add docsGatePolicy to harness.contract.json, run 'harness upgrade --dry-run' for the safe upgrade path, or use 'harness init --update' when tracked baseline files must be re-scaffolded. For downstream repos without tracked contract surfaces, run 'harness init --track' once (or manually add docsGatePolicy defaults) before re-running docs-gate.",
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

		// Write deterministic fallback report
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
				`[docs-gate] Warning: failed to write fallback report to '${options.outPath ?? DEFAULT_OUT_PATH}': ${_error instanceof Error ? _error.message : String(_error)}`,
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

	if (changedFilesResolution.error) {
		outcome =
			mode === "required"
				? ("policy_error" as const)
				: ("drift_detected" as const);
		status = "partial";
		findings.push({
			rule_id: "docs.gate.changed_files_resolution_error",
			category: "system",
			surface: "changed_files",
			rule_result: mode === "required" ? "error" : "fail",
			result: mode === "required" ? "error" : "fail",
			severity: mode === "required" ? "error" : "warning",
			message: changedFilesResolution.error,
			details:
				"Pass --files explicitly, or run docs-gate in a git worktree where changed files can be resolved.",
		});
	}

	// Classify changes
	const { categories, unknownFiles } = classifyChanges(changedFiles, repoRoot);

	// Add findings for unknown governance changes
	if (unknownFiles.length > 0) {
		if (outcome !== "policy_error") {
			outcome = "drift_detected";
		}
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
		deletedFiles,
	);
	findings.push(...presenceFindings);

	if (missing.length > 0) {
		if (outcome !== "policy_error") {
			outcome = "drift_detected";
		}
	}

	const frontmatterMetadataFindings = collectFrontmatterMetadataViolations({
		repoRoot,
		changedFiles,
		deletedFiles,
	}).map(
		(violation): DocsFinding => ({
			rule_id: "docs.frontmatter.metadata_not_prose",
			category: "doc_only",
			surface: violation.path,
			rule_result: "fail",
			result: "fail",
			severity: mode === "required" ? "error" : "warning",
			message:
				"YAML frontmatter fields are machine-readable metadata and must not be represented as prose headings or Table of Contents entries.",
			path: violation.path,
			details: violation.fix,
			source_of_truth_ref: violation.sourceLearningId,
		}),
	);
	findings.push(...frontmatterMetadataFindings);
	if (frontmatterMetadataFindings.length > 0 && outcome !== "policy_error") {
		outcome = "drift_detected";
	}

	const contradictionFindings = collectContradictionFindings(
		repoRoot,
		contract,
		mode,
	);
	findings.push(...contradictionFindings);
	if (
		changedFilesResolutionIsBlocking ||
		contradictionFindings.some(
			(finding) => finding.category === "source_truth_missing",
		)
	) {
		outcome = "policy_error";
	} else if (
		contradictionFindings.some(
			(finding) =>
				finding.category === "required_check_conflict" ||
				finding.category === "workflow_policy_conflict",
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
	const gateResult = normaliseDocsGateResult(result);

	if (options.json) {
		process.stdout.write(`${JSON.stringify(gateResult, null, 2)}\n`);
	} else {
		renderGateDecision(gateResult);
	}

	return result.exitCode;
}

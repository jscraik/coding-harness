import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type {
	DocsGatePolicy,
	DocsImpactCategory,
} from "../lib/contract/types.js";
import { validateContract } from "../lib/contract/validator.js";
import { sanitizeError } from "../lib/input/sanitize.js";
import { validatePath } from "../lib/input/validator.js";

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
	category: DocsImpactCategory | "system";
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

/**
 * Load and validate the docs-gate policy from contract.
 * Returns undefined if policy is missing or invalid.
 */
function loadDocsGatePolicy(
	repoRoot: string,
	contractPath: string,
): { policy?: DocsGatePolicy; error?: string } {
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
		if (!contractData.docsGatePolicy) {
			return { error: "docsGatePolicy is not defined in contract" };
		}

		return { policy: contractData.docsGatePolicy };
	} catch (error) {
		return { error: `Failed to load contract: ${sanitizeError(error)}` };
	}
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
		"ops/",
	];

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

		// Agent governance changes
		if (
			file === "AGENTS.md" ||
			file.startsWith("docs/agents/") ||
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
		const isChanged = changedFiles.some(
			(f) => f === surface || f.endsWith(`/${surface}`),
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
	const policyResult = loadDocsGatePolicy(repoRoot, CONTRACT_PATH);
	const policy = policyResult.policy;

	// Build execution context
	const executionContext = buildExecutionContext(options, policy);

	// Handle bootstrap gap
	if (policyResult.error || !policy) {
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
			message: policyResult.error ?? "docsGatePolicy is missing from contract",
			details:
				"Add docsGatePolicy to harness.contract.json or run 'harness init --update'",
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
			// Silent fail for stub report - already in error state
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
			contradiction_count: 0, // v1: not implementing full parity checks yet
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
		console.info(JSON.stringify(result.report, null, 2));
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

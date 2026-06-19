import type { DocsImpactCategory } from "../lib/contract/types.js";
import { WORKFLOW_POLICY_SOURCE_PATHS } from "./docs-gate-types.js";

const GOVERNANCE_PREFIXES = [
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

function addIf(
	condition: boolean,
	category: DocsImpactCategory,
	categories: Set<DocsImpactCategory>,
): boolean {
	if (!condition) return false;
	categories.add(category);
	return true;
}

function isWorkflowAuthorityDoc(file: string): boolean {
	return WORKFLOW_POLICY_SOURCE_PATHS.some(
		(path) => path.startsWith("docs/agents/") && path === file,
	);
}

function isDocOnly(file: string): boolean {
	return (
		(file.endsWith(".md") &&
			(file === "README.md" ||
				file === "CONTRIBUTING.md" ||
				file.startsWith("docs/"))) ||
		file.startsWith("ops/metrics/docs-gate/")
	);
}

function classifyFile(
	file: string,
	categories: Set<DocsImpactCategory>,
): boolean {
	let matched = false;
	matched ||= addIf(
		file.startsWith("src/cli.") ||
			file.startsWith("src/lib/cli/") ||
			file.includes("command-registry"),
		"cli_surface",
		categories,
	);
	matched ||= addIf(
		file === "harness.contract.json" || file.includes("src/lib/contract/"),
		"contract_policy",
		categories,
	);
	matched ||= addIf(
		file.startsWith(".github/workflows/"),
		"ci_workflow",
		categories,
	);
	matched ||= addIf(
		file.includes("required-checks") || file.includes("branch-protect"),
		"branch_protection_or_required_checks",
		categories,
	);
	matched ||= addIf(
		file.startsWith("src/commands/init.") || file.includes("template"),
		"init_scaffolding",
		categories,
	);
	matched ||= addToolingCategory(file, categories);
	matched ||= addArchitectureCategory(file, categories);
	matched ||= addWorkflowArtifactCategory(file, categories);
	matched ||= addIf(
		isWorkflowAuthorityDoc(file),
		"workflow_authority",
		categories,
	);
	matched ||= addIf(
		file === "AGENTS.md" ||
			(file.startsWith("docs/agents/") && !isWorkflowAuthorityDoc(file)) ||
			file.includes("agent-governance"),
		"agent_governance",
		categories,
	);
	matched ||= addIf(isDocOnly(file), "doc_only", categories);
	return matched;
}

function addToolingCategory(
	file: string,
	categories: Set<DocsImpactCategory>,
): boolean {
	return addIf(
		file === "Makefile" ||
			file === ".mise.toml" ||
			file === "prek.toml" ||
			file === ".codex/environments/environment.toml" ||
			file.startsWith("scripts/check-environment") ||
			file.startsWith("scripts/setup-git-hooks") ||
			file.includes("tooling-baseline") ||
			file.startsWith("src/commands/tooling-audit.") ||
			file.startsWith("src/commands/check-environment."),
		"tooling_runtime",
		categories,
	);
}

function addArchitectureCategory(
	file: string,
	categories: Set<DocsImpactCategory>,
): boolean {
	return addIf(
		file.startsWith("AI/diagrams/") ||
			file.startsWith("AI/context/") ||
			file.startsWith(".diagram/") ||
			file.startsWith("scripts/refresh-diagram-context") ||
			file.startsWith("scripts/check-diagram-freshness") ||
			file.startsWith("docs/architecture/"),
		"architecture_context",
		categories,
	);
}

function addWorkflowArtifactCategory(
	file: string,
	categories: Set<DocsImpactCategory>,
): boolean {
	let matched = false;
	matched ||= addIf(file.startsWith("docs/adr/"), "adr_artifact", categories);
	matched ||= addIf(
		file.startsWith("docs/specs/"),
		"spec_artifact",
		categories,
	);
	matched ||= addIf(
		file.startsWith("docs/plans/"),
		"plan_artifact",
		categories,
	);
	matched ||= addIf(
		file.startsWith("docs/brainstorms/"),
		"brainstorm_artifact",
		categories,
	);
	return matched;
}

/** Classify changed files into docs-gate impact categories. */
export function classifyChanges(changedFiles: readonly string[]): {
	categories: DocsImpactCategory[];
	unknownFiles: string[];
} {
	const categories = new Set<DocsImpactCategory>();
	const unknownFiles: string[] = [];
	for (const file of changedFiles) {
		if (!classifyFile(file, categories) && isPotentialGovernanceFile(file)) {
			unknownFiles.push(file);
		}
	}
	if (unknownFiles.length > 0 && categories.size === 0) {
		categories.add("unknown_governance_change");
	}
	return { categories: Array.from(categories), unknownFiles };
}

function isPotentialGovernanceFile(file: string): boolean {
	return GOVERNANCE_PREFIXES.some((prefix) => file.startsWith(prefix));
}

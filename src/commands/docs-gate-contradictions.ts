import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type {
	ContextContradictionCategory,
	ContextIntegrityPolicy,
	HarnessContract,
} from "../lib/contract/types.js";
import { isNonWorkflowRequiredCheck } from "../lib/policy/required-checks.js";
import {
	extractCommandManagers,
	inferExpectedPackageManager,
	loadFileIfPresent,
	parseWorkflowCheckNames,
} from "./docs-gate-files.js";
import type {
	ContradictionFinding,
	DocsGateMode,
	DocsSeverity,
} from "./docs-gate-types.js";
import {
	CONTRACT_PATH,
	INSTRUCTION_PRECEDENCE_SOURCE_PATHS,
	PACKAGE_JSON_PATH,
	WORKFLOW_PATH,
	WORKFLOW_POLICY_SOURCE_PATHS,
} from "./docs-gate-types.js";

function extractDeclaredPathToken(value: string): string | undefined {
	const markdownLinkMatch = value.match(/\[[^\]]+\]\(([^)]+)\)/);
	const backtickMatch = value.match(/`([^`]+)`/);
	const token =
		markdownLinkMatch?.[1] ??
		backtickMatch?.[1] ??
		value.match(
			/(?:^|\s)(?:~\/|\.{1,2}\/|\/)?[A-Za-z0-9._/-]+(?:\.md)?(?:#\w[\w-]*)?(?=$|[\s),.;])/,
		)?.[0];
	return token
		?.trim()
		.replace(/^<|>$/g, "")
		.replace(/^[\s(]+|[\s).,;]+$/g, "")
		.replace(/^\.\/+/g, "")
		.replace(/#.*$/, "");
}

function extractDiscoveryFirstSource(content: string): string | undefined {
	const headingMatch = content.match(
		/(?:^|\n)#{1,6}\s*codex discovery order\b[^\n]*\n([\s\S]*?)(?=\n#{1,6}\s|$)/i,
	);
	const fromSection = headingMatch?.[1]
		?.split(/\r?\n/)
		.map((line) => line.match(/^\s*1\.\s+(.+)$/)?.[1])
		.find((line): line is string => Boolean(line));
	if (fromSection) return extractDeclaredPathToken(fromSection);
	for (const line of content.split(/\r?\n/)) {
		const readFirstMatch = line.match(
			/\b(?:read|open|follow)\s+(.+?)\s+first\b/i,
		);
		const declaredPath = readFirstMatch?.[1]
			? extractDeclaredPathToken(readFirstMatch[1])
			: undefined;
		if (declaredPath) return declaredPath;
	}
	return undefined;
}

function normalizeProviderToken(value: string): string | undefined {
	const normalized = value.trim().toLowerCase();
	if (!normalized) return undefined;
	if (["github-actions", "github actions", "github"].includes(normalized)) {
		return "github-actions";
	}
	if (normalized === "circleci" || normalized === "circle ci")
		return "circleci";
	return normalized;
}

function extractDeclaredActiveProvider(content: string): string | undefined {
	for (const line of content.split(/\r?\n/)) {
		const normalizedLine = line.trim();
		if (!normalizedLine || normalizedLine.startsWith("#")) continue;
		const match = normalizedLine.match(
			/(?:^|[{\s])(?:"(?:activeprovider|active(?:\s+ci)?\s+provider)"|\b(?:active(?:\s+ci)?\s+provider|activeprovider)\b)\s*(?::|=|is)\s*(?:["'`])?([a-z0-9 _-]+)(?:["'`])?/i,
		);
		const provider = match?.[1] ? normalizeProviderToken(match[1]) : undefined;
		if (provider) return provider;
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

/** Collect context-integrity contradiction findings for docs-gate. */
export function collectContradictionFindings(
	repoRoot: string,
	contract: HarnessContract,
	mode: DocsGateMode,
): ContradictionFinding[] {
	return [
		...collectTruthSourceFindings(repoRoot, contract),
		...collectPackageManagerFindings(repoRoot, contract, mode),
		...collectRequiredCheckFindings(repoRoot, contract, mode),
		...collectPrecedenceFindings(repoRoot, contract, mode),
		...collectProviderFindings(repoRoot, contract, mode),
	];
}

function collectTruthSourceFindings(
	repoRoot: string,
	contract: HarnessContract,
): ContradictionFinding[] {
	const policy = contract.contextIntegrityPolicy;
	return (policy?.truthSources ?? []).flatMap((source) => {
		if (!source.required || existsSync(join(repoRoot, source.path))) return [];
		const message = `Required truth source '${source.path}' is missing`;
		return [
			finding("source_truth_missing", source.path, message, policy, [
				source.path,
			]),
		];
	});
}

function collectPackageManagerFindings(
	repoRoot: string,
	contract: HarnessContract,
	mode: DocsGateMode,
): ContradictionFinding[] {
	const expected = inferExpectedPackageManager(contract, repoRoot);
	if (!expected) return [];
	return ["README.md", "AGENTS.md", "CONTRIBUTING.md"].flatMap((sourcePath) => {
		const content = loadFileIfPresent(join(repoRoot, sourcePath));
		if (!content) return [];
		const managers = extractCommandManagers(content).filter(
			(manager) => manager !== expected,
		);
		if (managers.length === 0) return [];
		const unexpected = Array.from(new Set(managers)).sort().join(", ");
		const message =
			"Canonical command guidance uses " +
			unexpected +
			" but package manager contract requires " +
			expected;
		return [
			finding(
				"command_contract_conflict",
				sourcePath,
				message,
				contract.contextIntegrityPolicy,
				[sourcePath, PACKAGE_JSON_PATH],
				mode,
			),
		];
	});
}

function collectRequiredCheckFindings(
	repoRoot: string,
	contract: HarnessContract,
	mode: DocsGateMode,
): ContradictionFinding[] {
	const requiredChecks = contract.branchProtection?.requiredChecks ?? [];
	if (
		requiredChecks.length === 0 ||
		contract.ciProviderPolicy?.activeProvider === "circleci"
	) {
		return [];
	}
	const workflowChecks = parseWorkflowCheckNames(repoRoot);
	const missingChecks = requiredChecks.filter(
		(check) => !isNonWorkflowRequiredCheck(check) && !workflowChecks.has(check),
	);
	if (missingChecks.length === 0) return [];
	const message = `Workflow is missing required checks: ${missingChecks.join(", ")}`;
	return [
		finding(
			"required_check_conflict",
			WORKFLOW_PATH,
			message,
			contract.contextIntegrityPolicy,
			[WORKFLOW_PATH, CONTRACT_PATH],
			mode,
			`Missing workflow checks: ${missingChecks.join(", ")}`,
		),
	];
}

function collectPrecedenceFindings(
	repoRoot: string,
	contract: HarnessContract,
	mode: DocsGateMode,
): ContradictionFinding[] {
	const declarations = INSTRUCTION_PRECEDENCE_SOURCE_PATHS.flatMap(
		(sourcePath) => {
			const content = loadFileIfPresent(join(repoRoot, sourcePath));
			const firstSource = content
				? extractDiscoveryFirstSource(content)
				: undefined;
			return firstSource ? [{ sourcePath, firstSource }] : [];
		},
	);
	const uniqueFirstSources = new Set(
		declarations.map((entry) => entry.firstSource),
	);
	if (uniqueFirstSources.size <= 1) return [];
	const sourcePaths = declarations.map((entry) => entry.sourcePath);
	const summary = declarations
		.map((entry) => `${entry.sourcePath} -> ${entry.firstSource}`)
		.join("; ");
	return declarations.map((declaration) =>
		finding(
			"instruction_precedence_conflict",
			declaration.sourcePath,
			"Instruction precedence conflict: canonical docs disagree on first discovery source (" +
				summary +
				")",
			contract.contextIntegrityPolicy,
			sourcePaths,
			mode,
		),
	);
}

function collectProviderFindings(
	repoRoot: string,
	contract: HarnessContract,
	mode: DocsGateMode,
): ContradictionFinding[] {
	const declarations = providerDeclarations(repoRoot);
	const providers = new Set(declarations.map((entry) => entry.provider));
	if (providers.size > 1)
		return [providerInterDocFinding(declarations, contract, mode)];
	const activeProvider = normalizeProviderToken(
		String(contract.ciProviderPolicy?.activeProvider ?? ""),
	);
	if (!activeProvider) return [];
	return declarations
		.filter((entry) => entry.provider !== activeProvider)
		.map((entry) =>
			providerContractFinding(entry, activeProvider, contract, mode),
		);
}

function providerDeclarations(repoRoot: string) {
	return WORKFLOW_POLICY_SOURCE_PATHS.flatMap((sourcePath) => {
		const content = loadFileIfPresent(join(repoRoot, sourcePath));
		const provider = content
			? extractDeclaredActiveProvider(content)
			: undefined;
		return provider ? [{ sourcePath, provider }] : [];
	});
}

function providerInterDocFinding(
	declarations: { sourcePath: string; provider: string }[],
	contract: HarnessContract,
	mode: DocsGateMode,
): ContradictionFinding {
	const sourcePaths = declarations.map((entry) => entry.sourcePath);
	const summary = declarations
		.map((entry) => `${entry.sourcePath} -> ${entry.provider}`)
		.join("; ");
	return finding(
		"workflow_policy_conflict",
		sourcePaths.join(","),
		"Workflow policy conflict: docs declare inconsistent active providers (" +
			summary +
			")",
		contract.contextIntegrityPolicy,
		sourcePaths,
		mode,
		undefined,
		sourcePaths[0],
	);
}

function providerContractFinding(
	entry: { sourcePath: string; provider: string },
	activeProvider: string,
	contract: HarnessContract,
	mode: DocsGateMode,
): ContradictionFinding {
	return finding(
		"workflow_policy_conflict",
		entry.sourcePath,
		"Workflow policy conflict: " +
			entry.sourcePath +
			" declares active provider '" +
			entry.provider +
			"' but contract requires '" +
			activeProvider +
			"'",
		contract.contextIntegrityPolicy,
		[entry.sourcePath, CONTRACT_PATH],
		mode,
	);
}

function finding(
	category: ContextContradictionCategory,
	surface: string,
	message: string,
	policy: ContextIntegrityPolicy | undefined,
	sourcePaths: string[],
	mode?: DocsGateMode,
	details?: string,
	path = surface,
): ContradictionFinding {
	return {
		finding_id: buildFindingId(category, surface, message),
		rule_id: `context-integrity.${category}`,
		category,
		surface,
		rule_result: "fail",
		result: "fail",
		severity:
			mode === "advisory" &&
			(category === "command_contract_conflict" ||
				category === "required_check_conflict" ||
				category === "workflow_policy_conflict" ||
				category === "instruction_precedence_conflict")
				? "warning"
				: resolveContradictionSeverity(policy, category),
		message,
		path,
		source_paths: sourcePaths,
		...(details ? { details } : {}),
	};
}

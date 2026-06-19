import { existsSync } from "node:fs";
import { join } from "node:path";
import type {
	DocsGatePolicy,
	DocsImpactCategory,
} from "../lib/contract/types.js";
import type { DocsFinding, DocsGateMode } from "./docs-gate-types.js";
import { DEEP_MODULE_README_SOURCE_PATTERN } from "./docs-gate-types.js";

/** Determine required documentation surfaces based on impact categories. */
export function resolveRequiredSurfaces(
	categories: readonly DocsImpactCategory[],
	policy: DocsGatePolicy,
): { surfaces: string[]; ruleFindings: DocsFinding[] } {
	const surfaces = new Set<string>();
	const ruleFindings: DocsFinding[] = [];
	for (const rule of policy.rules) {
		if (
			!(rule.when.categories?.some((cat) => categories.includes(cat)) ?? false)
		) {
			continue;
		}
		for (const doc of rule.requireDocs) surfaces.add(doc);
		ruleFindings.push({
			rule_id: rule.ruleId,
			category: rule.when.categories?.[0] ?? "unknown_governance_change",
			surface: rule.requireDocs.join(", ") || "none",
			rule_result: "pass",
			result: "pass",
			severity: "info",
			message:
				"Rule '" +
				rule.ruleId +
				"' applies: requires " +
				(rule.requireDocs.join(", ") || "no docs"),
		});
	}
	return { surfaces: Array.from(surfaces), ruleFindings };
}

/** Check if required surfaces are present in changed files. */
export function checkSurfacePresence(
	requiredSurfaces: readonly string[],
	changedFiles: readonly string[],
	policy: DocsGatePolicy,
	deletedFiles: ReadonlySet<string>,
): { present: string[]; missing: string[]; findings: DocsFinding[] } {
	const present: string[] = [];
	const missing: string[] = [];
	const findings: DocsFinding[] = [];
	for (const surface of requiredSurfaces) {
		const isDirectorySurface = surface.endsWith("/");
		const matchingChangedFiles = changedFiles.filter((file) =>
			isDirectorySurface
				? file.startsWith(surface)
				: file === surface || file.endsWith(`/${surface}`),
		);
		const isChanged = matchingChangedFiles.some(
			(file) => !deletedFiles.has(file),
		);
		if (isChanged) addPresent(surface, present, findings);
		else addMissing(surface, policy, missing, findings);
	}
	return { present, missing, findings };
}

function addPresent(
	surface: string,
	present: string[],
	findings: DocsFinding[],
): void {
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
}

function addMissing(
	surface: string,
	policy: DocsGatePolicy,
	missing: string[],
	findings: DocsFinding[],
): void {
	missing.push(surface);
	findings.push({
		rule_id: "docs.surface.missing",
		category: "system",
		surface,
		rule_result: "fail",
		result: "fail",
		severity: policy.mode === "required" ? "error" : "warning",
		message:
			"Required documentation surface '" +
			surface +
			"' was not updated for this change",
		path: surface,
	});
}

/** Require existing deep-module READMEs to move with module changes. */
export function collectDeepModuleReadmeFindings(
	repoRoot: string,
	changedFiles: readonly string[],
	deletedFiles: ReadonlySet<string>,
	mode: DocsGateMode,
): { missing: string[]; findings: DocsFinding[] } {
	const touchedModules = new Set<string>();
	for (const file of changedFiles) {
		const match = deletedFiles.has(file)
			? undefined
			: file.match(DEEP_MODULE_README_SOURCE_PATTERN);
		if (match?.[1]) touchedModules.add(match[1]);
	}
	return collectModuleReadmeFindings(
		repoRoot,
		touchedModules,
		changedFiles,
		deletedFiles,
		mode,
	);
}

function collectModuleReadmeFindings(
	repoRoot: string,
	modules: ReadonlySet<string>,
	changedFiles: readonly string[],
	deletedFiles: ReadonlySet<string>,
	mode: DocsGateMode,
): { missing: string[]; findings: DocsFinding[] } {
	const missing: string[] = [];
	const findings: DocsFinding[] = [];
	for (const moduleName of Array.from(modules).sort()) {
		const readmePath = `src/lib/${moduleName}/README.md`;
		const readmeExists = existsSync(join(repoRoot, readmePath));
		if (!readmeExists && !deletedFiles.has(readmePath)) continue;
		if (changedFiles.includes(readmePath) && !deletedFiles.has(readmePath)) {
			addReadmePresent(readmePath, findings);
		} else {
			addReadmeMissing(readmePath, moduleName, mode, missing, findings);
		}
	}
	return { missing, findings };
}

function addReadmePresent(readmePath: string, findings: DocsFinding[]): void {
	findings.push({
		rule_id: "docs.deep_module_readme.present",
		category: "architecture_context",
		surface: readmePath,
		rule_result: "pass",
		result: "pass",
		severity: "info",
		message: `Deep-module README '${readmePath}' was updated with module changes`,
		path: readmePath,
	});
}

function addReadmeMissing(
	readmePath: string,
	moduleName: string,
	mode: DocsGateMode,
	missing: string[],
	findings: DocsFinding[],
): void {
	missing.push(readmePath);
	findings.push({
		rule_id: "docs.deep_module_readme.missing",
		category: "architecture_context",
		surface: readmePath,
		rule_result: "fail",
		result: "fail",
		severity: mode === "required" ? "error" : "warning",
		message:
			"Deep-module README '" +
			readmePath +
			"' was not updated for changes under src/lib/" +
			moduleName +
			"/",
		path: readmePath,
		details:
			"Update the module README when module behavior, contract, validation, ownership, or architecture changed. If the module README is not affected, record that n.a. decision in the PR Documentation impact field.",
	});
}

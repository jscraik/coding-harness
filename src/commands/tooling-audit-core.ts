import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { loadContract } from "../lib/contract/loader.js";
import {
	DEFAULT_CONTRACT,
	type HarnessContract,
} from "../lib/contract/types.js";
import { PathTraversalError, validatePath } from "../lib/input/validator.js";
import { findRepositories } from "../lib/org/repositories.js";
import {
	REQUIRED_HOOK_SUPPORT_FILES,
	REQUIRED_PACKAGE_SCRIPTS,
	REQUIRED_PREK_HOOKS,
	TOOLING_PACKAGE_JSON_PATH,
	TOOLING_PREK_CONFIG_PATH,
} from "../lib/policy/tooling-baseline.js";
import { type CliResult, err, ok } from "../lib/result/types.js";

export const EXIT_CODES = {
	SUCCESS: 0,
	NO_REPOS_FOUND: 1,
	SCAN_ERRORS: 2,
	DRIFT_DETECTED: 3,
	INVALID_ARGUMENT: 4,
} as const;

/**
 * Supported output formats for tooling-audit reports.
 */
export type OutputFormat = "json" | "markdown" | "table";
/**
 * Severity classes emitted by tooling-audit findings.
 */
export type FindingSeverity = "critical" | "warning" | "info";

/**
 * Single tooling-audit finding describing detected drift.
 */
export interface ToolingAuditFinding {
	path: string;
	severity: FindingSeverity;
	description: string;
	expected?: unknown;
	actual?: unknown;
}

/**
 * Per-repository tooling-audit result.
 */
export interface ToolingAuditRepoResult {
	path: string;
	status: "success" | "error" | "no-contract";
	findings: ToolingAuditFinding[];
	error?: string | undefined;
}

/**
 * Options accepted by tooling-audit execution.
 */
export interface ToolingAuditOptions {
	path: string;
	baseContract?: HarnessContract | undefined;
	format: OutputFormat;
	includeMissing?: boolean | undefined;
}

/**
 * Aggregate tooling-audit report across scanned repositories.
 */
export interface ToolingAuditResult {
	totalRepos: number;
	successfulRepos: number;
	errors: number;
	noContract: number;
	findings: {
		total: number;
		critical: number;
		warning: number;
		info: number;
	};
	results: ToolingAuditRepoResult[];
}

interface PackageManifest {
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
}

function validatePathInput(
	rawPath: string,
	field: string,
): CliResult<{ absolutePath: string; safePath: string }> {
	const absolutePath = resolve(rawPath);
	try {
		const safePath = validatePath(dirname(absolutePath), absolutePath);
		return ok({ absolutePath, safePath });
	} catch (error) {
		if (error instanceof PathTraversalError) {
			return err({
				code: "VALIDATION_ERROR",
				message: `${field} contains an unsafe path traversal sequence`,
			});
		}
		return err({
			code: "VALIDATION_ERROR",
			message: `${field} is not a valid path`,
		});
	}
}

function getRawJson(content: string): Record<string, unknown> {
	const parsed = JSON.parse(content) as unknown;
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
		throw new Error("Contract root must be an object");
	}
	return parsed as Record<string, unknown>;
}

function readTextFile(path: string): string | null {
	if (!existsSync(path)) {
		return null;
	}
	return readFileSync(path, "utf-8");
}

function readPackageManifest(path: string): PackageManifest | null {
	const content = readTextFile(path);
	if (content === null) {
		return null;
	}
	const parsed = JSON.parse(content) as unknown;
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
		throw new Error("package.json root must be an object");
	}
	const manifest = parsed as PackageManifest;
	return manifest;
}

function readJsonObject(path: string): Record<string, unknown> | null {
	const content = readTextFile(path);
	if (content === null) {
		return null;
	}
	const parsed = JSON.parse(content) as unknown;
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
		throw new Error("JSON root must be an object");
	}
	return parsed as Record<string, unknown>;
}

function collectPackageDependencies(manifest: PackageManifest): Set<string> {
	return new Set([
		...Object.keys(manifest.dependencies ?? {}),
		...Object.keys(manifest.devDependencies ?? {}),
	]);
}

function detectCapabilities(
	contract: HarnessContract,
	manifest: PackageManifest | null,
): Set<string> {
	const capabilities = new Set<string>();
	const packagePolicy = contract.toolingPolicy?.packagePolicy;
	if (!packagePolicy) {
		return capabilities;
	}

	for (const capability of packagePolicy.explicitCapabilities ?? []) {
		capabilities.add(capability);
	}

	if (manifest === null) {
		return capabilities;
	}

	const dependencyNames = collectPackageDependencies(manifest);
	for (const detector of packagePolicy.capabilityDetectors) {
		if (
			detector.dependencyMarkers.some((marker) => dependencyNames.has(marker))
		) {
			capabilities.add(detector.capability);
		}
	}

	return capabilities;
}

function hasRequiredPackage(
	manifest: PackageManifest,
	packageName: string,
	dependencyType: "dependencies" | "devDependencies" | "either",
): boolean {
	const dependencies = manifest.dependencies ?? {};
	const devDependencies = manifest.devDependencies ?? {};

	if (dependencyType === "dependencies") {
		return Object.prototype.hasOwnProperty.call(dependencies, packageName);
	}
	if (dependencyType === "devDependencies") {
		return Object.prototype.hasOwnProperty.call(devDependencies, packageName);
	}

	return (
		Object.prototype.hasOwnProperty.call(dependencies, packageName) ||
		Object.prototype.hasOwnProperty.call(devDependencies, packageName)
	);
}

function collectMisePins(content: string): Map<string, string> {
	const pins = new Map<string, string>();
	const regex = /^\s*(?:"([^"]+)"|([A-Za-z0-9:@._/-]+))\s*=\s*"([^"]+)"\s*$/gm;
	let match = regex.exec(content);
	while (match !== null) {
		const tool = match[1] ?? match[2];
		const version = match[3];
		if (tool && version) {
			pins.set(tool, version);
		}
		match = regex.exec(content);
	}
	return pins;
}

function collectCodexActionPairs(content: string): Set<string> {
	const pairs = new Set<string>();
	const blockRegex = /\[\[actions\]\][\s\S]*?(?=\n\[\[actions\]\]|$)/g;
	for (const block of content.match(blockRegex) ?? []) {
		const name = /\nname = "([^"]+)"/.exec(`\n${block}`)?.[1];
		const icon = /\nicon = "([^"]+)"/.exec(`\n${block}`)?.[1];
		if (name && icon) {
			pairs.add(`${name}|${icon}`);
		}
	}
	return pairs;
}

function collectMakeTargets(content: string): Set<string> {
	const targets = new Set<string>();
	const regex = /^([A-Za-z0-9_.-]+):/gm;
	let match = regex.exec(content);
	while (match !== null) {
		const target = match[1];
		if (target) {
			targets.add(target);
		}
		match = regex.exec(content);
	}
	return targets;
}

function addMissingFileFinding(
	findings: ToolingAuditFinding[],
	path: string,
	label: string,
): void {
	findings.push({
		path,
		severity: "critical",
		description: `Missing required ${label}: ${path}`,
	});
}

function auditReadinessScript(
	findings: ToolingAuditFinding[],
	repoPath: string,
	contract: HarnessContract,
): void {
	const toolingPolicy =
		contract.toolingPolicy ?? DEFAULT_CONTRACT.toolingPolicy;
	if (!toolingPolicy) {
		return;
	}
	const scriptPath = join(repoPath, toolingPolicy.readinessScriptPath);
	const content = readTextFile(scriptPath);
	if (content === null) {
		addMissingFileFinding(
			findings,
			toolingPolicy.readinessScriptPath,
			"readiness script",
		);
		return;
	}

	for (const term of toolingPolicy.requiredDocumentationTerms) {
		if (!content.includes(`"${term}"`)) {
			findings.push({
				path: "toolingPolicy.requiredDocumentationTerms",
				severity: "warning",
				description: `Readiness script no longer enforces tooling inventory term '${term}'`,
				expected: term,
				actual: toolingPolicy.readinessScriptPath,
			});
		}
	}

	for (const binary of toolingPolicy.requiredBinaries) {
		if (!content.includes(`"${binary}"`)) {
			findings.push({
				path: "toolingPolicy.requiredBinaries",
				severity: "critical",
				description: `Readiness script no longer enforces binary '${binary}'`,
				expected: binary,
				actual: toolingPolicy.readinessScriptPath,
			});
		}
	}

	for (const action of toolingPolicy.codexEnvironment.requiredActions) {
		const pair = `${action.name}|${action.icon}`;
		if (!content.includes(`"${pair}"`)) {
			findings.push({
				path: "toolingPolicy.codexEnvironment.requiredActions",
				severity: "warning",
				description: `Readiness script no longer checks Codex action '${pair}'`,
				expected: pair,
				actual: toolingPolicy.readinessScriptPath,
			});
		}
	}

	for (const target of toolingPolicy.makefile.requiredTargets) {
		if (!content.includes(`"${target}"`)) {
			findings.push({
				path: "toolingPolicy.makefile.requiredTargets",
				severity: "warning",
				description: `Readiness script no longer checks Makefile target '${target}'`,
				expected: target,
				actual: toolingPolicy.readinessScriptPath,
			});
		}
	}

	if (toolingPolicy.projectBrainMemoryExtension?.enabled) {
		if (!content.includes("project_brain_memory_extension_enabled=true")) {
			findings.push({
				path: "toolingPolicy.projectBrainMemoryExtension.enabled",
				severity: "warning",
				description:
					"Readiness script no longer enables Project Brain memory-extension checks",
				expected: "project_brain_memory_extension_enabled=true",
				actual: toolingPolicy.readinessScriptPath,
			});
		}

		if (!content.includes("required_project_brain_paths=(")) {
			findings.push({
				path: "toolingPolicy.projectBrainMemoryExtension.requiredPaths",
				severity: "warning",
				description:
					"Readiness script no longer declares required Project Brain memory-extension paths",
				expected: toolingPolicy.projectBrainMemoryExtension.requiredPaths,
				actual: toolingPolicy.readinessScriptPath,
			});
		}

		for (const requiredPath of toolingPolicy.projectBrainMemoryExtension
			.requiredPaths) {
			if (!content.includes(`"${requiredPath}"`)) {
				findings.push({
					path: "toolingPolicy.projectBrainMemoryExtension.requiredPaths",
					severity: "warning",
					description: `Readiness script no longer checks Project Brain path '${requiredPath}'`,
					expected: requiredPath,
					actual: toolingPolicy.readinessScriptPath,
				});
			}
		}
	}

	for (const detector of toolingPolicy.packagePolicy.capabilityDetectors) {
		if (!content.includes(detector.capability)) {
			findings.push({
				path: "toolingPolicy.packagePolicy.capabilityDetectors",
				severity: "warning",
				description: `Readiness script no longer references capability detector '${detector.capability}'`,
				expected: detector.capability,
				actual: toolingPolicy.readinessScriptPath,
			});
		}
		for (const marker of detector.dependencyMarkers) {
			if (!content.includes(marker)) {
				findings.push({
					path: "toolingPolicy.packagePolicy.capabilityDetectors",
					severity: "warning",
					description: `Readiness script no longer references package marker '${marker}' for capability '${detector.capability}'`,
					expected: marker,
					actual: toolingPolicy.readinessScriptPath,
				});
			}
		}
	}

	for (const capability of toolingPolicy.packagePolicy.explicitCapabilities ??
		[]) {
		if (!content.includes(`"${capability}"`)) {
			findings.push({
				path: "toolingPolicy.packagePolicy.explicitCapabilities",
				severity: "warning",
				description: `Readiness script no longer references explicit capability '${capability}'`,
				expected: capability,
				actual: toolingPolicy.readinessScriptPath,
			});
		}
	}

	for (const requiredPackage of toolingPolicy.packagePolicy.requiredPackages) {
		if (!content.includes(requiredPackage.package)) {
			findings.push({
				path: "toolingPolicy.packagePolicy.requiredPackages",
				severity: "warning",
				description: `Readiness script no longer references required package '${requiredPackage.package}'`,
				expected: requiredPackage.package,
				actual: toolingPolicy.readinessScriptPath,
			});
		}
	}
}

function auditMise(
	findings: ToolingAuditFinding[],
	repoPath: string,
	contract: HarnessContract,
): void {
	const toolingPolicy =
		contract.toolingPolicy ?? DEFAULT_CONTRACT.toolingPolicy;
	if (!toolingPolicy) {
		return;
	}
	const misePath = join(repoPath, toolingPolicy.miseFilePath);
	const content = readTextFile(misePath);
	if (content === null) {
		addMissingFileFinding(findings, toolingPolicy.miseFilePath, "mise file");
		return;
	}

	const pins = collectMisePins(content);
	for (const tool of toolingPolicy.requiredMiseTools) {
		const actualVersion = pins.get(tool.tool);
		if (!actualVersion) {
			findings.push({
				path: "toolingPolicy.requiredMiseTools",
				severity: "critical",
				description: `Missing mise tool pin for '${tool.tool}'`,
				expected: tool.version,
			});
			continue;
		}
		if (actualVersion !== tool.version) {
			findings.push({
				path: `toolingPolicy.requiredMiseTools.${tool.tool}`,
				severity: "warning",
				description: `Mise pin drift for '${tool.tool}'`,
				expected: tool.version,
				actual: actualVersion,
			});
		}
	}
}

function auditCodexEnvironment(
	findings: ToolingAuditFinding[],
	repoPath: string,
	contract: HarnessContract,
): void {
	const toolingPolicy =
		contract.toolingPolicy ?? DEFAULT_CONTRACT.toolingPolicy;
	if (!toolingPolicy) {
		return;
	}
	const envPath = join(repoPath, toolingPolicy.codexEnvironment.path);
	const content = readTextFile(envPath);
	if (content === null) {
		addMissingFileFinding(
			findings,
			toolingPolicy.codexEnvironment.path,
			"Codex environment file",
		);
		return;
	}

	const pairs = collectCodexActionPairs(content);
	for (const action of toolingPolicy.codexEnvironment.requiredActions) {
		const pair = `${action.name}|${action.icon}`;
		if (!pairs.has(pair)) {
			findings.push({
				path: "toolingPolicy.codexEnvironment.requiredActions",
				severity: "critical",
				description: `Missing Codex action mapping '${pair}'`,
				expected: pair,
			});
		}
	}
}

function auditMakefile(
	findings: ToolingAuditFinding[],
	repoPath: string,
	contract: HarnessContract,
): void {
	const toolingPolicy =
		contract.toolingPolicy ?? DEFAULT_CONTRACT.toolingPolicy;
	if (!toolingPolicy) {
		return;
	}
	const makefilePath = join(repoPath, toolingPolicy.makefile.path);
	const content = readTextFile(makefilePath);
	if (content === null) {
		addMissingFileFinding(findings, toolingPolicy.makefile.path, "Makefile");
		return;
	}

	const targets = collectMakeTargets(content);
	for (const target of toolingPolicy.makefile.requiredTargets) {
		if (!targets.has(target)) {
			findings.push({
				path: "toolingPolicy.makefile.requiredTargets",
				severity: "warning",
				description: `Missing Makefile target '${target}'`,
				expected: target,
			});
		}
	}
}

function auditProjectBrainMemoryExtension(
	findings: ToolingAuditFinding[],
	repoPath: string,
	contract: HarnessContract,
): void {
	const toolingPolicy =
		contract.toolingPolicy ?? DEFAULT_CONTRACT.toolingPolicy;
	if (!toolingPolicy?.projectBrainMemoryExtension?.enabled) {
		return;
	}

	for (const requiredPath of toolingPolicy.projectBrainMemoryExtension
		.requiredPaths) {
		if (!existsSync(join(repoPath, requiredPath))) {
			findings.push({
				path: "toolingPolicy.projectBrainMemoryExtension.requiredPaths",
				severity: "critical",
				description: `Missing Project Brain memory-extension path '${requiredPath}'`,
				expected: requiredPath,
			});
		}
	}
}

function auditPackagePolicy(
	findings: ToolingAuditFinding[],
	repoPath: string,
	contract: HarnessContract,
): void {
	const toolingPolicy =
		contract.toolingPolicy ?? DEFAULT_CONTRACT.toolingPolicy;
	if (!toolingPolicy) {
		return;
	}

	const packagePath = join(
		repoPath,
		toolingPolicy.packagePolicy.packageJsonPath,
	);
	let manifest: PackageManifest | null;
	try {
		manifest = readPackageManifest(packagePath);
	} catch (error) {
		findings.push({
			path: "toolingPolicy.packagePolicy.packageJsonPath",
			severity: "critical",
			description: `Failed to parse package manifest at '${toolingPolicy.packagePolicy.packageJsonPath}'`,
			expected: "Valid JSON object",
			actual: error instanceof Error ? error.message : "Invalid JSON",
		});
		return;
	}
	if (manifest === null) {
		return;
	}

	const capabilities = detectCapabilities(contract, manifest);
	for (const requiredPackage of toolingPolicy.packagePolicy.requiredPackages) {
		const shouldApply = requiredPackage.requiredWhenCapabilities.some(
			(capability) => capabilities.has(capability),
		);
		if (!shouldApply) {
			continue;
		}
		if (
			!hasRequiredPackage(
				manifest,
				requiredPackage.package,
				requiredPackage.dependencyType,
			)
		) {
			findings.push({
				path: "toolingPolicy.packagePolicy.requiredPackages",
				severity: "critical",
				description: `Missing required package '${requiredPackage.package}' for detected capabilities: ${requiredPackage.requiredWhenCapabilities.filter((capability) => capabilities.has(capability)).join(", ")}`,
				expected: {
					package: requiredPackage.package,
					dependencyType: requiredPackage.dependencyType,
				},
				actual: toolingPolicy.packagePolicy.packageJsonPath,
			});
		}
	}
}

/**
 * Audit a repository for required hook support files, prek hook configurations, and hook-related package.json scripts, appending findings for any detected problems.
 *
 * Checks for the presence of required support files and the Prek configuration, validates each required Prek hook configuration, validates required entries in `package.json` scripts, and flags legacy `simple-git-hooks` configuration. If `package.json` fails to parse, records a critical finding and stops further package.json checks.
 *
 * @param findings - Mutable array to which this function will append ToolingAuditFinding entries describing detected issues.
 * @param repoPath - Filesystem path to the repository root to inspect.
 */
function auditLocalHooks(
	findings: ToolingAuditFinding[],
	repoPath: string,
): void {
	for (const supportFile of REQUIRED_HOOK_SUPPORT_FILES) {
		if (!existsSync(join(repoPath, supportFile))) {
			addMissingFileFinding(findings, supportFile, "hook support file");
		}
	}

	const prekPath = join(repoPath, TOOLING_PREK_CONFIG_PATH);
	const prekContent = readTextFile(prekPath);
	if (prekContent === null) {
		addMissingFileFinding(findings, TOOLING_PREK_CONFIG_PATH, "prek config");
	} else {
		for (const [hookName, hookConfig] of Object.entries(REQUIRED_PREK_HOOKS)) {
			const hookStages =
				"stages" in hookConfig ? (hookConfig.stages ?? []) : [];
			const hookPattern = new RegExp(
				String.raw`\[\[repos\.hooks\]\][\s\S]*?id = "${hookName}"[\s\S]*?name = "${hookConfig.name}"[\s\S]*?entry = "${hookConfig.entry}"[\s\S]*?language = "${hookConfig.language}"[\s\S]*?pass_filenames = ${String(hookConfig.pass_filenames)}${
					hookStages.length
						? String.raw`[\s\S]*?stages = \["${hookStages.join(String.raw`", "`)}"\]`
						: ""
				}`,
			);
			if (!hookPattern.test(prekContent)) {
				findings.push({
					path: TOOLING_PREK_CONFIG_PATH,
					severity: "critical",
					description: `Prek hook '${hookName}' is missing or out of date`,
					expected: {
						id: hookName,
						name: hookConfig.name,
						entry: hookConfig.entry,
						language: hookConfig.language,
						pass_filenames: hookConfig.pass_filenames,
						stages: hookStages,
					},
				});
			}
		}
	}

	const packagePath = join(repoPath, TOOLING_PACKAGE_JSON_PATH);
	let packageJson: Record<string, unknown> | null;
	try {
		packageJson = readJsonObject(packagePath);
	} catch (error) {
		findings.push({
			path: TOOLING_PACKAGE_JSON_PATH,
			severity: "critical",
			description: `Failed to parse package manifest at '${TOOLING_PACKAGE_JSON_PATH}'`,
			expected: "Valid JSON object",
			actual: error instanceof Error ? error.message : "Invalid JSON",
		});
		return;
	}
	if (packageJson === null) {
		return;
	}

	const scripts = packageJson.scripts;
	const scriptObject =
		scripts && typeof scripts === "object" && !Array.isArray(scripts)
			? (scripts as Record<string, unknown>)
			: null;
	for (const [scriptName, expectedCommand] of Object.entries(
		REQUIRED_PACKAGE_SCRIPTS,
	)) {
		if (!scriptObject || scriptObject[scriptName] !== expectedCommand) {
			findings.push({
				path: TOOLING_PACKAGE_JSON_PATH,
				severity: "critical",
				description: `package.json script '${scriptName}' is missing or out of date`,
				expected: expectedCommand,
				actual: scriptObject?.[scriptName],
			});
		}
	}

	if (Object.prototype.hasOwnProperty.call(packageJson, "simple-git-hooks")) {
		findings.push({
			path: TOOLING_PACKAGE_JSON_PATH,
			severity: "critical",
			description:
				"Legacy simple-git-hooks config should be removed after migrating to prek",
			expected: "No simple-git-hooks key",
			actual: packageJson["simple-git-hooks"],
		});
	}
}

function auditBaseDrift(
	findings: ToolingAuditFinding[],
	contract: HarnessContract,
	baseContract: HarnessContract,
): void {
	const basePolicy = baseContract.toolingPolicy;
	const actualPolicy = contract.toolingPolicy;
	if (!basePolicy || !actualPolicy) {
		return;
	}

	const actualDocs = new Set(actualPolicy.requiredDocumentationTerms);
	for (const term of basePolicy.requiredDocumentationTerms) {
		if (!actualDocs.has(term)) {
			findings.push({
				path: "toolingPolicy.requiredDocumentationTerms",
				severity: "warning",
				description: `Contract drift: missing tooling documentation term '${term}'`,
				expected: term,
			});
		}
	}

	const actualBins = new Set(actualPolicy.requiredBinaries);
	for (const binary of basePolicy.requiredBinaries) {
		if (!actualBins.has(binary)) {
			findings.push({
				path: "toolingPolicy.requiredBinaries",
				severity: "critical",
				description: `Contract drift: missing required binary '${binary}'`,
				expected: binary,
			});
		}
	}

	const actualDetectors = new Map(
		actualPolicy.packagePolicy.capabilityDetectors.map((detector) => [
			detector.capability,
			new Set(detector.dependencyMarkers),
		]),
	);
	for (const detector of basePolicy.packagePolicy.capabilityDetectors) {
		const actualMarkers = actualDetectors.get(detector.capability);
		if (!actualMarkers) {
			findings.push({
				path: "toolingPolicy.packagePolicy.capabilityDetectors",
				severity: "warning",
				description: `Contract drift: missing capability detector '${detector.capability}'`,
				expected: detector.capability,
			});
			continue;
		}
		for (const marker of detector.dependencyMarkers) {
			if (!actualMarkers.has(marker)) {
				findings.push({
					path: "toolingPolicy.packagePolicy.capabilityDetectors",
					severity: "warning",
					description: `Contract drift: capability '${detector.capability}' no longer checks dependency marker '${marker}'`,
					expected: marker,
				});
			}
		}
	}

	const actualExplicitCapabilities = new Set(
		actualPolicy.packagePolicy.explicitCapabilities ?? [],
	);
	for (const capability of basePolicy.packagePolicy.explicitCapabilities ??
		[]) {
		if (!actualExplicitCapabilities.has(capability)) {
			findings.push({
				path: "toolingPolicy.packagePolicy.explicitCapabilities",
				severity: "warning",
				description: `Contract drift: missing explicit tooling capability '${capability}'`,
				expected: capability,
			});
		}
	}

	const actualRequiredPackages = new Map(
		actualPolicy.packagePolicy.requiredPackages.map((requiredPackage) => [
			requiredPackage.package,
			requiredPackage,
		]),
	);
	for (const requiredPackage of basePolicy.packagePolicy.requiredPackages) {
		const actualPackage = actualRequiredPackages.get(requiredPackage.package);
		if (!actualPackage) {
			findings.push({
				path: "toolingPolicy.packagePolicy.requiredPackages",
				severity: "critical",
				description: `Contract drift: missing conditional package '${requiredPackage.package}'`,
				expected: requiredPackage.package,
			});
			continue;
		}
		if (actualPackage.dependencyType !== requiredPackage.dependencyType) {
			findings.push({
				path: `toolingPolicy.packagePolicy.requiredPackages.${requiredPackage.package}`,
				severity: "warning",
				description: `Contract drift: conditional package '${requiredPackage.package}' changed dependency type`,
				expected: requiredPackage.dependencyType,
				actual: actualPackage.dependencyType,
			});
		}
	}

	const baseProjectBrain = basePolicy.projectBrainMemoryExtension;
	const actualProjectBrain = actualPolicy.projectBrainMemoryExtension;
	if (baseProjectBrain?.enabled) {
		if (!actualProjectBrain?.enabled) {
			findings.push({
				path: "toolingPolicy.projectBrainMemoryExtension.enabled",
				severity: "warning",
				description:
					"Contract drift: Project Brain memory-extension checks are no longer enabled",
				expected: true,
				actual: actualProjectBrain?.enabled ?? false,
			});
		}

		const actualPaths = new Set(actualProjectBrain?.requiredPaths ?? []);
		for (const requiredPath of baseProjectBrain.requiredPaths) {
			if (!actualPaths.has(requiredPath)) {
				findings.push({
					path: "toolingPolicy.projectBrainMemoryExtension.requiredPaths",
					severity: "warning",
					description: `Contract drift: missing Project Brain memory-extension path '${requiredPath}'`,
					expected: requiredPath,
				});
			}
		}
	}
}

function summarizeFindings(
	results: ToolingAuditRepoResult[],
): ToolingAuditResult["findings"] {
	let critical = 0;
	let warning = 0;
	let info = 0;
	for (const result of results) {
		for (const finding of result.findings) {
			if (finding.severity === "critical") critical += 1;
			if (finding.severity === "warning") warning += 1;
			if (finding.severity === "info") info += 1;
		}
	}
	return {
		total: critical + warning + info,
		critical,
		warning,
		info,
	};
}

async function auditRepository(
	repoPath: string,
	baseContract?: HarnessContract,
	includeMissing = false,
): Promise<ToolingAuditRepoResult> {
	const contractPath = join(repoPath, "harness.contract.json");
	if (!existsSync(contractPath)) {
		return includeMissing
			? { path: repoPath, status: "no-contract", findings: [] }
			: {
					path: repoPath,
					status: "error",
					findings: [],
					error: "No harness.contract.json found",
				};
	}

	let rawContract: Record<string, unknown>;
	try {
		rawContract = getRawJson(readFileSync(contractPath, "utf-8"));
	} catch (error) {
		return {
			path: repoPath,
			status: "error",
			findings: [],
			error:
				error instanceof Error ? error.message : "Failed to parse contract",
		};
	}

	let contract: HarnessContract;
	try {
		contract = loadContract(contractPath, repoPath);
	} catch (error) {
		return {
			path: repoPath,
			status: "error",
			findings: [],
			error: error instanceof Error ? error.message : "Failed to load contract",
		};
	}

	const findings: ToolingAuditFinding[] = [];
	if (!Object.prototype.hasOwnProperty.call(rawContract, "toolingPolicy")) {
		findings.push({
			path: "toolingPolicy",
			severity: "warning",
			description:
				"Contract relies on implicit tooling defaults; run 'harness upgrade --dry-run' to preview a safe upgrade path, or 'harness init --update' to re-scaffold tracked files when needed",
		});
	}

	auditReadinessScript(findings, repoPath, contract);
	auditMise(findings, repoPath, contract);
	auditCodexEnvironment(findings, repoPath, contract);
	auditMakefile(findings, repoPath, contract);
	auditProjectBrainMemoryExtension(findings, repoPath, contract);
	auditPackagePolicy(findings, repoPath, contract);
	auditLocalHooks(findings, repoPath);
	if (baseContract) {
		auditBaseDrift(findings, contract, baseContract);
	}

	return {
		path: repoPath,
		status: "success",
		findings,
	};
}

/**
 * Executes tooling-audit checks over discovered repositories.
 */
export async function runToolingAudit(
	options: ToolingAuditOptions,
): Promise<CliResult<{ result: ToolingAuditResult; exitCode: number }>> {
	const pathValidation = validatePathInput(options.path, "path");
	if (!pathValidation.ok) {
		return err(pathValidation.error);
	}
	const validatedPath = pathValidation.value.safePath;
	const repos = findRepositories(validatedPath);
	if (repos.length === 0) {
		return ok({
			result: {
				totalRepos: 0,
				successfulRepos: 0,
				errors: 0,
				noContract: 0,
				findings: { total: 0, critical: 0, warning: 0, info: 0 },
				results: [],
			},
			exitCode: EXIT_CODES.NO_REPOS_FOUND,
		});
	}

	const results = await Promise.all(
		repos.map((repo) =>
			auditRepository(repo, options.baseContract, options.includeMissing),
		),
	);
	const findings = summarizeFindings(results);
	const errors = results.filter((result) => result.status === "error").length;
	const noContract = results.filter(
		(result) => result.status === "no-contract",
	).length;
	const successfulRepos = results.filter(
		(result) => result.status === "success",
	).length;
	const result: ToolingAuditResult = {
		totalRepos: repos.length,
		successfulRepos,
		errors,
		noContract,
		findings,
		results,
	};

	let exitCode: (typeof EXIT_CODES)[keyof typeof EXIT_CODES] =
		EXIT_CODES.SUCCESS;
	if (errors > 0) {
		exitCode = EXIT_CODES.SCAN_ERRORS;
	} else if (findings.critical > 0 || findings.warning > 0) {
		exitCode = EXIT_CODES.DRIFT_DETECTED;
	}

	return ok({ result, exitCode });
}

function formatJson(result: ToolingAuditResult): string {
	return JSON.stringify(result, null, 2);
}

function formatMarkdown(result: ToolingAuditResult): string {
	const lines: string[] = [];
	lines.push("# Tooling Audit Report", "", "## Summary", "");
	lines.push(`- **Total Repositories**: ${result.totalRepos}`);
	lines.push(`- **Successful**: ${result.successfulRepos}`);
	lines.push(`- **Errors**: ${result.errors}`);
	lines.push(`- **No Contract**: ${result.noContract}`);
	lines.push(`- **Critical Findings**: ${result.findings.critical}`);
	lines.push(`- **Warning Findings**: ${result.findings.warning}`);
	lines.push("");
	for (const repo of result.results) {
		lines.push(`## ${repo.path}`, "");
		if (repo.status === "error") {
			lines.push(`- Error: ${repo.error ?? "Unknown error"}`, "");
			continue;
		}
		if (repo.status === "no-contract") {
			lines.push("- No harness contract found.", "");
			continue;
		}
		if (repo.findings.length === 0) {
			lines.push("- No tooling drift detected.", "");
			continue;
		}
		for (const finding of repo.findings) {
			lines.push(`- [${finding.severity}] ${finding.description}`);
		}
		lines.push("");
	}
	return lines.join("\n");
}

function formatTable(result: ToolingAuditResult): string {
	const lines: string[] = [];
	lines.push("Tooling Audit Report", "====================", "");
	lines.push(`Total Repositories: ${result.totalRepos}`);
	lines.push(`Successful: ${result.successfulRepos}`);
	lines.push(`Errors: ${result.errors}`);
	lines.push(`No Contract: ${result.noContract}`);
	lines.push(`Critical Findings: ${result.findings.critical}`);
	lines.push(`Warning Findings: ${result.findings.warning}`);
	lines.push("");
	for (const repo of result.results) {
		lines.push(`${repo.path}:`);
		if (repo.status === "error") {
			lines.push(`  ❌ ${repo.error ?? "Unknown error"}`);
			lines.push("");
			continue;
		}
		if (repo.status === "no-contract") {
			lines.push("  ℹ️ no harness contract found");
			lines.push("");
			continue;
		}
		if (repo.findings.length === 0) {
			lines.push("  ✅ no tooling drift detected");
			lines.push("");
			continue;
		}
		for (const finding of repo.findings) {
			const icon =
				finding.severity === "critical"
					? "❌"
					: finding.severity === "warning"
						? "⚠️"
						: "ℹ️";
			lines.push(`  ${icon} [${finding.severity}] ${finding.description}`);
		}
		lines.push("");
	}
	return lines.join("\n");
}

/**
 * CLI argument parser and output wrapper for tooling-audit.
 */
export async function runToolingAuditCLI(args: string[]): Promise<{
	exitCode: number;
	output?: string;
}> {
	const flagsWithValues = new Set(["--path", "--base", "--format"]);
	const booleanFlags = new Set(["--include-missing", "--json"]);
	for (let i = 0; i < args.length; i += 1) {
		const arg = args[i];
		if (!arg) continue;
		if (!arg.startsWith("-")) {
			console.error(`Error: Unexpected positional argument '${arg}'`);
			return { exitCode: EXIT_CODES.INVALID_ARGUMENT };
		}
		if (flagsWithValues.has(arg)) {
			const next = args[i + 1];
			if (!next || next.startsWith("-")) {
				console.error(`Error: ${arg} requires a value`);
				return { exitCode: EXIT_CODES.INVALID_ARGUMENT };
			}
			i += 1;
			continue;
		}
		if (booleanFlags.has(arg)) {
			continue;
		}
		console.error(`Error: Unknown flag '${arg}'`);
		return { exitCode: EXIT_CODES.INVALID_ARGUMENT };
	}

	const pathIndex = args.indexOf("--path");
	const baseIndex = args.indexOf("--base");
	const formatIndex = args.indexOf("--format");
	const includeMissing = args.includes("--include-missing");
	const jsonFlag = args.includes("--json");
	let scanPath = pathIndex === -1 ? process.cwd() : args[pathIndex + 1];
	if (!scanPath) {
		scanPath = process.cwd();
	}
	const pathValidation = validatePathInput(scanPath, "--path");
	if (!pathValidation.ok) {
		console.error(`Error: ${pathValidation.error.message}`);
		return { exitCode: EXIT_CODES.INVALID_ARGUMENT };
	}
	scanPath = pathValidation.value.absolutePath;
	if (!existsSync(scanPath)) {
		console.error(`Error: Path does not exist: ${scanPath}`);
		return { exitCode: EXIT_CODES.INVALID_ARGUMENT };
	}
	if (!statSync(scanPath).isDirectory()) {
		console.error(`Error: Path is not a directory: ${scanPath}`);
		return { exitCode: EXIT_CODES.INVALID_ARGUMENT };
	}

	let baseContract: HarnessContract | undefined;
	if (baseIndex !== -1) {
		const rawBasePath = args[baseIndex + 1];
		if (!rawBasePath) {
			console.error("Error: --base requires a path argument");
			return { exitCode: EXIT_CODES.INVALID_ARGUMENT };
		}
		const baseValidation = validatePathInput(rawBasePath, "--base");
		if (!baseValidation.ok) {
			console.error(`Error: ${baseValidation.error.message}`);
			return { exitCode: EXIT_CODES.INVALID_ARGUMENT };
		}
		try {
			baseContract = loadContract(
				baseValidation.value.safePath,
				dirname(baseValidation.value.safePath),
			);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			console.error(`Error loading base contract: ${message}`);
			return { exitCode: EXIT_CODES.INVALID_ARGUMENT };
		}
	}

	let format: OutputFormat = "table";
	if (jsonFlag || formatIndex !== -1) {
		const formatArg = jsonFlag ? "json" : args[formatIndex + 1];
		if (
			formatArg === "json" ||
			formatArg === "markdown" ||
			formatArg === "table"
		) {
			format = formatArg;
		}
	}

	const auditResult = await runToolingAudit({
		path: scanPath,
		baseContract,
		format,
		includeMissing,
	});
	if (!auditResult.ok) {
		console.error(`Error: ${auditResult.error.message}`);
		return { exitCode: EXIT_CODES.INVALID_ARGUMENT };
	}

	const { result, exitCode } = auditResult.value;
	const output =
		format === "json"
			? formatJson(result)
			: format === "markdown"
				? formatMarkdown(result)
				: formatTable(result);
	console.info(output);
	return { exitCode, output };
}

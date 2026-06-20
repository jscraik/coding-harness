#!/usr/bin/env node
const { existsSync, readFileSync } = require("node:fs");
const { join, normalize, sep } = require("node:path");

const repoRoot = process.cwd();
const policyPath = join(repoRoot, "coding-policy.json");
const schemaPath = join(repoRoot, "contracts/coding-policy.schema.json");
const expectedModules = new Map([
	["foundations", "codestyle/01-foundations.md"],
	["docs-config-release", "codestyle/04-docs-config-and-release.md"],
	["quality-security-ops", "codestyle/05-quality-security-ops.md"],
	["shell", "codestyle/10-shell-bash-zsh.md"],
	["package-managers", "codestyle/11-package-managers-pnpm-npm.md"],
	["git-workflow", "codestyle/13-git-workflow.md"],
	["security", "codestyle/16-security.md"],
	["testing", "codestyle/17-testing.md"],
	["development-workflow", "codestyle/19-development-workflow.md"],
]);
const expectedModuleIds = new Set(expectedModules.keys());
const expectedModulePaths = new Set(expectedModules.values());
const expectedSourceRules = new Set([
	"boy-scout",
	"ci-safety",
	"code-formatting",
	"commit-conventions",
	"context-artifacts",
	"context-writing-style",
	"dependency-management",
	"error-handling",
	"file-hygiene",
	"no-secrets",
	"plugin-evals",
	"rule-frontmatter",
	"script-as-black-box",
	"script-delegation",
	"skill-authoring",
	"stateful-artifacts",
	"sync-before-work",
	"testing-standards",
]);

function parseArgs(argv) {
	const options = { json: false, changedFiles: [] };
	const errors = [];
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === "--json") {
			options.json = true;
			continue;
		}
		if (arg === "--changed-file") {
			const next = argv[index + 1];
			if (next === undefined) {
				errors.push("--changed-file requires a path");
				continue;
			}
			options.changedFiles.push(next);
			index += 1;
			continue;
		}
		if (arg === "--changed-files" || arg === "--") {
			options.changedFiles.push(...argv.slice(index + 1));
			break;
		}
		errors.push(`unknown argument ${arg}`);
	}
	return { options, errors };
}

function readJson(path) {
	return JSON.parse(readFileSync(path, "utf8"));
}

function normalizeRepoPath(relativePath) {
	return normalize(relativePath).replace(/\\/g, "/").replace(/^\.\//, "");
}

function hasParentSegment(relativePath) {
	return relativePath.split(/[\\/]+/).includes("..");
}

function isInsideRepo(relativePath) {
	const normalized = normalizeRepoPath(relativePath);
	return (
		normalized.length > 0 &&
		!hasParentSegment(relativePath) &&
		!/^[A-Za-z]:\//.test(normalized) &&
		!normalized.startsWith("..") &&
		!normalized.startsWith(sep) &&
		!normalized.startsWith("/")
	);
}

function requireString(value, path, errors) {
	if (typeof value !== "string" || value.trim().length === 0) {
		errors.push(`${path} must be a non-empty string`);
	}
}

function isObject(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireObject(value, path, errors) {
	if (!isObject(value)) {
		errors.push(`${path} must be an object`);
		return false;
	}
	return true;
}

function requireOnlyKeys(value, allowedKeys, path, errors) {
	if (!requireObject(value, path, errors)) return;
	const allowed = new Set(allowedKeys);
	for (const key of Object.keys(value)) {
		if (!allowed.has(key)) {
			errors.push(`${path} additional property ${key} is not allowed`);
		}
	}
	for (const key of allowedKeys) {
		if (!(key in value)) {
			errors.push(`${path}.${key} is required`);
		}
	}
}

function requireUniqueStrings(values, path, errors) {
	const seen = new Set();
	for (const [index, value] of values.entries()) {
		requireString(value, `${path}[${index}]`, errors);
		if (typeof value !== "string") continue;
		if (seen.has(value)) {
			errors.push(`${path} duplicates ${value}`);
			continue;
		}
		seen.add(value);
	}
}

function requireRepoRelativePattern(pattern, path, errors) {
	requireString(pattern, path, errors);
	if (typeof pattern !== "string") return;
	if (!isInsideRepo(pattern)) {
		errors.push(`${path} must be repo-relative`);
	}
	if (pattern.includes("\\")) {
		errors.push(`${path} must use forward slashes`);
	}
	if (pattern.includes("//")) {
		errors.push(`${path} must not contain empty path segments`);
	}
	try {
		globToRegExp(pattern);
	} catch (error) {
		errors.push(`${path} is not a valid route pattern: ${error.message}`);
	}
}

function escapeRegExp(value) {
	return value.replace(/[|\\{}()[\]^$+?.*]/g, "\\$&");
}

function globToRegExp(pattern) {
	const escaped = escapeRegExp(pattern)
		.replace(/\\\*\\\*\\\//g, "(?:.*/)?")
		.replace(/\\\*\\\*/g, ".*")
		.replace(/\\\*/g, "[^/]*");
	return new RegExp(`^${escaped}$`);
}

function matchesPattern(relativePath, pattern) {
	return globToRegExp(pattern).test(normalizeRepoPath(relativePath));
}

function uniqueStrings(values) {
	return Array.from(new Set(values));
}

function buildPolicyRoute(policy, changedFiles) {
	const normalizedChangedFiles = uniqueStrings(
		changedFiles.map(normalizeRepoPath).filter((file) => file.length > 0),
	);
	const routedModules = [];
	for (const module of policy.policyModules) {
		const matchedFiles = normalizedChangedFiles.filter((file) =>
			module.changedFilePatterns.some((pattern) =>
				matchesPattern(file, pattern),
			),
		);
		if (matchedFiles.length === 0) continue;
		routedModules.push({
			id: module.id,
			path: module.path,
			changedFilePatterns: module.changedFilePatterns,
			sourceRules: module.sourceRules,
			requiredGates: module.requiredGates,
			matchedFiles,
		});
	}
	return {
		schemaVersion: "coding-policy-route/v1",
		policySchemaVersion: policy.schemaVersion,
		authority: policy.authority,
		entrypoints: policy.entrypoints,
		changedFiles: normalizedChangedFiles,
		policyModules: routedModules,
		requiredGates: uniqueStrings(
			routedModules.flatMap((module) => module.requiredGates),
		),
		claimBoundaries: policy.claimBoundaries,
	};
}

function validatePolicy(policy, schema) {
	const errors = [];
	requireOnlyKeys(
		policy,
		[
			"$schema",
			"schemaVersion",
			"authority",
			"entrypoints",
			"policyModules",
			"claimBoundaries",
		],
		"coding-policy",
		errors,
	);
	if (!isObject(policy)) return errors;
	if (policy.$schema !== "./contracts/coding-policy.schema.json") {
		errors.push("$schema must be ./contracts/coding-policy.schema.json");
	}
	if (schema?.additionalProperties !== false) {
		errors.push("schema root must disallow additional properties");
	}
	if (schema?.$defs?.policyModule?.additionalProperties !== false) {
		errors.push("schema policyModule must disallow additional properties");
	}
	if (
		schema?.$defs?.policyModule?.properties?.sourceRules?.uniqueItems !== true
	) {
		errors.push("schema policyModule.sourceRules must be unique");
	}
	if (
		schema?.$defs?.policyModule?.properties?.requiredGates?.uniqueItems !== true
	) {
		errors.push("schema policyModule.requiredGates must be unique");
	}
	if (
		schema?.$defs?.policyModule?.properties?.changedFilePatterns
			?.uniqueItems !== true
	) {
		errors.push("schema policyModule.changedFilePatterns must be unique");
	}
	if (policy?.schemaVersion !== "harness-coding-policy/v1") {
		errors.push("schemaVersion must be harness-coding-policy/v1");
	}
	if (policy?.authority !== "canonical") {
		errors.push("authority must be canonical");
	}
	requireOnlyKeys(
		policy.entrypoints,
		["human", "machine", "modules"],
		"entrypoints",
		errors,
	);
	if (policy?.entrypoints?.human !== "CODESTYLE.md") {
		errors.push("entrypoints.human must be CODESTYLE.md");
	}
	if (policy?.entrypoints?.machine !== "coding-policy.json") {
		errors.push("entrypoints.machine must be coding-policy.json");
	}
	if (policy?.entrypoints?.modules !== "codestyle/README.md") {
		errors.push("entrypoints.modules must be codestyle/README.md");
	}
	if (
		!Array.isArray(policy?.policyModules) ||
		policy.policyModules.length === 0
	) {
		errors.push("policyModules must be a non-empty array");
		return errors;
	}

	const seenIds = new Set();
	for (const [index, module] of policy.policyModules.entries()) {
		const prefix = `policyModules[${index}]`;
		requireOnlyKeys(
			module,
			["id", "path", "changedFilePatterns", "sourceRules", "requiredGates"],
			prefix,
			errors,
		);
		requireString(module?.id, `${prefix}.id`, errors);
		requireString(module?.path, `${prefix}.path`, errors);
		if (!expectedModuleIds.has(module?.id)) {
			errors.push(`${prefix}.id is not a known policy module`);
		}
		if (!expectedModulePaths.has(module?.path)) {
			errors.push(`${prefix}.path is not a known policy module path`);
		}
		const expectedPath = expectedModules.get(module?.id);
		if (expectedPath !== undefined && module?.path !== expectedPath) {
			errors.push(
				`${prefix}.path must be ${expectedPath} for module ${module.id}`,
			);
		}
		if (seenIds.has(module?.id)) {
			errors.push(`${prefix}.id duplicates ${module.id}`);
		}
		seenIds.add(module?.id);
		if (!isInsideRepo(module?.path ?? "")) {
			errors.push(`${prefix}.path must be repo-relative`);
		} else if (!existsSync(join(repoRoot, module.path))) {
			errors.push(`${prefix}.path does not exist: ${module.path}`);
		}
		if (
			!Array.isArray(module?.changedFilePatterns) ||
			module.changedFilePatterns.length === 0
		) {
			errors.push(`${prefix}.changedFilePatterns must be a non-empty array`);
		} else {
			requireUniqueStrings(
				module.changedFilePatterns,
				`${prefix}.changedFilePatterns`,
				errors,
			);
			for (const [
				patternIndex,
				pattern,
			] of module.changedFilePatterns.entries()) {
				requireRepoRelativePattern(
					pattern,
					`${prefix}.changedFilePatterns[${patternIndex}]`,
					errors,
				);
			}
		}
		if (
			!Array.isArray(module?.sourceRules) ||
			module.sourceRules.length === 0
		) {
			errors.push(`${prefix}.sourceRules must be a non-empty array`);
		} else {
			requireUniqueStrings(module.sourceRules, `${prefix}.sourceRules`, errors);
			for (const rule of module.sourceRules) {
				if (!expectedSourceRules.has(rule)) {
					errors.push(`${prefix}.sourceRules contains unknown rule ${rule}`);
				}
			}
		}
		if (
			!Array.isArray(module?.requiredGates) ||
			module.requiredGates.length === 0
		) {
			errors.push(`${prefix}.requiredGates must be a non-empty array`);
		} else {
			requireUniqueStrings(
				module.requiredGates,
				`${prefix}.requiredGates`,
				errors,
			);
		}
	}
	for (const id of expectedModuleIds) {
		if (!seenIds.has(id)) {
			errors.push(`policyModules missing required module ${id}`);
		}
	}
	if (
		!Array.isArray(policy?.claimBoundaries) ||
		policy.claimBoundaries.length === 0
	) {
		errors.push("claimBoundaries must be a non-empty array");
	} else {
		for (const [index, boundary] of policy.claimBoundaries.entries()) {
			requireString(boundary, `claimBoundaries[${index}]`, errors);
		}
	}
	return errors;
}

const parsedArgs = parseArgs(process.argv.slice(2));
if (parsedArgs.errors.length > 0) {
	console.error("coding-policy: failed");
	for (const error of parsedArgs.errors) console.error(`- ${error}`);
	process.exit(1);
}

if (!existsSync(policyPath)) {
	console.error("coding-policy: missing coding-policy.json");
	process.exit(1);
}
if (!existsSync(schemaPath)) {
	console.error("coding-policy: missing contracts/coding-policy.schema.json");
	process.exit(1);
}

let policy;
let schema;
try {
	policy = readJson(policyPath);
} catch (error) {
	console.error(
		`coding-policy: failed to parse coding-policy.json: ${error.message}`,
	);
	process.exit(1);
}

try {
	schema = readJson(schemaPath);
} catch (error) {
	console.error(
		"coding-policy: failed to parse contracts/coding-policy.schema.json: " +
			error.message,
	);
	process.exit(1);
}

const errors = validatePolicy(policy, schema);
for (const [index, changedFile] of parsedArgs.options.changedFiles.entries()) {
	if (!isInsideRepo(changedFile)) {
		errors.push(`changedFiles[${index}] must be repo-relative`);
	}
}
if (errors.length > 0) {
	console.error("coding-policy: failed");
	for (const error of errors) console.error(`- ${error}`);
	process.exit(1);
}

if (parsedArgs.options.json) {
	const payload =
		parsedArgs.options.changedFiles.length > 0
			? buildPolicyRoute(policy, parsedArgs.options.changedFiles)
			: {
					schemaVersion: "coding-policy-validation/v1",
					status: "pass",
					policySchemaVersion: policy.schemaVersion,
					authority: policy.authority,
					policyModules: policy.policyModules.length,
					claimBoundaries: policy.claimBoundaries.length,
				};
	process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
} else {
	console.log(
		"coding-policy: pass (" +
			policy.policyModules.length +
			" modules, " +
			policy.claimBoundaries.length +
			" claim boundaries)",
	);
	if (parsedArgs.options.changedFiles.length > 0) {
		const route = buildPolicyRoute(policy, parsedArgs.options.changedFiles);
		console.log(
			"coding-policy: route (" +
				route.policyModules.length +
				" modules, " +
				route.requiredGates.length +
				" required gates)",
		);
	}
}

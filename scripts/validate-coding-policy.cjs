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

function readJson(path) {
	return JSON.parse(readFileSync(path, "utf8"));
}

function isInsideRepo(relativePath) {
	const normalized = normalize(relativePath);
	return (
		normalized.length > 0 &&
		!normalized.startsWith("..") &&
		!normalized.startsWith(sep)
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
			["id", "path", "sourceRules", "requiredGates"],
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
if (errors.length > 0) {
	console.error("coding-policy: failed");
	for (const error of errors) console.error(`- ${error}`);
	process.exit(1);
}

console.log(
	"coding-policy: pass (" +
		policy.policyModules.length +
		" modules, " +
		policy.claimBoundaries.length +
		" claim boundaries)",
);

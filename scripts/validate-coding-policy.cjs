#!/usr/bin/env node
const { existsSync, readFileSync } = require("node:fs");
const { join, normalize, sep } = require("node:path");

const repoRoot = process.cwd();
const policyPath = join(repoRoot, "coding-policy.json");
const schemaPath = join(repoRoot, "contracts/coding-policy.schema.json");
const expectedModuleIds = new Set([
	"foundations",
	"docs-config-release",
	"quality-security-ops",
	"shell",
	"package-managers",
	"git-workflow",
	"security",
	"testing",
	"development-workflow",
]);
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

function validatePolicy(policy) {
	const errors = [];
	if (policy?.schemaVersion !== "harness-coding-policy/v1") {
		errors.push("schemaVersion must be harness-coding-policy/v1");
	}
	if (policy?.authority !== "canonical") {
		errors.push("authority must be canonical");
	}
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
		requireString(module?.id, `${prefix}.id`, errors);
		requireString(module?.path, `${prefix}.path`, errors);
		if (!expectedModuleIds.has(module?.id)) {
			errors.push(`${prefix}.id is not a known policy module`);
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
			for (const [gateIndex, gate] of module.requiredGates.entries()) {
				requireString(gate, `${prefix}.requiredGates[${gateIndex}]`, errors);
			}
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
try {
	policy = readJson(policyPath);
} catch (error) {
	console.error(
		`coding-policy: failed to parse coding-policy.json: ${error.message}`,
	);
	process.exit(1);
}

try {
	readJson(schemaPath);
} catch (error) {
	console.error(
		"coding-policy: failed to parse contracts/coding-policy.schema.json: " +
			error.message,
	);
	process.exit(1);
}

const errors = validatePolicy(policy);
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

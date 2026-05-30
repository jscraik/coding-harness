#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const manifestPath = "src/lib/testing/behavior-test-suites.json";
const manifest = loadBehaviorTestSuiteManifest(manifestPath);

const findings = [];

for (const entry of manifest.suites) {
	const absolutePath = resolve(repoRoot, entry.path);
	if (!existsSync(absolutePath)) {
		findings.push({
			...entry,
			message: "required high-trust test file is missing",
		});
		continue;
	}

	const source = readFileSync(absolutePath, "utf8");
	if (!/\bexpectBehavior\s*\(/u.test(source)) {
		findings.push({
			...entry,
			message:
				"required high-trust test file must use expectBehavior({ given, should, actual, expected })",
		});
	}
}

if (findings.length > 0) {
	console.error("[check-behavior-tests] evidence-bearing test gaps found:");
	for (const finding of findings) {
		console.error(
			`  ${relative(repoRoot, resolve(repoRoot, finding.path))} [${finding.area}]: ${finding.message}`,
		);
	}
	process.exit(1);
}

console.info(
	`[check-behavior-tests] checked ${manifest.suites.length} high-trust test file(s); behavior assertions present.`,
);

function loadBehaviorTestSuiteManifest(path) {
	const absolutePath = resolve(repoRoot, path);
	if (!existsSync(absolutePath)) {
		console.error(
			`[check-behavior-tests] missing behavior-test suite manifest: ${path}`,
		);
		process.exit(1);
	}

	const parsed = JSON.parse(readFileSync(absolutePath, "utf8"));
	const findings = [];
	if (parsed.schemaVersion !== "behavior-test-suites/v1") {
		findings.push("schemaVersion must be behavior-test-suites/v1");
	}
	if (!Array.isArray(parsed.suites) || parsed.suites.length === 0) {
		findings.push("suites must be a non-empty array");
	}

	for (const [index, suite] of (parsed.suites ?? []).entries()) {
		for (const field of ["area", "path", "rationale"]) {
			if (typeof suite?.[field] !== "string" || suite[field].trim() === "") {
				findings.push(`suites[${index}].${field} must be a non-empty string`);
			}
		}
	}

	if (findings.length > 0) {
		console.error(
			"[check-behavior-tests] invalid behavior-test suite manifest:",
		);
		for (const finding of findings) {
			console.error(`  ${finding}`);
		}
		process.exit(1);
	}

	return parsed;
}

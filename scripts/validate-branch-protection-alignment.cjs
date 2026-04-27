#!/usr/bin/env node

const { readFileSync, existsSync } = require("node:fs");
const { resolve } = require("node:path");

const MANIFEST_PATH = resolve(".harness/ci-required-checks.json");
const CONTRACT_PATH = resolve("harness.contract.json");

function main() {
	const errors = [];

	if (!existsSync(MANIFEST_PATH)) {
		errors.push(`Manifest not found: ${MANIFEST_PATH}`);
	}
	if (!existsSync(CONTRACT_PATH)) {
		errors.push(`Contract not found: ${CONTRACT_PATH}`);
	}

	if (errors.length > 0) {
		for (const error of errors) {
			console.error(`validate-branch-protection-alignment: ${error}`);
		}
		process.exit(1);
	}

	let manifest;
	let contract;
	try {
		manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
	} catch {
		errors.push(`Failed to parse manifest: ${MANIFEST_PATH}`);
	}
	try {
		contract = JSON.parse(readFileSync(CONTRACT_PATH, "utf8"));
	} catch {
		errors.push(`Failed to parse contract: ${CONTRACT_PATH}`);
	}

	if (errors.length > 0) {
		for (const error of errors) {
			console.error(`validate-branch-protection-alignment: ${error}`);
		}
		process.exit(1);
	}

	const activeProvider = manifest.activeProvider || "";
	const manifestChecks = new Set(
		(manifest.requiredChecks || [])
			.filter((entry) => {
				const provider =
					entry.sourceAppSlug || entry.sourceAppId || entry.provider || "";
				return provider === activeProvider;
			})
			.map((entry) => entry.githubCheckName)
			.filter(Boolean),
	);

	// Include non-provider checks (external apps like CodeRabbit, Semgrep)
	for (const entry of manifest.requiredChecks || []) {
		const provider =
			entry.sourceAppSlug || entry.sourceAppId || entry.provider || "";
		if (provider !== activeProvider && entry.githubCheckName) {
			manifestChecks.add(entry.githubCheckName);
		}
	}

	const contractChecks = new Set(
		(contract.branchProtection?.requiredChecks || []).filter(Boolean),
	);

	const missingFromContract = [];
	for (const check of manifestChecks) {
		if (!contractChecks.has(check)) {
			missingFromContract.push(check);
		}
	}

	const extraInContract = [];
	for (const check of contractChecks) {
		if (!manifestChecks.has(check)) {
			extraInContract.push(check);
		}
	}

	if (missingFromContract.length > 0) {
		errors.push(
			`branchProtection.requiredChecks missing manifest checks: ${missingFromContract.join(", ")}`,
		);
	}
	if (extraInContract.length > 0) {
		errors.push(
			`branchProtection.requiredChecks has extra checks not in manifest: ${extraInContract.join(", ")}`,
		);
	}

	if (errors.length > 0) {
		console.error("validate-branch-protection-alignment: FAILED");
		for (const error of errors) {
			console.error(`  - ${error}`);
		}
		console.error(
			"\nFix: update harness.contract.json branchProtection.requiredChecks to match the unique githubCheckName values in .harness/ci-required-checks.json",
		);
		process.exit(1);
	}

	console.info(
		`validate-branch-protection-alignment: pass (${contractChecks.size} checks aligned with manifest)`,
	);
	process.exit(0);
}

main();

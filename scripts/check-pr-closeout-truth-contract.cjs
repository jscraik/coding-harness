#!/usr/bin/env node
/**
 * Verifies that pr-closeout/v1 keeps the claim-vs-evidence truth contract.
 *
 * This is intentionally a small source invariant checker rather than a broad
 * dependency or AST platform. Runtime behavior still belongs in Vitest; this
 * gate protects the contract shape and required false-success fixtures.
 */

"use strict";

const { existsSync, readFileSync } = require("node:fs");
const { resolve } = require("node:path");

const SCHEMA_VERSION = "architecture-invariant-gate/v1";
const GATE_ID = "pr-closeout-truth-contract";

const args = process.argv.slice(2);
const jsonOutput = args.includes("--json") || !args.includes("--format");
const rootArgIndex = args.indexOf("--root");
if (
	rootArgIndex !== -1 &&
	(!args[rootArgIndex + 1] || args[rootArgIndex + 1].startsWith("-"))
) {
	console.error("--root requires a repository path argument");
	process.exit(2);
}
const repoRoot =
	rootArgIndex === -1 ? process.cwd() : resolve(args[rootArgIndex + 1]);

const REQUIRED_CLAIM_FIELDS = [
	"claim",
	"status",
	"evidenceRef",
	"source",
	"headSha",
	"freshness",
	"blockerClass",
	"missingContext",
	"verifiedAt",
];

const REQUIRED_CLAIM_STATUSES = [
	"pass",
	"fail",
	"blocked",
	"unknown",
	"not_applicable",
];

const REQUIRED_CLAIMS = [
	"tests_passed",
	"ci_green",
	"review_threads_resolved",
	"pr_metadata_ready",
	"branch_current_with_base",
	"linear_tracker_state_aligned",
	"independent_review_status_known",
	"required_checks_match_current_head",
	"rollback_path_named_or_not_applicable",
];

const REQUIRED_FIXTURES = [
	{
		id: "missing-tests-fixture",
		path: "src/lib/pr-closeout.test.ts",
		pattern: /blocks success when test evidence is missing/,
		message: "missing test evidence fixture is absent",
	},
	{
		id: "stale-sha-fixture",
		path: "src/lib/pr-closeout.test.ts",
		pattern: /blocks success when required check evidence is stale/,
		message: "stale SHA fixture is absent",
	},
	{
		id: "unknown-ci-fixture",
		path: "src/lib/pr-closeout.test.ts",
		pattern: /blocks success when CI state is unknown/,
		message: "unknown CI fixture is absent",
	},
	{
		id: "missing-linear-fixture",
		path: "src/lib/pr-closeout.test.ts",
		pattern: /blocks success when Linear tracker state is missing/,
		message: "missing Linear tracker fixture is absent",
	},
	{
		id: "missing-rollback-fixture",
		path: "src/lib/pr-closeout.test.ts",
		pattern: /blocks success when rollback evidence is missing/,
		message: "missing rollback fixture is absent",
	},
	{
		id: "current-head-command-fixture",
		path: "src/commands/pr-closeout.test.ts",
		pattern: /headRefOid/,
		message:
			"command fixture must preserve current-head evidence from gh pr view",
	},
];

function read(relativePath) {
	const absolutePath = resolve(repoRoot, relativePath);
	if (!existsSync(absolutePath)) {
		return { content: "", missing: true };
	}
	return { content: readFileSync(absolutePath, "utf8"), missing: false };
}

function finding(id, file, message, remediation) {
	return {
		id,
		severity: "error",
		file,
		message,
		remediation,
	};
}

function interfaceBody(source, name) {
	const match = source.match(
		new RegExp(
			`export\\s+interface\\s+${name}\\s*\\{(?<body>[\\s\\S]*?)\\n\\s*\\}`,
		),
	);
	return match?.groups?.body ?? "";
}

function requirePattern(
	findings,
	id,
	file,
	content,
	pattern,
	message,
	remediation,
) {
	if (!pattern.test(content)) {
		findings.push(finding(id, file, message, remediation));
	}
}

function checkClaimContract(findings) {
	const contractFile = "src/lib/pr-closeout/types.ts";
	const implementationFile = "src/lib/pr-closeout/claim-builders.ts";
	const helperFile = "src/lib/pr-closeout/claim-helpers.ts";
	const contractSource = read(contractFile);
	const implementationSource = read(implementationFile);
	const helperSource = read(helperFile);
	if (contractSource.missing) {
		findings.push(
			finding(
				"missing-claim-contract-module",
				contractFile,
				"claim contract module is missing",
				"Restore src/lib/pr-closeout/types.ts with the PrCloseoutClaim contract.",
			),
		);
		return;
	}
	if (implementationSource.missing) {
		findings.push(
			finding(
				"missing-claim-builders-module",
				implementationFile,
				"claim builder module is missing",
				"Restore src/lib/pr-closeout/claim-builders.ts with the required closeout claim builders.",
			),
		);
		return;
	}
	if (helperSource.missing) {
		findings.push(
			finding(
				"missing-claim-helpers-module",
				helperFile,
				"claim helper module is missing",
				"Restore src/lib/pr-closeout/claim-helpers.ts with claim factory and evidence helpers.",
			),
		);
		return;
	}
	const content = implementationSource.content;
	const helperContent = helperSource.content;
	const contractContent = contractSource.content;

	const claimBody = interfaceBody(contractContent, "PrCloseoutClaim");
	for (const field of REQUIRED_CLAIM_FIELDS) {
		requirePattern(
			findings,
			`claim-field-${field}`,
			contractFile,
			claimBody,
			new RegExp(`\\b${field}\\b`),
			`PrCloseoutClaim is missing required field: ${field}`,
			`Add ${field} to PrCloseoutClaim and populate it from verifier evidence.`,
		);
	}

	for (const status of REQUIRED_CLAIM_STATUSES) {
		requirePattern(
			findings,
			`claim-status-${status}`,
			contractFile,
			contractContent,
			new RegExp(`["']${status}["']`),
			`PrCloseoutClaimStatus is missing status: ${status}`,
			"Keep claim status vocabulary aligned with pr-closeout/v1.",
		);
	}

	for (const claim of REQUIRED_CLAIMS) {
		requirePattern(
			findings,
			`required-claim-${claim}`,
			implementationFile,
			content,
			new RegExp(`["']${claim}["']`),
			`required closeout claim is missing: ${claim}`,
			"Restore the full required claim set so closeout cannot skip evidence surfaces.",
		);
	}

	requirePattern(
		findings,
		"claim-builders-classify-missing-context",
		helperFile,
		helperContent,
		/classifyMissingContext[\s\S]*problem:/,
		"claim builders must classify missing context when evidence is absent, stale, blocked, or unknown",
		"Route non-passing claim evidence through classifyMissingContext before blockers are projected.",
	);

	const blockerProjectionFile = "src/lib/pr-closeout/claims.ts";
	const blockerProjectionSource = read(blockerProjectionFile);
	if (blockerProjectionSource.missing) {
		findings.push(
			finding(
				"missing-claims-module",
				blockerProjectionFile,
				"claim blocker projection module is missing",
				"Restore src/lib/pr-closeout/claims.ts with claim blocker projection.",
			),
		);
		return;
	}
	const blockerContent = blockerProjectionSource.content;
	requirePattern(
		findings,
		"claim-blockers-fail-closed",
		blockerProjectionFile,
		blockerContent,
		/claim\.status\s*===\s*["']pass["'][\s\S]*claim\.status\s*===\s*["']not_applicable["'][\s\S]*continue/,
		"collectClaimBlockers must only skip pass and not_applicable claims",
		"Ensure fail, blocked, unknown, and stale claims produce blockers.",
	);
	requirePattern(
		findings,
		"claim-blockers-carry-missing-context",
		blockerProjectionFile,
		blockerContent,
		/missingContext[\s\S]*claim\.missingContext/,
		"claim blockers must carry missing-context classification when present",
		"Spread claim.missingContext onto emitted PrCloseoutBlocker records.",
	);
}

function checkReportContract(findings) {
	const contractFile = "src/lib/pr-closeout/types.ts";
	const evaluatorFile = "src/lib/pr-closeout/evaluator.ts";
	const contractSource = read(contractFile);
	const evaluatorSource = read(evaluatorFile);
	if (contractSource.missing) {
		findings.push(
			finding(
				"missing-closeout-contract-module",
				contractFile,
				"pr-closeout report contract module is missing",
				"Restore src/lib/pr-closeout/types.ts with PrCloseoutReport and the schema version.",
			),
		);
		return;
	}
	if (evaluatorSource.missing) {
		findings.push(
			finding(
				"missing-closeout-evaluator-module",
				evaluatorFile,
				"pr-closeout report evaluator module is missing",
				"Restore src/lib/pr-closeout/evaluator.ts with buildPrCloseoutReport.",
			),
		);
		return;
	}
	const content = evaluatorSource.content;
	const contractContent = contractSource.content;
	const reportBody = interfaceBody(contractContent, "PrCloseoutReport");
	requirePattern(
		findings,
		"report-exposes-claims",
		contractFile,
		reportBody,
		/claims\s*:\s*PrCloseoutClaim\[\]/,
		"PrCloseoutReport must expose verifier-backed claims",
		"Add claims: PrCloseoutClaim[] to PrCloseoutReport.",
	);
	requirePattern(
		findings,
		"schema-version-v1",
		contractFile,
		contractContent,
		/PR_CLOSEOUT_SCHEMA_VERSION\s*=\s*["']pr-closeout\/v1["']/,
		"pr-closeout schema version must remain pr-closeout/v1",
		"Preserve pr-closeout/v1 unless a deliberate migration updates consumers and docs.",
	);
	requirePattern(
		findings,
		"builds-claims-before-decision",
		evaluatorFile,
		content,
		/const claims\s*=\s*buildCloseoutClaims[\s\S]*collectClaimBlockers\(claims, blockers\)[\s\S]*const decision\s*=\s*deriveNextAction\(blockers\)/,
		"buildPrCloseoutReport must derive status after claim blockers are collected",
		"Build claims, collect claim blockers, then derive status/mergeability from all blockers.",
	);
	requirePattern(
		findings,
		"returns-claims",
		evaluatorFile,
		content,
		/return\s*\{(?=[\s\S]*\bblockers\b)(?=[\s\S]*\bclaims\b)[\s\S]*\}/,
		"buildPrCloseoutReport must return the claim ledger",
		"Include claims in the returned pr-closeout/v1 report.",
	);

	const facadeFile = "src/lib/pr-closeout.ts";
	const facadeSource = read(facadeFile);
	if (facadeSource.missing) {
		findings.push(
			finding(
				"missing-closeout-module",
				facadeFile,
				"pr-closeout public facade is missing",
				"Restore src/lib/pr-closeout.ts as the public closeout interface.",
			),
		);
		return;
	}
	requirePattern(
		findings,
		"facade-exports-report-contract",
		facadeFile,
		facadeSource.content,
		/type PrCloseoutReport/,
		"pr-closeout public facade must export PrCloseoutReport",
		"Export PrCloseoutReport from src/lib/pr-closeout.ts so callers stay on the public boundary.",
	);
	requirePattern(
		findings,
		"facade-exports-report-builder",
		facadeFile,
		facadeSource.content,
		/buildPrCloseoutReport/,
		"pr-closeout public facade must export buildPrCloseoutReport",
		"Export buildPrCloseoutReport from src/lib/pr-closeout.ts so callers stay on the public boundary.",
	);
}

function checkFixtures(findings) {
	for (const requiredFixture of REQUIRED_FIXTURES) {
		const { content, missing } = read(requiredFixture.path);
		if (missing) {
			findings.push(
				finding(
					requiredFixture.id,
					requiredFixture.path,
					`${requiredFixture.message}: test file is missing`,
					"Restore the closeout truth fixture file.",
				),
			);
			continue;
		}
		requirePattern(
			findings,
			requiredFixture.id,
			requiredFixture.path,
			content,
			requiredFixture.pattern,
			requiredFixture.message,
			"Add a fixture that proves this false-success path blocks closeout.",
		);
	}
}

function buildResult() {
	const findings = [];
	checkClaimContract(findings);
	checkReportContract(findings);
	checkFixtures(findings);
	return {
		schemaVersion: SCHEMA_VERSION,
		gateId: GATE_ID,
		status: findings.length === 0 ? "pass" : "fail",
		checkedAt: new Date().toISOString(),
		root: repoRoot,
		findings,
	};
}

function main() {
	const result = buildResult();
	if (jsonOutput) {
		process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
	} else if (result.status === "pass") {
		process.stdout.write(`${GATE_ID}: pass\n`);
	} else {
		process.stdout.write(`${GATE_ID}: fail\n`);
		for (const item of result.findings) {
			process.stdout.write(`- ${item.file}: ${item.message}\n`);
		}
	}
	process.exit(result.status === "pass" ? 0 : 1);
}

main();

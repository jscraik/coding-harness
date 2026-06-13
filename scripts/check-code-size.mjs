#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import ts from "typescript";
import { collectChangedPaths } from "./lib/changed-files.mjs";

const SOURCE_EXTENSIONS = /\.(ts|tsx|js|jsx|mts|cts)$/;
const TYPE_DECLARATION = /\.d\.ts$/;
const TEST_SOURCE = /([./](?:__tests__|test|tests)[./]|\.test\.|\.spec\.)/;
const PROD_SOURCE_PREFIX = "src/";
const MAX_FILE_LINES = 800;
const MAX_FUNCTION_LINES = 120;
const TARGET_FILE_LINES = 400;
const TARGET_FUNCTION_LINES = 80;
const TEST_TARGET_FILE_LINES = 1_200;

const LEGACY_OVERSIZED_FILES = new Set([]);

const SOURCE_SIZE_ADVISORY_RATCHETS = new Map([
	[
		"src/lib/docs-surface/archive-candidates.ts",
		{
			maxLines: 631,
			ticket: "JSC-363",
			expires: "2026-07-13",
			functions: new Map([
				["runDocsArchiveCandidates", 108],
				["readActiveArtifacts", 83],
			]),
		},
	],
	[
		"src/lib/init/scaffold-environment-templates.ts",
		{
			maxLines: 709,
			ticket: "JSC-363",
			expires: "2026-07-13",
			functions: new Map([
				["renderEnvironmentFileChecks", 120],
				["renderToolchainPolicyChecks", 85],
				["renderRepositoryPolicyChecks", 114],
				["renderEnvironmentRunnerSelection", 91],
			]),
		},
	],
	[
		"src/lib/init/scaffold-hook-templates.ts",
		{
			maxLines: 618,
			ticket: "JSC-363",
			expires: "2026-07-13",
			functions: new Map([
				["renderValidateCommitMsgScript", 115],
				["renderSetupGitHooksScriptPrelude", 108],
			]),
		},
	],
	[
		"src/lib/policy/tooling-baseline.ts",
		{
			maxLines: 414,
			ticket: "JSC-363",
			expires: "2026-07-13",
			functions: new Map(),
		},
	],
]);

const TEST_SIZE_ADVISORY_RATCHETS = new Map([
	[
		"src/commands/docs-gate.test.ts",
		{ maxLines: 1_546, ticket: "JSC-363", expires: "2026-07-13" },
	],
	[
		"src/commands/init.test.ts",
		{ maxLines: 6_266, ticket: "JSC-363", expires: "2026-07-13" },
	],
	[
		"src/commands/pilot-evaluate.test.ts",
		{ maxLines: 1_950, ticket: "JSC-363", expires: "2026-07-13" },
	],
	[
		"src/dev/check-goal-board-script.test.ts",
		{ maxLines: 1_247, ticket: "JSC-363", expires: "2026-07-13" },
	],
	[
		"src/lib/architecture/module-boundaries.test.ts",
		{ maxLines: 2_642, ticket: "JSC-363", expires: "2026-07-13" },
	],
]);

const LEGACY_SPLIT_CORE_LIMITS = new Map([
	[
		"src/commands/branch-protect-core.ts",
		{ maxLines: 1_096, ticket: "JSC-363", expires: "2026-07-13" },
	],
	[
		"src/commands/check-environment-core.ts",
		{ maxLines: 626, ticket: "JSC-363", expires: "2026-07-13" },
	],
	[
		"src/commands/ci-migrate-core.ts",
		{ maxLines: 9_510, ticket: "JSC-363", expires: "2026-07-13" },
	],
	[
		"src/commands/docs-gate-core.ts",
		{ maxLines: 1_719, ticket: "JSC-363", expires: "2026-07-13" },
	],
	[
		"src/commands/drift-gate-core.ts",
		{ maxLines: 484, ticket: "JSC-363", expires: "2026-07-13" },
	],
	[
		"src/commands/health-core.ts",
		{ maxLines: 761, ticket: "JSC-363", expires: "2026-07-13" },
	],
	[
		"src/commands/linear-gate-core.ts",
		{ maxLines: 620, ticket: "JSC-363", expires: "2026-07-13" },
	],
	[
		"src/commands/linear-triage-core.ts",
		{ maxLines: 903, ticket: "JSC-363", expires: "2026-07-13" },
	],
	[
		"src/commands/linear-workflow-core.ts",
		{ maxLines: 441, ticket: "JSC-363", expires: "2026-07-13" },
	],
	[
		"src/commands/pilot-evaluate-core.ts",
		{ maxLines: 1_092, ticket: "JSC-363", expires: "2026-07-13" },
	],
	[
		"src/commands/review-gate-core.ts",
		{ maxLines: 1_571, ticket: "JSC-363", expires: "2026-07-13" },
	],
	[
		"src/commands/tooling-audit-core.ts",
		{ maxLines: 1_279, ticket: "JSC-363", expires: "2026-07-13" },
	],
	[
		"src/lib/cli/registry/command-specs-core.ts",
		{ maxLines: 682, ticket: "JSC-363", expires: "2026-07-13" },
	],
	[
		"src/lib/contract/json-schema-core.ts",
		{ maxLines: 1_024, ticket: "JSC-363", expires: "2026-07-13" },
	],
	[
		"src/lib/contract/policy-validators-core.ts",
		{ maxLines: 1_224, ticket: "JSC-363", expires: "2026-07-13" },
	],
	[
		"src/lib/contract/run-record-emitter-core.ts",
		{ maxLines: 306, ticket: "JSC-363", expires: "2026-07-13" },
	],
	[
		"src/lib/contract/run-records-core.ts",
		{ maxLines: 1_075, ticket: "JSC-363", expires: "2026-07-13" },
	],
	[
		"src/lib/contract/types-core.ts",
		{ maxLines: 1_776, ticket: "JSC-363", expires: "2026-07-13" },
	],
	[
		"src/lib/contract/validator-core.ts",
		{ maxLines: 2_822, ticket: "JSC-363", expires: "2026-07-13" },
	],
	[
		"src/lib/decision/he-phase-exit-core.ts",
		{ maxLines: 1_717, ticket: "JSC-363", expires: "2026-07-13" },
	],
	[
		"src/lib/governance/repo-scanner-core.ts",
		{ maxLines: 513, ticket: "JSC-363", expires: "2026-07-13" },
	],
	[
		"src/lib/init/update-core.ts",
		{ maxLines: 949, ticket: "JSC-363", expires: "2026-07-13" },
	],
	[
		"src/lib/output/normalise-review-preflight-core.ts",
		{ maxLines: 330, ticket: "JSC-363", expires: "2026-07-13" },
	],
	[
		"src/lib/pilot-evaluation/control-plane-core.ts",
		{ maxLines: 2_576, ticket: "JSC-363", expires: "2026-07-13" },
	],
	[
		"src/lib/pilot-evaluation/evaluation-engine-core.ts",
		{ maxLines: 872, ticket: "JSC-363", expires: "2026-07-13" },
	],
	[
		"src/lib/pilot-evaluation/metrics-capture-core.ts",
		{ maxLines: 1_057, ticket: "JSC-363", expires: "2026-07-13" },
	],
	[
		"src/lib/pilot-evaluation/types-core.ts",
		{ maxLines: 918, ticket: "JSC-363", expires: "2026-07-13" },
	],
	[
		"src/lib/plan-gate/detector-core.ts",
		{ maxLines: 615, ticket: "JSC-363", expires: "2026-07-13" },
	],
	[
		"src/lib/preflight/validator-core.ts",
		{ maxLines: 1_056, ticket: "JSC-363", expires: "2026-07-13" },
	],
	[
		"src/lib/review-gate/authz-core.ts",
		{ maxLines: 285, ticket: "JSC-363", expires: "2026-07-13" },
	],
	[
		"src/lib/verify/orchestrator-core.ts",
		{ maxLines: 578, ticket: "JSC-363", expires: "2026-07-13" },
	],
	[
		"src/lib/verify/resume-admissibility-core.ts",
		{ maxLines: 369, ticket: "JSC-363", expires: "2026-07-13" },
	],
	[
		"src/lib/verify/run-state-core.ts",
		{ maxLines: 1_073, ticket: "JSC-363", expires: "2026-07-13" },
	],
	[
		"src/lib/workflow-contract/checker-core.ts",
		{ maxLines: 602, ticket: "JSC-363", expires: "2026-07-13" },
	],
	[
		"src/lib/workflow-contract/gate-bundle-core.ts",
		{ maxLines: 615, ticket: "JSC-363", expires: "2026-07-13" },
	],
	[
		"src/lib/workflow-contract/pilot-tracker-core.ts",
		{ maxLines: 1_029, ticket: "JSC-363", expires: "2026-07-13" },
	],
	[
		"src/lib/workflow-contract/registry-core.ts",
		{ maxLines: 338, ticket: "JSC-363", expires: "2026-07-13" },
	],
]);

const SPLIT_LEGACY_CORE_RE = /-core(?:-v\d+)?\.ts$/;

const args = new Set(process.argv.slice(2));
const repoRoot = resolve(process.cwd());
const modeAll = args.has("--all");
const modeStaged = args.has("--staged");

function isProductionSource(path) {
	return (
		path.startsWith(PROD_SOURCE_PREFIX) &&
		SOURCE_EXTENSIONS.test(path) &&
		!TYPE_DECLARATION.test(path) &&
		!TEST_SOURCE.test(path) &&
		existsSync(resolve(repoRoot, path))
	);
}

function isTestSource(path) {
	return (
		path.startsWith(PROD_SOURCE_PREFIX) &&
		SOURCE_EXTENSIONS.test(path) &&
		TEST_SOURCE.test(path) &&
		existsSync(resolve(repoRoot, path))
	);
}

function getScriptKind(path) {
	if (path.endsWith(".tsx")) {
		return ts.ScriptKind.TSX;
	}
	if (path.endsWith(".jsx")) {
		return ts.ScriptKind.JSX;
	}
	if (path.endsWith(".js")) {
		return ts.ScriptKind.JS;
	}

	if (path.endsWith(".mts") || path.endsWith(".cts")) {
		return ts.ScriptKind.TS;
	}

	return ts.ScriptKind.TS;
}

function lineFor(sourceFile, position) {
	return sourceFile.getLineAndCharacterOfPosition(position).line + 1;
}

function functionName(node) {
	if ("name" in node && node.name && ts.isIdentifier(node.name)) {
		return node.name.text;
	}
	const parent = node.parent;
	if (
		ts.isVariableDeclaration(parent) &&
		parent.name &&
		ts.isIdentifier(parent.name)
	) {
		return parent.name.text;
	}
	if (
		ts.isPropertyAssignment(parent) &&
		parent.name &&
		ts.isIdentifier(parent.name)
	) {
		return parent.name.text;
	}
	return "<anonymous>";
}

function countLogicalLines(sourceText) {
	if (sourceText.length === 0) {
		return 0;
	}
	return sourceText.replace(/\r?\n$/, "").split(/\r?\n/).length;
}

function legacySplitCoreLimitForPath(path) {
	if (!SPLIT_LEGACY_CORE_RE.test(path)) return null;
	return LEGACY_SPLIT_CORE_LIMITS.get(path) ?? null;
}

function isExpiredDate(dateText) {
	const expiry = new Date(`${dateText}T23:59:59Z`);
	if (Number.isNaN(expiry.getTime())) return true;
	return expiry.getTime() < Date.now();
}

function pushExpiredAdvisoryRatchet(findings, path, line, ratchet) {
	if (!ratchet || !isExpiredDate(ratchet.expires)) return;
	findings.push({
		path,
		line,
		message:
			"advisory size ratchet expired on " +
			ratchet.expires +
			" (" +
			ratchet.ticket +
			"); split this surface or renew the ratchet with owner evidence",
	});
}

function pushExceededAdvisoryRatchet(
	findings,
	path,
	line,
	ratchet,
	actualLines,
	label,
) {
	if (!ratchet || actualLines <= ratchet.maxLines) return;
	findings.push({
		path,
		line,
		message:
			label +
			" has " +
			actualLines +
			" lines; advisory ratchet is " +
			ratchet.maxLines +
			" (" +
			ratchet.ticket +
			", expires " +
			ratchet.expires +
			")",
	});
}

function isFunctionLike(node) {
	return (
		ts.isFunctionDeclaration(node) ||
		ts.isFunctionExpression(node) ||
		ts.isArrowFunction(node) ||
		ts.isMethodDeclaration(node) ||
		ts.isConstructorDeclaration(node) ||
		ts.isGetAccessorDeclaration(node) ||
		ts.isSetAccessorDeclaration(node)
	);
}

function checkFile(path) {
	if (LEGACY_OVERSIZED_FILES.has(path)) {
		return {
			skippedLegacy: true,
			findings: [],
			warnings: [],
		};
	}

	const absolutePath = resolve(repoRoot, path);
	const sourceText = readFileSync(absolutePath, "utf8");
	const sourceFile = ts.createSourceFile(
		path,
		sourceText,
		ts.ScriptTarget.Latest,
		true,
		getScriptKind(path),
	);
	const findings = [];
	const warnings = [];

	const fileLines = countLogicalLines(sourceText);
	const sourceAdvisoryRatchet = SOURCE_SIZE_ADVISORY_RATCHETS.get(path);
	pushExpiredAdvisoryRatchet(findings, path, 1, sourceAdvisoryRatchet);
	pushExceededAdvisoryRatchet(
		findings,
		path,
		1,
		sourceAdvisoryRatchet,
		fileLines,
		"file",
	);
	const legacyCoreLimit = legacySplitCoreLimitForPath(path);
	if (legacyCoreLimit) {
		if (isExpiredDate(legacyCoreLimit.expires)) {
			findings.push({
				path,
				line: 1,
				message:
					"legacy split core ratchet expired on " +
					legacyCoreLimit.expires +
					" (" +
					legacyCoreLimit.ticket +
					"); split this file or renew the ratchet with owner evidence",
			});
		}
		if (fileLines > legacyCoreLimit.maxLines) {
			findings.push({
				path,
				line: 1,
				message:
					"legacy split core file has " +
					fileLines +
					" lines; ratchet is " +
					legacyCoreLimit.maxLines +
					" (" +
					legacyCoreLimit.ticket +
					", expires " +
					legacyCoreLimit.expires +
					")",
			});
		}
		if (fileLines > TARGET_FILE_LINES && fileLines > legacyCoreLimit.maxLines) {
			warnings.push({
				path,
				line: 1,
				message:
					"legacy split core file has " +
					fileLines +
					" lines; ratchet is " +
					legacyCoreLimit.maxLines +
					" (" +
					legacyCoreLimit.ticket +
					", expires " +
					legacyCoreLimit.expires +
					")",
			});
		}
		return {
			skippedLegacy: false,
			findings,
			warnings,
		};
	}

	if (fileLines > MAX_FILE_LINES) {
		findings.push({
			path,
			line: 1,
			message: `file has ${fileLines} lines; max is ${MAX_FILE_LINES}`,
		});
	}
	if (
		fileLines > TARGET_FILE_LINES &&
		(!sourceAdvisoryRatchet || fileLines > sourceAdvisoryRatchet.maxLines)
	) {
		warnings.push({
			path,
			line: 1,
			message: `file has ${fileLines} lines; ratchet target is ${TARGET_FILE_LINES}`,
		});
	}

	function visit(node) {
		if (isFunctionLike(node)) {
			const startLine = lineFor(sourceFile, node.getStart(sourceFile));
			const endLine = lineFor(sourceFile, node.getEnd());
			const span = endLine - startLine + 1;
			const functionAdvisoryRatchet = sourceAdvisoryRatchet?.functions?.get(
				functionName(node),
			);
			pushExceededAdvisoryRatchet(
				findings,
				path,
				startLine,
				functionAdvisoryRatchet
					? {
							maxLines: functionAdvisoryRatchet,
							ticket: sourceAdvisoryRatchet.ticket,
							expires: sourceAdvisoryRatchet.expires,
						}
					: null,
				span,
				functionName(node),
			);
			if (span > MAX_FUNCTION_LINES) {
				findings.push({
					path,
					line: startLine,
					message: `${functionName(node)} has ${span} lines; max is ${MAX_FUNCTION_LINES}`,
				});
			}
			if (
				span > TARGET_FUNCTION_LINES &&
				(!functionAdvisoryRatchet || span > functionAdvisoryRatchet)
			) {
				warnings.push({
					path,
					line: startLine,
					message: `${functionName(node)} has ${span} lines; ratchet target is ${TARGET_FUNCTION_LINES}`,
				});
			}
		}
		ts.forEachChild(node, visit);
	}

	visit(sourceFile);
	return {
		skippedLegacy: false,
		findings,
		warnings,
	};
}

const changedPaths = collectChangedPaths({ repoRoot, modeAll, modeStaged });
const files = changedPaths
	.filter(isProductionSource)
	.sort((a, b) => a.localeCompare(b));
const testFiles = changedPaths
	.filter(isTestSource)
	.sort((a, b) => a.localeCompare(b));

if (files.length === 0) {
	console.info("[check-code-size] no changed production source files.");
}

const findings = [];
const warnings = [];
const skippedLegacy = [];
for (const path of files) {
	const result = checkFile(path);
	if (result.skippedLegacy) {
		skippedLegacy.push(path);
	}
	findings.push(...result.findings);
	warnings.push(...result.warnings);
}

const testWarnings = [];
for (const path of testFiles) {
	const fileLines = countLogicalLines(
		readFileSync(resolve(repoRoot, path), "utf8"),
	);
	const ratchet = TEST_SIZE_ADVISORY_RATCHETS.get(path);
	if (ratchet && isExpiredDate(ratchet.expires)) {
		findings.push({
			path,
			line: 1,
			message:
				"test advisory size ratchet expired on " +
				ratchet.expires +
				" (" +
				ratchet.ticket +
				"); split this test or renew the ratchet with owner evidence",
		});
	}
	if (ratchet && fileLines > ratchet.maxLines) {
		findings.push({
			path,
			line: 1,
			message:
				"test file has " +
				fileLines +
				" lines; advisory ratchet is " +
				ratchet.maxLines +
				" (" +
				ratchet.ticket +
				", expires " +
				ratchet.expires +
				")",
		});
	}
	if (
		fileLines > TEST_TARGET_FILE_LINES &&
		(!ratchet || fileLines > ratchet.maxLines)
	) {
		testWarnings.push({
			path,
			line: 1,
			message: `test file has ${fileLines} lines; advisory ratchet target is ${TEST_TARGET_FILE_LINES}`,
		});
	}
}

if (skippedLegacy.length > 0) {
	console.info(
		`[check-code-size] skipped legacy oversized file(s): ${skippedLegacy.join(", ")}`,
	);
}

if (findings.length > 0) {
	console.error("[check-code-size] code size limits exceeded:");
	for (const finding of findings) {
		console.error(
			`  ${relative(repoRoot, resolve(repoRoot, finding.path))}:${finding.line} ${finding.message}`,
		);
	}
	process.exit(1);
}

if (warnings.length > 0) {
	console.warn("[check-code-size] size ratchet warnings:");
	for (const warning of warnings) {
		console.warn(
			`  ${relative(repoRoot, resolve(repoRoot, warning.path))}:${warning.line} ${warning.message}`,
		);
	}
}

if (testWarnings.length > 0) {
	console.warn("[check-code-size] test size advisory warnings:");
	for (const warning of testWarnings) {
		console.warn(
			`  ${relative(repoRoot, resolve(repoRoot, warning.path))}:${warning.line} ${warning.message}`,
		);
	}
}

console.info(
	`[check-code-size] checked ${files.length - skippedLegacy.length} production file(s), reviewed ${testFiles.length} test file(s) for advisory size; size limits passed.`,
);

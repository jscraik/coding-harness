#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import ts from "typescript";
import { collectChangedPaths } from "./lib/changed-files.mjs";

const SOURCE_EXTENSIONS = /\.(ts|tsx|js|jsx|mts|cts)$/;
const TEST_OR_TYPE_DECLARATION =
	/(\.d\.ts|[./](?:__tests__|test|tests)[./]|\.test\.|\.spec\.)/;
const PROD_SOURCE_PREFIX = "src/";
const MAX_FILE_LINES = 800;
const MAX_FUNCTION_LINES = 120;
const TARGET_FILE_LINES = 400;
const TARGET_FUNCTION_LINES = 80;

const LEGACY_OVERSIZED_FILES = new Set([]);

const SPLIT_LEGACY_CORE_RE = /-core(?:-v\d+)?\.ts$/;

const args = new Set(process.argv.slice(2));
const repoRoot = resolve(process.cwd());
const modeAll = args.has("--all");
const modeStaged = args.has("--staged");

function isProductionSource(path) {
	return (
		path.startsWith(PROD_SOURCE_PREFIX) &&
		SOURCE_EXTENSIONS.test(path) &&
		!TEST_OR_TYPE_DECLARATION.test(path) &&
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
	if (LEGACY_OVERSIZED_FILES.has(path) || SPLIT_LEGACY_CORE_RE.test(path)) {
		return {
			skippedLegacy: !SPLIT_LEGACY_CORE_RE.test(path),
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

	if (fileLines > MAX_FILE_LINES) {
		findings.push({
			path,
			line: 1,
			message: `file has ${fileLines} lines; max is ${MAX_FILE_LINES}`,
		});
	}
	if (fileLines > TARGET_FILE_LINES) {
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
			if (span > MAX_FUNCTION_LINES) {
				findings.push({
					path,
					line: startLine,
					message: `${functionName(node)} has ${span} lines; max is ${MAX_FUNCTION_LINES}`,
				});
			}
			if (span > TARGET_FUNCTION_LINES) {
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

const files = collectChangedPaths({ repoRoot, modeAll, modeStaged })
	.filter(isProductionSource)
	.sort((a, b) => a.localeCompare(b));

if (files.length === 0) {
	console.info("[check-code-size] no changed production source files.");
	process.exit(0);
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

console.info(
	`[check-code-size] checked ${files.length - skippedLegacy.length} file(s); size limits passed.`,
);

#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import ts from "typescript";
import { collectChangedPaths } from "./lib/changed-files.mjs";

const SOURCE_EXTENSIONS = /\.(ts|tsx|js|jsx|mts|cts)$/;
const TEST_OR_TYPE_DECLARATION =
	/(\.d\.ts|[./](?:__tests__|test|tests)[./]|\.test\.|\.spec\.)/;
const PROD_SOURCE_PREFIX = "src/";

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
	return ts.ScriptKind.TS;
}

function hasExportModifier(node) {
	return Boolean(
		node.modifiers?.some(
			(modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
		),
	);
}

function hasJSDoc(sourceText, node) {
	const ranges =
		ts.getLeadingCommentRanges(sourceText, node.getFullStart()) ?? [];
	return ranges.some((range) =>
		sourceText.slice(range.pos, range.end).trimStart().startsWith("/**"),
	);
}

function lineFor(sourceFile, node) {
	return (
		sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1
	);
}

function declarationName(node) {
	if ("name" in node && node.name && ts.isIdentifier(node.name)) {
		return node.name.text;
	}
	return "<anonymous export>";
}

function exportedVariableFunctionDeclarations(statement) {
	if (!ts.isVariableStatement(statement) || !hasExportModifier(statement)) {
		return [];
	}

	return statement.declarationList.declarations.filter((declaration) => {
		const initializer = declaration.initializer;
		return (
			initializer &&
			(ts.isArrowFunction(initializer) ||
				ts.isFunctionExpression(initializer) ||
				ts.isClassExpression(initializer))
		);
	});
}

function checkFile(path) {
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

	for (const statement of sourceFile.statements) {
		if (
			(ts.isFunctionDeclaration(statement) ||
				ts.isClassDeclaration(statement) ||
				ts.isInterfaceDeclaration(statement) ||
				ts.isTypeAliasDeclaration(statement) ||
				ts.isEnumDeclaration(statement)) &&
			hasExportModifier(statement) &&
			!hasJSDoc(sourceText, statement)
		) {
			findings.push({
				path,
				line: lineFor(sourceFile, statement),
				name: declarationName(statement),
			});
		}

		for (const declaration of exportedVariableFunctionDeclarations(statement)) {
			if (!hasJSDoc(sourceText, statement)) {
				const name = ts.isIdentifier(declaration.name)
					? declaration.name.text
					: "<destructured export>";
				findings.push({
					path,
					line: lineFor(sourceFile, declaration),
					name,
				});
			}
		}
	}

	return findings;
}

const files = collectChangedPaths({ repoRoot, modeAll, modeStaged })
	.filter(isProductionSource)
	.sort((a, b) => a.localeCompare(b));

if (files.length === 0) {
	console.info("[check-public-api-docs] no changed production source files.");
	process.exit(0);
}

const findings = files.flatMap(checkFile);
if (findings.length > 0) {
	console.error(
		"[check-public-api-docs] exported public API declarations need JSDoc:",
	);
	for (const finding of findings) {
		console.error(
			`  ${relative(repoRoot, resolve(repoRoot, finding.path))}:${finding.line} ${finding.name}`,
		);
	}
	process.exit(1);
}

console.info(
	`[check-public-api-docs] checked ${files.length} file(s); exported public API docs present.`,
);

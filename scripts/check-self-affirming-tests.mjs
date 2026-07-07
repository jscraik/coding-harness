#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import ts from "typescript";
import { collectChangedPaths } from "./lib/changed-files.mjs";

const TEST_FILE_RE =
	/^(?:(?:.*(?:^|[./])(?:__tests__|test|tests)(?:[./]).*)|(?:.*\.(?:test|spec)\.(?:c|m)?(?:t|j)sx?))$/;
const SOURCE_EXTENSIONS = /\.(?:c|m)?(?:t|j)sx?$/;
const ASSERTION_METHODS = new Set([
	"toBe",
	"toEqual",
	"toStrictEqual",
	"toMatchObject",
	"toContainEqual",
]);

const args = new Set(process.argv.slice(2));
const repoRoot = resolve(process.cwd());
const modeAll = args.has("--all");
const modeStaged = args.has("--staged");

function isTestSource(path) {
	return (
		SOURCE_EXTENSIONS.test(path) &&
		TEST_FILE_RE.test(path) &&
		existsSync(resolve(repoRoot, path))
	);
}

function getScriptKind(path) {
	if (path.endsWith(".tsx")) return ts.ScriptKind.TSX;
	if (path.endsWith(".jsx")) return ts.ScriptKind.JSX;
	if (path.endsWith(".js")) return ts.ScriptKind.JS;
	return ts.ScriptKind.TS;
}

function lineFor(sourceFile, node) {
	return (
		sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1
	);
}

function hasSelfAffirmingWaiver(sourceText, sourceFile, node) {
	const ranges =
		ts.getLeadingCommentRanges(sourceText, node.getFullStart()) ?? [];
	if (
		ranges.some((range) =>
			sourceText.slice(range.pos, range.end).includes("self-affirming-ok:"),
		)
	) {
		return true;
	}

	const line = sourceFile.getLineAndCharacterOfPosition(
		node.getStart(sourceFile),
	).line;
	const lineStart = sourceFile.getPositionOfLineAndCharacter(line, 0);
	const nextLineStart =
		line + 1 < sourceFile.getLineStarts().length
			? sourceFile.getPositionOfLineAndCharacter(line + 1, 0)
			: sourceText.length;
	return sourceText
		.slice(lineStart, nextLineStart)
		.includes("self-affirming-ok:");
}

function normalizeExpression(sourceFile, node) {
	return node.getText(sourceFile).replace(/\s+/g, " ").trim();
}

function identifierName(node) {
	return ts.isIdentifier(node) ? node.text : null;
}

function calledAssertionMethod(node) {
	if (!ts.isCallExpression(node)) return null;
	const expression = node.expression;
	if (!ts.isPropertyAccessExpression(expression)) return null;
	const method = expression.name.text;
	if (!ASSERTION_METHODS.has(method)) return null;
	return method;
}

function expectActual(node) {
	if (!ts.isCallExpression(node)) return null;
	const receiver = node.expression;
	if (!ts.isPropertyAccessExpression(receiver)) return null;
	let expectCall = receiver.expression;
	if (
		ts.isPropertyAccessExpression(expectCall) &&
		expectCall.name.text === "not"
	) {
		expectCall = expectCall.expression;
	}
	if (!ts.isCallExpression(expectCall)) return null;
	if (!ts.isIdentifier(expectCall.expression)) return null;
	if (expectCall.expression.text !== "expect") return null;
	return expectCall.arguments[0] ?? null;
}

function isNegatedAssertion(node) {
	if (!ts.isCallExpression(node)) return false;
	const receiver = node.expression;
	return (
		ts.isPropertyAccessExpression(receiver) &&
		ts.isPropertyAccessExpression(receiver.expression) &&
		receiver.expression.name.text === "not"
	);
}

function initializerExpression(statement) {
	if (!ts.isVariableStatement(statement)) return null;
	if (statement.declarationList.declarations.length !== 1) return null;
	const declaration = statement.declarationList.declarations[0];
	const name = identifierName(declaration.name);
	if (!name || !declaration.initializer) return null;
	return {
		name,
		expression: normalizeExpression(
			statement.getSourceFile(),
			declaration.initializer,
		),
	};
}

function pairKey(left, right) {
	return [left, right].sort().join("\0");
}

function expressionPairIsDefensiveCopyCheck(statement, left, right) {
	const allowedPairs = new Set();
	const parent = statement.parent;
	if (!parent || !("statements" in parent)) return false;

	for (const sibling of parent.statements) {
		if (sibling === statement) {
			break;
		}
		if (!ts.isExpressionStatement(sibling)) continue;
		const assertion = sibling.expression;
		if (!ts.isCallExpression(assertion)) continue;
		const method = calledAssertionMethod(assertion);
		if (method !== "toBe" || !isNegatedAssertion(assertion)) continue;
		const actual = expectActual(assertion);
		const expected = assertion.arguments[0];
		const actualName = actual ? identifierName(actual) : null;
		const expectedName = expected ? identifierName(expected) : null;
		if (actualName && expectedName) {
			allowedPairs.add(pairKey(actualName, expectedName));
		}
	}

	return allowedPairs.has(pairKey(left, right));
}

function checkAssertion(
	sourceText,
	sourceFile,
	statement,
	variableExpressions,
) {
	if (!ts.isExpressionStatement(statement)) return [];
	const assertion = statement.expression;
	if (!ts.isCallExpression(assertion)) return [];
	const method = calledAssertionMethod(assertion);
	if (!method || isNegatedAssertion(assertion)) return [];
	if (hasSelfAffirmingWaiver(sourceText, sourceFile, statement)) return [];

	const actual = expectActual(assertion);
	const expected = assertion.arguments[0];
	if (!actual || !expected) return [];

	const findings = [];
	const actualText = normalizeExpression(sourceFile, actual);
	const expectedText = normalizeExpression(sourceFile, expected);
	if (actualText === expectedText) {
		findings.push({
			line: lineFor(sourceFile, assertion),
			message: `self-affirming assertion compares the same expression with ${method}: ${actualText}`,
		});
		return findings;
	}

	const actualName = identifierName(actual);
	const expectedName = identifierName(expected);
	if (!actualName || !expectedName) return findings;
	if (expressionPairIsDefensiveCopyCheck(statement, actualName, expectedName)) {
		return findings;
	}

	const actualInitializer = variableExpressions.get(actualName);
	const expectedInitializer = variableExpressions.get(expectedName);
	if (actualInitializer && actualInitializer === expectedInitializer) {
		findings.push({
			line: lineFor(sourceFile, assertion),
			message: `self-affirming assertion compares variables initialized from the same expression with ${method}: ${actualInitializer}`,
		});
	}

	return findings;
}

function checkStatementBlock(sourceText, sourceFile, statements, findings) {
	const variableExpressions = new Map();
	for (const statement of statements) {
		const initialized = initializerExpression(statement);
		if (initialized) {
			variableExpressions.set(initialized.name, initialized.expression);
		}
		findings.push(
			...checkAssertion(sourceText, sourceFile, statement, variableExpressions),
		);
	}
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

	function visit(node) {
		if (ts.isSourceFile(node) || ts.isBlock(node)) {
			checkStatementBlock(sourceText, sourceFile, node.statements, findings);
		}
		ts.forEachChild(node, visit);
	}

	visit(sourceFile);
	return findings.map((finding) => ({ path, ...finding }));
}

const files = collectChangedPaths({ repoRoot, modeAll, modeStaged })
	.filter(isTestSource)
	.sort((a, b) => a.localeCompare(b));

if (files.length === 0) {
	console.info("[check-self-affirming-tests] no test files to scan.");
	process.exit(0);
}

const findings = files.flatMap(checkFile);
if (findings.length > 0) {
	console.error(
		"[check-self-affirming-tests] self-affirming test assertions found:",
	);
	for (const finding of findings) {
		console.error(
			`  ${relative(repoRoot, resolve(repoRoot, finding.path))}:${finding.line} ${finding.message}`,
		);
	}
	console.error(
		"Use a requirement-derived expected value, fixture, schema, snapshot, or explicit property test instead of the implementation under test as its own oracle.",
	);
	process.exit(1);
}

console.info(
	`[check-self-affirming-tests] checked ${files.length} test file(s); assertion oracles passed.`,
);

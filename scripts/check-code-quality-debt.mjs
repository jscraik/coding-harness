#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import ts from "typescript";

const SOURCE_EXTENSIONS = /\.(ts|tsx|js|jsx|mts|cts|mjs|cjs)$/;
const TYPE_DECLARATION = /\.d\.ts$/;
const TEST_SOURCE = /([./](?:__tests__|test|tests)[./]|\.test\.|\.spec\.)/;
const PRODUCTION_PREFIXES = ["src/", "scripts/"];
const BASELINE_SCHEMA_VERSION = "code-quality-debt-baseline/v1";
const REPORT_SCHEMA_VERSION = "code-quality-debt/v1";
const MAX_FILE_LINES = 400;
const MAX_FUNCTION_LINES = 80;
const MAX_COMPLEXITY = 10;
const MAX_TEST_FILE_LINES = 1_200;
const DUPLICATE_BLOCK_LINES = 24;
const args = new Set(process.argv.slice(2));
const repoRoot = resolve(process.cwd());
const baselinePath = resolve(
	repoRoot,
	process.env.HARNESS_CODE_QUALITY_DEBT_BASELINE ??
		"contracts/code-quality-debt-baseline.json",
);
const updateBaseline = args.has("--update-baseline");
const json = args.has("--json");

function runGit(gitArgs) {
	try {
		return execFileSync("git", gitArgs, {
			cwd: repoRoot,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
		});
	} catch (error) {
		const detail = error instanceof Error ? `: ${error.message}` : "";
		throw new Error(`git ${gitArgs.join(" ")} failed${detail}`);
	}
}

function gitPaths() {
	return runGit(["ls-files", "--cached", "--others", "--exclude-standard"])
		.split(/\r?\n/)
		.filter(Boolean)
		.filter((path) => existsSync(resolve(repoRoot, path)));
}

function isSourceFile(path) {
	return (
		SOURCE_EXTENSIONS.test(path) &&
		!TYPE_DECLARATION.test(path) &&
		PRODUCTION_PREFIXES.some((prefix) => path.startsWith(prefix))
	);
}

function isTestFile(path) {
	return isSourceFile(path) && TEST_SOURCE.test(path);
}

function isProductionFile(path) {
	return isSourceFile(path) && !isTestFile(path);
}

function scriptKind(path) {
	if (path.endsWith(".tsx")) return ts.ScriptKind.TSX;
	if (path.endsWith(".jsx")) return ts.ScriptKind.JSX;
	if (path.endsWith(".js") || path.endsWith(".mjs") || path.endsWith(".cjs")) {
		return ts.ScriptKind.JS;
	}
	return ts.ScriptKind.TS;
}

function countLogicalLines(sourceText) {
	if (sourceText.length === 0) return 0;
	return sourceText.replace(/\r?\n$/, "").split(/\r?\n/).length;
}

function lineFor(sourceFile, position) {
	return sourceFile.getLineAndCharacterOfPosition(position).line + 1;
}

function normalizeSnippet(line) {
	return line.trim().replace(/\s+/g, " ");
}

function snippetFor(lines, lineNumber) {
	return normalizeSnippet(lines[lineNumber - 1] ?? "");
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

function nodeComplexityIncrement(node) {
	if (
		ts.isIfStatement(node) ||
		ts.isForStatement(node) ||
		ts.isForInStatement(node) ||
		ts.isForOfStatement(node) ||
		ts.isWhileStatement(node) ||
		ts.isDoStatement(node) ||
		ts.isCaseClause(node) ||
		ts.isDefaultClause(node) ||
		ts.isConditionalExpression(node) ||
		ts.isCatchClause(node)
	) {
		return 1;
	}
	if (
		ts.isBinaryExpression(node) &&
		(node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
			node.operatorToken.kind === ts.SyntaxKind.BarBarToken)
	) {
		return 1;
	}
	return 0;
}

function functionComplexity(node) {
	let complexity = 1;
	function visit(child) {
		if (child !== node && isFunctionLike(child)) return;
		complexity += nodeComplexityIncrement(child);
		ts.forEachChild(child, visit);
	}
	ts.forEachChild(node, visit);
	return complexity;
}

function addDebt(items, debt) {
	items.push({
		id: debtId(debt),
		...debt,
	});
}

function debtId(debt) {
	const symbol = debt.symbol ? `:${debt.symbol}` : "";
	const fingerprint = debt.fingerprint ? `:${debt.fingerprint}` : "";
	return `${debt.category}:${debt.path}${symbol}${fingerprint}`;
}

function sizeAndComplexityDebt(path, sourceText, sourceFile) {
	const debt = [];
	const fileLines = countLogicalLines(sourceText);
	if (isProductionFile(path) && fileLines > MAX_FILE_LINES) {
		addDebt(debt, {
			category: "oversized_file",
			path,
			line: 1,
			actual: fileLines,
			max: MAX_FILE_LINES,
			detail: `file has ${fileLines} lines; max is ${MAX_FILE_LINES}`,
		});
	}
	if (isTestFile(path) && fileLines > MAX_TEST_FILE_LINES) {
		addDebt(debt, {
			category: "oversized_test_file",
			path,
			line: 1,
			actual: fileLines,
			max: MAX_TEST_FILE_LINES,
			detail: `test file has ${fileLines} lines; max is ${MAX_TEST_FILE_LINES}`,
		});
	}
	if (!isProductionFile(path)) return debt;

	function visit(node) {
		if (isFunctionLike(node)) {
			const startLine = lineFor(sourceFile, node.getStart(sourceFile));
			const endLine = lineFor(sourceFile, node.getEnd());
			const span = endLine - startLine + 1;
			const symbol = functionName(node);
			if (span > MAX_FUNCTION_LINES) {
				addDebt(debt, {
					category: "oversized_function",
					path,
					line: startLine,
					symbol,
					actual: span,
					max: MAX_FUNCTION_LINES,
					detail: `${symbol} has ${span} lines; max is ${MAX_FUNCTION_LINES}`,
				});
			}
			const complexity = functionComplexity(node);
			if (complexity > MAX_COMPLEXITY) {
				addDebt(debt, {
					category: "high_complexity_function",
					path,
					line: startLine,
					symbol,
					actual: complexity,
					max: MAX_COMPLEXITY,
					detail: `${symbol} has complexity ${complexity}; max is ${MAX_COMPLEXITY}`,
				});
			}
		}
		ts.forEachChild(node, visit);
	}
	visit(sourceFile);
	return debt;
}

function typeEscapeDebt(path, sourceText, sourceFile) {
	if (!path.startsWith("src/") || !path.endsWith(".ts") || isTestFile(path)) {
		return [];
	}
	const lines = sourceText.split(/\r?\n/);
	const debt = [];
	const scanner = ts.createScanner(
		ts.ScriptTarget.Latest,
		false,
		ts.LanguageVariant.Standard,
		sourceText,
	);
	let token = scanner.scan();
	while (token !== ts.SyntaxKind.EndOfFileToken) {
		if (
			token === ts.SyntaxKind.SingleLineCommentTrivia ||
			token === ts.SyntaxKind.MultiLineCommentTrivia
		) {
			const comment = sourceText.slice(
				scanner.getTokenPos(),
				scanner.getTextPos(),
			);
			for (const marker of ["ts-ignore", "ts-nocheck"]) {
				if (comment.includes(`@${marker}`)) {
					const line = lineFor(sourceFile, scanner.getTokenPos());
					addDebt(debt, {
						category: "typescript_escape_hatch",
						path,
						line,
						fingerprint: marker,
						detail: `TypeScript suppression @${marker}: ${snippetFor(lines, line)}`,
					});
				}
			}
		}
		token = scanner.scan();
	}

	function hasAnyType(node) {
		return node?.kind === ts.SyntaxKind.AnyKeyword;
	}
	function hasUnknownType(node) {
		return node?.kind === ts.SyntaxKind.UnknownKeyword;
	}
	function typeReferenceName(node) {
		return ts.isIdentifier(node.typeName) ? node.typeName.text : undefined;
	}
	function push(pattern, node) {
		const line = lineFor(sourceFile, node.getStart(sourceFile));
		addDebt(debt, {
			category: "typescript_escape_hatch",
			path,
			line,
			fingerprint: pattern,
			detail: `${pattern}: ${snippetFor(lines, line)}`,
		});
	}
	function isExplicitAnyAnnotation(node) {
		if (!hasAnyType(node.type)) return false;
		return (
			ts.isParameter(node) ||
			ts.isVariableDeclaration(node) ||
			ts.isPropertyDeclaration(node) ||
			ts.isPropertySignature(node) ||
			ts.isFunctionDeclaration(node) ||
			ts.isMethodDeclaration(node) ||
			ts.isMethodSignature(node) ||
			ts.isFunctionTypeNode(node) ||
			ts.isCallSignatureDeclaration(node) ||
			ts.isTypeAliasDeclaration(node)
		);
	}
	function visit(node) {
		if (isExplicitAnyAnnotation(node)) push("explicit-any-annotation", node);
		if (ts.isAsExpression(node) && hasAnyType(node.type)) {
			push("as-any-assertion", node);
		}
		if (
			ts.isAsExpression(node) &&
			ts.isAsExpression(node.expression) &&
			hasUnknownType(node.expression.type)
		) {
			push("double-assertion", node.expression.type);
		}
		if (ts.isTypeReferenceNode(node) && typeReferenceName(node) === "Promise") {
			const [firstArgument] = node.typeArguments ?? [];
			if (hasAnyType(firstArgument)) push("promise-any", node);
		}
		if (ts.isTypeReferenceNode(node) && typeReferenceName(node) === "Record") {
			const [keyArgument, valueArgument] = node.typeArguments ?? [];
			if (
				keyArgument?.kind === ts.SyntaxKind.StringKeyword &&
				hasAnyType(valueArgument)
			) {
				push("record-string-any", node);
			}
		}
		ts.forEachChild(node, visit);
	}
	visit(sourceFile);
	return debt;
}

function productionMarkerDebt(path, sourceText) {
	if (!isProductionFile(path)) return [];
	const debt = [];
	const lines = sourceText.split(/\r?\n/);
	for (const [index, line] of lines.entries()) {
		const match = /\b(TODO|FIXME|HACK)\b/.exec(line);
		if (!match) continue;
		const normalized = normalizeSnippet(line);
		addDebt(debt, {
			category: "production_marker",
			path,
			line: index + 1,
			fingerprint: createHash("sha256")
				.update(normalized)
				.digest("hex")
				.slice(0, 12),
			detail: `${match[1]} marker in production path: ${normalized}`,
		});
	}
	return debt;
}

function normalizedDuplicateLines(sourceText) {
	const result = [];
	for (const [index, rawLine] of sourceText.split(/\r?\n/).entries()) {
		const line = normalizeSnippet(rawLine);
		if (!line) continue;
		if (
			line === "{" ||
			line === "}" ||
			line === "});" ||
			line.startsWith("//") ||
			line.startsWith("*") ||
			line.startsWith("/*") ||
			line.startsWith("import ") ||
			line.startsWith("export {")
		) {
			continue;
		}
		result.push({ line, lineNumber: index + 1 });
	}
	return result;
}

function duplicateDebt(sources) {
	const windows = new Map();
	for (const source of sources.filter((item) => isProductionFile(item.path))) {
		const normalized = normalizedDuplicateLines(source.sourceText);
		if (normalized.length < DUPLICATE_BLOCK_LINES) continue;
		for (
			let index = 0;
			index <= normalized.length - DUPLICATE_BLOCK_LINES;
			index += 1
		) {
			const block = normalized
				.slice(index, index + DUPLICATE_BLOCK_LINES)
				.map((item) => item.line)
				.join("\n");
			const fingerprint = createHash("sha256")
				.update(block)
				.digest("hex")
				.slice(0, 16);
			const entry = {
				path: source.path,
				line: normalized[index].lineNumber,
				fingerprint,
			};
			const existing = windows.get(fingerprint) ?? [];
			existing.push(entry);
			windows.set(fingerprint, existing);
		}
	}
	const debt = [];
	const reportedPairs = new Set();
	for (const [fingerprint, entries] of windows) {
		const uniquePaths = new Set(entries.map((entry) => entry.path));
		if (uniquePaths.size < 2) continue;
		const [first] = entries;
		const second = entries.find((entry) => entry.path !== first.path);
		if (!second) continue;
		const paths = [...uniquePaths].sort();
		const pairKey = paths.slice(0, 2).join("\u0000");
		if (reportedPairs.has(pairKey)) continue;
		reportedPairs.add(pairKey);
		addDebt(debt, {
			category: "duplicate_block",
			path: first.path,
			line: first.line,
			fingerprint,
			relatedPath: second.path,
			relatedLine: second.line,
			detail: `duplicate ${DUPLICATE_BLOCK_LINES}-line block across ${paths.slice(0, 3).join(", ")}`,
		});
	}
	return debt;
}

function collectDebt() {
	const sources = gitPaths()
		.filter(isSourceFile)
		.sort((a, b) => a.localeCompare(b))
		.map((path) => {
			const sourceText = readFileSync(resolve(repoRoot, path), "utf8");
			const sourceFile = ts.createSourceFile(
				path,
				sourceText,
				ts.ScriptTarget.Latest,
				true,
				scriptKind(path),
			);
			return { path, sourceText, sourceFile };
		});

	const debt = [];
	for (const source of sources) {
		debt.push(
			...sizeAndComplexityDebt(
				source.path,
				source.sourceText,
				source.sourceFile,
			),
			...typeEscapeDebt(source.path, source.sourceText, source.sourceFile),
			...productionMarkerDebt(source.path, source.sourceText),
		);
	}
	debt.push(...duplicateDebt(sources));
	return debt.sort((a, b) => a.id.localeCompare(b.id));
}

function readBaseline() {
	if (!existsSync(baselinePath)) {
		return null;
	}
	const parsed = JSON.parse(readFileSync(baselinePath, "utf8"));
	if (parsed.schemaVersion !== BASELINE_SCHEMA_VERSION) {
		throw new Error(
			`unsupported baseline schemaVersion: ${String(parsed.schemaVersion)}`,
		);
	}
	return parsed;
}

function countById(entries) {
	const counts = new Map();
	for (const entry of entries) {
		counts.set(entry.id, (counts.get(entry.id) ?? 0) + 1);
	}
	return counts;
}

function compareToBaseline(current, baseline) {
	const baselineEntries = Array.isArray(baseline?.entries)
		? baseline.entries
		: [];
	const baselineCounts = countById(baselineEntries);
	const currentCounts = countById(current);
	const newDebt = [];

	for (const entry of current) {
		const remaining = baselineCounts.get(entry.id) ?? 0;
		if (remaining > 0) {
			baselineCounts.set(entry.id, remaining - 1);
		} else {
			newDebt.push(entry);
		}
	}

	const resolvedDebt = [];
	for (const entry of baselineEntries) {
		const remaining = currentCounts.get(entry.id) ?? 0;
		if (remaining > 0) {
			currentCounts.set(entry.id, remaining - 1);
		} else {
			resolvedDebt.push(entry);
		}
	}

	return { newDebt, resolvedDebt, baselineCount: baselineEntries.length };
}

function categoryCounts(entries) {
	const counts = {};
	for (const entry of entries) {
		counts[entry.category] = (counts[entry.category] ?? 0) + 1;
	}
	return counts;
}

const currentDebt = collectDebt();

if (updateBaseline) {
	const baseline = {
		schemaVersion: BASELINE_SCHEMA_VERSION,
		generatedAt: new Date().toISOString(),
		thresholds: {
			maxFileLines: MAX_FILE_LINES,
			maxFunctionLines: MAX_FUNCTION_LINES,
			maxComplexity: MAX_COMPLEXITY,
			maxTestFileLines: MAX_TEST_FILE_LINES,
			duplicateBlockLines: DUPLICATE_BLOCK_LINES,
		},
		entries: currentDebt,
	};
	mkdirSync(dirname(baselinePath), { recursive: true });
	writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`, "utf8");
	console.info(
		`[code-quality-debt] wrote ${currentDebt.length} baseline entries to ${relative(repoRoot, baselinePath)}`,
	);
	process.exit(0);
}

const baseline = readBaseline();
if (!baseline) {
	console.error(
		`[code-quality-debt] missing baseline: ${relative(repoRoot, baselinePath)}`,
	);
	console.error(
		"[code-quality-debt] run: pnpm run quality:debt -- --update-baseline",
	);
	process.exit(1);
}

const { newDebt, resolvedDebt, baselineCount } = compareToBaseline(
	currentDebt,
	baseline,
);
const status =
	newDebt.length > 0 ? "fail" : resolvedDebt.length > 0 ? "warn" : "pass";
const report = {
	schemaVersion: REPORT_SCHEMA_VERSION,
	status,
	baselinePath: relative(repoRoot, baselinePath),
	baselineCount,
	currentCount: currentDebt.length,
	newDebt,
	resolvedDebt,
	categoryCounts: categoryCounts(currentDebt),
	claimBoundary:
		"Code-quality debt is local static evidence; it does not prove runtime behavior, CI, review-thread state, tracker state, or merge readiness.",
};

if (json) {
	console.info(JSON.stringify(report, null, 2));
} else if (newDebt.length > 0) {
	console.error("[code-quality-debt] new unbaselined debt found:");
	for (const entry of newDebt.slice(0, 25)) {
		console.error(
			`- ${entry.path}:${entry.line} ${entry.category}: ${entry.detail}`,
		);
	}
	if (newDebt.length > 25) {
		console.error(`...and ${newDebt.length - 25} more`);
	}
	console.error(
		"Remove the debt, reduce the touched code, or deliberately refresh the baseline after review.",
	);
} else if (resolvedDebt.length > 0) {
	console.info(
		`[code-quality-debt] pass with burn-down: ${resolvedDebt.length} baseline entr${resolvedDebt.length === 1 ? "y" : "ies"} resolved; refresh baseline in the debt-burn-down PR.`,
	);
} else {
	console.info(
		`[code-quality-debt] pass current=${currentDebt.length} baseline=${baselineCount}; no new debt`,
	);
}

if (newDebt.length > 0) {
	process.exit(1);
}

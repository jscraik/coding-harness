#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import ts from "typescript";

const resolveRepoRoot = () => {
	try {
		return execFileSync("git", ["rev-parse", "--show-toplevel"], {
			encoding: "utf8",
		}).trim();
	} catch {
		return process.cwd();
	}
};

const repoRoot = resolveRepoRoot();
const baselinePath = path.join(
	repoRoot,
	"scripts",
	"type-policy-baseline.json",
);
const updateBaseline = process.argv.includes("--update-baseline");

const trackedFiles = execFileSync("git", ["ls-files", "src/**/*.ts"], {
	cwd: repoRoot,
	encoding: "utf8",
})
	.split("\n")
	.filter(Boolean)
	.filter((filePath) => existsSync(path.join(repoRoot, filePath)))
	.filter((filePath) => !filePath.endsWith(".test.ts"))
	.filter((filePath) => !filePath.endsWith(".spec.ts"))
	.filter((filePath) => !filePath.includes("/__tests__/"));

const normalizeSnippet = (line) => line.trim().replace(/\s+/g, " ");
const lineForPosition = (sourceFile, position) =>
	sourceFile.getLineAndCharacterOfPosition(position).line + 1;
const lineSnippet = (lines, lineNumber) =>
	normalizeSnippet(lines[lineNumber - 1] ?? "");
const typeReferenceName = (node) =>
	ts.isIdentifier(node.typeName) ? node.typeName.text : undefined;
const hasAnyType = (node) => node?.kind === ts.SyntaxKind.AnyKeyword;
const hasUnknownType = (node) => node?.kind === ts.SyntaxKind.UnknownKeyword;

const isExplicitAnyAnnotation = (node) => {
	if (!hasAnyType(node.type)) {
		return false;
	}
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
};

const commentViolations = (content, sourceFile, lines, filePath) => {
	const violations = [];
	const ranges = [];
	const scanner = ts.createScanner(
		ts.ScriptTarget.Latest,
		false,
		ts.LanguageVariant.Standard,
		content,
	);
	let token = scanner.scan();
	while (token !== ts.SyntaxKind.EndOfFileToken) {
		if (
			token === ts.SyntaxKind.SingleLineCommentTrivia ||
			token === ts.SyntaxKind.MultiLineCommentTrivia
		) {
			ranges.push({
				pos: scanner.getTokenPos(),
				end: scanner.getTextPos(),
			});
		}
		token = scanner.scan();
	}
	for (const range of ranges) {
		const comment = content.slice(range.pos, range.end);
		for (const pattern of ["ts-ignore", "ts-nocheck"]) {
			if (comment.includes(`@${pattern}`)) {
				const line = lineForPosition(sourceFile, range.pos);
				violations.push({
					pattern,
					file: filePath,
					line,
					snippet: lineSnippet(lines, line),
				});
			}
		}
	}
	return violations;
};

const findViolations = () => {
	const violations = [];
	for (const filePath of trackedFiles) {
		const absolutePath = path.join(repoRoot, filePath);
		const content = readFileSync(absolutePath, "utf8");
		const lines = content.split("\n");
		const sourceFile = ts.createSourceFile(
			filePath,
			content,
			ts.ScriptTarget.Latest,
			true,
			ts.ScriptKind.TS,
		);
		violations.push(...commentViolations(content, sourceFile, lines, filePath));
		const pushViolation = (pattern, node) => {
			const line = lineForPosition(sourceFile, node.getStart(sourceFile));
			violations.push({
				pattern,
				file: filePath,
				line,
				snippet: lineSnippet(lines, line),
			});
		};
		const visit = (node) => {
			if (isExplicitAnyAnnotation(node)) {
				pushViolation("explicit-any-annotation", node);
			}
			if (ts.isAsExpression(node) && hasAnyType(node.type)) {
				pushViolation("as-any-assertion", node);
			}
			if (
				ts.isAsExpression(node) &&
				ts.isAsExpression(node.expression) &&
				hasUnknownType(node.expression.type)
			) {
				pushViolation("double-assertion", node.expression.type);
			}
			if (
				ts.isTypeReferenceNode(node) &&
				typeReferenceName(node) === "Promise"
			) {
				const [firstArgument] = node.typeArguments ?? [];
				if (hasAnyType(firstArgument)) {
					pushViolation("promise-any", node);
				}
			}
			if (
				ts.isTypeReferenceNode(node) &&
				typeReferenceName(node) === "Record"
			) {
				const [keyArgument, valueArgument] = node.typeArguments ?? [];
				if (
					keyArgument?.kind === ts.SyntaxKind.StringKeyword &&
					hasAnyType(valueArgument)
				) {
					pushViolation("record-string-any", node);
				}
			}
			ts.forEachChild(node, visit);
		};
		visit(sourceFile);
	}
	return violations;
};

const keyFor = (violation) =>
	`${violation.pattern}\u0000${violation.file}\u0000${violation.snippet}`;

const countByKey = (items) => {
	const counts = new Map();
	for (const item of items) {
		const key = keyFor(item);
		counts.set(key, (counts.get(key) ?? 0) + 1);
	}
	return counts;
};

const currentViolations = findViolations();

if (updateBaseline) {
	const baseline = {
		schema_version: 1,
		description:
			"Current TypeScript escape-hatch baseline. New unbaselined entries fail scripts/check-types-policy.mjs.",
		entries: currentViolations,
	};
	writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`, "utf8");
	console.log(
		`[check-types-policy] wrote ${currentViolations.length} baseline entries`,
	);
	process.exit(0);
}

const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
const baselineEntries = Array.isArray(baseline.entries) ? baseline.entries : [];
const baselineCounts = countByKey(baselineEntries);
const currentCounts = countByKey(currentViolations);

const newViolations = [];
for (const violation of currentViolations) {
	const key = keyFor(violation);
	const remaining = baselineCounts.get(key) ?? 0;
	if (remaining > 0) {
		baselineCounts.set(key, remaining - 1);
	} else {
		newViolations.push(violation);
	}
}

const staleBaselineEntries = [];
for (const entry of baselineEntries) {
	const key = keyFor(entry);
	const remaining = currentCounts.get(key) ?? 0;
	if (remaining > 0) {
		currentCounts.set(key, remaining - 1);
	} else {
		staleBaselineEntries.push(entry);
	}
}

if (newViolations.length > 0 || staleBaselineEntries.length > 0) {
	console.error("[check-types-policy] TypeScript escape-hatch policy failed.");
	if (newViolations.length > 0) {
		console.error("\nNew unbaselined entries:");
		for (const violation of newViolations) {
			console.error(
				`- ${violation.file}:${violation.line} ${violation.pattern}: ${violation.snippet}`,
			);
		}
	}
	if (staleBaselineEntries.length > 0) {
		console.error("\nStale baseline entries:");
		for (const entry of staleBaselineEntries) {
			console.error(`- ${entry.file} ${entry.pattern}: ${entry.snippet}`);
		}
	}
	console.error(
		"\nRemove the escape hatch or run scripts/check-types-policy.mjs --update-baseline after a deliberate policy update.",
	);
	process.exit(1);
}

console.log(
	`[check-types-policy] ${currentViolations.length} baselined TypeScript escape hatches; no new entries`,
);

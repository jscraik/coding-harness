#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import ts from "typescript";

const repoRoot = process.cwd();
const manifestPath = join(
	repoRoot,
	"src/lib/testing/behavior-test-suites.json",
);
const canonicalExpectBehaviorPath = resolve(
	repoRoot,
	"src/lib/testing/expect-behavior.ts",
);

function fail(message) {
	console.error(`[behavior-tests] ${message}`);
	process.exitCode = 1;
}

function isInsideRepo(path) {
	const relativePath = relative(repoRoot, path);
	return (
		relativePath !== "" &&
		!relativePath.startsWith("..") &&
		!isAbsolute(relativePath)
	);
}

function hasExecutableExpectBehaviorCall(path, source) {
	const sourceFile = ts.createSourceFile(
		path,
		source,
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TS,
	);
	if (!importsCanonicalExpectBehavior(path, sourceFile)) return false;
	if (declaresLocalExpectBehavior(sourceFile)) return false;
	let found = false;
	function visit(node) {
		if (
			ts.isCallExpression(node) &&
			ts.isIdentifier(node.expression) &&
			node.expression.text === "expectBehavior" &&
			hasBehaviorAssertionShape(node)
		) {
			found = true;
			return;
		}
		ts.forEachChild(node, visit);
	}
	visit(sourceFile);
	return found;
}

function referencesBehaviorTraceControl(source) {
	return /HARNESS_EXPECT_BEHAVIOR_TRACE_(FILE|TOKEN)/.test(source);
}

function traceBelongsToSuite(traceLine, suitePath, token) {
	try {
		const parsed = JSON.parse(traceLine);
		const normalizedSuitePath = suitePath.replaceAll("\\", "/");
		const normalizedStack =
			typeof parsed.stack === "string"
				? parsed.stack.replaceAll("\\", "/")
				: "";
		return (
			typeof parsed.given === "string" &&
			typeof parsed.should === "string" &&
			parsed.token === token &&
			normalizedStack.includes(normalizedSuitePath)
		);
	} catch {
		return false;
	}
}

function vitestExecutablePath() {
	const candidates = [
		join(repoRoot, "node_modules/.bin/vitest"),
		join(repoRoot, "node_modules/.bin/vitest.cmd"),
	];
	return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function verifyBehaviorAssertionExecuted(entry, prefix) {
	const expectedCommand = `pnpm vitest run ${entry.path}`;
	if (entry.provingCommand !== expectedCommand) {
		fail(`${prefix} provingCommand must be exactly: ${expectedCommand}`);
		return;
	}
	const vitestPath = vitestExecutablePath();
	if (!vitestPath) {
		fail(
			prefix +
				" cannot find repo-local Vitest executable: node_modules/.bin/vitest or node_modules/.bin/vitest.cmd",
		);
		return;
	}
	const traceRoot = mkdtempSync(join(tmpdir(), "harness-behavior-trace-"));
	const traceFile = join(traceRoot, "trace.jsonl");
	const traceToken = randomUUID();
	try {
		const result = spawnSync(vitestPath, ["run", entry.path], {
			cwd: repoRoot,
			encoding: "utf8",
			shell: process.platform === "win32",
			env: {
				...process.env,
				HARNESS_EXPECT_BEHAVIOR_TRACE_FILE: traceFile,
				HARNESS_EXPECT_BEHAVIOR_TRACE_TOKEN: traceToken,
			},
		});
		if (result.status !== 0) {
			fail(
				`${entry.path} provingCommand failed with exit ${result.status}: ${entry.provingCommand}`,
			);
			if (result.stdout.trim()) console.error(result.stdout.trim());
			if (result.stderr.trim()) console.error(result.stderr.trim());
			return;
		}
		const trace = existsSync(traceFile)
			? readFileSync(traceFile, "utf8").split("\n").filter(Boolean)
			: [];
		if (
			!trace.some((line) => traceBelongsToSuite(line, entry.path, traceToken))
		) {
			fail(
				`${entry.path} provingCommand must execute an expectBehavior assertion from that suite`,
			);
		}
	} finally {
		rmSync(traceRoot, { force: true, recursive: true });
	}
}

function resolvesCanonicalExpectBehavior(suitePath, moduleSpecifier) {
	if (!moduleSpecifier.startsWith(".")) return false;
	const sourcePath = moduleSpecifier.endsWith(".js")
		? `${moduleSpecifier.slice(0, -3)}.ts`
		: moduleSpecifier;
	return (
		resolve(repoRoot, dirname(suitePath), sourcePath) ===
		canonicalExpectBehaviorPath
	);
}

function importsCanonicalExpectBehavior(suitePath, sourceFile) {
	return sourceFile.statements.some((statement) => {
		if (!ts.isImportDeclaration(statement)) return false;
		if (!ts.isStringLiteral(statement.moduleSpecifier)) return false;
		if (
			!resolvesCanonicalExpectBehavior(
				suitePath,
				statement.moduleSpecifier.text,
			)
		) {
			return false;
		}
		const bindings = statement.importClause?.namedBindings;
		if (!bindings || !ts.isNamedImports(bindings)) return false;
		return bindings.elements.some(
			(element) =>
				element.name.text === "expectBehavior" &&
				(element.propertyName?.text ?? "expectBehavior") === "expectBehavior",
		);
	});
}

function declaresLocalExpectBehavior(sourceFile) {
	let found = false;
	function visit(node) {
		if (
			(ts.isFunctionDeclaration(node) ||
				ts.isClassDeclaration(node) ||
				ts.isVariableDeclaration(node) ||
				ts.isParameter(node)) &&
			ts.isIdentifier(node.name) &&
			node.name.text === "expectBehavior"
		) {
			found = true;
			return;
		}
		ts.forEachChild(node, visit);
	}
	visit(sourceFile);
	return found;
}

function hasBehaviorAssertionShape(node) {
	const [firstArgument] = node.arguments;
	if (!firstArgument || !ts.isObjectLiteralExpression(firstArgument))
		return false;
	const keys = new Set(
		firstArgument.properties
			.map((property) => {
				if (!ts.isPropertyAssignment(property)) return null;
				const name = property.name;
				if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
				return null;
			})
			.filter(Boolean),
	);
	return ["given", "should", "actual", "expected"].every((key) =>
		keys.has(key),
	);
}

if (!existsSync(manifestPath)) {
	fail("missing manifest: src/lib/testing/behavior-test-suites.json");
} else {
	const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
	if (!Array.isArray(manifest) || manifest.length === 0) {
		fail("manifest must be a non-empty array");
	} else {
		for (const [index, entry] of manifest.entries()) {
			const prefix = `entry ${index + 1}`;
			for (const field of ["path", "owner", "rationale", "provingCommand"]) {
				if (typeof entry[field] !== "string" || entry[field].trim() === "") {
					fail(`${prefix} missing non-empty ${field}`);
				}
			}
			if (typeof entry.path !== "string") continue;
			if (!entry.path.endsWith(".test.ts")) {
				fail(`${prefix} path must name a Vitest suite: ${entry.path}`);
			}
			const suitePath = resolve(repoRoot, entry.path);
			if (!isInsideRepo(suitePath)) {
				fail(`${prefix} path must stay inside the repository: ${entry.path}`);
				continue;
			}
			if (!existsSync(suitePath)) {
				fail(`${prefix} suite does not exist: ${entry.path}`);
				continue;
			}
			const suite = readFileSync(suitePath, "utf8");
			if (referencesBehaviorTraceControl(suite)) {
				fail(
					`${entry.path} must not read or write behavior trace control environment variables`,
				);
				continue;
			}
			if (!hasExecutableExpectBehaviorCall(entry.path, suite)) {
				fail(
					`${entry.path} must include at least one executable expectBehavior assertion`,
				);
				continue;
			}
			verifyBehaviorAssertionExecuted(entry, prefix);
		}
	}
}

if (process.exitCode) {
	process.exit();
}

console.log("[behavior-tests] verified registered evidence-bearing suites");

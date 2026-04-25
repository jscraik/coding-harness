/**
 * TypeScript source outline CLI command.
 *
 * Produces a declaration-shaped first pass over a source file so agents can
 * inspect comments and signatures before spending tokens on implementation
 * bodies.
 */

import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { extname, relative, resolve } from "node:path";
import ts from "typescript";
import {
	MAX_INPUT_LENGTH,
	MAX_PATH_LENGTH,
	validateLength,
} from "../lib/input/validation.js";
import { PathTraversalError, validatePath } from "../lib/input/validator.js";

/** Process exit codes for the source-outline command. */
export const EXIT_CODES = {
	SUCCESS: 0,
	NOT_FOUND: 1,
	VALIDATION_ERROR: 2,
	ERROR: 3,
} as const;

const SUPPORTED_EXTENSIONS = new Set([
	".ts",
	".tsx",
	".js",
	".jsx",
	".mts",
	".cts",
]);

/** Source-outline rendering mode. */
export type SourceOutlineMode = "outline" | "implementation";

/** Declaration kinds surfaced by the source-outline command. */
export type SourceSymbolKind =
	| "class"
	| "constructor"
	| "enum"
	| "function"
	| "interface"
	| "method"
	| "property"
	| "type"
	| "variable";

/** Options for generating a source outline from one source file. */
export interface SourceOutlineOptions {
	path: string;
	baseDir?: string;
	symbol?: string;
	json?: boolean;
}

/** One declaration-style source symbol with comments and nested members. */
export interface SourceOutlineSymbol {
	name: string;
	qualifiedName: string;
	kind: SourceSymbolKind;
	signature: string;
	comments: string[];
	startLine: number;
	endLine: number;
	children: SourceOutlineSymbol[];
}

/** Implementation body returned when a caller unwraps a requested symbol. */
export interface SourceOutlineImplementation {
	symbol: string;
	kind: SourceSymbolKind;
	startLine: number;
	endLine: number;
	text: string;
}

/** Source-outline command output envelope for text and JSON callers. */
export interface SourceOutlineOutput {
	success: boolean;
	path: string;
	mode: SourceOutlineMode;
	language: "typescript";
	symbols: SourceOutlineSymbol[];
	implementation?: SourceOutlineImplementation;
	error?: string;
}

interface InternalSourceSymbol {
	symbol: SourceOutlineSymbol;
	implementationNode: ts.Node;
	children: InternalSourceSymbol[];
}

interface ResolvedSourceFile {
	relativePath: string;
	sourceFile: ts.SourceFile;
}

function scriptKindForPath(filePath: string): ts.ScriptKind {
	switch (extname(filePath)) {
		case ".tsx":
			return ts.ScriptKind.TSX;
		case ".jsx":
			return ts.ScriptKind.JSX;
		case ".js":
			return ts.ScriptKind.JS;
		case ".mts":
			return ts.ScriptKind.TS;
		case ".cts":
			return ts.ScriptKind.TS;
		default:
			return ts.ScriptKind.TS;
	}
}

function declarationKind(
	node: ts.VariableDeclarationList,
): "const" | "let" | "var" {
	if ((node.flags & ts.NodeFlags.Const) !== 0) return "const";
	if ((node.flags & ts.NodeFlags.Let) !== 0) return "let";
	return "var";
}

function compactWhitespace(value: string): string {
	return value.replace(/\s+/g, " ").trim();
}

function getNodeText(sourceFile: ts.SourceFile, node: ts.Node): string {
	return sourceFile.text.slice(node.getStart(sourceFile), node.getEnd());
}

function getNodeLine(sourceFile: ts.SourceFile, position: number): number {
	return sourceFile.getLineAndCharacterOfPosition(position).line + 1;
}

function getLeadingComments(
	sourceFile: ts.SourceFile,
	node: ts.Node,
): string[] {
	const ranges =
		ts.getLeadingCommentRanges(sourceFile.text, node.getFullStart()) ?? [];
	const nodeStart = node.getStart(sourceFile);
	return ranges
		.filter((range) => range.end <= nodeStart)
		.map((range) => sourceFile.text.slice(range.pos, range.end).trim())
		.map((comment) =>
			comment
				.replace(/^\/\*\*/, "")
				.replace(/^\/\*/, "")
				.replace(/\*\/$/, "")
				.split("\n")
				.map((line) => line.replace(/^\s*\* ?/, "").replace(/^\s*\/\/ ?/, ""))
				.join("\n")
				.trim(),
		)
		.filter((comment) => comment.length > 0);
}

function signatureBeforeBody(
	sourceFile: ts.SourceFile,
	node:
		| ts.FunctionDeclaration
		| ts.MethodDeclaration
		| ts.ConstructorDeclaration,
): string {
	if (!node.body) return compactWhitespace(getNodeText(sourceFile, node));
	return `${compactWhitespace(
		sourceFile.text.slice(
			node.getStart(sourceFile),
			node.body.getStart(sourceFile),
		),
	)};`;
}

function classSignature(
	sourceFile: ts.SourceFile,
	node: ts.ClassDeclaration,
): string {
	const openBrace = node.members.pos;
	return `${compactWhitespace(
		sourceFile.text.slice(node.getStart(sourceFile), openBrace),
	)} { ... }`;
}

function variableSignature(
	sourceFile: ts.SourceFile,
	statement: ts.VariableStatement,
	declaration: ts.VariableDeclaration,
): string | undefined {
	if (!ts.isIdentifier(declaration.name)) return undefined;
	const modifiers = statement.modifiers
		?.map((modifier) => modifier.getText(sourceFile))
		.join(" ");
	const prefix = modifiers ? `${modifiers} ` : "";
	const name = declaration.name.getText(sourceFile);
	const kind = declarationKind(statement.declarationList);

	if (declaration.type) {
		return `${prefix}${kind} ${name}: ${declaration.type.getText(sourceFile)};`;
	}

	if (
		declaration.initializer &&
		(ts.isArrowFunction(declaration.initializer) ||
			ts.isFunctionExpression(declaration.initializer))
	) {
		const parameters = declaration.initializer.parameters
			.map((parameter) => compactWhitespace(parameter.getText(sourceFile)))
			.join(", ");
		const returnType = declaration.initializer.type
			? `: ${declaration.initializer.type.getText(sourceFile)}`
			: "";
		return `${prefix}${kind} ${name} = (${parameters})${returnType} => ...;`;
	}

	return `${prefix}${kind} ${name};`;
}

function createSymbol(
	sourceFile: ts.SourceFile,
	node: ts.Node,
	name: string,
	qualifiedName: string,
	kind: SourceSymbolKind,
	signature: string,
	children: InternalSourceSymbol[] = [],
	implementationNode: ts.Node = node,
): InternalSourceSymbol {
	return {
		symbol: {
			name,
			qualifiedName,
			kind,
			signature,
			comments: getLeadingComments(sourceFile, node),
			startLine: getNodeLine(sourceFile, node.getStart(sourceFile)),
			endLine: getNodeLine(sourceFile, node.getEnd()),
			children: children.map((child) => child.symbol),
		},
		implementationNode,
		children,
	};
}

function methodName(
	sourceFile: ts.SourceFile,
	node: ts.ClassElement,
): string | undefined {
	if (ts.isConstructorDeclaration(node)) return "constructor";
	if (!("name" in node) || !node.name) return undefined;
	if (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) {
		return node.name.text;
	}
	return node.name.getText(sourceFile);
}

function methodSignature(
	sourceFile: ts.SourceFile,
	node: ts.ClassElement,
): string | undefined {
	if (ts.isConstructorDeclaration(node)) {
		return signatureBeforeBody(sourceFile, node);
	}
	if (ts.isMethodDeclaration(node)) {
		return signatureBeforeBody(sourceFile, node);
	}
	if (ts.isPropertyDeclaration(node)) {
		return `${compactWhitespace(getNodeText(sourceFile, node)).replace(/;?$/, "")};`;
	}
	return undefined;
}

function extractClassMembers(
	sourceFile: ts.SourceFile,
	node: ts.ClassDeclaration,
	className: string,
): InternalSourceSymbol[] {
	const members: InternalSourceSymbol[] = [];
	for (const member of node.members) {
		if (
			!ts.isConstructorDeclaration(member) &&
			!ts.isMethodDeclaration(member) &&
			!ts.isPropertyDeclaration(member)
		) {
			continue;
		}
		const name = methodName(sourceFile, member);
		const signature = methodSignature(sourceFile, member);
		if (!name || !signature) continue;
		members.push(
			createSymbol(
				sourceFile,
				member,
				name,
				`${className}.${name}`,
				ts.isPropertyDeclaration(member)
					? "property"
					: name === "constructor"
						? "constructor"
						: "method",
				signature,
			),
		);
	}
	return members;
}

function extractTopLevelSymbols(
	sourceFile: ts.SourceFile,
): InternalSourceSymbol[] {
	const symbols: InternalSourceSymbol[] = [];

	for (const statement of sourceFile.statements) {
		if (ts.isFunctionDeclaration(statement) && statement.name) {
			const name = statement.name.text;
			symbols.push(
				createSymbol(
					sourceFile,
					statement,
					name,
					name,
					"function",
					signatureBeforeBody(sourceFile, statement),
				),
			);
			continue;
		}

		if (ts.isClassDeclaration(statement) && statement.name) {
			const name = statement.name.text;
			const children = extractClassMembers(sourceFile, statement, name);
			symbols.push(
				createSymbol(
					sourceFile,
					statement,
					name,
					name,
					"class",
					classSignature(sourceFile, statement),
					children,
				),
			);
			continue;
		}

		if (ts.isInterfaceDeclaration(statement)) {
			const name = statement.name.text;
			symbols.push(
				createSymbol(
					sourceFile,
					statement,
					name,
					name,
					"interface",
					compactWhitespace(getNodeText(sourceFile, statement)),
				),
			);
			continue;
		}

		if (ts.isTypeAliasDeclaration(statement)) {
			const name = statement.name.text;
			symbols.push(
				createSymbol(
					sourceFile,
					statement,
					name,
					name,
					"type",
					compactWhitespace(getNodeText(sourceFile, statement)),
				),
			);
			continue;
		}

		if (ts.isEnumDeclaration(statement)) {
			const name = statement.name.text;
			symbols.push(
				createSymbol(
					sourceFile,
					statement,
					name,
					name,
					"enum",
					compactWhitespace(getNodeText(sourceFile, statement)),
				),
			);
			continue;
		}

		if (ts.isVariableStatement(statement)) {
			for (const declaration of statement.declarationList.declarations) {
				if (!ts.isIdentifier(declaration.name)) continue;
				const signature = variableSignature(sourceFile, statement, declaration);
				if (!signature) continue;
				symbols.push(
					createSymbol(
						sourceFile,
						statement,
						declaration.name.text,
						declaration.name.text,
						"variable",
						signature,
						[],
						statement,
					),
				);
			}
		}
	}

	return symbols;
}

function flattenSymbols(
	symbols: InternalSourceSymbol[],
): InternalSourceSymbol[] {
	const flattened: InternalSourceSymbol[] = [];
	for (const symbol of symbols) {
		flattened.push(symbol);
		flattened.push(...flattenSymbols(symbol.children));
	}
	return flattened;
}

function resolveSourceFile(options: SourceOutlineOptions): ResolvedSourceFile {
	const baseDir = realpathSync(resolve(options.baseDir ?? process.cwd()));
	const pathValidation = validateLength(options.path, MAX_PATH_LENGTH, "path");
	if (!pathValidation.ok) {
		throw new Error(pathValidation.error.message);
	}
	const absolutePath = validatePath(baseDir, options.path);
	const extension = extname(absolutePath);
	if (!SUPPORTED_EXTENSIONS.has(extension)) {
		throw new Error(
			`Unsupported source extension "${extension}". Expected one of: ${[
				...SUPPORTED_EXTENSIONS,
			].join(", ")}`,
		);
	}
	if (!existsSync(absolutePath)) {
		throw new Error(`Source file not found: ${options.path}`);
	}
	if (!statSync(absolutePath).isFile()) {
		throw new Error(`Source path is not a file: ${options.path}`);
	}
	const text = readFileSync(absolutePath, "utf-8");
	const sourceFile = ts.createSourceFile(
		absolutePath,
		text,
		ts.ScriptTarget.Latest,
		true,
		scriptKindForPath(absolutePath),
	);
	return {
		relativePath: relative(baseDir, absolutePath).replace(/\\/g, "/"),
		sourceFile,
	};
}

function implementationForSymbol(
	resolved: ResolvedSourceFile,
	internalSymbol: InternalSourceSymbol,
): SourceOutlineImplementation {
	const node = internalSymbol.implementationNode;
	return {
		symbol: internalSymbol.symbol.qualifiedName,
		kind: internalSymbol.symbol.kind,
		startLine: getNodeLine(
			resolved.sourceFile,
			node.getStart(resolved.sourceFile),
		),
		endLine: getNodeLine(resolved.sourceFile, node.getEnd()),
		text: getNodeText(resolved.sourceFile, node),
	};
}

function parseSourceOutlineArgs(
	args: string[],
): SourceOutlineOptions | undefined {
	const json = args.includes("--json");
	const help = args.includes("--help") || args.includes("-h");
	if (help) return undefined;
	const symbolIndex = args.indexOf("--symbol");
	const symbol = symbolIndex >= 0 ? args[symbolIndex + 1] : undefined;
	const path = args.find((arg, index) => {
		if (arg.startsWith("--")) return false;
		if (index > 0 && args[index - 1] === "--symbol") return false;
		return true;
	});
	if (!path) return undefined;
	const options: SourceOutlineOptions = { path };
	if (json) options.json = true;
	if (symbol) options.symbol = symbol;
	return options;
}

function printSourceOutlineUsage(): void {
	console.info(`Usage: harness source-outline <path> [--symbol <name>] [--json]

Print declaration-style comments and signatures for a TypeScript-family source file.
Use --symbol to unwrap the implementation for a single top-level symbol or class member.

Examples:
  harness source-outline src/commands/source-outline.ts
  harness source-outline src/commands/source-outline.ts --symbol runSourceOutline --json
  harness source-outline src/lib/example.ts --symbol Example.run`);
}

function formatSourceOutlineText(output: SourceOutlineOutput): string {
	const lines = [`${output.path} (${output.mode})`];
	const writeSymbol = (symbol: SourceOutlineSymbol, depth: number): void => {
		const indent = "  ".repeat(depth);
		lines.push(
			`${indent}${symbol.kind} ${symbol.qualifiedName} lines ${symbol.startLine}-${symbol.endLine}`,
		);
		for (const comment of symbol.comments) {
			lines.push(...comment.split("\n").map((line) => `${indent}  # ${line}`));
		}
		lines.push(`${indent}  ${symbol.signature}`);
		for (const child of symbol.children) {
			writeSymbol(child, depth + 1);
		}
	};

	for (const symbol of output.symbols) {
		writeSymbol(symbol, 0);
	}
	if (output.implementation) {
		lines.push("");
		lines.push(
			`implementation ${output.implementation.symbol} lines ${output.implementation.startLine}-${output.implementation.endLine}`,
		);
		lines.push(output.implementation.text);
	}
	return lines.join("\n");
}

/** Build a low-token source outline, optionally unwrapping one symbol body. */
export function runSourceOutline(
	options: SourceOutlineOptions,
): SourceOutlineOutput {
	const symbolValidation = options.symbol
		? validateLength(options.symbol, MAX_INPUT_LENGTH, "symbol")
		: undefined;
	if (symbolValidation && !symbolValidation.ok) {
		return {
			success: false,
			path: options.path,
			mode: "outline",
			language: "typescript",
			symbols: [],
			error: symbolValidation.error.message,
		};
	}

	try {
		const resolved = resolveSourceFile(options);
		const internalSymbols = extractTopLevelSymbols(resolved.sourceFile);
		const output: SourceOutlineOutput = {
			success: true,
			path: resolved.relativePath,
			mode: options.symbol ? "implementation" : "outline",
			language: "typescript",
			symbols: internalSymbols.map((symbol) => symbol.symbol),
		};
		if (options.symbol) {
			const match = flattenSymbols(internalSymbols).find(
				(symbol) =>
					symbol.symbol.name === options.symbol ||
					symbol.symbol.qualifiedName === options.symbol,
			);
			if (!match) {
				return {
					success: false,
					path: resolved.relativePath,
					mode: "implementation",
					language: "typescript",
					symbols: output.symbols,
					error: `Symbol not found: ${options.symbol}`,
				};
			}
			output.implementation = implementationForSymbol(resolved, match);
		}
		return output;
	} catch (error) {
		const message =
			error instanceof PathTraversalError
				? "Path traversal detected"
				: error instanceof Error
					? error.message
					: "Unknown source outline error";
		return {
			success: false,
			path: options.path,
			mode: options.symbol ? "implementation" : "outline",
			language: "typescript",
			symbols: [],
			error: message,
		};
	}
}

/** Execute the source-outline command from registry-dispatched CLI args. */
export function runSourceOutlineCLI(args: string[]): number {
	const options = parseSourceOutlineArgs(args);
	if (!options) {
		printSourceOutlineUsage();
		return EXIT_CODES.VALIDATION_ERROR;
	}
	const output = runSourceOutline(options);
	if (options.json) {
		console.info(JSON.stringify(output, null, 2));
	} else if (output.success) {
		console.info(formatSourceOutlineText(output));
	} else {
		console.error(output.error ?? "Source outline failed");
	}

	if (output.success) return EXIT_CODES.SUCCESS;
	if (output.error?.startsWith("Source file not found"))
		return EXIT_CODES.NOT_FOUND;
	if (
		output.error?.startsWith("Unsupported source extension") ||
		output.error === "Path traversal detected"
	) {
		return EXIT_CODES.VALIDATION_ERROR;
	}
	return EXIT_CODES.ERROR;
}

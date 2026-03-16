#!/usr/bin/env node
/**
 * check-architecture-rules.cjs
 *
 * Implements the rules defined in .architecture.yml using only Node.js
 * built-ins. Replaces `diagram test` (which has a MODULE_NOT_FOUND: ./rules
 * bug in @brainwav/diagram v1.0.8).
 *
 * Rules enforced:
 *   - no-circular-deps       : no import cycles in src/
 *   - commands-no-cross-import: src/commands/* must not import other commands
 *   - auth-commands-use-crypto: auth-boundary commands must import node:crypto
 *   - github-lib-no-fs       : src/lib/github/* must not import node:fs/fs
 *   - diagram-freshness      : AI/diagrams/manifest.json must contain required
 *                              types with no placeholders
 *
 * Exit codes:
 *   0 - all rules pass
 *   1 - one or more rules fail (errors printed to stdout, summary to stderr)
 *
 * Usage:
 *   node scripts/check-architecture-rules.cjs [--format console|json] [--verbose]
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");

// ── CLI args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const FORMAT = args.includes("--format")
	? args[args.indexOf("--format") + 1]
	: "console";
const VERBOSE = args.includes("--verbose");

// ── Configuration ───────────────────────────────────────────────────────────
const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, "src");
const COMMANDS_DIR = path.join(SRC_DIR, "commands");
const GITHUB_LIB_DIR = path.join(SRC_DIR, "lib", "github");
const MANIFEST_PATH = path.join(ROOT, "AI", "diagrams", "manifest.json");
const BASELINE_PATH = path.join(ROOT, ".architecture-baseline.txt");

// Load baseline: pre-existing violations that are advisory-only (not CI-blocking)
const baselineKeys = new Set();
if (fs.existsSync(BASELINE_PATH)) {
	for (const line of fs.readFileSync(BASELINE_PATH, "utf-8").split("\n")) {
		const trimmed = line.trim();
		if (trimmed && !trimmed.startsWith("#")) {
			baselineKeys.add(trimmed); // format: "<rule-id>|<relative-file>"
		}
	}
}

const REQUIRED_DIAGRAM_TYPES = [
	"architecture",
	"dependency",
	"security",
	"auth",
];

const AUTH_BOUNDARY_COMMANDS = [
	"ci-migrate.ts",
	"check-authz.ts",
	"branch-protect.ts",
	"evidence-verify.ts",
];

// ── Utilities ────────────────────────────────────────────────────────────────

/** Recursively collect all .ts files under a directory, excluding .test.ts */
function collectTsFiles(dir, excludeTests = false) {
	if (!fs.existsSync(dir)) return [];
	const results = [];
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			results.push(...collectTsFiles(full, excludeTests));
		} else if (
			entry.name.endsWith(".ts") &&
			!(excludeTests && entry.name.endsWith(".test.ts"))
		) {
			results.push(full);
		}
	}
	return results;
}

/** Parse static import/require paths from a TypeScript source file */
function extractImports(filePath) {
	const content = fs.readFileSync(filePath, "utf-8");
	const imports = [];
	// ESM static imports: import ... from '...'
	const esmRe = /(?:^|\n)\s*import\s+(?:[^'"]*from\s+)?['"]([^'"]+)['"]/g;
	let m = esmRe.exec(content);
	while (m !== null) {
		imports.push(m[1]);
		m = esmRe.exec(content);
	}
	// CommonJS: require('...')
	const cjsRe = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
	m = cjsRe.exec(content);
	while (m !== null) {
		imports.push(m[1]);
		m = cjsRe.exec(content);
	}
	return imports;
}

/** Resolve a relative import path to an absolute file path */
function resolveImport(fromFile, importPath) {
	if (!importPath.startsWith(".")) return null; // external
	const base = path.resolve(path.dirname(fromFile), importPath);
	// Try with .ts extension, then /index.ts
	for (const candidate of [base, `${base}.ts`, path.join(base, "index.ts")]) {
		if (fs.existsSync(candidate)) return candidate;
	}
	// Strip .js extension (ESM compat imports)
	const jsStripped = base.replace(/\.js$/, "");
	for (const candidate of [
		jsStripped,
		`${jsStripped}.ts`,
		path.join(jsStripped, "index.ts"),
	]) {
		if (fs.existsSync(candidate)) return candidate;
	}
	return null;
}

// ── Results collector ────────────────────────────────────────────────────────

const violations = []; // { rule, severity, file, message }

function fail(rule, severity, file, message) {
	const rel = path.relative(ROOT, file);
	const baselineKey = `${rule}|${rel}`;
	const effectiveSeverity = baselineKeys.has(baselineKey)
		? "baseline"
		: severity;
	violations.push({
		rule,
		severity: effectiveSeverity,
		file: rel,
		message,
		baselined: baselineKeys.has(baselineKey),
	});
}

// ── Rule: no-circular-deps ───────────────────────────────────────────────────

function checkNoCyclicDeps() {
	const files = collectTsFiles(SRC_DIR);
	// Build adjacency list: file -> [resolved import files]
	const graph = new Map();
	for (const file of files) {
		const deps = [];
		for (const imp of extractImports(file)) {
			const resolved = resolveImport(file, imp);
			if (resolved && files.includes(resolved)) {
				deps.push(resolved);
			}
		}
		graph.set(file, deps);
	}

	// DFS cycle detection
	const visited = new Set();
	const inStack = new Set();
	const cyclesFound = new Set();

	function dfs(node, stack) {
		if (inStack.has(node)) {
			const cycleStart = stack.indexOf(node);
			const cycle = stack.slice(cycleStart).concat(node);
			const key = cycle.map((f) => path.relative(ROOT, f)).join(" → ");
			if (!cyclesFound.has(key)) {
				cyclesFound.add(key);
				fail("no-circular-deps", "error", node, `Circular import: ${key}`);
			}
			return;
		}
		if (visited.has(node)) return;
		visited.add(node);
		inStack.add(node);
		stack.push(node);
		for (const dep of graph.get(node) || []) {
			dfs(dep, stack);
		}
		stack.pop();
		inStack.delete(node);
	}

	for (const file of files) {
		dfs(file, []);
	}
}

// ── Rule: commands-no-cross-import ──────────────────────────────────────────

function checkCommandsNoCrossImport() {
	if (!fs.existsSync(COMMANDS_DIR)) return;
	const commandFiles = collectTsFiles(COMMANDS_DIR, true);
	for (const file of commandFiles) {
		for (const imp of extractImports(file)) {
			const resolved = resolveImport(file, imp);
			if (resolved?.startsWith(COMMANDS_DIR) && resolved !== file) {
				fail(
					"commands-no-cross-import",
					"error",
					file,
					`Command imports another command: ${path.relative(ROOT, resolved)}. Move shared logic to src/lib/.`,
				);
			}
		}
	}
}

// ── Rule: auth-commands-use-crypto ──────────────────────────────────────────

function checkAuthCommandsUseCrypto() {
	for (const filename of AUTH_BOUNDARY_COMMANDS) {
		const filePath = path.join(COMMANDS_DIR, filename);
		if (!fs.existsSync(filePath)) continue;
		const imports = extractImports(filePath);
		const usesCrypto = imports.some(
			(imp) => imp === "node:crypto" || imp === "crypto",
		);
		if (!usesCrypto) {
			// Also check if it's imported via a lib module (indirect — warn only)
			fail(
				"auth-commands-use-crypto",
				"warning",
				filePath,
				"Auth-boundary command does not directly import node:crypto. Verify signing is delegated to a lib module that does.",
			);
		}
	}
}

// ── Rule: github-lib-no-fs ──────────────────────────────────────────────────

function checkGithubLibNoFs() {
	if (!fs.existsSync(GITHUB_LIB_DIR)) return;
	const files = collectTsFiles(GITHUB_LIB_DIR);
	for (const file of files) {
		const imports = extractImports(file);
		const usesFs = imports.some(
			(imp) => imp === "node:fs" || imp === "fs" || imp === "node:fs/promises",
		);
		if (usesFs) {
			fail(
				"github-lib-no-fs",
				"error",
				file,
				"src/lib/github file imports node:fs directly. Use src/lib/input/ path helpers instead.",
			);
		}
	}
}

// ── Rule: diagram-freshness ──────────────────────────────────────────────────

function checkDiagramFreshness() {
	if (!fs.existsSync(MANIFEST_PATH)) {
		fail(
			"diagram-freshness",
			"error",
			MANIFEST_PATH,
			`Manifest not found: ${path.relative(ROOT, MANIFEST_PATH)}. Run: diagram all . --output-dir AI/diagrams`,
		);
		return;
	}

	let manifest;
	try {
		manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));
	} catch {
		fail(
			"diagram-freshness",
			"error",
			MANIFEST_PATH,
			"Manifest JSON is invalid.",
		);
		return;
	}

	// diagram manifest JSON structure: { diagrams: [{ id, path, status? }], ... }
	// or flat object keyed by type from the CLI's --json output.
	// Handle both shapes.
	const diagrams = Array.isArray(manifest.diagrams)
		? manifest.diagrams
		: Object.entries(manifest).map(([id, val]) =>
				typeof val === "object" ? { id, ...val } : { id, path: val },
			);

	const found = new Map(diagrams.map((d) => [d.id ?? d.type, d]));

	for (const type of REQUIRED_DIAGRAM_TYPES) {
		if (!found.has(type)) {
			fail(
				"diagram-freshness",
				"error",
				MANIFEST_PATH,
				`Required diagram type missing from manifest: ${type}`,
			);
			continue;
		}
		const diag = found.get(type);
		const diagPath = path.join(
			ROOT,
			"AI",
			"diagrams",
			diag.path ?? `${type}.mmd`,
		);
		if (!fs.existsSync(diagPath)) {
			fail(
				"diagram-freshness",
				"error",
				MANIFEST_PATH,
				`Diagram file not found for type ${type}: ${path.relative(ROOT, diagPath)}`,
			);
			continue;
		}
		const content = fs.readFileSync(diagPath, "utf-8");
		if (
			content.includes("PLACEHOLDER") ||
			content.trim() === "" ||
			/graph\s+TD\s*\n\s*A\["?Placeholder/i.test(content)
		) {
			fail(
				"diagram-freshness",
				"error",
				diagPath,
				`Diagram type ${type} is a placeholder. Regenerate: diagram all . --output-dir AI/diagrams`,
			);
		}
	}
}

// ── Run all rules ────────────────────────────────────────────────────────────

checkNoCyclicDeps();
checkCommandsNoCrossImport();
checkAuthCommandsUseCrypto();
checkGithubLibNoFs();
checkDiagramFreshness();

// ── Report ───────────────────────────────────────────────────────────────────

const errors = violations.filter((v) => v.severity === "error");
const warnings = violations.filter((v) => v.severity === "warning");
const baselined = violations.filter((v) => v.severity === "baseline");

if (FORMAT === "json") {
	const out = {
		schema_version: 1,
		command: "check-architecture-rules",
		status: errors.length === 0 ? "pass" : "fail",
		summary: {
			total: violations.length,
			errors: errors.length,
			warnings: warnings.length,
			baselined: baselined.length,
		},
		violations,
	};
	console.log(JSON.stringify(out, null, 2));
} else {
	for (const v of errors) {
		console.log(`❌ [${v.rule}] ${v.file}`);
		console.log(`   ${v.message}`);
	}
	for (const v of warnings) {
		console.log(`⚠️  [${v.rule}] ${v.file}`);
		console.log(`   ${v.message}`);
	}
	if (VERBOSE) {
		for (const v of baselined) {
			console.log(`📋 [${v.rule}] ${v.file} (baselined — advisory only)`);
			console.log(`   ${v.message}`);
		}
	}

	if (violations.length === 0) {
		console.log("✅ All architecture rules passed.");
	} else if (errors.length === 0) {
		console.log(
			`✅ No new violations. ${warnings.length} warning(s), ${baselined.length} baselined tech-debt item(s).`,
		);
	} else {
		console.log(
			`\n❌ ${errors.length} new error(s), ${warnings.length} warning(s), ${baselined.length} baselined. Fix errors before merge.`,
		);
	}
}

if (errors.length > 0) {
	process.exit(1);
}

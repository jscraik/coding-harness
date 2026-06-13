#!/usr/bin/env node
/**
 * check-architecture-rules.cjs
 *
 * Implements the rules defined in .architecture.yml using only Node.js
 * built-ins. This replaced `diagram test` when @brainwav/diagram v1.0.8 had a
 * MODULE_NOT_FOUND: ./rules bug; keep the local checks as the stable harness
 * contract until a deliberate migration removes them.
 *
 * Rules enforced:
 *   - no-circular-deps       : no import cycles in src/
 *   - commands-no-cross-import: command facade files must not import other
 *                              command facades
 *   - auth-commands-use-crypto: auth-boundary commands must import node:crypto
 *   - github-lib-no-fs       : src/lib/github/* must not import node:fs/fs
 *   - diagram-freshness      : .diagram/manifest.json must contain required
 *                              types with no placeholders
 *
 * Exit codes:
 *   0 - all rules pass with no unowned warnings
 *   1 - one or more rules fail, or one or more warnings are unowned
 *       (errors printed to stdout, summary to stderr)
 *
 * Usage:
 *   node scripts/check-architecture-rules.cjs [--format console|json] [--verbose]
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

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
const DIAGRAM_DIR = path.join(ROOT, ".diagram");
const MANIFEST_PATH = path.join(DIAGRAM_DIR, "manifest.json");
const BASELINE_PATH = path.join(ROOT, ".architecture-baseline.txt");
const ARCHITECTURE_REGISTRY_VALIDATOR = path.join(
	ROOT,
	"scripts",
	"validate-architecture-registries.cjs",
);
const COMMAND_SPECS_CORE_PATH = path.join(
	ROOT,
	"src",
	"lib",
	"cli",
	"registry",
	"command-specs-core.ts",
);

// Load baseline: pre-existing violations that are advisory-only (not CI-blocking)
const baselineKeys = new Set();
const baselineMetadataViolations = [];
const todayYmd = new Date().toISOString().slice(0, 10);

function isValidYmd(value) {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (!match) return false;
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const date = new Date(Date.UTC(year, month - 1, day));
	return (
		date.getUTCFullYear() === year &&
		date.getUTCMonth() === month - 1 &&
		date.getUTCDate() === day
	);
}

if (fs.existsSync(BASELINE_PATH)) {
	for (const line of fs.readFileSync(BASELINE_PATH, "utf-8").split("\n")) {
		const trimmed = line.trim();
		if (trimmed && !trimmed.startsWith("#")) {
			const [rule, relFile, ...metadata] = trimmed.split("|");
			const metadataText = metadata.join("|");
			const hasOwner = /\bowner=[^|]+/.test(metadataText);
			const hasReason = /\breason=[^|]+/.test(metadataText);
			const dateMatch = /\bdate=(\d{4}-\d{2}-\d{2})\b/.exec(metadataText);
			const ticketMatch = /\bticket=(JSC-\d+)\b/.exec(metadataText);
			const expiresMatch = /\bexpires=(\d{4}-\d{2}-\d{2})\b/.exec(metadataText);
			if (
				!rule ||
				!relFile ||
				!hasOwner ||
				!hasReason ||
				!dateMatch ||
				!ticketMatch ||
				!expiresMatch
			) {
				baselineMetadataViolations.push({
					line: trimmed,
					reason:
						"baseline entries must use <rule-id>|<relative-file-path>|owner=<owner>|reason=<reason>|date=YYYY-MM-DD|ticket=JSC-<number>|expires=YYYY-MM-DD",
				});
				continue;
			}
			if (!isValidYmd(dateMatch[1])) {
				baselineMetadataViolations.push({
					line: trimmed,
					reason: `baseline date must be a valid UTC YYYY-MM-DD calendar date: ${dateMatch[1]}`,
				});
				continue;
			}
			if (!isValidYmd(expiresMatch[1])) {
				baselineMetadataViolations.push({
					line: trimmed,
					reason: `baseline expires must be a valid UTC YYYY-MM-DD calendar date: ${expiresMatch[1]}`,
				});
				continue;
			}
			if (expiresMatch[1] < todayYmd) {
				baselineMetadataViolations.push({
					line: trimmed,
					reason: `baseline entry expired on ${expiresMatch[1]}; renew the owner-visible debt record or fix the architecture warning`,
				});
				continue;
			}
			baselineKeys.add(`${rule}|${relFile}`);
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

function stripTypeScriptComments(content) {
	return content
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** Parse static import/require paths from TypeScript source text. */
function extractImportsFromContent(content, options = {}) {
	const source = stripTypeScriptComments(content);
	const imports = [];
	// ESM static imports/exports: handle multiline, 'export type', etc.
	// Match `import|export ... from '...'`
	const esmRe =
		/(?<kind>import|export)\s+(?<typeOnly>type\s+)?(?:[\s\S]*?from\s+)?['"](?<specifier>[^'"]+)['"]/g;
	let m = esmRe.exec(source);
	while (m !== null) {
		if (!options.runtimeOnly || !m.groups?.typeOnly) {
			imports.push(m.groups?.specifier);
		}
		m = esmRe.exec(source);
	}
	// CommonJS and Dynamic Import: require('.') or import('.')
	const cjsRe = /(?:require|import)\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
	m = cjsRe.exec(source);
	while (m !== null) {
		imports.push(m[1]);
		m = cjsRe.exec(source);
	}
	return imports.filter((specifier) => typeof specifier === "string");
}

/** Parse static import/require paths from a TypeScript source file. */
function extractImports(filePath, options = {}) {
	return extractImportsFromContent(fs.readFileSync(filePath, "utf-8"), options);
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

function getRegisteredCommandFacadeFiles() {
	if (!fs.existsSync(COMMAND_SPECS_CORE_PATH)) return new Set();
	const content = fs.readFileSync(COMMAND_SPECS_CORE_PATH, "utf-8");
	const commandImportRe =
		/from\s+['"]\.\.\/\.\.\/\.\.\/commands\/([^'"]+)\.js['"]/g;
	const facades = new Set();
	let match = commandImportRe.exec(content);
	while (match !== null) {
		facades.add(path.join(COMMANDS_DIR, `${match[1]}.ts`));
		match = commandImportRe.exec(content);
	}
	return facades;
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

for (const violation of baselineMetadataViolations) {
	fail(
		"architecture-baseline-metadata",
		"error",
		BASELINE_PATH,
		`${violation.reason}: ${violation.line}`,
	);
}

// ── Rule: no-circular-deps ───────────────────────────────────────────────────

function checkNoCyclicDeps() {
	const files = collectTsFiles(SRC_DIR);
	// Build adjacency list: file -> [resolved import files]
	const graph = new Map();
	for (const file of files) {
		const deps = [];
		for (const imp of extractImports(file, { runtimeOnly: true })) {
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
	const commandFacadeFiles = getRegisteredCommandFacadeFiles();
	for (const file of commandFiles) {
		if (!commandFacadeFiles.has(file)) continue;
		for (const imp of extractImports(file)) {
			const resolved = resolveImport(file, imp);
			if (
				resolved !== null &&
				resolved !== file &&
				commandFacadeFiles.has(resolved)
			) {
				fail(
					"commands-no-cross-import",
					"error",
					file,
					`Command facade imports another command facade: ${path.relative(ROOT, resolved)}. Move shared logic to src/lib/ or a focused command seam.`,
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

/**
 * Validates the .diagram manifest and its diagram files for presence and freshness.
 *
 * Checks that .diagram/manifest.json exists and is valid JSON (supports either
 * a `diagrams` array or an object shape), ensures all REQUIRED_DIAGRAM_TYPES are
 * present in the manifest, verifies each referenced diagram file exists under
 * .diagram, and flags diagrams that appear to be placeholders (contains the
 * substring "PLACEHOLDER", is empty/whitespace, or matches a placeholder node pattern).
 *
 * When a problem is detected this function records a violation via `fail(...)`
 * (for example: missing manifest, invalid JSON, missing diagram type/file, or
 * placeholder content). The suggested regeneration command in violation messages
 * is: `pnpm run diagrams:refresh`.
 */

function checkDiagramFreshness() {
	if (!fs.existsSync(MANIFEST_PATH)) {
		fail(
			"diagram-freshness",
			"error",
			MANIFEST_PATH,
			`Manifest not found: ${path.relative(ROOT, MANIFEST_PATH)}. Run: pnpm run diagrams:refresh`,
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
		const diagPath = path.join(DIAGRAM_DIR, diag.path ?? `${type}.mmd`);
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
				`Diagram type ${type} is a placeholder. Regenerate: pnpm run diagrams:refresh`,
			);
		}
	}
}

// ── Rule: architecture-registries ───────────────────────────────────────────

function checkArchitectureRegistries() {
	if (!fs.existsSync(ARCHITECTURE_REGISTRY_VALIDATOR)) {
		fail(
			"architecture-registries",
			"error",
			ARCHITECTURE_REGISTRY_VALIDATOR,
			"Architecture registry validator is missing.",
		);
		return;
	}

	const result = spawnSync(
		process.execPath,
		[ARCHITECTURE_REGISTRY_VALIDATOR],
		{
			cwd: ROOT,
			encoding: "utf-8",
		},
	);
	if (result.status === 0) return;

	let parsed = null;
	try {
		parsed = JSON.parse(result.stdout);
	} catch {
		fail(
			"architecture-registries",
			"error",
			ARCHITECTURE_REGISTRY_VALIDATOR,
			(
				result.stderr ||
				result.stdout ||
				"architecture registry validation failed"
			).trim(),
		);
		return;
	}

	for (const violation of parsed.violations ?? []) {
		fail(
			"architecture-registries",
			"error",
			path.join(ROOT, violation.file ?? "docs/architecture"),
			violation.message ?? "architecture registry validation failed",
		);
	}
}

// ── Run all rules ────────────────────────────────────────────────────────────

checkNoCyclicDeps();
checkCommandsNoCrossImport();
checkAuthCommandsUseCrypto();
checkGithubLibNoFs();
checkDiagramFreshness();
checkArchitectureRegistries();

// ── Report ───────────────────────────────────────────────────────────────────

const errors = violations.filter((v) => v.severity === "error");
const warnings = violations.filter((v) => v.severity === "warning");
const baselined = violations.filter((v) => v.severity === "baseline");
const failed = errors.length > 0 || warnings.length > 0;

if (FORMAT === "json") {
	const out = {
		schema_version: 1,
		command: "check-architecture-rules",
		status: failed ? "fail" : "pass",
		summary: {
			total: violations.length,
			errors: errors.length,
			warnings: warnings.length,
			baselined: baselined.length,
		},
		violations,
	};
	process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
} else {
	for (const violation of errors) {
		process.stderr.write(
			`[error] ${violation.rule} ${violation.file}: ${violation.message}\n`,
		);
	}
	for (const violation of warnings) {
		process.stderr.write(
			`[warning] ${violation.rule} ${violation.file}: ${violation.message}\n`,
		);
	}
	if (VERBOSE) {
		for (const violation of baselined) {
			process.stderr.write(
				`[baseline] ${violation.rule} ${violation.file}: ${violation.message}\n`,
			);
		}
	}

	if (violations.length === 0) {
		process.stderr.write("[architecture] pass: no violations found\n");
	} else if (failed) {
		process.stderr.write(
			`[architecture] fail: ${errors.length} error(s), ${warnings.length} warning(s), ${baselined.length} baselined\n`,
		);
	} else {
		process.stderr.write(
			`[architecture] pass: ${baselined.length} baselined warning(s) owned\n`,
		);
	}
}

if (failed) {
	process.exit(1);
}

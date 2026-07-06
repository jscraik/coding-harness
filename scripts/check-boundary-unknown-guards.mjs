#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = (() => {
	try {
		return execFileSync("git", ["rev-parse", "--show-toplevel"], {
			encoding: "utf8",
		}).trim();
	} catch {
		return process.cwd();
	}
})();

const baselinePath = path.join(
	repoRoot,
	"scripts",
	"boundary-unknown-guards-baseline.json",
);
const updateBaseline = process.argv.includes("--update-baseline");

const bannedGuardNames = [
	"isRecord",
	"isObjectRecord",
	"isPlainObject",
	"isObject",
	"isDict",
	"asRecord",
	"asRecords",
	"coerceRecord",
	"normalizeUnknown",
	"parseUnknown",
	"is_record",
	"is_object_record",
	"is_plain_object",
	"is_object",
	"is_dict",
	"as_record",
	"as_records",
	"coerce_record",
	"normalize_unknown",
	"parse_unknown",
];
const bannedGuardNameSet = new Set(bannedGuardNames);

const trackedFiles = execFileSync("git", ["ls-files"], {
	cwd: repoRoot,
	encoding: "utf8",
})
	.split("\n")
	.filter(Boolean)
	.filter((filePath) => existsSync(path.join(repoRoot, filePath)))
	.filter((filePath) => !filePath.endsWith(".test.ts"))
	.filter((filePath) => !filePath.endsWith(".test.tsx"))
	.filter((filePath) => !filePath.endsWith(".spec.ts"))
	.filter((filePath) => !filePath.endsWith(".spec.tsx"))
	.filter((filePath) => !filePath.includes("/__tests__/"));

const normalizeSnippet = (line) => line.trim().replace(/\s+/g, " ");

const diagnosticFor = (name) =>
	"Do not add " +
	name +
	" here. This code should not still have unknown or dynamic data at this layer. Fix the upstream parser, schema, API adapter, DTO, config loader, CLI parser, storage decoder, migration importer, or test fixture boundary first, then pass a typed value into this module.";

const sourceKindFor = (filePath, content) => {
	const extension = path.extname(filePath).toLowerCase();
	if ([".ts", ".tsx"].includes(extension)) {
		return "typescript";
	}
	if ([".js", ".jsx", ".mjs", ".cjs"].includes(extension)) {
		return "javascript";
	}
	if (extension === ".py") {
		return "python";
	}
	if ([".sh", ".bash", ".zsh"].includes(extension)) {
		return "shell";
	}
	const firstLine = content.split("\n", 1)[0] ?? "";
	if (/^#!.*\b(?:bash|zsh|sh)\b/.test(firstLine)) {
		return "shell";
	}
	return undefined;
};

const patternsFor = (language) => {
	if (language === "python") {
		return [/^\s*def\s+(?<name>[A-Za-z_][A-Za-z0-9_]*)\s*\(/];
	}
	if (language === "shell") {
		return [
			/^\s*function\s+(?<name>[A-Za-z_][A-Za-z0-9_-]*)\s*(?:\(\))?\s*\{/,
			/^\s*(?<name>[A-Za-z_][A-Za-z0-9_-]*)\s*\(\)\s*\{/,
		];
	}
	return [
		/^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+(?<name>[A-Za-z_$][A-Za-z0-9_$]*)\s*\(/,
		/^\s*(?:export\s+)?(?:const|let|var)\s+(?<name>[A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][A-Za-z0-9_$]*)\s*=>/,
		/^\s*(?:export\s+)?(?:const|let|var)\s+(?<name>[A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:async\s+)?function\b/,
	];
};

const pushViolation = (violations, filePath, line, snippet, name, language) => {
	violations.push({
		pattern: `boundary-no-late-unknown:${name}`,
		file: filePath,
		line,
		language,
		snippet,
		message: diagnosticFor(name),
	});
};

const fileViolations = (filePath) => {
	const content = readFileSync(path.join(repoRoot, filePath), "utf8");
	const language = sourceKindFor(filePath, content);
	if (language === undefined) {
		return [];
	}
	const violations = [];
	const matchers = patternsFor(language);
	content.split("\n").forEach((lineContent, index) => {
		for (const matcher of matchers) {
			const match = matcher.exec(lineContent);
			const name = match?.groups?.name;
			if (name !== undefined && bannedGuardNameSet.has(name)) {
				pushViolation(
					violations,
					filePath,
					index + 1,
					normalizeSnippet(lineContent),
					name,
					language,
				);
			}
		}
	});
	return violations;
};

const findViolations = () => trackedFiles.flatMap(fileViolations);

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
			"Current boundary-no-late-unknown guard baseline. New unbaselined generic shape helpers fail scripts/check-boundary-unknown-guards.mjs.",
		entries: currentViolations,
	};
	writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`, "utf8");
	console.log(
		"[check-boundary-unknown-guards] wrote " +
			currentViolations.length +
			" baseline entries",
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
	console.error(
		"[check-boundary-unknown-guards] Boundary unknown guard policy failed.",
	);
	if (newViolations.length > 0) {
		console.error("\nNew unbaselined entries:");
		for (const violation of newViolations) {
			console.error(
				"- " +
					violation.file +
					":" +
					violation.line +
					" " +
					violation.pattern +
					" (" +
					violation.language +
					"): " +
					violation.snippet,
			);
			console.error(`  Agent prompt: ${violation.message}`);
		}
	}
	if (staleBaselineEntries.length > 0) {
		console.error("\nStale baseline entries:");
		for (const entry of staleBaselineEntries) {
			console.error(`- ${entry.file} ${entry.pattern}: ${entry.snippet}`);
		}
	}
	console.error(
		"\nFix the upstream boundary or run scripts/check-boundary-unknown-guards.mjs --update-baseline after a deliberate policy update.",
	);
	process.exit(1);
}

console.log(
	"[check-boundary-unknown-guards] " +
		currentViolations.length +
		" baselined boundary unknown guards; no new entries",
);

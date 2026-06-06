#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const baselinePath = path.join(
	repoRoot,
	"scripts",
	"type-policy-baseline.json",
);
const updateBaseline = process.argv.includes("--update-baseline");

const policyPatterns = [
	{
		id: "explicit-any-annotation",
		regex: /(?<![\w$]):\s*any\b/g,
	},
	{
		id: "as-any-assertion",
		regex: /\bas\s+any\b/g,
	},
	{
		id: "promise-any",
		regex: /\bPromise\s*<\s*any\s*>/g,
	},
	{
		id: "record-string-any",
		regex: /\bRecord\s*<\s*string\s*,\s*any\s*>/g,
	},
	{
		id: "ts-ignore",
		regex: /@ts-ignore\b/g,
	},
	{
		id: "ts-nocheck",
		regex: /@ts-nocheck\b/g,
	},
	{
		id: "double-assertion",
		regex: /\bas\s+unknown\s+as\b/g,
	},
];

const trackedFiles = execFileSync("git", ["ls-files", "src/**/*.ts"], {
	cwd: repoRoot,
	encoding: "utf8",
})
	.split("\n")
	.filter(Boolean)
	.filter((filePath) => !filePath.endsWith(".test.ts"))
	.filter((filePath) => !filePath.endsWith(".spec.ts"))
	.filter((filePath) => !filePath.includes("/__tests__/"));

const normalizeSnippet = (line) => line.trim().replace(/\s+/g, " ");

const findViolations = () => {
	const violations = [];
	for (const filePath of trackedFiles) {
		const absolutePath = path.join(repoRoot, filePath);
		const content = readFileSync(absolutePath, "utf8");
		const lines = content.split("\n");
		lines.forEach((line, index) => {
			for (const pattern of policyPatterns) {
				pattern.regex.lastIndex = 0;
				if (pattern.regex.test(line)) {
					violations.push({
						pattern: pattern.id,
						file: filePath,
						line: index + 1,
						snippet: normalizeSnippet(line),
					});
				}
			}
		});
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

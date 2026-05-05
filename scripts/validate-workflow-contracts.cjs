#!/usr/bin/env node

const { readFileSync, existsSync } = require("node:fs");
const { resolve } = require("node:path");

const ACTIVE_WORKFLOW_FILES = [
	"WORKFLOW.md",
	"docs/agents/03-local-memory.md",
	"docs/agents/13-linear-production-workflow.md",
	"docs/agents/15-context-integrity-compact.md",
	"docs/agents/16-linear-production-compact.md",
	".agents/skills/coding-harness/references/setup-and-commands.md",
	"docs/specs/workflow-contract-v1.md",
];

const REQUIRED_SECTION_ORDER = [
	"abbreviations",
	"metadata",
	"invariants",
	"states",
	"transition table (canonical)",
	"error handling",
	"idempotency",
	"execution modes",
	"dry-run simulation",
	"observability logs",
	"validation checklist",
];

const REQUIRED_ERRORS = [
	"VALIDATION_ERROR",
	"BLOCKED_DEPENDENCY",
	"POLICY_FAIL",
	"SYSTEM_ERROR",
];

function normalizeHeading(line) {
	return line
		.replace(/^#{1,6}\s+/, "")
		.trim()
		.toLowerCase();
}

/**
 * Extracts and normalizes Markdown headings from the given content.
 * @param {string} content - The Markdown document text to scan.
 * @returns {string[]} Normalized heading texts with Markdown heading markers removed, trimmed, and lowercased.
 */
function collectHeadings(content) {
	return content
		.split(/\r?\n/)
		.filter((line) => /^#{1,6}\s+/.test(line))
		.map(normalizeHeading);
}

/**
 * Finds the index of an expected heading within a list of normalized headings.
 * @param {string[]} headings - Array of normalized heading strings (e.g., lowercased, trimmed).
 * @param {string} expectedHeading - The normalized heading to locate.
 * @returns {number} The zero-based index of `expectedHeading` in `headings`, or `-1` if not found.
 */
function findHeadingIndex(headings, expectedHeading) {
	return headings.indexOf(expectedHeading);
}

/**
 * Checks whether the given markdown text contains the canonical transition table header `S | E | G | A | N`.
 * @param {string} content - The file or document content to search.
 * @returns {boolean} `true` if the canonical header exists in the content, `false` otherwise.
 */
function findCanonicalTransitionHeader(content) {
	return /`S\s*\|\s*E\s*\|\s*G\s*\|\s*A\s*\|\s*N`/.test(content);
}

function extractTransitionTableRows(content) {
	const lines = content.split(/\r?\n/);
	const rows = [];
	let inTable = false;

	for (const line of lines) {
		if (!inTable) {
			if (
				/^\|\s*S\s*\|\s*E\s*\|\s*G\s*\|\s*A\s*\|\s*N\s*\|\s*$/.test(line.trim())
			) {
				inTable = true;
			}
			continue;
		}

		const trimmed = line.trim();
		if (!trimmed.startsWith("|")) {
			break;
		}

		if (
			/^\|\s*[-: ]+\|\s*[-: ]+\|\s*[-: ]+\|\s*[-: ]+\|\s*[-: ]+\|\s*$/.test(
				trimmed,
			)
		) {
			continue;
		}

		rows.push(trimmed);
	}

	return rows;
}

function validateTransitionRows(rows) {
	const errors = [];
	for (const row of rows) {
		const cells = row
			.split("|")
			.slice(1, -1)
			.map((cell) => cell.trim());

		if (cells.length !== 5) {
			errors.push(`row does not contain exactly 5 cells: ${row}`);
			continue;
		}

		if (cells.some((cell) => cell.length === 0)) {
			errors.push(`row contains empty cell: ${row}`);
		}
	}

	return errors;
}

function hasBlockedOrFailPath(rows) {
	const haystack = rows.join("\n").toLowerCase();
	return /(blocked|fail|error)/.test(haystack);
}

function hasDeterministicDryRunSemantics(content) {
	const lower = content.toLowerCase();
	return (
		lower.includes("dry-run") &&
		lower.includes("no side effects") &&
		lower.includes("deterministic") &&
		lower.includes("trace")
	);
}

function validateFile(path) {
	const absPath = resolve(path);
	const errors = [];

	if (!existsSync(absPath)) {
		return { path, errors: ["file does not exist"] };
	}

	const content = readFileSync(absPath, "utf8");
	const headings = collectHeadings(content);
	let lastIndex = -1;
	for (const section of REQUIRED_SECTION_ORDER) {
		const index = findHeadingIndex(headings, section);
		if (index === -1) {
			errors.push(`missing required section heading: ${section}`);
			continue;
		}
		if (index < lastIndex) {
			errors.push(`section out of order: ${section}`);
		}
		lastIndex = index;
	}

	if (!findCanonicalTransitionHeader(content)) {
		errors.push("missing canonical transition header: `S | E | G | A | N`");
	}

	const rows = extractTransitionTableRows(content);
	if (rows.length === 0) {
		errors.push("missing transition rows under canonical table header");
	} else {
		errors.push(...validateTransitionRows(rows));
		if (!hasBlockedOrFailPath(rows)) {
			errors.push("missing blocked/fail/error path in transition table");
		}
	}

	for (const code of REQUIRED_ERRORS) {
		if (!content.includes(code)) {
			errors.push(`missing required error code: ${code}`);
		}
	}

	if (!content.includes("STRICT") || !content.includes("ADVISORY")) {
		errors.push("missing required modes: STRICT and ADVISORY");
	}

	const requiredLogFields = [
		"workflow_id",
		"transition_code",
		"from_state",
		"to_state",
		"correlation_id",
		"result",
	];

	for (const field of requiredLogFields) {
		if (!content.includes(field)) {
			errors.push(`missing required observability field: ${field}`);
		}
	}

	if (!hasDeterministicDryRunSemantics(content)) {
		errors.push(
			"dry-run simulation must include no side effects + deterministic trace semantics",
		);
	}

	return { path, errors };
}

function main() {
	const results = ACTIVE_WORKFLOW_FILES.map(validateFile);
	const failed = results.filter((result) => result.errors.length > 0);

	if (failed.length === 0) {
		console.info(
			`workflow-contract-v1: pass (${ACTIVE_WORKFLOW_FILES.length} files validated)`,
		);
		process.exit(0);
	}

	console.error("workflow-contract-v1: failed");
	for (const result of failed) {
		console.error(`\n${result.path}`);
		for (const error of result.errors) {
			console.error(`  - ${error}`);
		}
	}
	process.exit(1);
}

main();

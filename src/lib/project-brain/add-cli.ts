import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import {
	EXIT_CODES,
	type BrainAddResult,
	type BrainAddType,
	type BrainCliResult,
} from "./cli-types.js";
import {
	getBrainFlagValue,
	resolveBrainHarnessDir,
	shouldRenderBrainJson,
} from "./cli-args.js";

const VALID_ADD_TYPES = new Set<BrainAddType>([
	"learning",
	"rule",
	"hypothesis",
	"decision",
]);

const VALID_SEVERITIES = new Set(["must", "should", "may"]);

function isSafeDomainSegment(domain: string): boolean {
	return /^[a-z0-9][a-z0-9_-]*$/i.test(domain);
}

function assertNeverBrainAddType(type: never): never {
	throw new Error(`Unsupported Project Brain add type: ${type}`);
}

function isInsideDirectory(rootDir: string, targetPath: string): boolean {
	const relativePath = relative(rootDir, targetPath);
	return (
		relativePath === "" ||
		(!relativePath.startsWith("..") && !isAbsolute(relativePath))
	);
}

/**
 * Adds a knowledge item to the harness repository by creating or appending the appropriate file for the given type.
 *
 * The function writes or appends a formatted entry for `type` into the harness directory structure (e.g., knowledge/<domain>/rules.md,
 * knowledge/<domain>/hypotheses.md, decisions/<date>-<slug>.md, or memory/LEARNINGS.md) and returns metadata about the created/updated file.
 *
 * @param harnessDir - Path to the root harness directory (the function writes under this directory)
 * @param type - One of `"learning" | "rule" | "hypothesis" | "decision"` selecting the target file and formatting
 * @param domain - Domain name used for domain-scoped files (e.g., `knowledge/<domain>/...`); ignored for decisions and global learnings
 * @param content - The textual content to be inserted into the selected file
 * @param options - Optional settings
 * @param options.severity - Severity label used when `type` is `"rule"` (default: `"should"`)
 * @returns An object describing the addition: `type`, `domain`, `path` (relative to the harness dir), the `content` written, and `appended: true`
 */
export function runBrainAdd(
	harnessDir: string,
	type: BrainAddType,
	domain: string,
	content: string,
	options?: { severity?: string },
): BrainAddResult {
	let targetFile: string;
	let formattedContent: string;

	const date = new Date().toISOString().slice(0, 10);
	const domainIsRequired = type === "rule" || type === "hypothesis";
	if (domainIsRequired && !isSafeDomainSegment(domain)) {
		throw new Error(
			'Invalid domain: use a single segment with letters, numbers, "_" or "-".',
		);
	}

	switch (type) {
		case "rule": {
			targetFile = `knowledge/${domain}/rules.md`;
			const severity = options?.severity ?? "should";
			formattedContent = `\n- **R-auto**: ${content}\n  - Severity: ${severity}\n  - Rationale: (to be confirmed)\n  - Last promoted: ${date}\n  - Promoted from: brain add`;
			break;
		}
		case "hypothesis": {
			targetFile = `knowledge/${domain}/hypotheses.md`;
			formattedContent = `\n- **${date}**: ${content}`;
			break;
		}
		case "decision": {
			targetFile = `decisions/${date}-${content
				.slice(0, 40)
				.replace(/[^a-z0-9]/gi, "-")
				.toLowerCase()}.md`;
			formattedContent = `# Decision: ${content}\n\n**Date:** ${date}\n**Status:** proposed\n**Context:** (to be filled)\n\n## Decision\n\n${content}\n\n## Consequences\n\n(to be documented)\n`;
			break;
		}
		case "learning": {
			targetFile = "memory/LEARNINGS.md";
			formattedContent = `\n**${date} [manual]:** ${content}`;
			break;
		}
		default:
			assertNeverBrainAddType(type);
	}

	const resolvedHarnessDir = resolve(harnessDir);
	const fullPath = resolve(resolvedHarnessDir, targetFile);
	if (!isInsideDirectory(resolvedHarnessDir, fullPath)) {
		throw new Error(
			"Refusing to write Project Brain content outside .harness.",
		);
	}
	mkdirSync(dirname(fullPath), { recursive: true });

	if (type === "decision") {
		writeFileSync(fullPath, formattedContent, "utf-8");
	} else {
		appendFileSync(fullPath, formattedContent, "utf-8");
	}

	return {
		type,
		domain,
		path: targetFile,
		content: formattedContent,
		appended: true,
	};
}

/**
 * Handle the `brain add` CLI subcommand: validate flags, perform the add action, and emit output.
 *
 * Processes expected flags from `args` (e.g., `--type`, `--domain`, `--content`, `--severity`, `--dir`, and `--json`),
 * writes human or JSON output to stdout (and error messages to stderr), and invokes the add operation.
 *
 * @param args - The CLI token array passed to the `add` subcommand
 * @returns A `BrainCliResult` containing an `exitCode` and, on success, the `result` produced by `runBrainAdd`.
 *          Returns `EXIT_CODES.INVALID_ARGS` when required flags are missing or invalid, and
 *          `EXIT_CODES.NOT_FOUND` when a `.harness` directory cannot be located.
 */
export function cliBrainAdd(args: string[]): BrainCliResult {
	const typeVal = getBrainFlagValue(args, args.indexOf("--type"));
	const domainVal = getBrainFlagValue(args, args.indexOf("--domain"));
	const contentVal = getBrainFlagValue(args, args.indexOf("--content"));
	const severityVal = getBrainFlagValue(args, args.indexOf("--severity"));

	if (!typeVal || !VALID_ADD_TYPES.has(typeVal as BrainAddType)) {
		process.stderr.write(
			`Error: --type must be one of: ${[...VALID_ADD_TYPES].join(", ")}\n`,
		);
		return { exitCode: EXIT_CODES.INVALID_ARGS };
	}

	const type = typeVal as BrainAddType;

	if ((type === "rule" || type === "hypothesis") && !domainVal) {
		process.stderr.write(
			"Error: --domain is required for rule and hypothesis types\n",
		);
		return { exitCode: EXIT_CODES.INVALID_ARGS };
	}
	if (
		(type === "rule" || type === "hypothesis") &&
		!isSafeDomainSegment(domainVal ?? "")
	) {
		process.stderr.write(
			'Error: --domain must be a single segment using letters, numbers, "_" or "-"\n',
		);
		return { exitCode: EXIT_CODES.INVALID_ARGS };
	}

	if (!contentVal) {
		process.stderr.write("Error: --content is required\n");
		return { exitCode: EXIT_CODES.INVALID_ARGS };
	}

	if (severityVal && !VALID_SEVERITIES.has(severityVal)) {
		process.stderr.write(
			`Error: --severity must be one of: ${[...VALID_SEVERITIES].join(", ")}\n`,
		);
		return { exitCode: EXIT_CODES.INVALID_ARGS };
	}

	const harnessDir = resolveBrainHarnessDir(
		getBrainFlagValue(args, args.indexOf("--dir")),
	);

	if (!existsSync(harnessDir)) {
		process.stderr.write(
			`Error: No .harness directory found at ${harnessDir}\n`,
		);
		return { exitCode: EXIT_CODES.NOT_FOUND };
	}

	const addOptions: { severity?: string } = {};
	if (severityVal) addOptions.severity = severityVal;

	const result = runBrainAdd(
		harnessDir,
		type,
		domainVal ?? "general",
		contentVal,
		addOptions,
	);
	const json = shouldRenderBrainJson(args);

	if (json) {
		process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
	} else {
		process.stdout.write(`\n✅ Added ${result.type} to ${result.path}\n\n`);
	}

	return { exitCode: EXIT_CODES.SUCCESS, result };
}

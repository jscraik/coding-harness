import { existsSync } from "node:fs";
import { EXIT_CODES, type BrainCliResult } from "./cli-types.js";
import {
	getBrainFlagValue,
	resolveBrainHarnessDir,
	shouldRenderBrainJson,
} from "./cli-args.js";
import { runBrainLintChecks } from "./lint-checks.js";
import type { BrainLintResult } from "./lint-types.js";

/** Run the read-only Project Brain lint checks for wiki-trust metadata. */
export function runBrainLint(harnessDir: string): BrainLintResult {
	return runBrainLintChecks(harnessDir);
}

function renderBrainLintHuman(result: BrainLintResult): string {
	const lines: string[] = [];
	lines.push("");
	lines.push("=== Project Brain Lint ===");
	lines.push(`  Status: ${result.status}`);
	lines.push(`  Files scanned: ${result.summary.filesScanned}`);
	lines.push(
		`  Findings: ${result.summary.errors} errors, ${result.summary.warnings} warnings, ${result.summary.info} info`,
	);
	for (const finding of result.findings) {
		const where = finding.line
			? `${finding.path}:${finding.line}`
			: finding.path;
		lines.push(`  [${finding.severity}] ${finding.kind} ${where}`);
		lines.push(`    ${finding.evidence}`);
	}
	lines.push("");
	return lines.join("\n");
}

/** Execute the harness brain lint subcommand. */
export function cliBrainLint(args: string[]): BrainCliResult {
	const harnessDir = resolveBrainHarnessDir(
		getBrainFlagValue(args, args.indexOf("--dir")),
	);
	if (!existsSync(harnessDir)) {
		const result = runBrainLint(harnessDir);
		if (shouldRenderBrainJson(args)) {
			process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
		} else {
			process.stderr.write(
				`Error: No .harness directory found at ${harnessDir}\n`,
			);
		}
		return { exitCode: EXIT_CODES.NOT_FOUND, result };
	}
	const result = runBrainLint(harnessDir);
	if (shouldRenderBrainJson(args)) {
		process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
	} else {
		process.stdout.write(renderBrainLintHuman(result));
	}
	if (result.status === "fail") return { exitCode: EXIT_CODES.ERRORS, result };
	if (result.status === "warn")
		return { exitCode: EXIT_CODES.WARNINGS, result };
	return { exitCode: EXIT_CODES.SUCCESS, result };
}

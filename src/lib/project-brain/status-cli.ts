import { existsSync } from "node:fs";
import { validateProjectBrain } from "./brain-validator.js";
import {
	EXIT_CODES,
	type BrainCliResult,
	type BrainStatusResult,
} from "./cli-types.js";
import {
	getBrainFlagValue,
	resolveBrainHarnessDir,
	shouldRenderBrainJson,
} from "./cli-args.js";

/**
 * Build the Project Brain health summary used by CLI and tests.
 */
export function runBrainStatus(harnessDir: string): BrainStatusResult {
	const validation = validateProjectBrain(harnessDir);
	const placeholderDomains = Object.keys(
		validation.summary.placeholderDomains ?? {},
	).sort();
	const hasErrors = !validation.valid || validation.summary.errors > 0;
	const level = hasErrors
		? "seeded"
		: placeholderDomains.length === 0
			? "mature"
			: "partial";
	const recommendations: string[] = [];
	if (hasErrors)
		recommendations.push(
			"Resolve Project Brain validation errors before assessing maturity.",
		);
	if (placeholderDomains.length > 0)
		recommendations.push(
			`Populate non-placeholder focus/knowledge content for: ${placeholderDomains.join(", ")}`,
		);
	if (recommendations.length > 0)
		recommendations.push("Re-run: harness brain status --json");
	return {
		valid: validation.valid,
		harnessDir,
		validation,
		maturity: {
			level,
			placeholderDomains,
			recommendations,
		},
	};
}

function renderBrainStatusHuman(result: BrainStatusResult): string {
	const { validation } = result;
	const lines: string[] = [];

	lines.push("");
	lines.push("=== Project Brain Status ===");
	lines.push(`  Directory: ${result.harnessDir}`);
	lines.push(`  Valid: ${validation.valid ? "Yes" : "No"}`);
	lines.push(`  Files scanned: ${validation.filesScanned}`);
	lines.push("");

	const s = validation.summary;
	lines.push("  Summary:");
	lines.push(`    Errors:    ${s.errors}`);
	lines.push(`    Warnings:  ${s.warnings}`);
	lines.push(`    Info:      ${s.info}`);
	lines.push(`    Missing:   ${s.missingFiles}`);
	lines.push(`    Placeholders: ${s.placeholderCount}`);
	lines.push(`    Missing metadata: ${s.missingMetadata}`);
	if (result.maturity.placeholderDomains.length > 0) {
		lines.push(
			`    Placeholder domains: ${result.maturity.placeholderDomains.join(", ")}`,
		);
	}
	lines.push(`    Maturity: ${result.maturity.level}`);

	if (validation.findings.length > 0) {
		lines.push("");
		lines.push("  Findings:");
		for (const f of validation.findings) {
			const icon =
				f.severity === "error" ? "❌" : f.severity === "warning" ? "⚠️ " : "ℹ️ ";
			lines.push(`    ${icon} [${f.path}] ${f.field}: ${f.message}`);
		}
	}

	lines.push("");
	return lines.join("\n");
}

/**
 * Execute the harness brain status subcommand.
 */
export function cliBrainStatus(args: string[]): BrainCliResult {
	const harnessDir = resolveBrainHarnessDir(
		getBrainFlagValue(args, args.indexOf("--dir")),
	);

	if (!existsSync(harnessDir)) {
		const json = shouldRenderBrainJson(args);
		if (json) {
			const payload = {
				error: "No .harness directory found",
				path: harnessDir,
			};
			process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
		} else {
			process.stderr.write(
				`Error: No .harness directory found at ${harnessDir}\n`,
			);
		}
		return { exitCode: EXIT_CODES.NOT_FOUND };
	}

	const result = runBrainStatus(harnessDir);
	const json = shouldRenderBrainJson(args);

	if (json) {
		process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
	} else {
		process.stdout.write(renderBrainStatusHuman(result));
	}

	if (result.validation.summary.errors > 0)
		return { exitCode: EXIT_CODES.ERRORS, result };
	if (result.validation.summary.warnings > 0)
		return { exitCode: EXIT_CODES.WARNINGS, result };
	return { exitCode: EXIT_CODES.SUCCESS, result };
}

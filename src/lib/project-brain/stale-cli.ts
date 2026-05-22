import { existsSync } from "node:fs";
import { scanBrainMetadata } from "./metadata-scanner.js";
import {
	EXIT_CODES,
	type BrainCliResult,
	type BrainStaleResult,
} from "./cli-types.js";
import {
	getBrainFlagValue,
	resolveBrainHarnessDir,
	shouldRenderBrainJson,
} from "./cli-args.js";

/** Public API export. */
export function runBrainStale(
	harnessDir: string,
	options?: { thresholdDays?: number },
): BrainStaleResult {
	const scanOptions: { thresholdDays?: number; now?: Date } = {};
	if (options?.thresholdDays !== undefined)
		scanOptions.thresholdDays = options.thresholdDays;
	const report = scanBrainMetadata(harnessDir, scanOptions);
	return { report };
}

function renderBrainStaleHuman(result: BrainStaleResult): string {
	const { report } = result;
	const lines: string[] = [];

	lines.push("");
	lines.push("=== Brain Staleness Report ===");
	lines.push(
		`  Domains: ${report.totalDomains} | Files: ${report.totalFiles} | Threshold: ${report.thresholdDays} days`,
	);
	lines.push(
		`  Average staleness: ${report.averageStaleness} | Needs review: ${report.staleFiles.length}`,
	);
	lines.push("");

	if (report.staleFiles.length > 0) {
		lines.push("  Stale / needs review:");
		for (const f of report.staleFiles) {
			const stalenessPercent = `${Math.round(f.stalenessScore * 100)}%`;
			const verified = f.lastVerified ?? "never";
			lines.push(
				`    [${f.domain}] ${stalenessPercent} stale - last verified: ${verified}`,
			);
			lines.push(`      ${f.stalenessReason}`);
		}
		lines.push("");
	}

	if (report.freshFiles.length > 0) {
		lines.push("  Fresh:");
		for (const f of report.freshFiles) {
			const stalenessPercent = `${Math.round(f.stalenessScore * 100)}%`;
			lines.push(
				`    [${f.domain}] ${stalenessPercent} stale - ${f.stalenessReason}`,
			);
		}
		lines.push("");
	}

	return lines.join("\n");
}

/** Run the Project Brain stale subcommand and render CLI output. */
export function cliBrainStale(args: string[]): BrainCliResult {
	const harnessDir = resolveBrainHarnessDir(
		getBrainFlagValue(args, args.indexOf("--dir")),
	);
	const thresholdVal = getBrainFlagValue(
		args,
		args.indexOf("--threshold-days"),
	);
	const thresholdDays =
		thresholdVal === undefined ? undefined : Number.parseInt(thresholdVal, 10);
	if (
		thresholdDays !== undefined &&
		(!Number.isInteger(thresholdDays) || thresholdDays < 0)
	) {
		process.stderr.write(
			"Error: --threshold-days must be a non-negative integer\n",
		);
		return { exitCode: EXIT_CODES.INVALID_ARGS };
	}

	if (!existsSync(harnessDir)) {
		process.stderr.write(
			`Error: No .harness directory found at ${harnessDir}\n`,
		);
		return { exitCode: EXIT_CODES.NOT_FOUND };
	}

	const staleOptions: { thresholdDays?: number } = {};
	if (thresholdDays !== undefined) staleOptions.thresholdDays = thresholdDays;
	const result = runBrainStale(harnessDir, staleOptions);
	const json = shouldRenderBrainJson(args);

	if (json) {
		process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
	} else {
		process.stdout.write(renderBrainStaleHuman(result));
	}

	if (result.report.staleFiles.length > 0)
		return { exitCode: EXIT_CODES.WARNINGS, result };
	return { exitCode: EXIT_CODES.SUCCESS, result };
}

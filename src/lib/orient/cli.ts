import { existsSync, statSync } from "node:fs";
import { inspectFlagValue } from "../cli/parse-utils.js";
import { collectHarnessOrient } from "./collector.js";
import type {
	HarnessOrientNextDecisionProvider,
	HarnessOrientReport,
	HarnessOrientUsageError,
} from "./types.js";

const EXIT_CODES = {
	SUCCESS: 0,
	FAILURE: 1,
	USAGE: 2,
} as const;

const VALUE_FLAGS = new Set(["--repo-root"]);
const VALID_FLAGS = new Set(["--json", ...VALUE_FLAGS]);

/** Run the read-only orient command from CLI arguments. */
export function runOrientCLI(
	args: string[],
	nextDecisionProvider: HarnessOrientNextDecisionProvider,
): number {
	const json = args.includes("--json");
	const unknownFlag = args.find(
		(arg) => arg.startsWith("-") && !VALID_FLAGS.has(arg),
	);
	if (unknownFlag) {
		return emitUsage(
			json,
			"orient.unknown_flag",
			`harness orient does not support ${unknownFlag}.`,
		);
	}

	const repoRootFlag = inspectFlagValue(args, "--repo-root");
	if (repoRootFlag.missingValue) {
		return emitUsage(
			json,
			"orient.flag_value_required",
			"harness orient requires a value after --repo-root.",
		);
	}

	const positionals = collectPositionals(args);
	if (
		positionals.length > 1 ||
		(repoRootFlag.value && positionals.length > 0)
	) {
		return emitUsage(
			json,
			"orient.unexpected_positional",
			"harness orient accepts at most one repository path; use either --repo-root PATH or a single positional PATH.",
		);
	}

	const targetDir = positionals[0];
	const repoRoot = repoRootFlag.value ?? targetDir ?? process.cwd();
	if (!isDirectory(repoRoot)) {
		return emitUsage(
			json,
			"orient.invalid_repo_root",
			"harness orient requires --repo-root to point at an existing directory.",
		);
	}

	const report = collectHarnessOrient({ repoRoot, nextDecisionProvider });
	if (json) {
		console.info(JSON.stringify(report, null, 2));
	} else {
		emitHumanReport(report);
	}
	return report.status === "fail" ? EXIT_CODES.FAILURE : EXIT_CODES.SUCCESS;
}

/** Return positional arguments while skipping values consumed by value flags. */
function collectPositionals(args: string[]): string[] {
	const positionals: string[] = [];
	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];
		if (arg === undefined) continue;
		if (VALUE_FLAGS.has(arg)) {
			index += 1;
			continue;
		}
		if (!arg.startsWith("-")) {
			positionals.push(arg);
		}
	}
	return positionals;
}

/** Print the orient packet as compact human-readable command guidance. */
function emitHumanReport(report: HarnessOrientReport): void {
	console.info(`orient: ${report.status}`);
	console.info(`schema: ${report.schemaVersion} (${report.evidenceUse})`);
	console.info(
		`next: ${report.nextDecision.status} - ${report.nextDecision.nextAction}`,
	);
	if (report.nextDecision.nextCommand) {
		console.info(`next command: ${report.nextDecision.nextCommand}`);
	}
	console.info(`session-context: ${report.sessionContext.status}`);
	console.info(
		"agent-readiness context-health: " +
			report.agentReadinessContextHealth.status,
	);
	console.info(`preflight: ${report.preflightReceipt.status}`);
	console.info(`architecture map: ${report.architectureContext.status}`);
	console.info(`Project Brain: ${report.projectBrain.brainStatus}`);
	console.info("read next:");
	for (const ref of report.orientationRefs.filter(
		(candidate) => candidate.status === "present",
	)) {
		console.info(`  - ${ref.path} - ${ref.reason}`);
	}
	console.info("context commands:");
	for (const command of report.contextCommands) {
		console.info(`  - ${command.command} - ${command.reason}`);
	}
}

/** Emit usage errors in the requested output format and return the usage exit code. */
function emitUsage(
	json: boolean,
	code: HarnessOrientUsageError["error"]["code"],
	message: string,
): number {
	if (json) {
		const payload: HarnessOrientUsageError = {
			schemaVersion: "harness-orient-error/v1",
			status: "error",
			error: { code, message },
		};
		console.info(JSON.stringify(payload, null, 2));
	} else {
		console.error(`Error: ${message}`);
	}
	return EXIT_CODES.USAGE;
}

/** Check directory existence while converting filesystem errors into false. */
function isDirectory(path: string): boolean {
	try {
		return existsSync(path) && statSync(path).isDirectory();
	} catch {
		return false;
	}
}

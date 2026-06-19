import { readFileSync } from "node:fs";

import { buildFleetRemediationPlan } from "./fleet-plan.js";
import type {
	FleetRemediationPlan,
	ParsedFleetPlanArgs,
} from "./fleet-plan-types.js";

type FleetPlanReadResult =
	| { plan: FleetRemediationPlan; error?: undefined }
	| { plan?: undefined; error: string };

function parseArgs(argv: string[]): ParsedFleetPlanArgs {
	let from: string | undefined;
	let json = false;
	let help = false;
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === "--help" || arg === "-h") {
			help = true;
			continue;
		}
		if (arg === "--json") {
			json = true;
			continue;
		}
		if (arg === "--from") {
			const value = argv[index + 1];
			if (!value || value.startsWith("--")) {
				return { json, help, error: "--from requires a matrix artifact path" };
			}
			from = value;
			index += 1;
			continue;
		}
		return { json, help, error: `Unknown argument: ${arg}` };
	}
	return {
		...(from === undefined ? {} : { from }),
		json,
		help,
	};
}

function printUsage(): void {
	console.info("Usage: harness fleet-plan --from <matrix.json> [--json]");
	console.info("");
	console.info(
		"Build an agent-native, read-only remediation plan from a harness upgrade matrix artifact.",
	);
}

function printLiveUpgradeBlockers(plan: FleetRemediationPlan): void {
	if (plan.liveUpgradeBlockedBecause.length === 0) {
		return;
	}
	console.info("");
	console.info("Live upgrade blockers:");
	for (const blocker of plan.liveUpgradeBlockedBecause) {
		console.info(`  - ${blocker}`);
	}
}

function printFirstSafeWave(plan: FleetRemediationPlan): void {
	if (plan.firstSafeWave.length === 0) {
		return;
	}
	console.info("");
	console.info("First safe wave:");
	for (const command of plan.firstSafeWave) {
		console.info(`  - ${command.nextCommand}`);
	}
}

function printRepoRows(plan: FleetRemediationPlan): void {
	console.info("");
	for (const repo of plan.repos) {
		console.info(`${repo.status}: ${repo.repo}`);
		console.info(`  next: ${repo.nextCommand ?? repo.nextAction}`);
		if (repo.blockingReasons.length > 0) {
			console.info(`  reasons: ${repo.blockingReasons.join(", ")}`);
		}
	}
}

function printHuman(plan: FleetRemediationPlan): void {
	console.info(`Fleet remediation plan: ${plan.generatedFrom}`);
	console.info(`Live upgrade ready: ${plan.liveUpgradeReady ? "yes" : "no"}`);
	console.info(
		`Ready=${plan.summary.ready} adoption=${plan.summary.needsAdoption} circleci=${plan.summary.needsCircleCiMigration} coderabbit=${plan.summary.needsCodeRabbitSetup} codestyleInstall=${plan.summary.needsCodestyleInstall} codestyleRefresh=${plan.summary.needsCodestyleRefresh} greptile=${plan.summary.needsGreptileCleanup} blocked=${plan.summary.blocked}`,
	);
	printLiveUpgradeBlockers(plan);
	printFirstSafeWave(plan);
	printRepoRows(plan);
}

function readMatrixArtifact(path: string): FleetPlanReadResult {
	try {
		return {
			plan: buildFleetRemediationPlan({
				matrix: JSON.parse(readFileSync(path, "utf8")),
				matrixArtifact: path,
			}),
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return { error: `Failed to read matrix artifact: ${message}` };
	}
}

/**
 * Run the fleet-plan CLI with parsed arguments and print either JSON or human-readable output.
 *
 * @param argv - Command-line arguments passed after the command name.
 * @returns Process exit code for success, usage errors, or unreadable matrix artifacts.
 */
export function runFleetPlanCLI(argv: string[]): number {
	const parsed = parseArgs(argv);
	if (parsed.help) {
		printUsage();
		return 0;
	}
	if (parsed.error) {
		if (parsed.json) {
			console.info(
				JSON.stringify(
					{ status: "fail", error: parsed.error, exitCode: 2 },
					null,
					2,
				),
			);
		} else {
			console.error(parsed.error);
			printUsage();
		}
		return 2;
	}
	if (!parsed.from) {
		if (parsed.json) {
			console.info(
				JSON.stringify(
					{ status: "fail", error: "--from is required", exitCode: 2 },
					null,
					2,
				),
			);
		} else {
			console.error("--from is required");
			printUsage();
		}
		return 2;
	}

	const readResult = readMatrixArtifact(parsed.from);
	if ("error" in readResult) {
		if (parsed.json) {
			console.info(
				JSON.stringify(
					{ status: "fail", error: readResult.error, exitCode: 1 },
					null,
					2,
				),
			);
		} else {
			console.error(readResult.error);
		}
		return 1;
	}
	const plan = readResult.plan;
	if (parsed.json) {
		console.info(JSON.stringify(plan, null, 2));
	} else {
		printHuman(plan);
	}
	return 0;
}

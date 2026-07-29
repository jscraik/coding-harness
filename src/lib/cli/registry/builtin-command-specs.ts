import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
	type CommandAgentCatalogMode,
	type CommandCapabilityCatalogDocument,
	getAgentCommandCapabilityCatalogDocument,
	getCommandCapabilityCatalogDocument,
	parseAgentCatalogMode,
} from "./command-capabilities.js";
import type { CommandSpec } from "./types.js";

export const BUILTIN_COMMAND_SPECS: CommandSpec[] = [
	{
		name: "prompt-context-drift:write",
		summary: "Write the prompt-context drift report for the current repo",
		example: "prompt-context-drift:write",
		errorLabel: "Prompt Context Drift Write Error",
		execute: (args) =>
			runPackagedPromptContextScript(
				"write-prompt-context-drift-report.cjs",
				args.length > 0 ? args : ["--repo-root", "."],
			),
	},
	{
		name: "prompt-context-drift:validate",
		summary: "Validate a prompt-context drift report for the current repo",
		example: "prompt-context-drift:validate",
		errorLabel: "Prompt Context Drift Validate Error",
		execute: (args) =>
			runPackagedPromptContextScript(
				"validate-prompt-context-drift.cjs",
				args.length > 0
					? args
					: [
							"artifacts/context-integrity/prompt-context-drift-report.json",
							"--repo-root",
							".",
						],
			),
	},
];

/** Synchronous stdout boundary for machine-readable command catalog output. */
export const COMMAND_CATALOG_OUTPUT = {
	/** Writes catalog JSON and waits for a back-pressured stdout stream to drain. */
	write(payload: string): void | Promise<void> {
		if (process.stdout.write(payload)) return;
		return new Promise((resolve, reject) => {
			process.stdout.once("drain", resolve);
			process.stdout.once("error", reject);
		});
	},
};

/** Create the registry command spec that emits the live command catalog. */
export function createCommandsCatalogSpec(
	getSpecs: () => CommandSpec[],
): CommandSpec {
	return {
		name: "commands",
		summary:
			"List machine-readable command capability metadata for humans and agents",
		example: "commands --json",
		errorLabel: "Commands Catalog Error",
		execute: (args) => runCommandsCatalog(args, getSpecs()),
	};
}

/** Builds and writes the command catalog response for the registry CLI flags. */
function runCommandsCatalog(
	args: readonly string[],
	specs: CommandSpec[],
): number | Promise<number> {
	const jsonFlag = args.includes("--json");
	const forAgentFlag = args.includes("--for-agent");
	const fullCatalogFlag = args.includes("--all") || args.includes("--plumbing");
	const agentMode = parseAgentCatalogMode(args);
	if (forAgentFlag && !fullCatalogFlag && agentMode === "invalid") {
		console.error(
			"Error: --mode must be orient, verify, review, or handoff when used with commands --for-agent",
		);
		return 2;
	}
	const catalog = commandCatalogForFlags(
		forAgentFlag,
		fullCatalogFlag,
		agentMode,
		specs,
	);
	if (jsonFlag) {
		// `console.info` can lose a large catalog when stdout is a pipe and the
		// process exits immediately. Write the JSON payload directly so the CLI
		// remains a valid machine-readable contract for subprocess consumers.
		const write = COMMAND_CATALOG_OUTPUT.write(`${JSON.stringify(catalog)}\n`);
		return write instanceof Promise ? write.then(() => 0) : 0;
	}
	printCommandCatalog(catalog, forAgentFlag && !fullCatalogFlag);
	return 0;
}

/**
 * Selects the public, agent-specific, or explicit full catalog for CLI flags.
 * @param forAgentFlag - Whether the caller requested an agent rail.
 * @param fullCatalogFlag - Whether the caller explicitly requested plumbing.
 * @param agentMode - Optional bounded agent lifecycle mode.
 * @param specs - Every registered command specification.
 * @returns The catalog document appropriate for the requested discovery scope.
 */
function commandCatalogForFlags(
	forAgentFlag: boolean,
	fullCatalogFlag: boolean,
	agentMode: CommandAgentCatalogMode | undefined | "invalid",
	specs: CommandSpec[],
): CommandCapabilityCatalogDocument {
	if (forAgentFlag && !fullCatalogFlag) {
		return getAgentCommandCapabilityCatalogDocument(
			specs,
			agentMode !== "invalid" ? agentMode : undefined,
		);
	}
	const catalog = getCommandCapabilityCatalogDocument(specs);
	if (fullCatalogFlag) return catalog;
	const commands = catalog.commands.filter((command) =>
		["default", "agent", "advanced"].includes(command.visibility),
	);
	return {
		...catalog,
		commandCount: commands.length,
		commands,
	};
}

/**
 * Prints a human-readable command catalog and the next narrower discovery path.
 * @param catalog - The already filtered command capability catalog.
 * @param forAgent - Whether the displayed catalog is an agent rail.
 */
function printCommandCatalog(
	catalog: CommandCapabilityCatalogDocument,
	forAgent: boolean,
): void {
	console.info("Command capability catalog:");
	for (const capability of catalog.commands) {
		const category = capability.category.padEnd(22, " ");
		console.info(
			`  ${capability.name.padEnd(24, " ")} ${category} ${capability.mutability}`,
		);
	}
	console.info("");
	console.info(
		forAgent
			? 'Run "harness commands --json --all" for the full capability catalog.'
			: 'Run "harness commands --json --all" for internal plumbing, or "harness commands --json --for-agent" for the public agent rail set.',
	);
}

function runPackagedPromptContextScript(
	scriptName: string,
	args: readonly string[],
): number {
	const scriptPath = fileURLToPath(
		new URL(`../../../../scripts/${scriptName}`, import.meta.url),
	);
	const result = spawnSync(process.execPath, [scriptPath, ...args], {
		stdio: "inherit",
	});
	if (result.error) {
		console.error(
			"Error: packaged prompt-context drift script failed to start.",
		);
		return 1;
	}
	return result.status ?? 1;
}

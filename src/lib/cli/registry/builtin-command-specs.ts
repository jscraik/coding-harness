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

function runCommandsCatalog(
	args: readonly string[],
	specs: CommandSpec[],
): number {
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
		console.info(JSON.stringify(catalog));
		return 0;
	}
	printCommandCatalog(catalog, forAgentFlag && !fullCatalogFlag);
	return 0;
}

function commandCatalogForFlags(
	forAgentFlag: boolean,
	fullCatalogFlag: boolean,
	agentMode: CommandAgentCatalogMode | undefined | "invalid",
	specs: CommandSpec[],
): CommandCapabilityCatalogDocument {
	return forAgentFlag && !fullCatalogFlag
		? getAgentCommandCapabilityCatalogDocument(
				specs,
				agentMode !== "invalid" ? agentMode : undefined,
			)
		: getCommandCapabilityCatalogDocument(specs);
}

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
			: 'Run "harness commands --json --for-agent" for the public agent rail set.',
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

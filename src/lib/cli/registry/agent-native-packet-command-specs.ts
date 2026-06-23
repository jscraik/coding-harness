import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineCommandSpec } from "./define-command-spec.js";
import type { CommandSpec } from "./types.js";

const scriptPath = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"../../../..",
	"scripts/write-agent-native-ratchet-report.cjs",
);

function stripCommandName(args: string[], commandName: string): string[] {
	return args[0] === commandName ? args.slice(1) : args;
}

function runPacketScript(
	commandName: string,
	baseArgs: string[],
	args: string[],
) {
	const forwardedArgs = stripCommandName(args, commandName);
	const result = spawnSync(process.execPath, [...baseArgs, ...forwardedArgs], {
		cwd: process.cwd(),
		stdio: "inherit",
	});
	return result.status ?? 1;
}

function createPacketCommandSpec(options: {
	name: string;
	summary: string;
	example: string;
	errorLabel: string;
	baseArgs: string[];
}): CommandSpec {
	return defineCommandSpec({
		name: options.name,
		summary: options.summary,
		example: options.example,
		errorLabel: options.errorLabel,
		execute: (args) => runPacketScript(options.name, options.baseArgs, args),
	});
}

/** Build command specs for the agent-native packet producers. */
export function createAgentNativePacketCommandSpecs(): CommandSpec[] {
	return [
		createPacketCommandSpec({
			name: "agent-native-ratchets",
			summary: "Emit an agent-native-ratchets/v1 packet for ratchet discovery",
			example: "agent-native-ratchets --json",
			errorLabel: "Agent Native Ratchets Error",
			baseArgs: [scriptPath, "--json", "--validate"],
		}),
		createPacketCommandSpec({
			name: "session-distill",
			summary: "Emit a session-distill/v1 packet for resumed agents",
			example: "session-distill --json",
			errorLabel: "Session Distill Error",
			baseArgs: [scriptPath, "--session-distill", "--json", "--validate"],
		}),
		createPacketCommandSpec({
			name: "agent-rework",
			summary: "Emit an agent-rework/v1 packet from local rework evidence",
			example: "agent-rework --json",
			errorLabel: "Agent Rework Error",
			baseArgs: [scriptPath, "--rework", "--json"],
		}),
		createPacketCommandSpec({
			name: "reviewer-decision",
			summary:
				"Emit a reviewer-decision/v1 packet from review coverage evidence",
			example: "reviewer-decision --json",
			errorLabel: "Reviewer Decision Error",
			baseArgs: [scriptPath, "--reviewer-decision", "--json"],
		}),
		createPacketCommandSpec({
			name: "governance-decision-surface",
			summary: "Emit a governance-decision-surface/v1 packet",
			example: "governance-decision-surface --json",
			errorLabel: "Governance Decision Surface Error",
			baseArgs: [scriptPath, "--governance", "--json", "--validate"],
		}),
	];
}

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

/** Build command specs for the agent-native packet producers. */
export function createAgentNativePacketCommandSpecs(): CommandSpec[] {
	return [
		defineCommandSpec({
			name: "agent-native-ratchets",
			summary: "Emit an agent-native-ratchets/v1 packet for ratchet discovery",
			example: "agent-native-ratchets --json",
			errorLabel: "Agent Native Ratchets Error",
			execute: (args) =>
				runPacketScript(
					"agent-native-ratchets",
					[scriptPath, "--json", "--validate"],
					args,
				),
		}),
		defineCommandSpec({
			name: "session-distill",
			summary: "Emit a session-distill/v1 packet for resumed agents",
			example: "session-distill --json",
			errorLabel: "Session Distill Error",
			execute: (args) =>
				runPacketScript(
					"session-distill",
					[scriptPath, "--session-distill", "--json", "--validate"],
					args,
				),
		}),
		defineCommandSpec({
			name: "agent-rework",
			summary: "Emit an agent-rework/v1 packet from local rework evidence",
			example: "agent-rework --json",
			errorLabel: "Agent Rework Error",
			execute: (args) =>
				runPacketScript(
					"agent-rework",
					[scriptPath, "--rework", "--json", "--validate"],
					args,
				),
		}),
		defineCommandSpec({
			name: "reviewer-decision",
			summary:
				"Emit a reviewer-decision/v1 packet from review coverage evidence",
			example: "reviewer-decision --json",
			errorLabel: "Reviewer Decision Error",
			execute: (args) =>
				runPacketScript(
					"reviewer-decision",
					[scriptPath, "--reviewer-decision", "--json", "--validate"],
					args,
				),
		}),
		defineCommandSpec({
			name: "governance-decision-surface",
			summary: "Emit a governance-decision-surface/v1 packet",
			example: "governance-decision-surface --json",
			errorLabel: "Governance Decision Surface Error",
			execute: (args) =>
				runPacketScript(
					"governance-decision-surface",
					[scriptPath, "--governance", "--json", "--validate"],
					args,
				),
		}),
	];
}

import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalizeLegacyPacket } from "../../synaipse/packet-canonicalization.js";
import type { PacketFamilySchemaVersion } from "../../synaipse/packet-consolidation.js";
import { defineCommandSpec } from "./define-command-spec.js";
import type { CommandSpec } from "./types.js";

const scriptPath = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"../../../..",
	"scripts/write-agent-native-ratchet-report.cjs",
);
const PACKET_PRODUCER_MAX_BUFFER_BYTES = 64 * 1024 * 1024;

/** Remove the compatibility command token before forwarding producer arguments. */
function stripCommandName(args: string[], commandName: string): string[] {
	return args[0] === commandName ? args.slice(1) : args;
}

/**
 * Execute one legacy producer with bounded buffering and canonical diagnostics.
 * Successful producers must emit JSON on stdout; their exact compatibility
 * payload and exit code are preserved when canonicalization is unavailable or
 * invalid, with a structured diagnostic added to stderr. Producer stderr and
 * non-zero exits pass through unchanged, while malformed JSON returns exit 1.
 */
function runPacketScript(
	commandName: string,
	schemaVersion: PacketFamilySchemaVersion,
	baseArgs: string[],
	args: string[],
) {
	const forwardedArgs = stripCommandName(args, commandName);
	const result = spawnSync(process.execPath, [...baseArgs, ...forwardedArgs], {
		cwd: process.cwd(),
		encoding: "utf8",
		maxBuffer: PACKET_PRODUCER_MAX_BUFFER_BYTES,
	});
	if (result.stderr) process.stderr.write(result.stderr);
	if ((result.status ?? 1) !== 0) {
		if (result.stdout) process.stdout.write(result.stdout);
		return result.status ?? 1;
	}
	let packet: unknown;
	try {
		packet = JSON.parse(result.stdout);
	} catch {
		console.error(`${commandName}: producer returned invalid JSON`);
		return 1;
	}
	const canonical = canonicalizeLegacyPacket(schemaVersion, packet, {
		repoRoot: process.cwd(),
		observedAt: new Date().toISOString(),
	});
	if (canonical.status === "invalid") {
		process.stdout.write(result.stdout);
		process.stderr.write(
			`${JSON.stringify({
				diagnostic: "canonical_projection_invalid",
				sourceSchemaVersion: canonical.sourceSchemaVersion,
				targetSchemaVersion: canonical.targetSchemaVersion,
				reasons: canonical.errors,
			})}\n`,
		);
		return result.status ?? 0;
	}
	if (canonical.status === "unavailable") {
		process.stdout.write(result.stdout);
		process.stderr.write(
			`${JSON.stringify({
				diagnostic: "canonical_projection_unavailable",
				sourceSchemaVersion: canonical.sourceSchemaVersion,
				targetSchemaVersion: canonical.targetSchemaVersion,
				reasons: canonical.errors,
			})}\n`,
		);
		return result.status ?? 0;
	}
	process.stdout.write(result.stdout);
	return 0;
}

/** Define one compatibility command with its owning schema route. */
function createPacketCommandSpec(options: {
	name: string;
	schemaVersion: PacketFamilySchemaVersion;
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
		execute: (args) =>
			runPacketScript(
				options.name,
				options.schemaVersion,
				options.baseArgs,
				args,
			),
	});
}

/** Build command specs for the agent-native packet producers. */
export function createAgentNativePacketCommandSpecs(): CommandSpec[] {
	return [
		createPacketCommandSpec({
			name: "agent-native-ratchets",
			schemaVersion: "agent-native-ratchets/v1",
			summary: "Emit an agent-native-ratchets/v1 packet for ratchet discovery",
			example: "agent-native-ratchets --json",
			errorLabel: "Agent Native Ratchets Error",
			baseArgs: [scriptPath, "--json", "--validate"],
		}),
		createPacketCommandSpec({
			name: "session-distill",
			schemaVersion: "session-distill/v1",
			summary: "Emit a session-distill/v1 packet for resumed agents",
			example: "session-distill --json",
			errorLabel: "Session Distill Error",
			baseArgs: [scriptPath, "--session-distill", "--json", "--validate"],
		}),
		createPacketCommandSpec({
			name: "agent-rework",
			schemaVersion: "agent-rework/v1",
			summary: "Emit an agent-rework/v1 packet from local rework evidence",
			example: "agent-rework --json",
			errorLabel: "Agent Rework Error",
			baseArgs: [scriptPath, "--rework", "--json"],
		}),
		createPacketCommandSpec({
			name: "reviewer-decision",
			schemaVersion: "reviewer-decision/v1",
			summary:
				"Emit a reviewer-decision/v1 packet from review coverage evidence",
			example: "reviewer-decision --json",
			errorLabel: "Reviewer Decision Error",
			baseArgs: [scriptPath, "--reviewer-decision", "--json"],
		}),
		createPacketCommandSpec({
			name: "governance-decision-surface",
			schemaVersion: "governance-decision-surface/v1",
			summary: "Emit a governance-decision-surface/v1 packet",
			example: "governance-decision-surface --json",
			errorLabel: "Governance Decision Surface Error",
			baseArgs: [scriptPath, "--governance", "--json", "--validate"],
		}),
	];
}

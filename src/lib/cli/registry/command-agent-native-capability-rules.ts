export const AGENT_NATIVE_PACKET_COMMAND_NAMES = [
	"runtime-card",
	"session-context",
	"agent-native-ratchets",
	"session-distill",
	"agent-rework",
	"reviewer-decision",
	"governance-decision-surface",
] as const;

export const AGENT_NATIVE_ORIENT_COMMAND_NAMES = [
	"runtime-card",
	"session-context",
	"agent-native-ratchets",
	"session-distill",
	"governance-decision-surface",
] as const;

export function mapCommands<Value>(
	names: readonly string[],
	value: Value,
): Record<string, Value> {
	return Object.fromEntries(names.map((name) => [name, value]));
}

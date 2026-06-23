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

/**
 * Builds a static command-name lookup table where every listed command shares
 * the same catalog classification value.
 */
export function mapCommands<const Names extends readonly string[], Value>(
	names: Names,
	value: Value,
): Record<Names[number], Value> {
	return Object.fromEntries(names.map((name) => [name, value])) as Record<
		Names[number],
		Value
	>;
}

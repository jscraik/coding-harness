/** Command that emits the aggregate agent-native ratchet report. */
export const AGENT_NATIVE_RATCHET_COMMAND =
	"harness agent-native-ratchets --json";

/** Command that emits a session distillation packet for resumed agents. */
export const SESSION_DISTILL_COMMAND = "harness session-distill --json";

/**
 * Build metadata that lets harness-next expose agent-native ratchet packets.
 *
 * Returns loosely typed Record<string, unknown> for intentional architectural flexibility.
 * This pattern is consistent across all metadata builders (phaseExitMeta, runtimeCardMeta,
 * agentReadinessContextMeta) to allow metadata evolution without breaking contracts.
 */
export function agentNativeRatchetMeta(): Record<string, unknown> {
	return {
		agentNativeRatchets: {
			schemaVersion: "agent-native-ratchet-discovery/v1",
			commands: [SESSION_DISTILL_COMMAND, AGENT_NATIVE_RATCHET_COMMAND],
			packets: [
				"session-distill/v1",
				"agent-native-ratchets/v1",
				"agent-rework/v1",
				"reviewer-decision/v1",
				"governance-decision-surface/v1",
			],
			claimBoundary:
				"Ratchet packets orient agents and do not prove validation, review, CI, tracker, or merge readiness.",
		},
	};
}

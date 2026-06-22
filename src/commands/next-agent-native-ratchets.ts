/** Command that emits the aggregate agent-native ratchet report. */
export const AGENT_NATIVE_RATCHET_COMMAND = "harness agent-readiness . --json";

/** Command that emits a session distillation packet for resumed agents. */
export const SESSION_DISTILL_COMMAND =
	"harness session-context --json --repo-root .";

/** Build metadata that lets harness-next expose agent-native ratchet packets. */
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

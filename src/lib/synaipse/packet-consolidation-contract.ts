const PACKET_COMMAND_ADAPTER =
	"src/lib/cli/registry/agent-native-packet-command-specs.ts";
const CANONICAL_ADAPTER = "src/lib/synaipse/packet-canonicalization.ts";
const TRANSITION_PROJECTION =
	"src/lib/synaipse/packet-transition-projection.ts";
const COMPATIBILITY_PROJECTION = "src/lib/synaipse/packet-consolidation.ts";
const NEXT_METADATA_ADAPTER = "src/commands/next-agent-native-ratchets.ts";
const RUNTIME_CONSUMERS = [
	PACKET_COMMAND_ADAPTER,
	CANONICAL_ADAPTER,
	TRANSITION_PROJECTION,
	COMPATIBILITY_PROJECTION,
	NEXT_METADATA_ADAPTER,
] as const;

/** Canonical producer, consumer, command, and projection map for legacy packets. */
export const PACKET_FAMILY_REGISTRY = [
	{
		schemaVersion: "agent-native-ratchets/v1",
		producer: "scripts/write-agent-native-ratchet-report.cjs",
		consumers: RUNTIME_CONSUMERS,
		command: "harness agent-native-ratchets --json",
		canonicalContract: "synaipse-state/v1",
	},
	{
		schemaVersion: "session-distill/v1",
		producer: "scripts/write-agent-native-ratchet-report.cjs",
		consumers: RUNTIME_CONSUMERS,
		command: "harness session-distill --json",
		canonicalContract: "synaipse-state/v1",
	},
	{
		schemaVersion: "agent-rework/v1",
		producer: "scripts/write-agent-native-ratchet-report.cjs",
		consumers: RUNTIME_CONSUMERS,
		command: "harness agent-rework --json",
		canonicalContract: "synaipse-improvement-case/v1",
	},
	{
		schemaVersion: "reviewer-decision/v1",
		producer: "scripts/write-agent-native-ratchet-report.cjs",
		consumers: RUNTIME_CONSUMERS,
		command: "harness reviewer-decision --json",
		canonicalContract: "synaipse-transition/v1",
	},
	{
		schemaVersion: "governance-decision-surface/v1",
		producer: "scripts/write-agent-native-ratchet-report.cjs",
		consumers: RUNTIME_CONSUMERS,
		command: "harness governance-decision-surface --json",
		canonicalContract: "synaipse-transition/v1",
	},
] as const;

/** Registry row describing one managed legacy packet family. */
export type PacketFamily = (typeof PACKET_FAMILY_REGISTRY)[number];

/** Schema-version literal for a managed legacy packet family. */
export type PacketFamilySchemaVersion = PacketFamily["schemaVersion"];

/** Exact consumer inventory required before legacy retirement. */
export const MANAGED_CONSUMERS = [
	...new Set(PACKET_FAMILY_REGISTRY.flatMap((family) => family.consumers)),
];

/** Exact canonical projection inventory required before legacy retirement. */
export const MANAGED_PROJECTION_TARGETS = [
	...new Set(PACKET_FAMILY_REGISTRY.map((family) => family.canonicalContract)),
];

/** Claim allow-list for each legacy packet family. */
export const MAY_CLAIMS = {
	"agent-native-ratchets/v1": [
		"repo_orientation",
		"policy_route",
		"repo_handoff_orientation",
		"worktree_changed_files",
		"local_recovery_state",
		"review_lane_decision",
		"governance_routing",
	],
	"session-distill/v1": ["repo_handoff_orientation", "worktree_changed_files"],
	"agent-rework/v1": ["local_recovery_state"],
	"reviewer-decision/v1": ["review_lane_decision"],
	"governance-decision-surface/v1": ["governance_routing"],
} as const satisfies Record<PacketFamilySchemaVersion, readonly string[]>;

/** Claim allow-list for each row in the aggregate ratchet packet. */
export const RATCHET_MAY_CLAIMS = {
	orientation_packet: ["repo_orientation", "policy_route"],
	session_distillation: ["repo_handoff_orientation", "worktree_changed_files"],
	agent_rework_loop: ["local_recovery_state"],
	reviewer_decision_contract: ["review_lane_decision"],
	governance_decision_surface: ["governance_routing"],
} as const;

/** Claims forbidden across all legacy packet families. */
export const DENIED_CLAIMS = [
	"codex_context_current",
	"codex_session_truth",
	"connector_snapshot_current",
	"sidecar_export_current",
	"ci_passed",
	"review_threads_resolved",
	"tracker_closed",
	"merge_ready",
] as const;

/** Session packet denial set, including unsupported validation completion. */
export const SESSION_DENIED_CLAIMS = [
	...DENIED_CLAIMS,
	"validation_passed",
] as const;

/** Return the registry row for a legacy packet family. */
export const packetFamily = (
	schemaVersion: PacketFamilySchemaVersion,
): PacketFamily =>
	PACKET_FAMILY_REGISTRY.find(
		(family) => family.schemaVersion === schemaVersion,
	) as PacketFamily;

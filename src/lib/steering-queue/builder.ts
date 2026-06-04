import { STEERING_QUEUE_SCHEMA_VERSION } from "./constants.js";
import { hashSteeringInstructionText } from "./hash.js";
import type {
	SteeringArtifactIdentity,
	SteeringInstructionSource,
	SteeringQueueEvaluationInput,
	SteeringQueueItem,
	SteeringQueueItemInput,
	SteeringQueuePacket,
	SteeringQueueStaleKind,
	SteeringQueueStalePrecondition,
	SteeringQueueState,
	SteeringQueueSummary,
} from "./types.js";

/** Build a pointer-only SteeringQueue/v1 packet from queue items and current runtime context. */
export function buildSteeringQueuePacket(
	input: SteeringQueueEvaluationInput,
): SteeringQueuePacket {
	const instructionSources = mapInstructionSources(
		input.instructionSources ?? [],
	);
	const artifacts = new Map(
		input.currentArtifacts.map((artifact) => [artifact.artifactRef, artifact]),
	);
	const evaluatedItems = input.items.map((item) =>
		evaluateItem(item, input, artifacts, instructionSources),
	);
	return {
		schemaVersion: STEERING_QUEUE_SCHEMA_VERSION,
		generatedAt: input.generatedAt,
		producer: input.producer,
		runtimeStatus: "not_yet_emitted",
		evidenceUse: input.evidenceUse,
		headSha: input.headSha,
		threadId: input.threadId,
		turnId: input.turnId,
		clientUserMessageId: input.clientUserMessageId,
		evaluatedAt: input.nowIso,
		selectedItemId: selectApplicableItem(evaluatedItems)?.id ?? null,
		items: evaluatedItems,
		summary: summarizeSteeringQueue(evaluatedItems),
		blockedBy:
			input.blockedBy ??
			"blocked:runtime-card-continuation-wiring-not-implemented",
	};
}

/** Return the deterministic winner from applicable steering items. */
export function selectApplicableItem(
	items: readonly SteeringQueueItem[],
): SteeringQueueItem | null {
	return (
		[...items]
			.filter((item) => item.state === "applicable")
			.sort(compareApplicableItems)[0] ?? null
	);
}

/** Count steering items by lifecycle state for packet summaries. */
export function summarizeSteeringQueue(
	items: readonly SteeringQueueItem[],
): SteeringQueueSummary {
	const summary: SteeringQueueSummary = {
		total: items.length,
		pending: 0,
		applicable: 0,
		applied: 0,
		rejected: 0,
		expired: 0,
		superseded: 0,
		stale: 0,
	};
	for (const item of items) summary[item.state] += 1;
	return summary;
}

function mapInstructionSources(
	sources: readonly SteeringInstructionSource[],
): ReadonlyMap<string, string | null> {
	const mapped = new Map<string, string | null>();
	for (const source of sources) {
		if (!mapped.has(source.instructionRef)) {
			mapped.set(source.instructionRef, source.instructionText);
			continue;
		}
		if (mapped.get(source.instructionRef) !== source.instructionText) {
			mapped.set(source.instructionRef, null);
		}
	}
	return mapped;
}

function evaluateItem(
	item: SteeringQueueItemInput,
	input: SteeringQueueEvaluationInput,
	artifacts: ReadonlyMap<string, SteeringArtifactIdentity>,
	instructionSources: ReadonlyMap<string, string | null>,
): SteeringQueueItem {
	const stalePreconditions = [
		...(item.stalePreconditions ?? []),
		...derivePreconditions(item, input, artifacts, instructionSources),
	];
	const state = deriveState(item, stalePreconditions);
	return {
		...item,
		state,
		stateAt: deriveStateAt(item, state, input.nowIso),
		stateReason: deriveStateReason(item, state, stalePreconditions),
		stalePreconditions,
	};
}

function derivePreconditions(
	item: SteeringQueueItemInput,
	input: SteeringQueueEvaluationInput,
	artifacts: ReadonlyMap<string, SteeringArtifactIdentity>,
	instructionSources: ReadonlyMap<string, string | null>,
): SteeringQueueStalePrecondition[] {
	const preconditions: SteeringQueueStalePrecondition[] = [];
	addContextPreconditions(preconditions, item, input);
	addInstructionHashPreconditions(preconditions, item, instructionSources);
	addArtifactPreconditions(preconditions, item, artifacts);
	addTerminalPreconditions(preconditions, item, input.nowIso);
	return preconditions;
}

function addContextPreconditions(
	preconditions: SteeringQueueStalePrecondition[],
	item: SteeringQueueItemInput,
	input: SteeringQueueEvaluationInput,
) {
	if (
		item.expectedThreadId !== null &&
		item.expectedThreadId !== input.threadId
	) {
		preconditions.push(
			precondition("stale_thread", item.expectedThreadId, input.threadId),
		);
	}
	if (item.expectedTurnId !== null && item.expectedTurnId !== input.turnId) {
		preconditions.push(
			precondition("stale_turn", item.expectedTurnId, input.turnId),
		);
	}
	if (
		item.expectedClientUserMessageId !== null &&
		item.expectedClientUserMessageId !== input.clientUserMessageId
	) {
		preconditions.push(
			precondition(
				"stale_client_user_message",
				item.expectedClientUserMessageId,
				input.clientUserMessageId,
			),
		);
	}
	if (item.expectedHeadSha !== input.headSha) {
		preconditions.push(
			precondition("stale_head", item.expectedHeadSha, input.headSha),
		);
	}
}

function addInstructionHashPreconditions(
	preconditions: SteeringQueueStalePrecondition[],
	item: SteeringQueueItemInput,
	instructionSources: ReadonlyMap<string, string | null>,
) {
	const sourceText = instructionSources.get(item.instructionRef);
	if (sourceText === undefined || sourceText === null) {
		preconditions.push(
			precondition(
				"instruction_hash_unverifiable",
				item.instructionHash,
				"missing",
			),
		);
		return;
	}
	const actualHash = hashSteeringInstructionText(sourceText);
	if (actualHash !== item.instructionHash) {
		preconditions.push(
			precondition(
				"instruction_hash_mismatch",
				item.instructionHash,
				actualHash,
			),
		);
	}
}

function addArtifactPreconditions(
	preconditions: SteeringQueueStalePrecondition[],
	item: SteeringQueueItemInput,
	artifacts: ReadonlyMap<string, SteeringArtifactIdentity>,
) {
	for (const requiredArtifact of item.requiredArtifacts) {
		const actualArtifact = artifacts.get(requiredArtifact.artifactRef);
		if (!actualArtifact) {
			preconditions.push(
				precondition(
					"missing_artifact",
					requiredArtifact.artifactRef,
					"missing",
				),
			);
			continue;
		}
		if (!artifactsMatch(requiredArtifact, actualArtifact)) {
			preconditions.push(
				precondition(
					"artifact_identity_mismatch",
					artifactIdentityKey(requiredArtifact),
					artifactIdentityKey(actualArtifact),
				),
			);
		}
	}
}

function addTerminalPreconditions(
	preconditions: SteeringQueueStalePrecondition[],
	item: SteeringQueueItemInput,
	nowIso: string,
) {
	if (item.supersededBy !== null || item.state === "superseded") {
		preconditions.push(
			precondition(
				"superseded_artifact",
				item.id,
				item.supersededBy ?? "state:superseded",
			),
		);
	}
	if (Date.parse(nowIso) >= Date.parse(item.expiresAt)) {
		preconditions.push(precondition("expired_queue", item.expiresAt, nowIso));
	}
	if (item.state === "rejected") {
		preconditions.push(
			precondition("rejected_steering", item.id, item.rejectedAt ?? "rejected"),
		);
	}
	if (item.state === "applied") {
		preconditions.push(
			precondition("already_applied", item.id, item.appliedAt ?? "applied"),
		);
	}
}

function deriveState(
	item: SteeringQueueItemInput,
	preconditions: readonly SteeringQueueStalePrecondition[],
): SteeringQueueState {
	if (item.state === "rejected") return "rejected";
	if (item.state === "applied") return "applied";
	if (item.state === "superseded" || item.supersededBy !== null)
		return "superseded";
	if (
		item.state === "expired" ||
		preconditions.some((entry) => entry.kind === "expired_queue")
	) {
		return "expired";
	}
	if (preconditions.length > 0) return "stale";
	return item.state === "pending" ? "applicable" : item.state;
}

function deriveStateAt(
	item: SteeringQueueItemInput,
	state: SteeringQueueState,
	nowIso: string,
): string {
	if (state === "applied" && item.appliedAt) return item.appliedAt;
	if (state === "rejected" && item.rejectedAt) return item.rejectedAt;
	if (state === "superseded" && item.supersededAt) return item.supersededAt;
	if (state === "expired") return item.expiresAt;
	return item.stateAt ?? nowIso;
}

function deriveStateReason(
	item: SteeringQueueItemInput,
	state: SteeringQueueState,
	preconditions: readonly SteeringQueueStalePrecondition[],
): string | null {
	if (item.stateReason) return item.stateReason;
	if (state === "applicable") return null;
	return preconditions[0]?.kind ?? state;
}

function compareApplicableItems(
	left: SteeringQueueItem,
	right: SteeringQueueItem,
) {
	if (right.supersedes.includes(left.id)) return 1;
	if (left.supersedes.includes(right.id)) return -1;
	if (left.priority !== right.priority) return right.priority - left.priority;
	const createdDelta = Date.parse(right.createdAt) - Date.parse(left.createdAt);
	if (createdDelta !== 0) return createdDelta;
	return left.id.localeCompare(right.id);
}

function artifactsMatch(
	expected: SteeringArtifactIdentity,
	actual: SteeringArtifactIdentity,
): boolean {
	return (
		expected.headSha === actual.headSha &&
		expected.producedAt === actual.producedAt &&
		expected.sha256 === actual.sha256 &&
		expected.receiptId === actual.receiptId
	);
}

function artifactIdentityKey(artifact: SteeringArtifactIdentity): string {
	return [
		artifact.artifactRef,
		artifact.headSha,
		artifact.producedAt,
		artifact.sha256 ?? "sha256:null",
		artifact.receiptId ?? "receipt:null",
	].join("@");
}

function precondition(
	kind: SteeringQueueStaleKind,
	expected: string,
	actual: string | null,
): SteeringQueueStalePrecondition {
	return {
		kind,
		expected,
		actual: actual ?? "null",
		evidenceRef: `steering-queue:${kind}`,
	};
}

import { describe, expect, it } from "vitest";
import {
	buildSteeringQueuePacket,
	hashSteeringInstructionText,
	validateSteeringApplicationReceipt,
	validateSteeringQueuePacket,
	type SteeringApplicationReceipt,
	type SteeringArtifactIdentity,
	type SteeringQueueItemInput,
} from "./steering-queue.js";

const HEAD_SHA = "a07c87353bb2e437abee6ac11aae0bee625c6e96";
const NOW = "2026-05-28T09:46:00Z";
const CREATED_AT = "2026-05-28T09:40:00Z";
const EXPIRES_AT = "2026-05-28T12:40:00Z";
const INSTRUCTION_TEXT =
	"Continue with the next bounded slice after PR triage completes.";
const INSTRUCTION_HASH = hashSteeringInstructionText(INSTRUCTION_TEXT);
const CLIENT_USER_MESSAGE_ID = "client-user-message:pu-047";

const ARTIFACT: SteeringArtifactIdentity = {
	artifactRef: "artifact:pr-triage-report",
	headSha: HEAD_SHA,
	producedAt: "2026-05-28T09:41:00Z",
	sha256:
		"sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
	receiptId: "receipt:pr-triage-report",
};

function item(
	overrides: Partial<SteeringQueueItemInput> = {},
): SteeringQueueItemInput {
	return {
		id: "steering:continue-after-triage",
		scopeRef: "goal:codex-runtime-evidence-verifier-cockpit",
		createdAt: CREATED_AT,
		expiresAt: EXPIRES_AT,
		sourceRef: "artifact:implementation-notes",
		instructionRef: "artifact:steering/continue-after-triage",
		instructionHash: INSTRUCTION_HASH,
		instructionHashAlgorithm: "sha256",
		instructionCanonicalizationVersion: "steering-instruction-text-lf/v1",
		instructionProvenanceKind: "harness_artifact",
		deliveryMode: "same_thread_continuation",
		expectedThreadId: "thread:codex-runtime-evidence-cockpit",
		expectedTurnId: "turn:pu-030",
		expectedClientUserMessageId: CLIENT_USER_MESSAGE_ID,
		expectedHeadSha: HEAD_SHA,
		priority: 10,
		requiredArtifacts: [ARTIFACT],
		supersedes: [],
		supersededBy: null,
		state: "pending",
		stateReason: null,
		appliedClientUserMessageId: null,
		appliedAt: null,
		rejectedAt: null,
		supersededAt: null,
		...overrides,
	};
}

function packetWith(items: readonly SteeringQueueItemInput[]) {
	return buildSteeringQueuePacket({
		generatedAt: "2026-05-28T09:45:00Z",
		producer: "coding-harness:steering-queue",
		evidenceUse: "orientation",
		headSha: HEAD_SHA,
		threadId: "thread:codex-runtime-evidence-cockpit",
		turnId: "turn:pu-030",
		clientUserMessageId: CLIENT_USER_MESSAGE_ID,
		nowIso: NOW,
		items,
		currentArtifacts: [ARTIFACT],
		instructionSources: [
			{
				instructionRef: "artifact:steering/continue-after-triage",
				instructionText: INSTRUCTION_TEXT,
			},
		],
	});
}

function applicationReceipt(
	overrides: Partial<SteeringApplicationReceipt> = {},
): SteeringApplicationReceipt {
	return {
		schemaVersion: "steering-application-receipt/v1",
		receiptId: "steering-application:continue-after-triage",
		generatedAt: "2026-05-28T09:48:00Z",
		producer: "coding-harness:steering-application-receipt",
		runtimeStatus: "not_yet_emitted",
		evidenceUse: "audit_trail",
		headSha: HEAD_SHA,
		queuePacketRef: "steering-queue:packet-2026-05-28T09-45-00Z",
		queueItemId: "steering:continue-after-triage",
		queueItemState: "applicable",
		expectedContext: {
			threadId: "thread:codex-runtime-evidence-cockpit",
			turnId: "turn:pu-030",
			clientUserMessageId: CLIENT_USER_MESSAGE_ID,
			headSha: HEAD_SHA,
		},
		currentContext: {
			threadId: "thread:codex-runtime-evidence-cockpit",
			turnId: "turn:pu-030",
			clientUserMessageId: CLIENT_USER_MESSAGE_ID,
			headSha: HEAD_SHA,
		},
		runtimeCardUpdateRef: {
			ref: "runtime-card:after-steering-continue-after-triage",
			headSha: HEAD_SHA,
			producedAt: "2026-05-28T09:48:00Z",
			receiptId: "runtime-card-receipt:after-steering-continue-after-triage",
		},
		application: {
			decision: "applied",
			decidedAt: "2026-05-28T09:48:00Z",
			reason: "selected-applicable-steering-item-applied",
			appliedClientUserMessageId: CLIENT_USER_MESSAGE_ID,
		},
		stalePreconditions: [],
		blockers: [],
		nextAction: "continue-runtime-card-bound-slice",
		blockedBy: "PU-052-runtime-emission-not-wired",
		...overrides,
	};
}

describe("SteeringQueue/v1", () => {
	it("builds and validates an applicable happy-path packet", () => {
		const packet = packetWith([item()]);

		expect(packet.selectedItemId).toBe("steering:continue-after-triage");
		expect(packet.summary).toMatchObject({ applicable: 1, stale: 0 });
		expect(packet.items[0]?.state).toBe("applicable");
		expect(validateSteeringQueuePacket(packet)).toEqual({
			valid: true,
			errors: [],
		});
	});

	it("classifies stale turn preconditions as stale", () => {
		const packet = packetWith([item({ expectedTurnId: "turn:old" })]);

		expect(packet.items[0]?.state).toBe("stale");
		expect(packet.items[0]?.stalePreconditions).toEqual(
			expect.arrayContaining([expect.objectContaining({ kind: "stale_turn" })]),
		);
		expect(packet.selectedItemId).toBeNull();
	});

	it("classifies stale client user-message preconditions as stale", () => {
		const packet = packetWith([
			item({ expectedClientUserMessageId: "client-user-message:old" }),
		]);

		expect(packet.items[0]?.state).toBe("stale");
		expect(packet.items[0]?.stalePreconditions).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ kind: "stale_client_user_message" }),
			]),
		);
		expect(packet.selectedItemId).toBeNull();
	});

	it("classifies stale head preconditions as stale", () => {
		const packet = packetWith([item({ expectedHeadSha: "b".repeat(40) })]);

		expect(packet.items[0]?.state).toBe("stale");
		expect(packet.items[0]?.stalePreconditions).toEqual(
			expect.arrayContaining([expect.objectContaining({ kind: "stale_head" })]),
		);
	});

	it("classifies instruction hash mismatch and unverifiable sources as stale", () => {
		const mismatch = packetWith([
			item({ instructionHash: `sha256:${"b".repeat(64)}` }),
		]);
		const unverifiable = buildSteeringQueuePacket({
			generatedAt: "2026-05-28T09:45:00Z",
			producer: "coding-harness:steering-queue",
			evidenceUse: "orientation",
			headSha: HEAD_SHA,
			threadId: "thread:codex-runtime-evidence-cockpit",
			turnId: "turn:pu-030",
			clientUserMessageId: CLIENT_USER_MESSAGE_ID,
			nowIso: NOW,
			items: [item()],
			currentArtifacts: [ARTIFACT],
			instructionSources: [],
		});

		expect(mismatch.items[0]?.stalePreconditions).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ kind: "instruction_hash_mismatch" }),
			]),
		);
		expect(unverifiable.items[0]?.stalePreconditions).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ kind: "instruction_hash_unverifiable" }),
			]),
		);
	});

	it("classifies same-path artifact digest replacement as stale", () => {
		const packet = buildSteeringQueuePacket({
			generatedAt: "2026-05-28T09:45:00Z",
			producer: "coding-harness:steering-queue",
			evidenceUse: "orientation",
			headSha: HEAD_SHA,
			threadId: "thread:codex-runtime-evidence-cockpit",
			turnId: "turn:pu-030",
			clientUserMessageId: CLIENT_USER_MESSAGE_ID,
			nowIso: NOW,
			items: [item()],
			currentArtifacts: [
				{
					...ARTIFACT,
					sha256:
						"sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
				},
			],
			instructionSources: [
				{
					instructionRef: "artifact:steering/continue-after-triage",
					instructionText: INSTRUCTION_TEXT,
				},
			],
		});

		expect(packet.items[0]?.state).toBe("stale");
		expect(packet.items[0]?.stalePreconditions).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ kind: "artifact_identity_mismatch" }),
			]),
		);
	});

	it("classifies superseded, expired, rejected, and applied steering explicitly", () => {
		const packet = packetWith([
			item({ id: "steering:superseded", supersededBy: "steering:new" }),
			item({ id: "steering:expired", expiresAt: "2026-05-28T09:45:00Z" }),
			item({
				id: "steering:rejected",
				state: "rejected",
				stateReason: "operator_rejected",
				rejectedAt: "2026-05-28T09:42:00Z",
			}),
			item({
				id: "steering:applied",
				state: "applied",
				appliedClientUserMessageId: CLIENT_USER_MESSAGE_ID,
				appliedAt: "2026-05-28T09:43:00Z",
			}),
		]);

		expect(packet.summary).toMatchObject({
			applied: 1,
			rejected: 1,
			expired: 1,
			superseded: 1,
		});
	});

	it("selects the deterministic applicable winner by priority, recency, then id", () => {
		const packet = packetWith([
			item({ id: "steering:b", priority: 1 }),
			item({
				id: "steering:a",
				priority: 20,
				createdAt: "2026-05-28T09:41:00Z",
			}),
			item({
				id: "steering:c",
				priority: 20,
				createdAt: "2026-05-28T09:41:00Z",
			}),
		]);

		expect(packet.selectedItemId).toBe("steering:a");
		expect(validateSteeringQueuePacket(packet).valid).toBe(true);
	});

	it("rejects cross-scope packets instead of globally suppressing another stream", () => {
		const packet = packetWith([
			item({ id: "steering:a", scopeRef: "goal:a" }),
			item({ id: "steering:b", scopeRef: "goal:b", priority: 20 }),
		]);

		expect(validateSteeringQueuePacket(packet).errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: expect.stringContaining("multiple_scopes"),
				}),
			]),
		);
	});

	it("rejects cyclic supersession graphs before relying on sort order", () => {
		const packet = packetWith([
			item({ id: "steering:a", supersedes: ["steering:b"] }),
			item({ id: "steering:b", supersedes: ["steering:c"] }),
			item({ id: "steering:c", supersedes: ["steering:a"] }),
		]);

		expect(validateSteeringQueuePacket(packet).errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: expect.stringContaining("supersession_cycle"),
				}),
			]),
		);
	});

	it("treats duplicate conflicting instruction source refs as unverifiable", () => {
		const packet = buildSteeringQueuePacket({
			generatedAt: "2026-05-28T09:45:00Z",
			producer: "coding-harness:steering-queue",
			evidenceUse: "orientation",
			headSha: HEAD_SHA,
			threadId: "thread:codex-runtime-evidence-cockpit",
			turnId: "turn:pu-030",
			clientUserMessageId: CLIENT_USER_MESSAGE_ID,
			nowIso: NOW,
			items: [item()],
			currentArtifacts: [ARTIFACT],
			instructionSources: [
				{
					instructionRef: "artifact:steering/continue-after-triage",
					instructionText: INSTRUCTION_TEXT,
				},
				{
					instructionRef: "artifact:steering/continue-after-triage",
					instructionText: "Conflicting steering text",
				},
			],
		});

		expect(packet.items[0]?.state).toBe("stale");
		expect(packet.items[0]?.stalePreconditions).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					kind: "instruction_hash_unverifiable",
				}),
			]),
		);
	});

	it("rejects duplicate item ids", () => {
		const packet = packetWith([item(), item()]);

		expect(validateSteeringQueuePacket(packet).errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ path: "items[1].id" }),
			]),
		);
	});

	it("rejects raw prompt, transcript, and secret-like fields", () => {
		const packet = {
			...packetWith([item()]),
			items: [
				{
					...packetWith([item()]).items[0],
					notes: "hidden user prompt content",
				},
			],
		};

		expect(validateSteeringQueuePacket(packet).errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ path: "items[0].notes" }),
			]),
		);
	});

	it("rejects applied items with stale preconditions", () => {
		const packet = packetWith([
			item({
				state: "applied",
				appliedClientUserMessageId: CLIENT_USER_MESSAGE_ID,
				appliedAt: "2026-05-28T09:43:00Z",
				stalePreconditions: [
					{
						kind: "stale_head",
						expected: HEAD_SHA,
						actual: "b".repeat(40),
						evidenceRef: "steering-queue:stale_head",
					},
				],
			}),
		]);

		expect(validateSteeringQueuePacket(packet).errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					path: "items[0].stalePreconditions",
				}),
			]),
		);
	});

	it("rejects applied items without the applied client user-message id", () => {
		const packet = packetWith([
			item({
				state: "applied",
				appliedAt: "2026-05-28T09:43:00Z",
			}),
		]);

		expect(validateSteeringQueuePacket(packet).errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: expect.stringContaining(
						"missing_applied_client_user_message_id",
					),
					path: "items[0].appliedClientUserMessageId",
				}),
			]),
		);
	});

	it("rejects applied items without applied evidence even when no client user-message id was expected", () => {
		const packet = packetWith([
			item({
				expectedClientUserMessageId: null,
				state: "applied",
				appliedAt: "2026-05-28T09:43:00Z",
			}),
		]);

		expect(validateSteeringQueuePacket(packet).errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: expect.stringContaining(
						"missing_applied_client_user_message_id",
					),
					path: "items[0].appliedClientUserMessageId",
				}),
			]),
		);
	});

	it("rejects applied items with a different client user-message id", () => {
		const packet = packetWith([
			item({
				state: "applied",
				appliedClientUserMessageId: "client-user-message:other",
				appliedAt: "2026-05-28T09:43:00Z",
			}),
		]);

		expect(validateSteeringQueuePacket(packet).errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: expect.stringContaining("client_user_message_mismatch"),
					path: "items[0].appliedClientUserMessageId",
				}),
			]),
		);
	});
});

describe("SteeringApplicationReceipt/v1", () => {
	it("validates an applied receipt bound to current runtime identity and runtime-card update", () => {
		const receipt = applicationReceipt();

		expect(validateSteeringApplicationReceipt(receipt)).toEqual({
			valid: true,
			errors: [],
		});
	});

	it("rejects applied receipts when expected and current message identity mismatch", () => {
		const receipt = applicationReceipt({
			currentContext: {
				threadId: "thread:codex-runtime-evidence-cockpit",
				turnId: "turn:pu-030",
				clientUserMessageId: "client-user-message:other",
				headSha: HEAD_SHA,
			},
		});

		expect(validateSteeringApplicationReceipt(receipt).errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: expect.stringContaining("expected_current_mismatch"),
					path: "currentContext.clientUserMessageId",
				}),
			]),
		);
	});

	it("rejects expired steering recorded as applied", () => {
		const receipt = applicationReceipt({ queueItemState: "expired" });

		expect(validateSteeringApplicationReceipt(receipt).errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: expect.stringContaining("applied_requires_applicable_item"),
					path: "queueItemState",
				}),
			]),
		);
	});

	it("rejects superseded steering recorded as applied", () => {
		const receipt = applicationReceipt({ queueItemState: "superseded" });

		expect(validateSteeringApplicationReceipt(receipt).errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: expect.stringContaining("applied_requires_applicable_item"),
					path: "queueItemState",
				}),
			]),
		);
	});

	it("rejects applied receipts without a runtime-card update reference", () => {
		const receipt = applicationReceipt({ runtimeCardUpdateRef: null });

		expect(validateSteeringApplicationReceipt(receipt).errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: expect.stringContaining("missing_runtime_card_update_ref"),
					path: "runtimeCardUpdateRef",
				}),
			]),
		);
	});

	it("rejects applied receipts whose runtime-card update is on another head", () => {
		const receipt = applicationReceipt({
			runtimeCardUpdateRef: {
				ref: "runtime-card:after-steering-continue-after-triage",
				headSha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
				producedAt: "2026-05-28T09:48:00Z",
				receiptId: "runtime-card-receipt:after-steering-continue-after-triage",
			},
		});

		expect(validateSteeringApplicationReceipt(receipt).errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: expect.stringContaining("runtime_card_receipt_head_mismatch"),
					path: "runtimeCardUpdateRef.headSha",
				}),
			]),
		);
	});

	it("accepts blocked expired and superseded receipts only with matching stale evidence and blockers", () => {
		const expired = applicationReceipt({
			queueItemState: "expired",
			runtimeCardUpdateRef: null,
			application: {
				decision: "blocked",
				decidedAt: "2026-05-28T09:48:00Z",
				reason: "expired-steering-not-applied",
				appliedClientUserMessageId: null,
			},
			stalePreconditions: [
				{
					kind: "expired_queue",
					expected: EXPIRES_AT,
					actual: "2026-05-28T13:00:00Z",
					evidenceRef: "steering-application:expired-queue",
				},
			],
			blockers: [
				{
					class: "expired_steering",
					reason: "expired-steering-not-applied",
					nextAction: "request-fresh-steering",
					evidenceRef: "steering-application:expired-queue",
				},
			],
		});
		const superseded = applicationReceipt({
			queueItemState: "superseded",
			runtimeCardUpdateRef: null,
			application: {
				decision: "blocked",
				decidedAt: "2026-05-28T09:48:00Z",
				reason: "superseded-steering-not-applied",
				appliedClientUserMessageId: null,
			},
			stalePreconditions: [
				{
					kind: "superseded_artifact",
					expected: "steering:continue-after-triage",
					actual: "steering:newer",
					evidenceRef: "steering-application:superseded-artifact",
				},
			],
			blockers: [
				{
					class: "superseded_steering",
					reason: "superseded-steering-not-applied",
					nextAction: "select-current-steering-item",
					evidenceRef: "steering-application:superseded-artifact",
				},
			],
		});

		expect(validateSteeringApplicationReceipt(expired).valid).toBe(true);
		expect(validateSteeringApplicationReceipt(superseded).valid).toBe(true);
	});

	it("rejects raw prompt-like fields in application receipts", () => {
		const receipt = {
			...applicationReceipt(),
			rawPrompt: "do hidden work",
		};

		expect(validateSteeringApplicationReceipt(receipt).errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ path: "packet.rawPrompt" }),
			]),
		);
	});
});

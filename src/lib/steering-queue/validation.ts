import { PACKET_KEYS, STEERING_QUEUE_SCHEMA_VERSION } from "./constants.js";
import { selectApplicableItem } from "./builder.js";
import type {
	SteeringQueueItem,
	SteeringQueueValidationError,
	SteeringQueueValidationResult,
} from "./types.js";
import { validateItem } from "./validation-item.js";
import {
	addError,
	isRecord,
	requireAllowedKeys,
	requireEnum,
	requireHeadSha,
	requireIso,
	requireLiteral,
	requireNullableSafePointer,
	requireSafePointer,
	validateNoRawKeys,
	validateSummary,
} from "./validation-helpers.js";

/** Validate a SteeringQueue/v1 packet and its semantic invariants. */
export function validateSteeringQueuePacket(
	value: unknown,
): SteeringQueueValidationResult {
	const errors: SteeringQueueValidationError[] = [];
	validateNoRawKeys(value, "packet", errors);
	if (!isRecord(value)) {
		addError(errors, "invalid_packet", "packet", "must be an object");
		return { valid: false, errors };
	}
	validatePacketEnvelope(value, errors);
	validateItems(value, errors);
	validateSummary(value, errors);
	requireSafePointer(value.blockedBy, "blockedBy", errors);
	return { valid: errors.length === 0, errors };
}

function validatePacketEnvelope(
	value: Record<string, unknown>,
	errors: SteeringQueueValidationError[],
) {
	requireAllowedKeys(value, PACKET_KEYS, "packet", errors);
	requireLiteral(
		value.schemaVersion,
		STEERING_QUEUE_SCHEMA_VERSION,
		"schemaVersion",
		errors,
	);
	requireIso(value.generatedAt, "generatedAt", errors);
	requireSafePointer(value.producer, "producer", errors);
	requireLiteral(
		value.runtimeStatus,
		"not_yet_emitted",
		"runtimeStatus",
		errors,
	);
	requireEnum(
		value.evidenceUse,
		["orientation", "audit_trail"],
		"evidenceUse",
		errors,
	);
	requireHeadSha(value.headSha, "headSha", errors);
	requireNullableSafePointer(value.threadId, "threadId", errors);
	requireNullableSafePointer(value.turnId, "turnId", errors);
	requireIso(value.evaluatedAt, "evaluatedAt", errors);
	requireNullableSafePointer(value.selectedItemId, "selectedItemId", errors);
}

function validateItems(
	value: Record<string, unknown>,
	errors: SteeringQueueValidationError[],
) {
	if (!Array.isArray(value.items)) {
		addError(errors, "invalid_items", "items", "must be an array");
		return;
	}
	const ids = new Set<string>();
	for (const [index, item] of value.items.entries()) {
		validateItem(item, `items[${index}]`, ids, errors);
	}
	validateSingleScope(value.items, errors);
	validateSupersessionGraph(value.items, errors);
	validateSelectedItem(value, errors);
}

function validateSelectedItem(
	value: Record<string, unknown>,
	errors: SteeringQueueValidationError[],
) {
	const items = value.items as unknown[];
	const applicableItems = items.filter(
		(item): item is SteeringQueueItem =>
			isRecord(item) && item.state === "applicable",
	);
	const selected = selectApplicableItem(applicableItems);
	if ((value.selectedItemId ?? null) !== (selected?.id ?? null)) {
		addError(
			errors,
			"invalid_selected_item",
			"selectedItemId",
			"must match deterministic applicable item selection",
		);
	}
}

function validateSingleScope(
	items: readonly unknown[],
	errors: SteeringQueueValidationError[],
) {
	const scopes = new Set(
		items
			.filter(isRecord)
			.map((item) => item.scopeRef)
			.filter((scope): scope is string => typeof scope === "string"),
	);
	if (scopes.size > 1) {
		addError(
			errors,
			"multiple_scopes",
			"items",
			"must contain a single scopeRef per steering queue packet",
		);
	}
}

function validateSupersessionGraph(
	items: readonly unknown[],
	errors: SteeringQueueValidationError[],
) {
	const graph = new Map<string, string[]>();
	for (const item of items) {
		if (!isRecord(item) || typeof item.id !== "string") continue;
		const supersedes = Array.isArray(item.supersedes)
			? item.supersedes.filter(
					(entry): entry is string => typeof entry === "string",
				)
			: [];
		graph.set(item.id, supersedes);
	}
	for (const id of graph.keys()) {
		if (hasSupersessionCycle(id, graph, new Set(), new Set())) {
			addError(
				errors,
				"supersession_cycle",
				"items",
				"supersedes relationships must be acyclic",
			);
			return;
		}
	}
}

function hasSupersessionCycle(
	id: string,
	graph: ReadonlyMap<string, readonly string[]>,
	visiting: Set<string>,
	visited: Set<string>,
): boolean {
	if (visiting.has(id)) return true;
	if (visited.has(id)) return false;
	visiting.add(id);
	for (const next of graph.get(id) ?? []) {
		if (
			graph.has(next) &&
			hasSupersessionCycle(next, graph, visiting, visited)
		) {
			return true;
		}
	}
	visiting.delete(id);
	visited.add(id);
	return false;
}

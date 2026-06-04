import type { AddFinding } from "./codex-runtime-evidence-validation-helpers.js";
import { isRecord } from "./codex-runtime-evidence-validation-helpers.js";

/** Validate that evidenceRef fields resolve to unique receipts in a runtime evidence packet. */
export function validateRuntimeEvidenceReferences(
	packet: Record<string, unknown>,
	add: AddFinding,
): void {
	const receiptRefs = collectReceiptRefs(packet.receipts, add);
	checkEvidenceRef(
		packet.permissions,
		"permissions.evidenceRef",
		receiptRefs,
		add,
	);
	checkEvidenceRef(
		packet.environment,
		"environment.sandboxPolicyRef",
		receiptRefs,
		add,
		"sandboxPolicyRef",
	);
	checkValidationResultRefs(packet.validationResults, receiptRefs, add);
	checkOptionalStateRef(
		packet.externalState,
		"externalState",
		receiptRefs,
		add,
	);
	checkOptionalStateRef(packet.reviewState, "reviewState", receiptRefs, add);
	checkStaleStateRefs(packet.staleState, receiptRefs, add);
}

function collectReceiptRefs(
	value: unknown,
	add: AddFinding,
): ReadonlySet<string> {
	const refs = new Set<string>();
	const duplicateRefs = new Set<string>();
	if (!Array.isArray(value)) return refs;
	for (const [index, receipt] of value.entries()) {
		if (!isRecord(receipt) || typeof receipt.ref !== "string") continue;
		if (refs.has(receipt.ref) && !duplicateRefs.has(receipt.ref)) {
			duplicateRefs.add(receipt.ref);
			add(
				`receipts[${index}].ref`,
				"duplicate_receipt_ref",
				"receipt refs must be unique so downstream evidence resolution is deterministic.",
			);
		}
		refs.add(receipt.ref);
	}
	return refs;
}

function checkValidationResultRefs(
	value: unknown,
	receiptRefs: ReadonlySet<string>,
	add: AddFinding,
): void {
	if (!Array.isArray(value)) return;
	for (const [index, result] of value.entries()) {
		checkEvidenceRef(
			result,
			`validationResults[${index}].evidenceRef`,
			receiptRefs,
			add,
		);
	}
}

function checkOptionalStateRef(
	value: unknown,
	path: string,
	receiptRefs: ReadonlySet<string>,
	add: AddFinding,
): void {
	if (value === undefined) return;
	checkEvidenceRef(value, `${path}.evidenceRef`, receiptRefs, add);
}

function checkStaleStateRefs(
	value: unknown,
	receiptRefs: ReadonlySet<string>,
	add: AddFinding,
): void {
	if (!Array.isArray(value)) return;
	for (const [index, state] of value.entries()) {
		checkEvidenceRef(
			state,
			`staleState[${index}].evidenceRef`,
			receiptRefs,
			add,
		);
	}
}

function checkEvidenceRef(
	container: unknown,
	path: string,
	receiptRefs: ReadonlySet<string>,
	add: AddFinding,
	fieldName = "evidenceRef",
): void {
	if (!isRecord(container)) return;
	const evidenceRef = container[fieldName];
	if (typeof evidenceRef !== "string") return;
	if (!receiptRefs.has(evidenceRef)) {
		add(
			path,
			"evidence_ref_missing",
			"evidence ref must resolve to an embedded evidence receipt ref.",
		);
	}
}

import {
	EVIDENCE_RECEIPT_SCHEMA_VERSION,
	validateEvidenceReceipt,
} from "../evidence/evidence-receipt.js";
import {
	INTERMEDIARY_CANONICAL_PACKET_SCHEMAS,
	INTERMEDIARY_CLAIM_FAMILIES,
	INTERMEDIARY_EVIDENCE_USES,
	INTERMEDIARY_FRESHNESS,
	INTERMEDIARY_SOURCE_KINDS,
	INTERMEDIARY_STATUSES,
	PACKET_KEYS,
	POLICY_KEYS,
	PROTECTED_CLAIM_FAMILY_CANONICAL_SCHEMAS,
	SOURCE_KEYS,
} from "./constants.js";
import {
	INTERMEDIARY_RECEIPT_COVERAGE_SCHEMA_VERSION,
	type IntermediaryClaimFamily,
	type IntermediaryReceiptCoverageValidationError,
	type IntermediaryReceiptCoverageValidationResult,
	type IntermediarySourceKind,
} from "./types.js";
import { aggregateStatus, validateBlockers } from "./validation-common.js";
import {
	addError,
	isRecord,
	requireAllowedKeys,
	requireBoolean,
	requireEnum,
	requireIso,
	requireLiteral,
	requireNullableHeadSha,
	requireNullablePointer,
	requireNullableSha256,
	requirePointer,
	requireText,
	validateNoRawKeys,
	validateScalarValues,
} from "./validation-helpers.js";
import { validateSummaries } from "./validation-summaries.js";

/** Validate an IntermediaryReceiptCoverage/v1 packet and semantic invariants. */
export function validateIntermediaryReceiptCoverage(
	value: unknown,
): IntermediaryReceiptCoverageValidationResult {
	const errors: IntermediaryReceiptCoverageValidationError[] = [];
	validateNoRawKeys(value, "packet", errors);
	validateScalarValues(value, "packet", errors);
	if (!isRecord(value)) {
		addError(errors, "invalid_packet", "packet", "must be an object");
		return { valid: false, errors };
	}
	validatePacketShape(value, errors);
	const receipts = validateReceipts(value.receipts, errors);
	const policies = validatePolicies(value.claimPolicies, errors);
	const sources = validateSources(value.sources, receipts, policies, errors);
	validateSummaries(
		value.claimFamilySummaries,
		sources,
		policies,
		receipts,
		errors,
	);
	validateBlockers(value.blockers, "blockers", errors);
	validateOverallStatus(value, sources, errors);
	return { valid: errors.length === 0, errors };
}

function validatePacketShape(
	packet: Record<string, unknown>,
	errors: IntermediaryReceiptCoverageValidationError[],
): void {
	requireAllowedKeys(packet, PACKET_KEYS, "packet", errors);
	requireLiteral(
		packet.schemaVersion,
		INTERMEDIARY_RECEIPT_COVERAGE_SCHEMA_VERSION,
		"schemaVersion",
		errors,
	);
	requireIso(packet.generatedAt, "generatedAt", errors);
	requirePointer(packet.producer, "producer", errors);
	requirePointer(packet.repoRootRef, "repoRootRef", errors);
	requireLiteral(
		packet.runtimeStatus,
		"not_yet_emitted",
		"runtimeStatus",
		errors,
	);
	requireNullableHeadSha(packet.currentHeadSha, "currentHeadSha", errors);
	requireLiteral(packet.defaultPolicy, "deny", "defaultPolicy", errors);
	requireEnum(
		packet.overallStatus,
		INTERMEDIARY_STATUSES,
		"overallStatus",
		errors,
	);
	requireText(packet.nextAction, "nextAction", 512, errors);
	if (!Array.isArray(packet.sources) || packet.sources.length === 0) {
		addError(errors, "invalid_sources", "sources", "must be a non-empty array");
	}
	if (!Array.isArray(packet.receipts)) {
		addError(errors, "invalid_receipts", "receipts", "must be an array");
	}
	if (!Array.isArray(packet.claimPolicies)) {
		addError(
			errors,
			"invalid_claim_policies",
			"claimPolicies",
			"must be an array",
		);
	}
	if (
		!Array.isArray(packet.claimFamilySummaries) ||
		packet.claimFamilySummaries.length === 0
	) {
		addError(
			errors,
			"invalid_claim_family_summaries",
			"claimFamilySummaries",
			"must be a non-empty array",
		);
	}
}

function validateReceipts(
	value: unknown,
	errors: IntermediaryReceiptCoverageValidationError[],
): Map<string, Record<string, unknown>> {
	const receipts = new Map<string, Record<string, unknown>>();
	if (!Array.isArray(value)) return receipts;
	value.forEach((receipt, index) => {
		const path = `receipts[${index}]`;
		const result = validateEvidenceReceipt(receipt);
		for (const error of result.errors) {
			addError(
				errors,
				"invalid_receipt",
				`${path}.${error.path}`,
				`${error.code}: evidence receipt validation failed`,
			);
		}
		if (!isRecord(receipt)) return;
		if (receipt.schemaVersion !== EVIDENCE_RECEIPT_SCHEMA_VERSION) {
			addError(
				errors,
				"invalid_receipt",
				`${path}.schemaVersion`,
				"must be evidence-receipt/v1",
			);
		}
		if (typeof receipt.ref === "string" && receipts.has(receipt.ref)) {
			addError(
				errors,
				"duplicate_receipt_ref",
				`${path}.ref`,
				"must be unique",
			);
		}
		if (typeof receipt.ref === "string") receipts.set(receipt.ref, receipt);
	});
	return receipts;
}

function validatePolicies(
	value: unknown,
	errors: IntermediaryReceiptCoverageValidationError[],
): Map<string, Record<string, unknown>> {
	const policies = new Map<string, Record<string, unknown>>();
	if (!Array.isArray(value)) return policies;
	const expectedKeys = new Set<string>();
	for (const sourceKind of INTERMEDIARY_SOURCE_KINDS) {
		for (const claimFamily of INTERMEDIARY_CLAIM_FAMILIES) {
			expectedKeys.add(policyKey(sourceKind, claimFamily));
		}
	}
	value.forEach((policy, index) => {
		const path = `claimPolicies[${index}]`;
		if (!isRecord(policy)) {
			addError(errors, "invalid_policy", path, "must be an object");
			return;
		}
		requireAllowedKeys(policy, POLICY_KEYS, path, errors);
		requireEnum(
			policy.sourceKind,
			INTERMEDIARY_SOURCE_KINDS,
			`${path}.sourceKind`,
			errors,
		);
		requireEnum(
			policy.claimFamily,
			INTERMEDIARY_CLAIM_FAMILIES,
			`${path}.claimFamily`,
			errors,
		);
		requireBoolean(policy.allowed, `${path}.allowed`, errors);
		validateRequiredCanonicalSchemas(
			policy.requiredCanonicalPacketSchemas,
			`${path}.requiredCanonicalPacketSchemas`,
			errors,
		);
		if (
			typeof policy.sourceKind === "string" &&
			typeof policy.claimFamily === "string"
		) {
			const key = policyKey(policy.sourceKind, policy.claimFamily);
			if (policies.has(key)) {
				addError(
					errors,
					"duplicate_policy",
					path,
					"policy matrix entry is duplicated",
				);
			}
			policies.set(key, policy);
		}
	});
	for (const expectedKey of expectedKeys) {
		if (!policies.has(expectedKey)) {
			addError(
				errors,
				"missing_policy_entry",
				"claimPolicies",
				`policy matrix is missing ${expectedKey}`,
			);
		}
	}
	return policies;
}

function validateRequiredCanonicalSchemas(
	value: unknown,
	path: string,
	errors: IntermediaryReceiptCoverageValidationError[],
): void {
	if (!Array.isArray(value)) {
		addError(errors, "invalid_canonical_schemas", path, "must be an array");
		return;
	}
	value.forEach((schema, index) => {
		requireEnum(
			schema,
			INTERMEDIARY_CANONICAL_PACKET_SCHEMAS,
			`${path}[${index}]`,
			errors,
		);
	});
}

function validateSources(
	value: unknown,
	receipts: Map<string, Record<string, unknown>>,
	policies: Map<string, Record<string, unknown>>,
	errors: IntermediaryReceiptCoverageValidationError[],
): Map<string, Record<string, unknown>> {
	const sources = new Map<string, Record<string, unknown>>();
	if (!Array.isArray(value)) return sources;
	const observedKinds = new Set<string>();
	value.forEach((source, index) => {
		const path = `sources[${index}]`;
		if (!isRecord(source)) {
			addError(errors, "invalid_source", path, "must be an object");
			return;
		}
		validateSourceShape(source, path, errors);
		if (typeof source.sourceId === "string") {
			if (sources.has(source.sourceId)) {
				addError(
					errors,
					"duplicate_source_id",
					`${path}.sourceId`,
					"must be unique",
				);
			}
			sources.set(source.sourceId, source);
		}
		if (typeof source.sourceKind === "string")
			observedKinds.add(source.sourceKind);
		validateSourceSemantics(source, path, receipts, policies, errors);
	});
	for (const sourceKind of INTERMEDIARY_SOURCE_KINDS) {
		if (!observedKinds.has(sourceKind)) {
			addError(
				errors,
				"missing_source_kind_fixture",
				"sources",
				`missing intermediary source kind ${sourceKind}`,
			);
		}
	}
	return sources;
}

function validateSourceShape(
	source: Record<string, unknown>,
	path: string,
	errors: IntermediaryReceiptCoverageValidationError[],
): void {
	requireAllowedKeys(source, SOURCE_KEYS, path, errors);
	requirePointer(source.sourceId, `${path}.sourceId`, errors);
	requireEnum(
		source.sourceKind,
		INTERMEDIARY_SOURCE_KINDS,
		`${path}.sourceKind`,
		errors,
	);
	requireEnum(
		source.evidenceUse,
		INTERMEDIARY_EVIDENCE_USES,
		`${path}.evidenceUse`,
		errors,
	);
	requireEnum(source.status, INTERMEDIARY_STATUSES, `${path}.status`, errors);
	requireEnum(
		source.freshness,
		INTERMEDIARY_FRESHNESS,
		`${path}.freshness`,
		errors,
	);
	requireIso(source.observedAt, `${path}.observedAt`, errors);
	requireNullableHeadSha(
		source.observedHeadSha,
		`${path}.observedHeadSha`,
		errors,
	);
	requireNullableHeadSha(
		source.currentHeadSha,
		`${path}.currentHeadSha`,
		errors,
	);
	requirePointer(source.ref, `${path}.ref`, errors);
	requireNullableSha256(
		source.sourceHashSha256,
		`${path}.sourceHashSha256`,
		errors,
	);
	requireNullablePointer(source.receiptRef, `${path}.receiptRef`, errors);
	requireNullablePointer(
		source.canonicalPacketRef,
		`${path}.canonicalPacketRef`,
		errors,
	);
	if (
		!Array.isArray(source.claimFamilies) ||
		source.claimFamilies.length === 0
	) {
		addError(
			errors,
			"invalid_claim_families",
			`${path}.claimFamilies`,
			"must be a non-empty array",
		);
	} else {
		source.claimFamilies.forEach((claimFamily, index) => {
			requireEnum(
				claimFamily,
				INTERMEDIARY_CLAIM_FAMILIES,
				`${path}.claimFamilies[${index}]`,
				errors,
			);
		});
	}
	validateBlockers(source.blockers, `${path}.blockers`, errors);
}

function validateSourceSemantics(
	source: Record<string, unknown>,
	path: string,
	receipts: Map<string, Record<string, unknown>>,
	policies: Map<string, Record<string, unknown>>,
	errors: IntermediaryReceiptCoverageValidationError[],
): void {
	if (
		source.observedHeadSha &&
		source.currentHeadSha &&
		source.observedHeadSha !== source.currentHeadSha &&
		source.evidenceUse === "claim_support"
	) {
		addError(
			errors,
			"head_sha_mismatch",
			`${path}.observedHeadSha`,
			"claim-support source head must match current head",
		);
	}
	if (source.evidenceUse === "claim_support") {
		validateClaimSupportSource(source, path, receipts, policies, errors);
	} else if (source.receiptRef === null && source.sourceHashSha256 === null) {
		validateOrientationOnlySource(source, path, errors);
	}
}

function validateClaimSupportSource(
	source: Record<string, unknown>,
	path: string,
	receipts: Map<string, Record<string, unknown>>,
	policies: Map<string, Record<string, unknown>>,
	errors: IntermediaryReceiptCoverageValidationError[],
): void {
	if (source.status !== "pass") {
		addError(
			errors,
			"source_status_not_pass",
			`${path}.status`,
			"claim support requires source status pass",
		);
	}
	if (source.freshness !== "current") {
		addError(
			errors,
			"freshness_not_current",
			`${path}.freshness`,
			"claim support requires current source freshness",
		);
	}
	if (source.sourceHashSha256 === null) {
		addError(
			errors,
			"missing_source_hash",
			`${path}.sourceHashSha256`,
			"claim support requires a bounded source hash",
		);
	}
	const receipt = receiptForSource(source, receipts);
	if (!receipt) {
		addError(
			errors,
			"missing_receipt",
			`${path}.receiptRef`,
			"claim support requires an evidence receipt",
		);
	} else {
		validateReceiptEligibility(receipt, path, errors);
		if (
			source.currentHeadSha &&
			receipt.headSha &&
			source.currentHeadSha !== receipt.headSha
		) {
			addError(
				errors,
				"head_sha_mismatch",
				`${path}.receiptRef`,
				"receipt head must match source current head",
			);
		}
	}
	if (Array.isArray(source.claimFamilies)) {
		source.claimFamilies.forEach((claimFamily, index) => {
			validatePolicyForSourceClaim(
				source,
				claimFamily,
				policies,
				`${path}.claimFamilies[${index}]`,
				errors,
			);
		});
	}
}

function validateOrientationOnlySource(
	source: Record<string, unknown>,
	path: string,
	errors: IntermediaryReceiptCoverageValidationError[],
): void {
	if (source.evidenceUse === "claim_support") return;
	if (source.status === "pass" && source.freshness !== "current") {
		addError(
			errors,
			"unbound_orientation_only",
			`${path}.freshness`,
			"unbound orientation can only pass when explicitly current",
		);
	}
}

function validateReceiptEligibility(
	receipt: Record<string, unknown>,
	path: string,
	errors: IntermediaryReceiptCoverageValidationError[],
): void {
	if (receipt.status !== "pass") {
		addError(
			errors,
			"receipt_status_not_pass",
			`${path}.receiptRef`,
			"receipt status must be pass for claim support",
		);
	}
	if (receipt.freshness !== "current") {
		addError(
			errors,
			"stale_receipt",
			`${path}.receiptRef`,
			"receipt must be current for claim support",
		);
	}
	if (receipt.evidenceUse !== "claim_support") {
		addError(
			errors,
			"receipt_not_claim_support",
			`${path}.receiptRef`,
			"receipt evidenceUse must be claim_support",
		);
	}
	if (typeof receipt.verifiedAt !== "string") {
		addError(
			errors,
			"missing_receipt_verified_at",
			`${path}.receiptRef`,
			"receipt must include verifiedAt for claim support",
		);
	}
}

function validatePolicyForSourceClaim(
	source: Record<string, unknown>,
	claimFamily: unknown,
	policies: Map<string, Record<string, unknown>>,
	path: string,
	errors: IntermediaryReceiptCoverageValidationError[],
): void {
	if (typeof source.sourceKind !== "string" || typeof claimFamily !== "string")
		return;
	const policy = policies.get(policyKey(source.sourceKind, claimFamily));
	if (!policy) {
		addError(
			errors,
			"missing_policy_entry",
			path,
			"policy matrix entry is missing",
		);
		return;
	}
	if (policy.allowed !== true) {
		addError(
			errors,
			"policy_matrix_denied",
			path,
			"claim-support source is denied by policy matrix",
		);
		return;
	}
	const protectedSchemas =
		PROTECTED_CLAIM_FAMILY_CANONICAL_SCHEMAS[
			claimFamily as keyof typeof PROTECTED_CLAIM_FAMILY_CANONICAL_SCHEMAS
		];
	if (!protectedSchemas) return;
	const requiredSchemas = Array.isArray(policy.requiredCanonicalPacketSchemas)
		? policy.requiredCanonicalPacketSchemas
		: [];
	for (const requiredSchema of protectedSchemas) {
		if (!requiredSchemas.includes(requiredSchema)) {
			addError(
				errors,
				"canonical_packet_required",
				path,
				`${claimFamily} requires policy route through ${requiredSchema}`,
			);
		}
	}
	if (
		typeof source.canonicalPacketRef !== "string" ||
		!protectedSchemas.some((schema) =>
			String(source.canonicalPacketRef).startsWith(`${schema}:`),
		)
	) {
		addError(
			errors,
			"canonical_packet_required",
			path,
			`${claimFamily} requires a canonical packet ref before claim support`,
		);
	}
}

function validateOverallStatus(
	packet: Record<string, unknown>,
	sources: Map<string, Record<string, unknown>>,
	errors: IntermediaryReceiptCoverageValidationError[],
): void {
	if (sources.size === 0) return;
	const topLevelBlocked =
		Array.isArray(packet.blockers) && packet.blockers.length > 0;
	const expectedStatus = topLevelBlocked
		? "blocked"
		: aggregateStatus([...sources.values()]);
	if (packet.overallStatus !== expectedStatus) {
		addError(
			errors,
			"overall_status_mismatch",
			"overallStatus",
			`must use most-restrictive status ${expectedStatus}`,
		);
	}
}

function policyKey(sourceKind: string, claimFamily: string): string {
	return `${sourceKind}::${claimFamily}`;
}

function receiptForSource(
	source: Record<string, unknown>,
	receipts: Map<string, Record<string, unknown>>,
): Record<string, unknown> | undefined {
	if (typeof source.receiptRef !== "string") return undefined;
	return receipts.get(source.receiptRef);
}

/** Builds the complete source-kind to claim-family policy matrix, denying unspecified pairs. */
export function createDenyByDefaultClaimPolicies(
	allowed: Partial<
		Record<
			IntermediarySourceKind,
			Partial<Record<IntermediaryClaimFamily, readonly string[]>>
		>
	> = {},
): Array<{
	sourceKind: IntermediarySourceKind;
	claimFamily: IntermediaryClaimFamily;
	allowed: boolean;
	requiredCanonicalPacketSchemas: string[];
}> {
	return INTERMEDIARY_SOURCE_KINDS.flatMap((sourceKind) =>
		INTERMEDIARY_CLAIM_FAMILIES.map((claimFamily) => {
			const requiredCanonicalPacketSchemas =
				allowed[sourceKind]?.[claimFamily] ?? [];
			return {
				sourceKind,
				claimFamily,
				allowed: requiredCanonicalPacketSchemas.length > 0,
				requiredCanonicalPacketSchemas: [...requiredCanonicalPacketSchemas],
			};
		}),
	);
}

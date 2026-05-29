import {
	INTERMEDIARY_CLAIM_FAMILIES,
	INTERMEDIARY_EVIDENCE_USES,
	INTERMEDIARY_STATUSES,
	PROTECTED_CLAIM_FAMILY_CANONICAL_SCHEMAS,
	SUMMARY_KEYS,
} from "./constants.js";
import type { IntermediaryReceiptCoverageValidationError } from "./types.js";
import { aggregateStatus, validateBlockers } from "./validation-common.js";
import {
	addError,
	isPointer,
	isRecord,
	requireAllowedKeys,
	requireBoolean,
	requireEnum,
} from "./validation-helpers.js";

/** Validates claim-family summaries against declared sources, receipts, and policies. */
export function validateSummaries(
	value: unknown,
	sources: Map<string, Record<string, unknown>>,
	policies: Map<string, Record<string, unknown>>,
	receipts: Map<string, Record<string, unknown>>,
	errors: IntermediaryReceiptCoverageValidationError[],
): void {
	if (!Array.isArray(value)) return;
	const observedFamilies = new Set<string>();
	value.forEach((summary, index) => {
		const path = `claimFamilySummaries[${index}]`;
		if (!isRecord(summary)) {
			addError(errors, "invalid_summary", path, "must be an object");
			return;
		}
		requireAllowedKeys(summary, SUMMARY_KEYS, path, errors);
		requireEnum(
			summary.claimFamily,
			INTERMEDIARY_CLAIM_FAMILIES,
			`${path}.claimFamily`,
			errors,
		);
		requireEnum(
			summary.status,
			INTERMEDIARY_STATUSES,
			`${path}.status`,
			errors,
		);
		requireEnum(
			summary.evidenceUse,
			INTERMEDIARY_EVIDENCE_USES,
			`${path}.evidenceUse`,
			errors,
		);
		requireBoolean(
			summary.claimSupportEligible,
			`${path}.claimSupportEligible`,
			errors,
		);
		validateBlockers(summary.blockers, `${path}.blockers`, errors);
		if (typeof summary.claimFamily === "string") {
			if (observedFamilies.has(summary.claimFamily)) {
				addError(
					errors,
					"duplicate_claim_family_summary",
					`${path}.claimFamily`,
					"claim family summary must be unique",
				);
			}
			observedFamilies.add(summary.claimFamily);
		}
		const summarySources = resolveSummarySources(
			summary.sourceIds,
			sources,
			path,
			errors,
		);
		validateSummarySemantics(
			summary,
			summarySources,
			policies,
			receipts,
			path,
			errors,
		);
	});
	for (const claimFamily of INTERMEDIARY_CLAIM_FAMILIES) {
		if (!observedFamilies.has(claimFamily)) {
			addError(
				errors,
				"missing_claim_family_summary",
				"claimFamilySummaries",
				`missing summary for ${claimFamily}`,
			);
		}
	}
}

function resolveSummarySources(
	value: unknown,
	sources: Map<string, Record<string, unknown>>,
	path: string,
	errors: IntermediaryReceiptCoverageValidationError[],
): Record<string, unknown>[] {
	if (!Array.isArray(value) || value.length === 0) {
		addError(
			errors,
			"invalid_source_ids",
			`${path}.sourceIds`,
			"must be a non-empty array",
		);
		return [];
	}
	const resolved: Record<string, unknown>[] = [];
	value.forEach((sourceId, index) => {
		if (!isPointer(sourceId)) {
			addError(
				errors,
				"invalid_source_id",
				`${path}.sourceIds[${index}]`,
				"must be a known sourceId",
			);
			return;
		}
		const source = sources.get(sourceId);
		if (!source) {
			addError(
				errors,
				"unknown_source_id",
				`${path}.sourceIds[${index}]`,
				"must reference a declared source",
			);
			return;
		}
		resolved.push(source);
	});
	return resolved;
}

function validateSummarySemantics(
	summary: Record<string, unknown>,
	sources: Record<string, unknown>[],
	policies: Map<string, Record<string, unknown>>,
	receipts: Map<string, Record<string, unknown>>,
	path: string,
	errors: IntermediaryReceiptCoverageValidationError[],
): void {
	if (sources.length === 0) return;
	const expectedStatus = aggregateStatus(sources);
	if (summary.status !== expectedStatus) {
		addError(
			errors,
			"mixed_source_conflict",
			`${path}.status`,
			`must use most-restrictive status ${expectedStatus}`,
		);
	}
	if (summary.claimSupportEligible === true) {
		if (summary.evidenceUse !== "claim_support") {
			addError(
				errors,
				"unsupported_claim_support",
				`${path}.evidenceUse`,
				"claimSupportEligible summaries require claim_support evidenceUse",
			);
		}
		for (const source of sources) {
			if (!sourceCanSupportSummaryClaim(source, summary, policies, receipts)) {
				addError(
					errors,
					"unsupported_claim_support",
					`${path}.claimSupportEligible`,
					"all summary sources must independently satisfy claim-support policy and receipts",
				);
				break;
			}
		}
	}
}

function sourceCanSupportSummaryClaim(
	source: Record<string, unknown>,
	summary: Record<string, unknown>,
	policies: Map<string, Record<string, unknown>>,
	receipts: Map<string, Record<string, unknown>>,
): boolean {
	if (
		source.evidenceUse !== "claim_support" ||
		source.status !== "pass" ||
		source.freshness !== "current" ||
		source.sourceHashSha256 === null ||
		!Array.isArray(source.claimFamilies) ||
		!source.claimFamilies.includes(summary.claimFamily)
	) {
		return false;
	}
	const receipt = receiptForSource(source, receipts);
	if (!receipt) return false;
	if (
		receipt.status !== "pass" ||
		receipt.freshness !== "current" ||
		receipt.evidenceUse !== "claim_support" ||
		typeof receipt.verifiedAt !== "string"
	) {
		return false;
	}
	if (
		source.currentHeadSha &&
		receipt.headSha &&
		source.currentHeadSha !== receipt.headSha
	) {
		return false;
	}
	if (
		typeof source.sourceKind !== "string" ||
		typeof summary.claimFamily !== "string"
	) {
		return false;
	}
	const policy = policies.get(
		policyKey(source.sourceKind, summary.claimFamily),
	);
	if (!policy || policy.allowed !== true) return false;
	const protectedSchemas =
		PROTECTED_CLAIM_FAMILY_CANONICAL_SCHEMAS[
			summary.claimFamily as keyof typeof PROTECTED_CLAIM_FAMILY_CANONICAL_SCHEMAS
		];
	if (!protectedSchemas) return true;
	const requiredSchemas = Array.isArray(policy.requiredCanonicalPacketSchemas)
		? policy.requiredCanonicalPacketSchemas
		: [];
	if (!protectedSchemas.every((schema) => requiredSchemas.includes(schema))) {
		return false;
	}
	const canonicalPacketRef = source.canonicalPacketRef;
	return (
		typeof canonicalPacketRef === "string" &&
		protectedSchemas.some((schema) =>
			canonicalPacketRef.startsWith(`${schema}:`),
		)
	);
}

function receiptForSource(
	source: Record<string, unknown>,
	receipts: Map<string, Record<string, unknown>>,
): Record<string, unknown> | undefined {
	if (typeof source.receiptRef !== "string") return undefined;
	return receipts.get(source.receiptRef);
}

function policyKey(sourceKind: string, claimFamily: string): string {
	return `${sourceKind}::${claimFamily}`;
}

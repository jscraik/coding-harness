import {
	EVIDENCE_RECEIPT_SCHEMA_VERSION,
	validateEvidenceReceipt,
} from "../evidence/evidence-receipt.js";
import {
	ROOT_HYGIENE_RECEIPT_PRODUCER,
	ROOT_HYGIENE_RECEIPT_REF,
	ROOT_HYGIENE_RECEIPT_REF_POLICY_PREFIX,
} from "./types.js";
import { ROOT_SURFACE_POLICY_DIGEST } from "./policy.js";
import type { EvidenceReceipt } from "../evidence/evidence-receipt.js";
import type { RootHygieneStatus } from "./types.js";

/** Build and validate the receipt used by root-surface claim support. */
export function buildRootHygieneReceipt(input: {
	checksum: string;
	generatedAt: string;
	headSha?: string | null;
	status: RootHygieneStatus;
}): EvidenceReceipt {
	const receipt: EvidenceReceipt = {
		schemaVersion: EVIDENCE_RECEIPT_SCHEMA_VERSION,
		kind: "artifact",
		ref: rootHygieneReceiptRef(),
		producer: ROOT_HYGIENE_RECEIPT_PRODUCER,
		status: input.status,
		freshness: "current",
		evidenceUse: "claim_support",
		blockerClass: input.status === "pass" ? null : "root_surface_drift",
		checksum: input.checksum,
		producedAt: input.generatedAt,
		verifiedAt: input.generatedAt,
		headSha: input.headSha ?? null,
	};
	const validation = validateEvidenceReceipt(receipt);
	if (!validation.valid) {
		throw new Error(
			"invalid root-hygiene evidence receipt: " +
				validation.errors.map((error) => error.code).join(", "),
		);
	}
	return receipt;
}

/** Return the current policy-bound root-hygiene receipt reference. */
export function rootHygieneReceiptRef(): string {
	return `${ROOT_HYGIENE_RECEIPT_REF_POLICY_PREFIX}${ROOT_SURFACE_POLICY_DIGEST}`;
}

/** Return true when a receipt ref is bound to the current root policy digest. */
export function isCurrentRootHygieneReceiptRef(ref: string): boolean {
	return ref === rootHygieneReceiptRef();
}

export { ROOT_HYGIENE_RECEIPT_REF };

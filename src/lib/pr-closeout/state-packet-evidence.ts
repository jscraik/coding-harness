import { createHash } from "node:crypto";
import type { EvidenceReceipt } from "../evidence/evidence-receipt.js";
import type { ExternalStateSourceSnapshot } from "../external-state/index.js";

/** Build an evidence receipt for private PR-closeout state-packet projections. */
export function buildStatePacketReceipt(options: {
	kind: EvidenceReceipt["kind"];
	ref: string;
	producer: string;
	verifiedAt: string;
	headSha: string | null;
	checksum: string;
	sizeBytes: number;
	status?: EvidenceReceipt["status"];
	freshness?: EvidenceReceipt["freshness"];
	evidenceUse?: EvidenceReceipt["evidenceUse"];
}): EvidenceReceipt {
	return {
		schemaVersion: "evidence-receipt/v1",
		kind: options.kind,
		ref: options.ref,
		producer: options.producer,
		status: options.status ?? "pass",
		freshness: options.freshness ?? "current",
		evidenceUse: options.evidenceUse ?? "claim_support",
		blockerClass: null,
		verifiedAt: options.verifiedAt,
		headSha: options.headSha,
		sizeBytes: options.sizeBytes,
		checksum: options.checksum,
	};
}

/** Project an optional verifier TTL into delivery-truth evidence options. */
export function statePacketVerifierTtlOption(
	verifierTtlSeconds: number | undefined,
): { verifierTtlSeconds: number } | Record<string, never> {
	return verifierTtlSeconds === undefined ? {} : { verifierTtlSeconds };
}

/** Return true only when an external-state source can support a closeout claim. */
export function isClaimSupportExternalStateSource(
	source: ExternalStateSourceSnapshot,
): boolean {
	return (
		source.status === "available" &&
		source.evidenceUse === "claim_support" &&
		source.freshness === "current" &&
		source.resultStatus === "pass"
	);
}

/** Hash a state-packet evidence payload with stable key ordering. */
export function statePacketChecksum(value: unknown): string {
	return createHash("sha256")
		.update(stableStatePacketStringify(value))
		.digest("hex");
}

/** Measure a state-packet evidence payload after stable serialization. */
export function statePacketByteLength(value: unknown): number {
	return Buffer.byteLength(stableStatePacketStringify(value), "utf8");
}

function stableStatePacketStringify(value: unknown): string {
	if (Array.isArray(value)) {
		return `[${value.map((item) => stableStatePacketStringify(item)).join(",")}]`;
	}
	if (value && typeof value === "object") {
		const record = value as Record<string, unknown>;
		return `{${Object.keys(record)
			.sort()
			.map(
				(key) =>
					`${JSON.stringify(key)}:${stableStatePacketStringify(record[key])}`,
			)
			.join(",")}}`;
	}
	return JSON.stringify(value);
}

import { createHash } from "node:crypto";
import type { RootHygienePolicy } from "./types.js";

/** Create a stable digest for the current root-surface policy contract. */
export function rootHygienePolicyDigest(policy: RootHygienePolicy): string {
	const normalizedPolicy = {
		sourceRef: policy.sourceRef,
		entries: [...policy.entries]
			.map((entry) => ({
				classification: entry.classification,
				kind: entry.kind,
				path: entry.path.replace(/\/$/u, ""),
				reason: entry.reason,
			}))
			.sort((left, right) =>
				left.kind === right.kind
					? left.path.localeCompare(right.path)
					: left.kind.localeCompare(right.kind),
			),
	};
	return createHash("sha256")
		.update(JSON.stringify(normalizedPolicy))
		.digest("hex");
}

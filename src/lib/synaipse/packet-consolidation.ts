import {
	DENIED_CLAIMS,
	MAY_CLAIMS,
	PACKET_FAMILY_REGISTRY,
	RATCHET_MAY_CLAIMS,
	SESSION_DENIED_CLAIMS,
	packetFamily,
	type PacketFamily,
	type PacketFamilySchemaVersion,
} from "./packet-consolidation-contract.js";

export { PACKET_FAMILY_REGISTRY };
export type { PacketFamily, PacketFamilySchemaVersion };
export {
	RETIREMENT_EVIDENCE_KINDS,
	canRetireLegacyPacket,
} from "./packet-retirement.js";
export type {
	RetirementEvidenceKind,
	RetirementEvidenceRef,
} from "./packet-retirement.js";

/** Validate one producer packet before canonical projection. */
export function validatePacketSource(
	schemaVersion: PacketFamilySchemaVersion,
	packet: unknown,
) {
	const errors: string[] = [];
	if (!isPacketRecord(packet)) {
		return { valid: false, errors: ["packet must be an object"] };
	}
	if (packet.schemaVersion !== schemaVersion)
		errors.push(`schemaVersion must be ${schemaVersion}`);
	if (Object.hasOwn(packet, "rawPayload"))
		errors.push("rawPayload must not cross the consolidation boundary");
	adaptPacketSource(schemaVersion, packet, errors);
	return { valid: errors.length === 0, errors };
}

/** Project a validated producer packet into its canonical contract lane. */
export function projectLegacyPacket(
	schemaVersion: PacketFamilySchemaVersion,
	packet: unknown,
	observedAt: string,
) {
	const family = packetFamily(schemaVersion);
	const validation = validatePacketSource(schemaVersion, packet);
	if (!validation.valid || !isPacketRecord(packet))
		return invalidPacket(family, schemaVersion, observedAt, validation.errors);
	const adapted = adaptPacketSource(schemaVersion, packet, []);
	return {
		valid: true,
		errors: [],
		fragmentKind: "internal_compatibility_fragment",
		targetSchemaVersion: family.canonicalContract,
		source: {
			schemaVersion,
			observedAt,
			warnings: [],
		},
		repository: adapted.repository,
		claims: adapted.claims,
		evidenceRefs: adapted.evidenceRefs,
	};
}

/** Adapt an emitted packet family into shared claims and evidence fields. */
function adaptPacketSource(
	schemaVersion: PacketFamilySchemaVersion,
	packet: Record<string, unknown>,
	errors: string[],
) {
	if (schemaVersion === "agent-native-ratchets/v1")
		return adaptRatchets(packet, errors);
	const allowedMustNot =
		schemaVersion === "session-distill/v1"
			? SESSION_DENIED_CLAIMS
			: DENIED_CLAIMS;
	validateClaims(
		"mayClaim",
		packet.mayClaim,
		MAY_CLAIMS[schemaVersion],
		errors,
	);
	validateClaims("mustNotClaim", packet.mustNotClaim, allowedMustNot, errors);
	let branch: string | null = null;
	let headSha: string | null = null;
	let evidenceRefs: string[] = [];
	switch (schemaVersion) {
		case "session-distill/v1":
			validateRequiredString("branch", packet.branch, errors);
			validateHeadSha(packet.headSha, errors);
			branch = stringOrNull(packet.branch);
			headSha = stringOrNull(packet.headSha);
			evidenceRefs = recordList(
				packet.evidenceLanes,
				"evidenceLanes",
				errors,
			).flatMap((lane, index) =>
				readEvidenceRefs(
					lane.evidenceRefs,
					`evidenceLanes[${index}].evidenceRefs`,
					errors,
				),
			);
			break;
		case "agent-rework/v1":
			validateRequiredString("attemptSource", packet.attemptSource, errors);
			evidenceRefs = claimList([packet.attemptSource]);
			break;
		case "reviewer-decision/v1":
			validateRequiredString("command", packet.command, errors);
			evidenceRefs = reviewerEvidenceRefs(packet, errors);
			break;
		case "governance-decision-surface/v1":
			evidenceRefs = readEvidenceRefs(
				packet.evidencePaths,
				"evidencePaths",
				errors,
			);
	}
	return adaptClaims(
		claimList(packet.mayClaim),
		claimList(packet.mustNotClaim),
		evidenceRefs,
		branch,
		headSha,
	);
}

/** Adapt and validate every row emitted by the ratchet producer mode. */
function adaptRatchets(packet: Record<string, unknown>, errors: string[]) {
	const rows = recordList(packet.ratchets, "ratchets", errors);
	const seenIds = new Set<string>();
	for (const [index, row] of rows.entries()) {
		const id = stringOrNull(row.id);
		const allowedClaims = ratchetMayClaims(id);
		if (!id || !allowedClaims) {
			errors.push(`ratchets[${index}].id must be a known ratchet id`);
			continue;
		}
		if (seenIds.has(id))
			errors.push(`ratchets[${index}].id must not duplicate ${id}`);
		seenIds.add(id);
		validateClaims(
			`ratchets[${index}].mayClaim`,
			row.mayClaim,
			allowedClaims,
			errors,
		);
		validateClaims(
			`ratchets[${index}].mustNotClaim`,
			row.mustNotClaim,
			SESSION_DENIED_CLAIMS,
			errors,
		);
	}
	for (const id of Object.keys(RATCHET_MAY_CLAIMS)) {
		if (!seenIds.has(id)) errors.push(`ratchets must include ${id}`);
	}
	return adaptClaims(
		rows.flatMap((row) => claimList(row.mayClaim)),
		rows.flatMap((row) => claimList(row.mustNotClaim)),
		rows.flatMap((row, index) =>
			readEvidenceRefs(
				row.evidencePaths,
				`ratchets[${index}].evidencePaths`,
				errors,
			),
		),
	);
}

/** Resolve the row-specific claim authority for a known ratchet id. */
function ratchetMayClaims(id: string | null): readonly string[] | null {
	if (!id || !Object.hasOwn(RATCHET_MAY_CLAIMS, id)) return null;
	return RATCHET_MAY_CLAIMS[id as keyof typeof RATCHET_MAY_CLAIMS];
}

/** Deduplicate an adapted packet projection without changing claim order. */
function adaptClaims(
	mayClaim: string[],
	mustNotClaim: string[],
	evidenceRefs: string[],
	branch: string | null = null,
	headSha: string | null = null,
) {
	return {
		repository: { name: null, branch, headSha },
		claims: {
			mayClaim: [...new Set(mayClaim)],
			mustNotClaim: [...new Set(mustNotClaim)],
		},
		evidenceRefs: [...new Set(evidenceRefs)],
	};
}

/** Return the fail-closed projection used for an invalid producer packet. */
function invalidPacket(
	family: PacketFamily,
	schemaVersion: PacketFamilySchemaVersion,
	observedAt: string,
	errors: string[],
) {
	return {
		valid: false,
		errors,
		fragmentKind: "internal_compatibility_fragment",
		targetSchemaVersion: family.canonicalContract,
		source: { schemaVersion, observedAt, warnings: [] },
		repository: { name: null, branch: null, headSha: null },
		claims: { mayClaim: [], mustNotClaim: [] },
		evidenceRefs: [],
	};
}

/** Narrow an unknown packet value to a non-array object. */
function isPacketRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Read an optional reviewer receipt without accepting malformed fallbacks. */
function reviewerEvidenceRefs(
	packet: Record<string, unknown>,
	errors: string[],
): string[] {
	if (!Object.hasOwn(packet, "coverageReceipt")) {
		return claimList([packet.command]);
	}
	if (!isPacketRecord(packet.coverageReceipt)) {
		errors.push("coverageReceipt must be an object when present");
		return [];
	}
	return readEvidenceRefs(
		packet.coverageReceipt.evidenceRefs,
		"coverageReceipt.evidenceRefs",
		errors,
	);
}

/** Require a non-empty list of object records at a packet boundary. */
function recordList(
	value: unknown,
	field: string,
	errors: string[],
): Record<string, unknown>[] {
	if (
		!Array.isArray(value) ||
		value.length === 0 ||
		value.some((entry) => !isPacketRecord(entry))
	) {
		errors.push(`${field} must be a non-empty array of objects`);
		return [];
	}
	return value;
}

function validateRequiredString(
	field: string,
	value: unknown,
	errors: string[],
): void {
	if (typeof value !== "string" || value.trim().length === 0)
		errors.push(`${field} must be a non-empty string`);
}

function validateHeadSha(value: unknown, errors: string[]): void {
	if (typeof value !== "string" || !isFullGitSha(value))
		errors.push("headSha must be an exact 40-character lowercase git SHA");
}

/** Require and return non-empty evidence references. */
function readEvidenceRefs(
	value: unknown,
	field: string,
	errors: string[],
): string[] {
	if (
		!Array.isArray(value) ||
		value.length === 0 ||
		value.some((ref) => typeof ref !== "string" || ref.trim().length === 0)
	) {
		errors.push(`${field} must be a non-empty array of non-empty strings`);
		return [];
	}
	return claimList(value);
}

/** Enforce a packet family's claim allow-list and uniqueness. */
function validateClaims(
	field: string,
	value: unknown,
	allowed: readonly string[],
	errors: string[],
): void {
	const claims = claimList(value);
	if (!Array.isArray(value) || claims.length !== value.length) {
		errors.push(`${field} must be an array of strings`);
		return;
	}
	if (claims.some((claim) => !allowed.includes(claim)))
		errors.push(`${field} has unsupported claim`);
	if (new Set(claims).size !== claims.length)
		errors.push(`${field} must not contain duplicates`);
}

/** Return the string members of an unknown array value. */
function claimList(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.filter((entry): entry is string => typeof entry === "string");
}

function stringOrNull(value: unknown): string | null {
	return typeof value === "string" && value.trim() !== "" ? value : null;
}

/** Validate the full lowercase SHA required at the canonical boundary. */
function isFullGitSha(value: string): boolean {
	return (
		value.length === 40 &&
		[...value].every((char) => "0123456789abcdef".includes(char))
	);
}

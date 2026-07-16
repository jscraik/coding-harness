import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Checked-in historical packet-catalog evidence used for comparison. */
export const PACKET_CONSOLIDATION_BASELINE_PATH =
	"evals/scenarios/north-star-agent-delivery/packet-surface-baseline.json";

const BASELINE_SOURCE_COMMAND = "harness commands --json --for-agent";
const BASELINE_OBSERVED_AT = "2026-07-14T00:00:00Z";
const BASELINE_SOURCE_COMMIT = "4b9c2abe870d38bfadd5b8836c73cf7ea8af2abe";
const BASELINE_CATALOG_SCHEMA_VERSION = "harness-command-catalog/v4";
const BASELINE_SOURCE_COMMAND_COUNT = 18;
const BASELINE_CATALOG_NORMALIZED_BYTES = 17_627;
const BASELINE_CATALOG_SHA256 =
	"sha256:1cdc209083ef5600c9c41f8757145665122566bd47c02224a131e5c5639730b8";
const BASELINE_EXTRACTION_RULE =
	"select the five managed packet command names from commands in catalog order and retain exact name, summary, and example fields";
const BASELINE_PAYLOAD_SHA256 =
	"sha256:0eabb6e08bb849254d46c77c4d33e616154e05a009c879f3ecc42f49d450fa7d";
const BASELINE_PACKET_COMMAND_NAMES = [
	"agent-native-ratchets",
	"governance-decision-surface",
	"session-distill",
	"reviewer-decision",
	"agent-rework",
] as const;
const BASELINE_CONTRACT_ERROR =
	"packet consolidation baseline does not match its immutable source contract";

/** Observed pre-consolidation packet surface retained as comparison evidence. */
export interface PacketConsolidationBaseline {
	observedAt: string;
	sourceCommit: string;
	sourceCommand: string;
	sourceCatalogSchemaVersion: string;
	sourceCommandCount: number;
	sourceCatalogNormalizedBytes: number;
	sourceCatalogSha256: string;
	extractionRule: string;
	rawPacketSubset: string;
	rawPacketSubsetSha256: string;
	commands: Array<{
		name: string;
		invocation: string;
		schemaVersion: string;
		summary: string;
	}>;
}

interface PacketConsolidationBaselineDocument {
	observedAt: string;
	sourceCommit: string;
	sourceCommand: string;
	sourceCatalogSchemaVersion: string;
	sourceCommandCount: number;
	sourceCatalogNormalizedBytes: number;
	sourceCatalogSha256: string;
	extractionRule: string;
	rawPacketSubset: string;
	rawPacketSubsetSha256: string;
}

/** Read and validate the immutable comparison at its filesystem/JSON boundary. */
export function readPacketConsolidationBaseline(
	repoRoot: string,
): PacketConsolidationBaseline {
	return parseBaseline(
		readFileSync(resolve(repoRoot, PACKET_CONSOLIDATION_BASELINE_PATH), "utf8"),
	);
}

/** Parse and bind the historical comparison to the managed packet registry. */
function parseBaseline(content: string): PacketConsolidationBaseline {
	let parsed: unknown;
	try {
		parsed = JSON.parse(content);
	} catch {
		throw new TypeError("packet consolidation baseline must be valid JSON");
	}
	const document = decodeBaselineDocument(parsed);
	const payloadDigest = `sha256:${createHash("sha256")
		.update(document.rawPacketSubset)
		.digest("hex")}`;
	let rawCommands: unknown;
	try {
		rawCommands = JSON.parse(document.rawPacketSubset);
	} catch {
		throw new TypeError(
			"packet consolidation baseline payload must be valid JSON",
		);
	}
	if (
		!Array.isArray(rawCommands) ||
		rawCommands.length !== BASELINE_PACKET_COMMAND_NAMES.length
	) {
		throw new TypeError(BASELINE_CONTRACT_ERROR);
	}
	const commands = rawCommands.map(decodeBaselineCommand);
	if (!baselineMetadataValid(document, payloadDigest)) {
		throw new TypeError(BASELINE_CONTRACT_ERROR);
	}
	return {
		observedAt: document.observedAt,
		sourceCommit: BASELINE_SOURCE_COMMIT,
		sourceCommand: BASELINE_SOURCE_COMMAND,
		sourceCatalogSchemaVersion: BASELINE_CATALOG_SCHEMA_VERSION,
		sourceCommandCount: BASELINE_SOURCE_COMMAND_COUNT,
		sourceCatalogNormalizedBytes: BASELINE_CATALOG_NORMALIZED_BYTES,
		sourceCatalogSha256: BASELINE_CATALOG_SHA256,
		extractionRule: BASELINE_EXTRACTION_RULE,
		rawPacketSubset: document.rawPacketSubset,
		rawPacketSubsetSha256: BASELINE_PAYLOAD_SHA256,
		commands,
	};
}

/** Decode the baseline file before any domain logic observes its fields. */
function decodeBaselineDocument(
	value: unknown,
): PacketConsolidationBaselineDocument {
	if (typeof value !== "object" || value === null) {
		throw new TypeError("packet consolidation baseline must be an object");
	}
	return {
		observedAt: baselineString(value, "observedAt"),
		sourceCommit: baselineString(value, "sourceCommit"),
		sourceCommand: baselineString(value, "sourceCommand"),
		sourceCatalogSchemaVersion: baselineString(
			value,
			"sourceCatalogSchemaVersion",
		),
		sourceCommandCount: baselineNumber(value, "sourceCommandCount"),
		sourceCatalogNormalizedBytes: baselineNumber(
			value,
			"sourceCatalogNormalizedBytes",
		),
		sourceCatalogSha256: baselineString(value, "sourceCatalogSha256"),
		extractionRule: baselineString(value, "extractionRule"),
		rawPacketSubset: baselineString(value, "rawPacketSubset"),
		rawPacketSubsetSha256: baselineString(value, "rawPacketSubsetSha256"),
	};
}

/** Validate immutable source metadata independently from live catalog rows. */
function baselineMetadataValid(
	document: PacketConsolidationBaselineDocument,
	payloadDigest: string,
): boolean {
	const immutableFieldsMatch = [
		[document.observedAt, BASELINE_OBSERVED_AT],
		[document.sourceCommit, BASELINE_SOURCE_COMMIT],
		[document.sourceCommand, BASELINE_SOURCE_COMMAND],
		[document.sourceCatalogSchemaVersion, BASELINE_CATALOG_SCHEMA_VERSION],
		[document.sourceCommandCount, BASELINE_SOURCE_COMMAND_COUNT],
		[document.sourceCatalogNormalizedBytes, BASELINE_CATALOG_NORMALIZED_BYTES],
		[document.sourceCatalogSha256, BASELINE_CATALOG_SHA256],
		[document.extractionRule, BASELINE_EXTRACTION_RULE],
		[document.rawPacketSubsetSha256, BASELINE_PAYLOAD_SHA256],
	].every(([actual, expected]) => actual === expected);
	return immutableFieldsMatch && payloadDigest === BASELINE_PAYLOAD_SHA256;
}

/** Decode one historical command row independently from the live registry. */
function decodeBaselineCommand(
	value: unknown,
	index: number,
): PacketConsolidationBaseline["commands"][number] {
	if (typeof value !== "object" || value === null) {
		throw new TypeError(BASELINE_CONTRACT_ERROR);
	}
	const expectedName = BASELINE_PACKET_COMMAND_NAMES[index];
	const name = baselineField(value, "name");
	const example = baselineField(value, "example");
	const summary = baselineField(value, "summary");
	if (
		typeof expectedName !== "string" ||
		name !== expectedName ||
		example !== `${expectedName} --json` ||
		typeof summary !== "string"
	) {
		throw new TypeError(BASELINE_CONTRACT_ERROR);
	}
	const schemaVersion = baselineSchemaVersion(summary);
	if (schemaVersion !== `${expectedName}/v1`) {
		throw new TypeError(BASELINE_CONTRACT_ERROR);
	}
	return {
		name: expectedName,
		invocation: `harness ${example}`,
		schemaVersion,
		summary,
	};
}

/** Extract the only historical v1 schema named in an exact catalog summary. */
function baselineSchemaVersion(summary: string): string | null {
	const matches = summary.match(/\b[a-z][a-z0-9-]*\/v1\b/g) ?? [];
	return matches.length === 1 ? matches[0] : null;
}

/** Decode one required string field at the baseline boundary. */
function baselineString(value: object, key: string): string {
	const field = baselineField(value, key);
	if (typeof field !== "string") throw new TypeError(BASELINE_CONTRACT_ERROR);
	return field;
}

/** Decode one required numeric field at the baseline boundary. */
function baselineNumber(value: object, key: string): number {
	const field = baselineField(value, key);
	if (typeof field !== "number") throw new TypeError(BASELINE_CONTRACT_ERROR);
	return field;
}

/** Read one named field while keeping unknown JSON inside this decoder. */
function baselineField(value: object, key: string): unknown {
	return Reflect.get(value, key);
}

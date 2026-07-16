import { getRegistryAgentCommandCatalogDocument } from "../cli/command-registry.js";
import type { CommandCapabilityCatalogDocument } from "../cli/registry/command-capabilities.js";
import {
	observePacketCandidateIdentity,
	type PacketCandidateIdentity,
} from "./packet-candidate-identity.js";
import {
	discoverPacketCallerInventory,
	type PacketCallerInventory,
} from "./packet-caller-inventory.js";
import {
	MANAGED_CONSUMERS,
	PACKET_FAMILY_REGISTRY,
} from "./packet-consolidation-contract.js";
import {
	PACKET_CONSOLIDATION_BASELINE_PATH,
	readPacketConsolidationBaseline,
	type PacketConsolidationBaseline,
} from "./packet-consolidation-baseline.js";

/** Measured command, packet, caller, context, and operator-choice effects. */
export interface PacketConsolidationMeasurement {
	schemaVersion: "packet-consolidation-measurement/v1";
	sources: {
		baselinePath: string;
		baselineSourceCommit: string;
		baselineSourceCommand: string;
		baselineCatalogSchemaVersion: string;
		baselineSourceCommandCount: number;
		baselineCatalogNormalizedBytes: number;
		baselineCatalogSha256: string;
		baselineExtractionRule: string;
		baselinePayloadSha256: string;
		catalogSchemaVersion: string;
		catalogGeneratedAt: string;
		checkoutHeadSha: string;
		candidateDigest: string;
		candidatePathCount: number;
		inventoryEvidenceRef: string;
	};
	commandVisibility: {
		before: string[];
		afterDefault: string[];
		compatibilityRetained: string[];
	};
	packetVisibility: {
		before: string[];
		afterDefault: string[];
	};
	migratedConsumerCoverage: {
		expected: number;
		observed: number;
		percent: number;
		missing: string[];
		unclassified: string[];
	};
	packetCatalogContextBytes: {
		beforeBytes: number;
		afterBytes: number;
		deltaBytes: number;
	};
	packetCommandChoice: { before: number; after: number; delta: number };
}

interface PacketConsolidationMeasurementInput {
	repoRoot: string;
	candidateIdentity: PacketCandidateIdentity;
	baseline: PacketConsolidationBaseline;
	catalog: CommandCapabilityCatalogDocument;
}

/** Load the checked-in baseline and live catalog inside the measurement owner. */
export function measureCurrentPacketConsolidation(
	repoRoot: string,
): PacketConsolidationMeasurement {
	return measurePacketConsolidation({
		repoRoot,
		candidateIdentity: observePacketCandidateIdentity(repoRoot),
		baseline: readPacketConsolidationBaseline(repoRoot),
		catalog: getRegistryAgentCommandCatalogDocument(),
	});
}

/** Measure the default surface without treating retained compatibility as gone. */
function measurePacketConsolidation(
	input: PacketConsolidationMeasurementInput,
): PacketConsolidationMeasurement {
	const inventory = discoverPacketCallerInventory(
		input.repoRoot,
		input.candidateIdentity,
	);
	const packetFamilyByName = new Map(
		PACKET_FAMILY_REGISTRY.map((family) => [
			family.command.split(" ")[1],
			family,
		]),
	);
	const livePacketRows = input.catalog.commands.flatMap((command) => {
		const family = packetFamilyByName.get(command.name);
		return family ? [{ command, family }] : [];
	});
	const beforeCommands = input.baseline.commands.map(
		(command) => command.invocation,
	);
	const beforePackets = input.baseline.commands.map(
		(command) => command.schemaVersion,
	);
	const afterCommands = livePacketRows.map(({ family }) => family.command);
	const afterPackets = livePacketRows.map(({ family }) => family.schemaVersion);
	const beforeContext = JSON.stringify(input.baseline.commands);
	const afterContext = JSON.stringify(
		livePacketRows.map(({ command, family }) => ({
			name: command.name,
			invocation: family.command,
			schemaVersion: family.schemaVersion,
			summary: command.summary,
		})),
	);
	return {
		schemaVersion: "packet-consolidation-measurement/v1",
		sources: measurementSources(input, inventory),
		commandVisibility: {
			before: beforeCommands,
			afterDefault: afterCommands,
			compatibilityRetained: PACKET_FAMILY_REGISTRY.map(
				(family) => family.command,
			),
		},
		packetVisibility: {
			before: beforePackets,
			afterDefault: afterPackets,
		},
		migratedConsumerCoverage: consumerCoverage(inventory),
		packetCatalogContextBytes: {
			beforeBytes: Buffer.byteLength(beforeContext),
			afterBytes: Buffer.byteLength(afterContext),
			deltaBytes:
				Buffer.byteLength(afterContext) - Buffer.byteLength(beforeContext),
		},
		packetCommandChoice: {
			before: beforeCommands.length,
			after: afterCommands.length,
			delta: afterCommands.length - beforeCommands.length,
		},
	};
}

/** Assemble historical and live source identities without obscuring either lane. */
function measurementSources(
	input: PacketConsolidationMeasurementInput,
	inventory: PacketCallerInventory,
): PacketConsolidationMeasurement["sources"] {
	return {
		baselinePath: PACKET_CONSOLIDATION_BASELINE_PATH,
		baselineSourceCommit: input.baseline.sourceCommit,
		baselineSourceCommand: input.baseline.sourceCommand,
		baselineCatalogSchemaVersion: input.baseline.sourceCatalogSchemaVersion,
		baselineSourceCommandCount: input.baseline.sourceCommandCount,
		baselineCatalogNormalizedBytes: input.baseline.sourceCatalogNormalizedBytes,
		baselineCatalogSha256: input.baseline.sourceCatalogSha256,
		baselineExtractionRule: input.baseline.extractionRule,
		baselinePayloadSha256: input.baseline.rawPacketSubsetSha256,
		catalogSchemaVersion: input.catalog.schemaVersion,
		catalogGeneratedAt: input.catalog.generatedAt,
		checkoutHeadSha: input.candidateIdentity.checkoutHeadSha,
		candidateDigest: input.candidateIdentity.candidateDigest,
		candidatePathCount: input.candidateIdentity.candidatePathCount,
		inventoryEvidenceRef: inventory.evidenceRef,
	};
}

/** Score managed migration while charging unclassified callers to coverage. */
function consumerCoverage(inventory: PacketCallerInventory) {
	const observed = inventory.runtimeConsumers.filter((path) =>
		(MANAGED_CONSUMERS as readonly string[]).includes(path),
	).length;
	const expected = MANAGED_CONSUMERS.length + inventory.unknownConsumers.length;
	return {
		expected,
		observed,
		percent: expected === 0 ? 100 : Math.round((observed / expected) * 100),
		missing: [...inventory.missingManagedConsumers],
		unclassified: [...inventory.unknownConsumers],
	};
}

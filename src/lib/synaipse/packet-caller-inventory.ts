import { packetCallerCandidateSources } from "./packet-caller-candidate-content.js";
import {
	observePacketCandidateIdentity,
	type PacketCandidateIdentity,
} from "./packet-candidate-identity.js";
import {
	MANAGED_CONSUMERS,
	PACKET_FAMILY_REGISTRY,
	type PacketFamilySchemaVersion,
} from "./packet-consolidation-contract.js";

/** Deterministic caller classes used by packet-retirement evidence. */
export type PacketCallerKind =
	| "producer"
	| "runtime_consumer"
	| "generated_contract"
	| "compatibility_validator"
	| "outcome_evaluator"
	| "compatibility_export"
	| "test_fixture"
	| "command_metadata"
	| "package_alias"
	| "orientation_metadata"
	| "documentation"
	| "unknown";

/** Machine-visible discovery signals independent from runtime classification. */
export type PacketDiscoverySignal =
	| "schema_literal"
	| "command_name"
	| "constructed_command_name"
	| "registry_reference"
	| "packet_module_reference"
	| "producer_invocation";

const EXACT_CALLER_KINDS = new Map<
	string,
	{ kind: PacketCallerKind; reason: string }
>([
	[
		"scripts/check_artifact_type_contracts.py",
		{
			kind: "compatibility_validator",
			reason: "validates compatibility artifacts",
		},
	],
	[
		"scripts/validate-runtime-packet-schemas.cjs",
		{ kind: "compatibility_validator", reason: "validates packet schemas" },
	],
	[
		"scripts/run-harness-evals.mjs",
		{ kind: "outcome_evaluator", reason: "executes packet eval scenarios" },
	],
	[
		"evals/scenarios/north-star-agent-delivery/registry.json",
		{ kind: "outcome_evaluator", reason: "declares packet eval scenarios" },
	],
	[
		"evals/scenarios/north-star-agent-delivery/packet-surface-baseline.json",
		{
			kind: "orientation_metadata",
			reason: "stores immutable measurement input",
		},
	],
	[
		"src/commands/next-recommendation-decisions.ts",
		{
			kind: "command_metadata",
			reason: "recommends command names without reading packet bytes",
		},
	],
	[
		"src/lib/synaipse/packet-consolidation-baseline.ts",
		{
			kind: "outcome_evaluator",
			reason:
				"decodes immutable measurement input without reading packet bytes",
		},
	],
	[
		"src/lib/synaipse/packet-consolidation-measurement.ts",
		{
			kind: "outcome_evaluator",
			reason: "measures inventory and command catalog metadata",
		},
	],
	[
		"src/lib/synaipse/packet-caller-inventory.ts",
		{
			kind: "orientation_metadata",
			reason: "owns mechanical caller discovery",
		},
	],
	[
		"src/lib/synaipse/packet-consolidation-contract.ts",
		{
			kind: "orientation_metadata",
			reason: "owns expected packet surface metadata",
		},
	],
]);

const CONVENTIONAL_CALLER_KINDS: Array<{
	matches: (path: string) => boolean;
	classification: { kind: PacketCallerKind; reason: string };
}> = [
	{
		matches: (path) => path === "package.json",
		classification: {
			kind: "package_alias",
			reason: "declares producer command aliases only",
		},
	},
	{
		matches: (path) => path.startsWith("contracts/"),
		classification: {
			kind: "generated_contract",
			reason: "declares packet schema or example bytes",
		},
	},
	{
		matches: (path) => path === "src/lib/synaipse/packet-retirement.ts",
		classification: {
			kind: "compatibility_export",
			reason:
				"evaluates retirement evidence without reading runtime packet bytes",
		},
	},
	{
		matches: (path) => path === "src/lib/testing/behavior-test-suites.json",
		classification: {
			kind: "test_fixture",
			reason: "registers packet behavior test coverage",
		},
	},
	{
		matches: (path) =>
			path.includes(".test.") || path.startsWith("scripts/tests/"),
		classification: {
			kind: "test_fixture",
			reason: "exercises packet behavior in tests only",
		},
	},
	{
		matches: (path) => /^src\/lib\/cli\/registry\/command-/.test(path),
		classification: {
			kind: "command_metadata",
			reason: "classifies command names without reading packet bytes",
		},
	},
	{
		matches: (path) =>
			path.startsWith("docs/") ||
			path.startsWith(".harness/") ||
			path.startsWith(".diagram/") ||
			path.endsWith(".md"),
		classification: {
			kind: "documentation",
			reason: "documents packet surfaces without runtime byte consumption",
		},
	},
];

/** One discovered surface that names or routes a packet family. */
export interface PacketCaller {
	path: string;
	kind: PacketCallerKind;
	reason: string;
	families: PacketFamilySchemaVersion[];
	signals: PacketDiscoverySignal[];
}

/** Candidate-SHA-bound packet caller inventory derived from repository bytes. */
export interface PacketCallerInventory {
	candidateSha: string;
	candidateDigest: string;
	evidenceRef: string;
	callers: PacketCaller[];
	runtimeConsumers: string[];
	nonRuntimeSurfaces: Array<{
		path: string;
		kind: PacketCallerKind;
		reason: string;
	}>;
	missingManagedConsumers: string[];
	unknownConsumers: string[];
}

const MANAGED_CONSUMER_REFERENCE_TOKENS = MANAGED_CONSUMERS.map((path) =>
	(path.split("/").at(-1) ?? path).replace(/\.ts$/, ""),
);

type CallerClassification = { kind: PacketCallerKind; reason: string };

/** Return exact producer, runtime, or repository-owned classification. */
function ownedCallerKind(path: string): CallerClassification | null {
	if (PACKET_FAMILY_REGISTRY.some((family) => family.producer === path)) {
		return {
			kind: "producer",
			reason: "emits managed compatibility packet bytes",
		};
	}
	if ((MANAGED_CONSUMERS as readonly string[]).includes(path)) {
		return {
			kind: "runtime_consumer",
			reason: "reads or projects managed packet bytes",
		};
	}
	const exactKind = EXACT_CALLER_KINDS.get(path);
	return exactKind ?? null;
}

/** Classify conventional non-runtime packet surfaces with explicit reasons. */
function conventionalCallerKind(path: string): CallerClassification {
	return (
		CONVENTIONAL_CALLER_KINDS.find((entry) => entry.matches(path))
			?.classification ?? {
			kind: "unknown",
			reason: "repository has no owned runtime or exclusion classification",
		}
	);
}

/** Classify a discovered surface separately from whether it reads packet bytes. */
function callerKind(path: string): CallerClassification {
	return ownedCallerKind(path) ?? conventionalCallerKind(path);
}

/** Normalize simple string concatenation so constructed command aliases are visible. */
function normalizedConstructedText(content: string): string {
	return content.replace(/[\s'"`+]/g, "");
}

/** Discover literal, direct-command, and constructed-command family references. */
function discoverFamilyReferences(content: string): {
	families: Set<PacketFamilySchemaVersion>;
	signals: Set<PacketDiscoverySignal>;
} {
	const families = new Set<PacketFamilySchemaVersion>();
	const signals = new Set<PacketDiscoverySignal>();
	const normalized = normalizedConstructedText(content);
	for (const family of PACKET_FAMILY_REGISTRY) {
		const commandName = family.command.split(" ")[1] ?? "";
		if (content.includes(family.schemaVersion)) {
			families.add(family.schemaVersion);
			signals.add("schema_literal");
		}
		if (content.includes(commandName)) {
			families.add(family.schemaVersion);
			signals.add("command_name");
		} else if (normalized.includes(commandName)) {
			families.add(family.schemaVersion);
			signals.add("constructed_command_name");
		}
	}
	return { families, signals };
}

/** Discover registry, packet-module, and producer-invocation signals. */
function genericReferenceSignals(content: string): PacketDiscoverySignal[] {
	return [
		content.includes("PACKET_FAMILY_REGISTRY") ? "registry_reference" : null,
		MANAGED_CONSUMER_REFERENCE_TOKENS.some((token) => content.includes(token))
			? "packet_module_reference"
			: null,
		content.includes("write-agent-native-ratchet-report")
			? "producer_invocation"
			: null,
	].filter((signal): signal is PacketDiscoverySignal => signal !== null);
}

/** Discover family-specific and registry/module-level reference signals. */
function discoverReferences(content: string): {
	families: PacketFamilySchemaVersion[];
	signals: PacketDiscoverySignal[];
} {
	const { families, signals } = discoverFamilyReferences(content);
	const genericSignals = genericReferenceSignals(content);
	for (const signal of genericSignals) signals.add(signal);
	if (genericSignals.length > 0 && families.size === 0) {
		for (const family of PACKET_FAMILY_REGISTRY)
			families.add(family.schemaVersion);
	}
	return { families: [...families], signals: [...signals] };
}

/** Discover runtime consumers and every explicit non-runtime packet surface. */
export function discoverPacketCallerInventory(
	repoRoot: string,
	candidateIdentity: PacketCandidateIdentity,
): PacketCallerInventory {
	const sources = packetCallerCandidateSources(repoRoot);
	const confirmedIdentity = observePacketCandidateIdentity(repoRoot);
	if (
		confirmedIdentity.checkoutHeadSha !== candidateIdentity.checkoutHeadSha ||
		confirmedIdentity.candidateDigest !== candidateIdentity.candidateDigest ||
		confirmedIdentity.candidatePathCount !==
			candidateIdentity.candidatePathCount
	)
		throw new TypeError(
			"packet caller inventory candidate changed during discovery",
		);
	const callers = sources.flatMap(({ path, contents }): PacketCaller[] => {
		const families = new Set<PacketFamilySchemaVersion>();
		const signals = new Set<PacketDiscoverySignal>();
		for (const bytes of contents) {
			const reference = discoverReferences(bytes.toString("utf8"));
			for (const family of reference.families) families.add(family);
			for (const signal of reference.signals) signals.add(signal);
		}
		const reference = { families: [...families], signals: [...signals] };
		if (reference.signals.length === 0 || reference.families.length === 0)
			return [];
		return [{ path, ...callerKind(path), ...reference }];
	});
	const runtimeConsumers = callers
		.filter((caller) => caller.kind === "runtime_consumer")
		.map((caller) => caller.path)
		.sort();
	return {
		candidateSha: candidateIdentity.checkoutHeadSha,
		candidateDigest: candidateIdentity.candidateDigest,
		evidenceRef: `git:${candidateIdentity.checkoutHeadSha}:packet-caller-inventory:${candidateIdentity.candidateDigest}`,
		callers,
		runtimeConsumers,
		nonRuntimeSurfaces: callers
			.filter((caller) => caller.kind !== "runtime_consumer")
			.map(({ path, kind, reason }) => ({ path, kind, reason })),
		missingManagedConsumers: MANAGED_CONSUMERS.filter(
			(path) => !runtimeConsumers.includes(path),
		),
		unknownConsumers: callers
			.filter((caller) => caller.kind === "unknown")
			.map((caller) => caller.path),
	};
}

import { buildHarnessDecision } from "../decision/harness-decision-builder.js";
import {
	buildSynaipseImprovementCase,
	type SynaipseImprovementCase,
	validateSynaipseImprovementCase,
} from "./improvement-case.js";
import {
	projectLegacyPacket,
	type PacketFamilySchemaVersion,
} from "./packet-consolidation.js";
import { buildPacketTransition } from "./packet-transition-projection.js";
import {
	buildSynaipseState,
	type SynaipseState,
	validateSynaipseState,
} from "./state.js";
import {
	type SynaipseTransitionInput,
	validateSynaipseTransition,
} from "./transition.js";

type CanonicalPacketRecord =
	| SynaipseState
	| SynaipseTransitionInput
	| SynaipseImprovementCase;

/** Successful routine-path projection into one complete canonical record. */
export interface CompleteCanonicalPacketProjection {
	status: "complete";
	valid: true;
	errors: [];
	sourceSchemaVersion: PacketFamilySchemaVersion;
	targetSchemaVersion: CanonicalPacketRecord["schemaVersion"];
	record: CanonicalPacketRecord;
}

/** Fail-closed result when a packet cannot form a valid canonical record. */
export interface InvalidCanonicalPacketProjection {
	status: "invalid";
	valid: false;
	errors: string[];
	sourceSchemaVersion: PacketFamilySchemaVersion;
	targetSchemaVersion: string;
	record: null;
}

/** Honest compatibility result when this canonical owner is repo-scoped. */
export interface UnavailableCanonicalPacketProjection {
	status: "unavailable";
	valid: false;
	errors: string[];
	sourceSchemaVersion: PacketFamilySchemaVersion;
	targetSchemaVersion: string;
	record: null;
}

/** Result of routing one legacy packet through its owning canonical builder. */
export type CanonicalPacketProjection =
	| CompleteCanonicalPacketProjection
	| InvalidCanonicalPacketProjection
	| UnavailableCanonicalPacketProjection;

/** Canonicalization inputs supplied by the routine packet command adapter. */
export interface CanonicalizeLegacyPacketOptions {
	repoRoot: string;
	observedAt: string;
}

/** Flatten owning-validator errors into the adapter's stable diagnostic form. */
function validationErrors(
	errors: Array<{ path: string; message: string }>,
): string[] {
	return errors.map((error) => `${error.path}: ${error.message}`);
}

/** Build a complete state through the existing canonical state owner. */
function canonicalState(
	schemaVersion: PacketFamilySchemaVersion,
	evidenceRefs: string[],
	options: CanonicalizeLegacyPacketOptions,
): CompleteCanonicalPacketProjection | InvalidCanonicalPacketProjection {
	const decision = buildHarnessDecision(`legacy:${schemaVersion}`, {
		status: "action_required",
		summary: `Project ${schemaVersion} through canonical SynAIpse state.`,
		nextAction:
			"Continue from the canonical state and retain compatibility output.",
		nextCommand: null,
		phase: "orient",
		safeToRun: true,
		requiresHuman: false,
		requiresNetwork: false,
		writesFiles: false,
		evidenceRef: evidenceRefs,
		failureClass: null,
		retry: "safe",
		riskTier: "low",
	});
	const record = buildSynaipseState(
		decision,
		options.repoRoot,
		options.observedAt,
	);
	const validation = validateSynaipseState(record);
	return validation.valid
		? complete(schemaVersion, record)
		: invalid(
				schemaVersion,
				record.schemaVersion,
				validationErrors(validation.errors),
			);
}

/** Build a complete improvement case through the canonical improvement owner. */
function canonicalImprovement(
	schemaVersion: PacketFamilySchemaVersion,
	evidenceRefs: string[],
	options: CanonicalizeLegacyPacketOptions,
): CompleteCanonicalPacketProjection | InvalidCanonicalPacketProjection {
	const record = buildSynaipseImprovementCase({
		caseId: "ch_case_packet_rework_compatibility",
		observedAt: options.observedAt,
		observation:
			"The legacy agent-rework producer requires canonical improvement routing while compatibility remains available.",
		classification: "systemic",
		siblingInventory: evidenceRefs,
		candidates: [
			{
				mechanism: "canonical_improvement_builder",
				disposition: "selected",
				rationale: "Reuses the owning contract and validator.",
			},
			{
				mechanism: "standalone_packet_receipt",
				disposition: "rejected",
				rationale: "Would create a duplicate public contract.",
			},
		],
		selectedMechanism: "canonical_improvement_builder",
		canary:
			"Run the routine agent-rework command through the canonical adapter.",
		measurement:
			"The complete improvement record passes its owning validator before legacy output is emitted.",
		disposition: "consolidate",
		owner: "SynAIpse",
		retirementCondition:
			"Retire compatibility only after current-SHA caller, canary, rollback, eval, and independent-QA evidence is complete.",
	});
	const validation = validateSynaipseImprovementCase(record);
	return validation.valid
		? complete(schemaVersion, record)
		: invalid(
				schemaVersion,
				record.schemaVersion,
				validationErrors(validation.errors),
			);
}

/** Build a complete transition from repo observations and safe authority defaults. */
function canonicalTransition(
	schemaVersion: PacketFamilySchemaVersion,
	evidenceRefs: string[],
	options: CanonicalizeLegacyPacketOptions,
): CanonicalPacketProjection {
	const record = buildPacketTransition(
		schemaVersion,
		evidenceRefs,
		options.repoRoot,
		options.observedAt,
	);
	if ("status" in record)
		return unavailable(schemaVersion, "synaipse-transition/v1", record.reason);
	const validation = validateSynaipseTransition(record);
	return validation.valid
		? complete(schemaVersion, record)
		: invalid(
				schemaVersion,
				record.schemaVersion,
				validationErrors(validation.errors),
			);
}

/** Route a validated fragment into the correct owning canonical builder. */
export function canonicalizeLegacyPacket(
	schemaVersion: PacketFamilySchemaVersion,
	packet: unknown,
	options: CanonicalizeLegacyPacketOptions,
): CanonicalPacketProjection {
	const fragment = projectLegacyPacket(
		schemaVersion,
		packet,
		options.observedAt,
	);
	if (!fragment.valid)
		return invalid(
			schemaVersion,
			fragment.targetSchemaVersion,
			fragment.errors,
		);
	switch (schemaVersion) {
		case "agent-native-ratchets/v1":
		case "session-distill/v1":
			return canonicalState(schemaVersion, fragment.evidenceRefs, options);
		case "agent-rework/v1":
			return canonicalImprovement(
				schemaVersion,
				fragment.evidenceRefs,
				options,
			);
		case "reviewer-decision/v1":
		case "governance-decision-surface/v1":
			return canonicalTransition(schemaVersion, fragment.evidenceRefs, options);
	}
}

/** Build one successful canonicalization result. */
function complete(
	sourceSchemaVersion: PacketFamilySchemaVersion,
	record: CanonicalPacketRecord,
): CompleteCanonicalPacketProjection {
	return {
		status: "complete",
		valid: true,
		errors: [],
		sourceSchemaVersion,
		targetSchemaVersion: record.schemaVersion,
		record,
	};
}

/** Build one invalid canonicalization result. */
function invalid(
	sourceSchemaVersion: PacketFamilySchemaVersion,
	targetSchemaVersion: string,
	errors: string[],
): InvalidCanonicalPacketProjection {
	return {
		status: "invalid",
		valid: false,
		errors,
		sourceSchemaVersion,
		targetSchemaVersion,
		record: null,
	};
}

/** Build one repo-scope or evidence-unavailable canonicalization result. */
function unavailable(
	sourceSchemaVersion: PacketFamilySchemaVersion,
	targetSchemaVersion: string,
	reason: string,
): UnavailableCanonicalPacketProjection {
	return {
		status: "unavailable",
		valid: false,
		errors: [reason],
		sourceSchemaVersion,
		targetSchemaVersion,
		record: null,
	};
}

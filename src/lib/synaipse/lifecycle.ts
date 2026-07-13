import { isRecord } from "../decision/validators.js";
import { isRfc3339DateTime } from "./state-validation.js";
import { validateIntegrationEvidence } from "./integration-validation.js";
import {
	add,
	isSha,
	isEnum,
	requireString,
	requireEnum,
	requireStringArray,
	rejectUnknownProperties,
} from "./validation-helpers.js";

/** Versioned transition contract identifier. */
export const SYNAIPSE_TRANSITION_SCHEMA_VERSION =
	"synaipse-transition/v1" as const;
export {
	SYNAIPSE_IMPROVEMENT_CASE_SCHEMA_VERSION,
	validateSynaipseImprovementCase,
} from "./improvement-case.js";

const STAGES = [
	"shape",
	"admit",
	"build",
	"prove",
	"review",
	"integrate",
	"improve",
] as const;
const POLICIES = ["standing_authority", "vital_decision_gate"] as const;
const OWNERS = ["codex", "operator"] as const;
const RUNTIME_STATUS = "not_yet_emitted" as const;
const CANONICAL_NEXT_STAGE: Record<SynaipseStage, SynaipseStage> = {
	shape: "admit",
	admit: "build",
	build: "prove",
	prove: "review",
	review: "integrate",
	integrate: "improve",
	improve: "shape",
};

/** Lifecycle stages accepted by the transition contract. */
export type SynaipseStage = (typeof STAGES)[number];
/** Field-level validation error returned by a SynAIpse contract validator. */
export type SynaipseValidationError = { path: string; message: string };
/** Deterministic validation result for a SynAIpse lifecycle contract. */
export type SynaipseValidationResult = {
	valid: boolean;
	errors: SynaipseValidationError[];
};

type ErrorList = SynaipseValidationError[];

function validateRepository(
	value: unknown,
	errors: ErrorList,
	path = "repository",
): void {
	if (!isRecord(value)) {
		add(errors, path, "must be an object");
		return;
	}
	rejectUnknownProperties(value, ["name", "sha"], path, errors);
	requireString(value.name, `${path}.name`, errors);
	if (!isSha(value.sha))
		add(errors, `${path}.sha`, "must be a 40-character SHA");
}

function validateEvidence(value: unknown, errors: ErrorList): void {
	if (!isRecord(value)) {
		add(errors, "evidence", "must be an object");
		return;
	}
	rejectUnknownProperties(
		value,
		["admitted", "rejected", "integration"],
		"evidence",
		errors,
	);
	requireStringArray(value.admitted, "evidence.admitted", errors);
	requireStringArray(value.rejected, "evidence.rejected", errors);
}

function validateAuthority(value: unknown, errors: ErrorList): void {
	if (!isRecord(value)) {
		add(errors, "authority", "must be an object");
		return;
	}
	rejectUnknownProperties(value, ["owner", "standing"], "authority", errors);
	requireEnum(value.owner, "authority.owner", OWNERS, errors);
	if (typeof value.standing !== "boolean")
		add(errors, "authority.standing", "must be boolean");
}

function validateWaivers(
	value: unknown,
	decidedAt: unknown,
	errors: ErrorList,
): void {
	if (!Array.isArray(value)) {
		add(errors, "waivers", "must be an array");
		return;
	}
	for (const [index, waiver] of value.entries()) {
		const path = `waivers[${index}]`;
		if (!isRecord(waiver)) {
			add(errors, path, "must be an object");
			continue;
		}
		rejectUnknownProperties(waiver, ["id", "expiresAt"], path, errors);
		requireString(waiver.id, `${path}.id`, errors);
		if (!isRfc3339DateTime(waiver.expiresAt)) {
			add(errors, `${path}.expiresAt`, "must be an RFC3339 date-time string");
			continue;
		}
		if (
			isRfc3339DateTime(decidedAt) &&
			Date.parse(waiver.expiresAt) <= Date.parse(decidedAt)
		)
			add(errors, `${path}.expiresAt`, "must be later than decidedAt");
	}
}

function validateRecovery(
	value: unknown,
	toStage: unknown,
	blockers: unknown,
	errors: ErrorList,
): void {
	if (value === null) {
		if (Array.isArray(blockers) && blockers.length > 0)
			add(errors, "recovery", "must be provided when blockers are present");
		return;
	}
	if (!isRecord(value)) {
		add(errors, "recovery", "must be an object or null");
		return;
	}
	rejectUnknownProperties(value, ["stage", "action"], "recovery", errors);
	const validStage = requireEnum(value.stage, "recovery.stage", STAGES, errors);
	requireString(value.action, "recovery.action", errors);
	if (validStage && value.stage !== toStage)
		add(errors, "recovery.stage", "must match toStage");
	if (!Array.isArray(blockers) || blockers.length === 0)
		add(errors, "blockers", "must be non-empty when recovery is provided");
}

function validateTransitionShape(
	value: Record<string, unknown>,
	errors: ErrorList,
): void {
	rejectUnknownProperties(
		value,
		[
			"schemaVersion",
			"runtimeStatus",
			"fromStage",
			"toStage",
			"repository",
			"evidence",
			"policy",
			"authority",
			"blockers",
			"waivers",
			"decidedAt",
			"recovery",
		],
		"transition",
		errors,
	);
	if (value.schemaVersion !== SYNAIPSE_TRANSITION_SCHEMA_VERSION)
		add(
			errors,
			"schemaVersion",
			`must be ${SYNAIPSE_TRANSITION_SCHEMA_VERSION}`,
		);
	if (value.runtimeStatus !== RUNTIME_STATUS)
		add(errors, "runtimeStatus", `must be ${RUNTIME_STATUS}`);
	requireEnum(value.fromStage, "fromStage", STAGES, errors);
	requireEnum(value.toStage, "toStage", STAGES, errors);
	validateRepository(value.repository, errors);
	validateEvidence(value.evidence, errors);
	requireEnum(value.policy, "policy", POLICIES, errors);
	validateAuthority(value.authority, errors);
	requireStringArray(value.blockers, "blockers", errors);
	if (!isRfc3339DateTime(value.decidedAt))
		add(errors, "decidedAt", "must be an RFC3339 date-time string");
	validateWaivers(value.waivers, value.decidedAt, errors);
	validateRecovery(value.recovery, value.toStage, value.blockers, errors);
}

function validateStageRoute(
	value: Record<string, unknown>,
	errors: ErrorList,
): void {
	if (!isEnum(value.fromStage, STAGES) || !isEnum(value.toStage, STAGES))
		return;
	const expected = CANONICAL_NEXT_STAGE[value.fromStage];
	const isForward = expected === value.toStage;
	const hasRecovery =
		Array.isArray(value.blockers) &&
		value.blockers.length > 0 &&
		isRecord(value.recovery) &&
		value.recovery.stage === value.toStage;
	if (!isForward && !hasRecovery)
		add(
			errors,
			"toStage",
			"must be the canonical next stage or an explicit recovery stage",
		);
}

function validatePolicyAuthority(
	value: Record<string, unknown>,
	errors: ErrorList,
): void {
	if (!isRecord(value.authority)) return;
	if (value.policy === "standing_authority") {
		if (value.authority.owner !== "codex" || value.authority.standing !== true)
			add(
				errors,
				"authority",
				"standing_authority requires standing Codex authority",
			);
		return;
	}
	if (
		value.authority.owner !== "operator" ||
		value.authority.standing !== false
	)
		add(
			errors,
			"authority",
			"vital_decision_gate requires a non-standing operator authority",
		);
	if (!Array.isArray(value.blockers) || value.blockers.length === 0)
		add(errors, "blockers", "must identify the Vital Decision");
}

/** Validate one current-SHA-bound lifecycle transition decision. */
export function validateSynaipseTransition(
	value: unknown,
	currentSha: string,
): SynaipseValidationResult {
	if (!isRecord(value))
		return {
			valid: false,
			errors: [{ path: "transition", message: "must be an object" }],
		};
	const errors: ErrorList = [];
	validateTransitionShape(value, errors);
	validateStageRoute(value, errors);
	validatePolicyAuthority(value, errors);
	validateIntegrationEvidence(value, currentSha, errors);
	if (value.repository && isRecord(value.repository)) {
		if (value.repository.sha !== currentSha)
			add(errors, "repository.sha", "must match the current repository SHA");
	}
	return { valid: errors.length === 0, errors };
}

/** Return whether a transition requires operator input at the Vital Decision Gate. */
export function isSynaipseVitalDecision(
	value: unknown,
	currentSha: string,
): boolean {
	return (
		isRecord(value) &&
		validateSynaipseTransition(value, currentSha).valid &&
		value.policy === "vital_decision_gate" &&
		isRecord(value.authority) &&
		value.authority.owner === "operator" &&
		value.authority.standing === false
	);
}

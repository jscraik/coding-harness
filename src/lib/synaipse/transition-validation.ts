import { isRecord } from "../decision/validators.js";
import { isRfc3339DateTime } from "./date-time.js";
import { validateAuthorityRecovery } from "./transition-recovery-validation.js";
import { validateEvidenceTimeOrder } from "./transition-time-validation.js";
import {
	BLOCKERS,
	STAGES,
	SYNAIPSE_TRANSITION_SCHEMA_VERSION,
	type Blocker,
	type SynaipseTransitionValidationResult,
} from "./transition-contract.js";

type Errors = SynaipseTransitionValidationResult["errors"];
const FULL_GIT_SHA = /^[0-9a-f]{40}$/;

/** Add a non-empty string error. */
function requireString(value: unknown, path: string, errors: Errors): void {
	if (typeof value !== "string" || value.trim() === "")
		errors.push({ path, message: "must be a non-empty string" });
}

/** Add a full lowercase Git SHA validation error. */
function requireFullGitSha(value: unknown, path: string, errors: Errors): void {
	if (typeof value !== "string" || !FULL_GIT_SHA.test(value))
		errors.push({ path, message: "must be a full lowercase git SHA" });
}

/** Add an RFC3339 date-time error. */
function requireDateTime(value: unknown, path: string, errors: Errors): void {
	if (!isRfc3339DateTime(value))
		errors.push({ path, message: "must be a valid date-time" });
}

/** Reject fields outside a versioned object boundary. */
function rejectUnknown(
	value: Record<string, unknown>,
	allowed: readonly string[],
	path: string,
	errors: Errors,
): void {
	for (const key of Object.keys(value))
		if (!allowed.includes(key))
			errors.push({
				path: `${path}.${key}`,
				message: "must not contain unknown properties",
			});
}

/** Add a non-empty string-array error. */
function requireStringArray(
	value: unknown,
	path: string,
	errors: Errors,
): void {
	if (
		!Array.isArray(value) ||
		value.length === 0 ||
		!value.every((entry) => typeof entry === "string" && entry.trim() !== "")
	)
		errors.push({ path, message: "must be a non-empty array of strings" });
}

/** Validate hosted-main identity and observation. */
function validateHostedMain(value: unknown, errors: Errors): void {
	if (!isRecord(value)) {
		errors.push({ path: "evidence.hostedMain", message: "must be an object" });
		return;
	}
	rejectUnknown(
		value,
		["remote", "ref", "sha", "observedAt"],
		"evidence.hostedMain",
		errors,
	);
	if (value.remote !== "https://github.com/jscraik/coding-harness.git")
		errors.push({
			path: "evidence.hostedMain.remote",
			message: "must be the canonical coding-harness remote",
		});
	if (value.ref !== "refs/heads/main")
		errors.push({
			path: "evidence.hostedMain.ref",
			message: "must be refs/heads/main",
		});
	requireFullGitSha(value.sha, "evidence.hostedMain.sha", errors);
	requireDateTime(value.observedAt, "evidence.hostedMain.observedAt", errors);
}

/** Validate evidence and hosted-main provenance. */
function validateEvidence(value: unknown, errors: Errors): void {
	if (!isRecord(value)) {
		errors.push({ path: "evidence", message: "must be an object" });
		return;
	}
	rejectUnknown(
		value,
		["currentSha", "refs", "observedAt", "hostedMain"],
		"evidence",
		errors,
	);
	requireFullGitSha(value.currentSha, "evidence.currentSha", errors);
	requireStringArray(value.refs, "evidence.refs", errors);
	requireDateTime(value.observedAt, "evidence.observedAt", errors);
	validateHostedMain(value.hostedMain, errors);
}

/** Validate standing authority and capabilities. */
function validateAuthority(value: unknown, errors: Errors): void {
	if (!isRecord(value)) {
		errors.push({ path: "authority", message: "must be an object" });
		return;
	}
	rejectUnknown(
		value,
		["owner", "standing", "capabilities"],
		"authority",
		errors,
	);
	if (value.owner !== "codex" && value.owner !== "operator")
		errors.push({
			path: "authority.owner",
			message: "must be codex or operator",
		});
	if (typeof value.standing !== "boolean")
		errors.push({ path: "authority.standing", message: "must be boolean" });
	requireStringArray(value.capabilities, "authority.capabilities", errors);
}

/** Validate Vital Decision cross-field rules. */
function validateVitalDecision(value: unknown, errors: Errors): void {
	if (!isRecord(value)) {
		errors.push({ path: "vitalDecision", message: "must be an object" });
		return;
	}
	rejectUnknown(value, ["required", "question"], "vitalDecision", errors);
	if (typeof value.required !== "boolean")
		errors.push({ path: "vitalDecision.required", message: "must be boolean" });
	if (
		value.required === true &&
		(typeof value.question !== "string" || value.question.trim() === "")
	)
		errors.push({
			path: "vitalDecision.question",
			message: "must be a question when required",
		});
	if (value.required === false && value.question !== null)
		errors.push({
			path: "vitalDecision.question",
			message: "must be null when not required",
		});
}

/** Validate waiver authority, scope, compensation, expiry, and retirement. */
function validateWaiver(value: unknown, errors: Errors): void {
	if (value === null) return;
	if (!isRecord(value)) {
		errors.push({ path: "waiver", message: "must be an object or null" });
		return;
	}
	rejectUnknown(
		value,
		[
			"id",
			"issuer",
			"scope",
			"reason",
			"compensation",
			"expiresAt",
			"retirementCondition",
		],
		"waiver",
		errors,
	);
	for (const field of [
		"id",
		"scope",
		"reason",
		"compensation",
		"retirementCondition",
	] as const)
		requireString(value[field], `waiver.${field}`, errors);
	if (value.issuer !== "codex" && value.issuer !== "operator")
		errors.push({
			path: "waiver.issuer",
			message: "must be codex or operator",
		});
	requireDateTime(value.expiresAt, "waiver.expiresAt", errors);
}

/** Validate recovery blocker and evidence references. */
function validateRecovery(value: unknown, errors: Errors): void {
	if (value === null) return;
	if (!isRecord(value)) {
		errors.push({ path: "recovery", message: "must be an object or null" });
		return;
	}
	rejectUnknown(
		value,
		["fromBlocker", "refreshedSha", "evidenceRefs"],
		"recovery",
		errors,
	);
	requireFullGitSha(value.refreshedSha, "recovery.refreshedSha", errors);
	requireStringArray(value.evidenceRefs, "recovery.evidenceRefs", errors);
	if (!BLOCKERS.includes(value.fromBlocker as Blocker))
		errors.push({
			path: "recovery.fromBlocker",
			message: "must reference a known transition blocker",
		});
}

/** Validate top-level transition identity and stage fields. */
function validateEnvelope(
	value: Record<string, unknown>,
	errors: Errors,
): void {
	rejectUnknown(
		value,
		[
			"schemaVersion",
			"transitionId",
			"fromStage",
			"toStage",
			"repositorySha",
			"evidence",
			"authority",
			"vitalDecision",
			"waiver",
			"recovery",
			"decidedAt",
		],
		"transition",
		errors,
	);
	if (value.schemaVersion !== SYNAIPSE_TRANSITION_SCHEMA_VERSION)
		errors.push({
			path: "schemaVersion",
			message: "must be synaipse-transition/v1",
		});
	requireString(value.transitionId, "transitionId", errors);
	requireFullGitSha(value.repositorySha, "repositorySha", errors);
	if (!STAGES.includes(value.fromStage as (typeof STAGES)[number]))
		errors.push({
			path: "fromStage",
			message: "must be a known lifecycle stage",
		});
	if (!STAGES.includes(value.toStage as (typeof STAGES)[number]))
		errors.push({
			path: "toStage",
			message: "must be a known lifecycle stage",
		});
	requireDateTime(value.decidedAt, "decidedAt", errors);
	if (value.waiver === undefined)
		errors.push({ path: "waiver", message: "must be an object or null" });
	if (value.recovery === undefined)
		errors.push({ path: "recovery", message: "must be an object or null" });
}

/** Validate cross-field SHA bindings. */
function validateShaBindings(
	value: Record<string, unknown>,
	errors: Errors,
): void {
	const evidence = isRecord(value.evidence) ? value.evidence : null;
	if (evidence) {
		if (value.repositorySha !== evidence.currentSha)
			errors.push({
				path: "repositorySha",
				message: "must match evidence.currentSha",
			});
		const recovery = isRecord(value.recovery) ? value.recovery : null;
		if (recovery && recovery.refreshedSha !== evidence.currentSha)
			errors.push({
				path: "recovery.refreshedSha",
				message: "must match evidence.currentSha",
			});
	}
}

function stringRefs(value: unknown): string[] {
	return Array.isArray(value)
		? value.filter((ref): ref is string => typeof ref === "string")
		: [];
}

function validateRecoveryReferences(
	recovery: Record<string, unknown>,
	refs: string[],
	errors: Errors,
): void {
	if (
		!Array.isArray(recovery.evidenceRefs) ||
		!stringRefs(recovery.evidenceRefs).every((ref) => refs.includes(ref)) ||
		!refs.includes(`recovery:${recovery.fromBlocker}`) ||
		!stringRefs(recovery.evidenceRefs).includes(
			`recovery:${recovery.fromBlocker}`,
		)
	)
		errors.push({
			path: "recovery.evidenceRefs",
			message: "must cite the observed blocker in evidence.refs",
		});
}

function validateVitalDecisionRecovery(
	value: Record<string, unknown>,
	recovery: Record<string, unknown>,
	refs: string[],
	errors: Errors,
): void {
	if (recovery.fromBlocker !== "vital_decision_required") return;
	const authority = isRecord(value.authority) ? value.authority : null;
	const operatorDecisionRef = stringRefs(recovery.evidenceRefs).find((ref) =>
		ref.startsWith("operator-decision:"),
	);
	if (authority?.owner !== "operator")
		errors.push({
			path: "authority.owner",
			message: "must be operator when recovering from a Vital Decision",
		});
	if (!operatorDecisionRef || !refs.includes(operatorDecisionRef))
		errors.push({
			path: "recovery.evidenceRefs",
			message:
				"must cite an observed operator-decision receipt when recovering from a Vital Decision",
		});
}

/** Validate recovery references against the observed evidence list. */
function validateRecoveryBindings(
	value: Record<string, unknown>,
	errors: Errors,
): void {
	const evidence = isRecord(value.evidence) ? value.evidence : null;
	const recovery = isRecord(value.recovery) ? value.recovery : null;
	if (!recovery) return;
	const refs = stringRefs(evidence?.refs);
	validateRecoveryReferences(recovery, refs, errors);
	validateVitalDecisionRecovery(value, recovery, refs, errors);
	validateAuthorityRecovery(value, recovery, errors);
}

/** Validate that a waiver authorizes this exact transition and authority owner. */
function validateWaiverBindings(
	value: Record<string, unknown>,
	errors: Errors,
): void {
	const waiver = isRecord(value.waiver) ? value.waiver : null;
	if (!waiver) return;
	const authority = isRecord(value.authority) ? value.authority : null;
	const expectedScope = `${String(value.fromStage)}->${String(value.toStage)}`;
	if (waiver.scope !== expectedScope)
		errors.push({
			path: "waiver.scope",
			message: "must cover the exact transition",
		});
	if (waiver.issuer !== authority?.owner)
		errors.push({
			path: "waiver.issuer",
			message: "must match authority.owner",
		});
	const capabilities = stringRefs(authority?.capabilities);
	if (!capabilities.includes(`waiver:${expectedScope}`))
		errors.push({
			path: "authority.capabilities",
			message: "must include the matching waiver capability",
		});
}

/** Validate all cross-field bindings in a transition receipt. */
function validateBindings(
	value: Record<string, unknown>,
	errors: Errors,
): void {
	validateShaBindings(value, errors);
	validateEvidenceTimeOrder(value, errors);
	validateRecoveryBindings(value, errors);
	validateWaiverBindings(value, errors);
}

/** Validate one complete lifecycle transition receipt. */
export function validateSynaipseTransition(
	value: unknown,
): SynaipseTransitionValidationResult {
	if (!isRecord(value))
		return {
			valid: false,
			errors: [{ path: "transition", message: "must be an object" }],
		};
	const errors: Errors = [];
	validateEnvelope(value, errors);
	validateEvidence(value.evidence, errors);
	validateAuthority(value.authority, errors);
	validateVitalDecision(value.vitalDecision, errors);
	validateWaiver(value.waiver, errors);
	validateRecovery(value.recovery, errors);
	validateBindings(value, errors);
	return { valid: errors.length === 0, errors };
}

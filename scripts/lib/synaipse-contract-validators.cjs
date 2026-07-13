const { readFileSync } = require("node:fs");

const STAGES = new Set([
	"shape",
	"admit",
	"build",
	"prove",
	"review",
	"integrate",
	"improve",
]);
const NEXT_STAGE = new Map([
	["shape", "admit"],
	["admit", "build"],
	["build", "prove"],
	["prove", "review"],
	["review", "integrate"],
	["integrate", "improve"],
	["improve", "shape"],
]);
const POLICIES = new Set(["standing_authority", "vital_decision_gate"]);
const OWNERS = new Set(["codex", "operator"]);
const MECHANISMS = new Set(["change", "retain", "delete", "defer"]);
const CLASSIFICATIONS = new Set(["local", "systemic"]);

function isShapeObject(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function add(errors, path, message) {
	errors.push({ path, message });
}

function onlyKeys(value, allowed, path, errors) {
	for (const key of Object.keys(value)) {
		if (!allowed.has(key)) add(errors, `${path}.${key}`, "is not allowed");
	}
}

function nonEmpty(value) {
	return typeof value === "string" && value.trim().length > 0;
}

function hexCharacter(value) {
	return (
		(value >= "0" && value <= "9") ||
		(value >= "a" && value <= "f") ||
		(value >= "A" && value <= "F")
	);
}

function isSha(value) {
	return (
		typeof value === "string" &&
		value.length === 40 &&
		[...value].every(hexCharacter)
	);
}

function isDateTime(value) {
	if (typeof value !== "string" || value.length < 20) return false;
	const separator = value.indexOf("T");
	return (
		separator === 10 &&
		value.indexOf("T", separator + 1) === -1 &&
		!Number.isNaN(Date.parse(value))
	);
}

function string(value, path, errors) {
	if (!nonEmpty(value)) add(errors, path, "must be a non-empty string");
}

function enumValue(value, values, path, errors) {
	if (typeof value !== "string" || !values.has(value))
		add(errors, path, "has an unrecognized value");
}

function stringArray(value, path, errors, requireItems = false) {
	if (
		!Array.isArray(value) ||
		(requireItems && value.length === 0) ||
		!value.every(nonEmpty)
	) {
		add(errors, path, "must be an array of non-empty strings");
	}
}

function repository(value, errors) {
	if (!isShapeObject(value)) {
		add(errors, "repository", "must be an object");
		return;
	}
	onlyKeys(value, new Set(["name", "sha"]), "repository", errors);
	string(value.name, "repository.name", errors);
	if (!isSha(value.sha))
		add(errors, "repository.sha", "must be a 40-character hexadecimal SHA");
}

function transitionIntegration(value, errors) {
	if (!isShapeObject(value)) {
		add(errors, "evidence.integration", "must be an object");
		return;
	}
	onlyKeys(
		value,
		new Set([
			"prSha",
			"checksSha",
			"signoff",
			"observedMerge",
			"mainSyncSha",
			"mainSyncRef",
			"mainSyncSource",
		]),
		"evidence.integration",
		errors,
	);
	for (const field of ["prSha", "checksSha", "mainSyncSha"]) {
		if (!isSha(value[field]))
			add(
				errors,
				`evidence.integration.${field}`,
				"must be a 40-character hexadecimal SHA",
			);
	}
	string(value.signoff, "evidence.integration.signoff", errors);
	if (value.observedMerge !== true)
		add(errors, "evidence.integration.observedMerge", "must be true");
	string(value.mainSyncRef, "evidence.integration.mainSyncRef", errors);
	string(value.mainSyncSource, "evidence.integration.mainSyncSource", errors);
}

function validateTransitionFields(value, errors) {
	onlyKeys(
		value,
		new Set([
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
		]),
		"transition",
		errors,
	);
	if (value.schemaVersion !== "synaipse-transition/v1")
		add(errors, "schemaVersion", "must be synaipse-transition/v1");
	if (value.runtimeStatus !== "not_yet_emitted")
		add(errors, "runtimeStatus", "must be not_yet_emitted");
	enumValue(value.fromStage, STAGES, "fromStage", errors);
	enumValue(value.toStage, STAGES, "toStage", errors);
	repository(value.repository, errors);
	stringArray(value.blockers, "blockers", errors);
	if (!isDateTime(value.decidedAt))
		add(errors, "decidedAt", "must be an RFC3339 date-time");
}

function validateTransitionEvidence(value, errors) {
	if (!isShapeObject(value.evidence)) {
		add(errors, "evidence", "must be an object");
	} else {
		onlyKeys(
			value.evidence,
			new Set(["admitted", "rejected", "integration"]),
			"evidence",
			errors,
		);
		stringArray(value.evidence.admitted, "evidence.admitted", errors);
		stringArray(value.evidence.rejected, "evidence.rejected", errors);
		if (value.evidence.integration !== undefined)
			transitionIntegration(value.evidence.integration, errors);
	}
}

function validateTransitionAuthority(value, errors) {
	enumValue(value.policy, POLICIES, "policy", errors);
	if (!isShapeObject(value.authority)) {
		add(errors, "authority", "must be an object");
	} else {
		onlyKeys(
			value.authority,
			new Set(["owner", "standing"]),
			"authority",
			errors,
		);
		enumValue(value.authority.owner, OWNERS, "authority.owner", errors);
		if (typeof value.authority.standing !== "boolean")
			add(errors, "authority.standing", "must be boolean");
	}
}

function validateTransitionWaivers(value, errors) {
	if (!Array.isArray(value.waivers)) {
		add(errors, "waivers", "must be an array");
	} else {
		value.waivers.forEach((waiver, index) => {
			const path = `waivers[${index}]`;
			if (!isShapeObject(waiver)) {
				add(errors, path, "must be an object");
				return;
			}
			onlyKeys(waiver, new Set(["id", "expiresAt"]), path, errors);
			string(waiver.id, `${path}.id`, errors);
			if (!isDateTime(waiver.expiresAt))
				add(errors, `${path}.expiresAt`, "must be an RFC3339 date-time");
			else if (
				isDateTime(value.decidedAt) &&
				Date.parse(waiver.expiresAt) <= Date.parse(value.decidedAt)
			)
				add(errors, `${path}.expiresAt`, "must be later than decidedAt");
		});
	}
}

function validateTransitionRecovery(value, errors) {
	if (value.recovery === null) {
		if (Array.isArray(value.blockers) && value.blockers.length > 0)
			add(errors, "recovery", "must be provided when blockers are present");
	} else if (!isShapeObject(value.recovery)) {
		add(errors, "recovery", "must be an object or null");
	} else {
		onlyKeys(value.recovery, new Set(["stage", "action"]), "recovery", errors);
		enumValue(value.recovery.stage, STAGES, "recovery.stage", errors);
		string(value.recovery.action, "recovery.action", errors);
		if (value.recovery.stage !== value.toStage)
			add(errors, "recovery.stage", "must match toStage");
		if (!Array.isArray(value.blockers) || value.blockers.length === 0)
			add(errors, "blockers", "must be non-empty when recovery is provided");
	}
}

function validateTransitionRoute(value, errors) {
	if (STAGES.has(value.fromStage) && STAGES.has(value.toStage)) {
		const forward = NEXT_STAGE.get(value.fromStage) === value.toStage;
		const recovery =
			isShapeObject(value.recovery) &&
			value.blockers.length > 0 &&
			value.recovery.stage === value.toStage;
		if (!forward && !recovery)
			add(
				errors,
				"toStage",
				"must be the canonical next stage or an explicit recovery stage",
			);
	}
}

function validateStandingAuthorityPolicy(value, errors) {
	const valid =
		isShapeObject(value.authority) &&
		value.authority.owner === "codex" &&
		value.authority.standing === true;
	if (value.policy === "standing_authority" && !valid)
		add(
			errors,
			"authority",
			"standing_authority requires standing Codex authority",
		);
}

function validateVitalDecisionPolicy(value, errors) {
	const valid =
		isShapeObject(value.authority) &&
		value.authority.owner === "operator" &&
		value.authority.standing === false;
	if (value.policy === "vital_decision_gate" && !valid)
		add(
			errors,
			"authority",
			"vital_decision_gate requires non-standing operator authority",
		);
	if (
		value.policy === "vital_decision_gate" &&
		(!Array.isArray(value.blockers) || value.blockers.length === 0)
	)
		add(errors, "blockers", "must identify the Vital Decision");
}

function validateTransitionPolicy(value, errors) {
	validateStandingAuthorityPolicy(value, errors);
	validateVitalDecisionPolicy(value, errors);
}

function validateTransitionIntegration(value, errors) {
	if (value.fromStage === "review" && value.toStage === "integrate") {
		if (
			!isShapeObject(value.evidence) ||
			!Array.isArray(value.evidence.admitted) ||
			value.evidence.admitted.length === 0
		)
			add(
				errors,
				"evidence.admitted",
				"review -> integrate requires admitted review evidence",
			);
		if (
			!isShapeObject(value.evidence) ||
			value.evidence.integration === undefined
		)
			add(
				errors,
				"evidence.integration",
				"review -> integrate requires structured PR, checks, signoff, merge, and main-sync evidence",
			);
		if (value.policy !== "standing_authority")
			add(errors, "policy", "review -> integrate requires standing authority");
	}
}

function validateTransition(value) {
	const errors = [];
	if (!isShapeObject(value))
		return [{ path: "transition", message: "must be an object" }];
	validateTransitionFields(value, errors);
	validateTransitionEvidence(value, errors);
	validateTransitionAuthority(value, errors);
	validateTransitionWaivers(value, errors);
	validateTransitionRecovery(value, errors);
	validateTransitionRoute(value, errors);
	validateTransitionPolicy(value, errors);
	validateTransitionIntegration(value, errors);
	return errors;
}

function runFile(path, validator, schemaVersion) {
	if (!path) {
		process.stderr.write(
			`usage: validate-${schemaVersion}.cjs <packet.json>\n`,
		);
		process.exitCode = 2;
		return;
	}
	try {
		const value = JSON.parse(readFileSync(path, "utf8"));
		const errors = validator(value);
		process.stdout.write(
			`${JSON.stringify({ schemaVersion: `${schemaVersion}-validation/v1`, status: errors.length === 0 ? "pass" : "fail", packetPath: path, errors }, null, 2)}\n`,
		);
		process.exitCode = errors.length === 0 ? 0 : 1;
	} catch (error) {
		process.stderr.write(
			`${error instanceof Error ? error.message : String(error)}\n`,
		);
		process.exitCode = 2;
	}
}

const api = {
	CLASSIFICATIONS,
	MECHANISMS,
	add,
	enumValue,
	isDateTime,
	isShapeObject,
	onlyKeys,
	repository,
	string,
	stringArray,
	runFile,
	validateTransition,
};
module.exports = api;
const {
	validateImprovementCase,
} = require("./synaipse-improvement-case-validator.cjs");
module.exports.validateImprovementCase = validateImprovementCase;

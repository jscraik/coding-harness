const {
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
} = require("./synaipse-contract-validators.cjs");

function validateImprovementCaseFields(value, errors) {
	onlyKeys(
		value,
		new Set([
			"schemaVersion",
			"runtimeStatus",
			"repository",
			"observedAt",
			"observation",
			"classification",
			"siblingInventory",
			"candidates",
			"selectedMechanism",
			"canary",
			"measurement",
			"disposition",
			"owner",
			"retirementCondition",
		]),
		"improvementCase",
		errors,
	);
	if (value.schemaVersion !== "synaipse-improvement-case/v1")
		add(errors, "schemaVersion", "must be synaipse-improvement-case/v1");
	if (value.runtimeStatus !== "not_yet_emitted")
		add(errors, "runtimeStatus", "must be not_yet_emitted");
	repository(value.repository, errors);
	if (!isDateTime(value.observedAt))
		add(errors, "observedAt", "must be an RFC3339 date-time");
	string(value.observation, "observation", errors);
	enumValue(value.classification, CLASSIFICATIONS, "classification", errors);
}

function validateImprovementCaseInventory(value, errors) {
	if (!isShapeObject(value.siblingInventory))
		add(errors, "siblingInventory", "must be an object");
	else {
		onlyKeys(
			value.siblingInventory,
			new Set(["searched", "changed", "left", "deferred"]),
			"siblingInventory",
			errors,
		);
		for (const field of ["searched", "changed", "left", "deferred"])
			stringArray(
				value.siblingInventory[field],
				`siblingInventory.${field}`,
				errors,
				field === "searched",
			);
	}
}

function validateImprovementCaseCandidates(value, errors) {
	if (!Array.isArray(value.candidates) || value.candidates.length === 0)
		add(errors, "candidates", "must be a non-empty array");
	else
		value.candidates.forEach((candidate, index) => {
			const path = `candidates[${index}]`;
			if (!isShapeObject(candidate)) {
				add(errors, path, "must be an object");
				return;
			}
			onlyKeys(
				candidate,
				new Set(["disposition", "rationale", "rollback"]),
				path,
				errors,
			);
			enumValue(
				candidate.disposition,
				MECHANISMS,
				`${path}.disposition`,
				errors,
			);
			string(candidate.rationale, `${path}.rationale`, errors);
			string(candidate.rollback, `${path}.rollback`, errors);
		});
}

function validateImprovementCaseSelection(value, errors) {
	for (const [field, keys] of [
		["selectedMechanism", ["disposition", "rationale"]],
		["canary", ["command", "expected"]],
		["measurement", ["metric", "target"]],
	]) {
		const path = field;
		if (!isShapeObject(value[field])) {
			add(errors, path, "must be an object");
			continue;
		}
		onlyKeys(value[field], new Set(keys), path, errors);
		for (const key of keys) string(value[field][key], `${path}.${key}`, errors);
		if (field === "selectedMechanism")
			enumValue(
				value[field].disposition,
				MECHANISMS,
				`${path}.disposition`,
				errors,
			);
	}
}

function validateImprovementCaseDisposition(value, errors) {
	enumValue(value.disposition, MECHANISMS, "disposition", errors);
	string(value.owner, "owner", errors);
	string(value.retirementCondition, "retirementCondition", errors);
	if (
		isShapeObject(value.selectedMechanism) &&
		Array.isArray(value.candidates) &&
		!value.candidates.some(
			(candidate) =>
				isShapeObject(candidate) &&
				candidate.disposition === value.selectedMechanism.disposition,
		)
	)
		add(
			errors,
			"selectedMechanism.disposition",
			"must be represented in candidates",
		);
	if (
		value.disposition !== undefined &&
		isShapeObject(value.selectedMechanism) &&
		value.disposition !== value.selectedMechanism.disposition
	)
		add(errors, "disposition", "must match selectedMechanism.disposition");
}

function validateImprovementCase(value) {
	const errors = [];
	if (!isShapeObject(value))
		return [{ path: "improvementCase", message: "must be an object" }];
	validateImprovementCaseFields(value, errors);
	validateImprovementCaseInventory(value, errors);
	validateImprovementCaseCandidates(value, errors);
	validateImprovementCaseSelection(value, errors);
	validateImprovementCaseDisposition(value, errors);
	return errors;
}

module.exports = { validateImprovementCase };

import {
	PRIVACY,
	REFRESH_TRIGGERS,
	SYNAIPSE_TASK_CONTEXT_SCHEMA_VERSION,
	SynaipseContextContractError,
	contractArray,
	contractEnum,
	contractObject,
	contractString,
	contractUniqueArray,
	dateTime,
	digest,
	gitSha,
	harnessId,
	rejectUnknown,
} from "./context-contract.js";

/** Parse the digest-bound context selections frozen into a task snapshot. */
function parseSelectedRefs(value: unknown) {
	return contractUniqueArray(
		value,
		"taskContext.selectedRefs",
		(item, path) => {
			const selected = contractObject(item, path);
			rejectUnknown(selected, ["contextId", "digest"], path);
			return Object.freeze({
				contextId: harnessId(
					selected.contextId,
					"ch_context",
					`${path}.contextId`,
				),
				digest: digest(selected.digest, `${path}.digest`),
			});
		},
		(item) => item.contextId,
	);
}

/** Parse an optional-empty list whose entries must be non-blank strings. */
function parseStringList(value: unknown, path: string): readonly string[] {
	if (!Array.isArray(value))
		throw new SynaipseContextContractError(path, "must be an array");
	return Object.freeze(
		value.map((item, index) => contractString(item, `${path}[${index}]`)),
	);
}

/** Parse and freeze one immutable Admit-time task context snapshot. */
function parseTaskContext(value: unknown) {
	const snapshot = contractObject(value, "taskContext");
	rejectUnknown(
		snapshot,
		[
			"schemaVersion",
			"taskContextId",
			"projectId",
			"taskId",
			"baseSha",
			"outcome",
			"nonGoals",
			"selectedRefs",
			"proofRefs",
			"privacy",
			"vitalDecisions",
			"refreshTriggers",
			"admittedAt",
		],
		"taskContext",
	);
	if (snapshot.schemaVersion !== SYNAIPSE_TASK_CONTEXT_SCHEMA_VERSION)
		throw new SynaipseContextContractError(
			"taskContext.schemaVersion",
			`must be ${SYNAIPSE_TASK_CONTEXT_SCHEMA_VERSION}`,
		);
	const selectedRefs = parseSelectedRefs(snapshot.selectedRefs);
	return Object.freeze({
		schemaVersion: SYNAIPSE_TASK_CONTEXT_SCHEMA_VERSION,
		taskContextId: harnessId(
			snapshot.taskContextId,
			"ch_taskctx",
			"taskContext.taskContextId",
		),
		projectId: harnessId(
			snapshot.projectId,
			"ch_project",
			"taskContext.projectId",
		),
		taskId: contractString(snapshot.taskId, "taskContext.taskId"),
		baseSha: gitSha(snapshot.baseSha, "taskContext.baseSha"),
		outcome: contractString(snapshot.outcome, "taskContext.outcome"),
		nonGoals: Object.freeze(
			contractArray(snapshot.nonGoals, "taskContext.nonGoals", contractString),
		),
		selectedRefs: Object.freeze(selectedRefs),
		proofRefs: Object.freeze(
			contractArray(
				snapshot.proofRefs,
				"taskContext.proofRefs",
				contractString,
			),
		),
		privacy: contractEnum(snapshot.privacy, PRIVACY, "taskContext.privacy"),
		vitalDecisions: parseStringList(
			snapshot.vitalDecisions,
			"taskContext.vitalDecisions",
		),
		refreshTriggers: Object.freeze(
			contractUniqueArray(
				snapshot.refreshTriggers,
				"taskContext.refreshTriggers",
				(item, path) => contractEnum(item, REFRESH_TRIGGERS, path),
			),
		),
		admittedAt: dateTime(snapshot.admittedAt, "taskContext.admittedAt"),
	});
}

/** Parse an immutable task snapshot for use by context resolution. */
export function parseSynaipseTaskContext(value: unknown): SynaipseTaskContext {
	return parseTaskContext(value);
}

/** Immutable task snapshot type inferred from the parser contract. */
export type SynaipseTaskContext = ReturnType<typeof parseTaskContext>;

/** Create one validated immutable snapshot without writing it to a provider. */
export function createSynaipseTaskContext(value: unknown): SynaipseTaskContext {
	return parseSynaipseTaskContext(value);
}

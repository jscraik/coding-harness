import {
	CONTEXT_UNKNOWN_REASONS,
	SynaipseContextContractError,
	contractObject,
	digest,
	harnessId,
	rejectUnknown,
	contractEnum,
} from "./context-contract.js";

export { CONTEXT_UNKNOWN_REASONS } from "./context-contract.js";

/** Reason vocabulary for context entries that could not be resolved. */
export type ContextUnknownReason = (typeof CONTEXT_UNKNOWN_REASONS)[number];

/** Parse one logical context ID and digest projected into cockpit state. */
export function parseSynaipseContextProjection(
	value: unknown,
	path = "contextRef",
): Readonly<{ contextId: string; digest: string }> {
	const projection = contractObject(value, path);
	rejectUnknown(projection, ["contextId", "digest"], path);
	return Object.freeze({
		contextId: harnessId(
			projection.contextId,
			"ch_context",
			`${path}.contextId`,
		),
		digest: digest(projection.digest, `${path}.digest`),
	});
}

/** Logical state projection type inferred from the parser contract. */
export type SynaipseContextProjection = ReturnType<
	typeof parseSynaipseContextProjection
>;

/** Parse one optional context ref that remained unavailable with its reason. */
export function parseSynaipseContextUnknown(
	value: unknown,
	path = "contextUnknown",
) {
	const unknown = contractObject(value, path);
	rejectUnknown(unknown, ["contextId", "reason"], path);
	return Object.freeze({
		contextId: harnessId(unknown.contextId, "ch_context", `${path}.contextId`),
		reason: contractEnum(
			unknown.reason,
			CONTEXT_UNKNOWN_REASONS,
			`${path}.reason`,
		),
	});
}

/** Optional-context unknown type inferred from its parser boundary. */
export type SynaipseContextUnknown = ReturnType<
	typeof parseSynaipseContextUnknown
>;

/** Validate optional state context projections without resolving provider content. */
export function validateSynaipseContextProjections(
	value: unknown,
): ReadonlyArray<{ path: string; message: string }> {
	if (value === undefined) return [];
	if (!Array.isArray(value))
		return [{ path: "contextRefs", message: "must be an array" }];
	const errors: Array<{ path: string; message: string }> = [];
	const seenContextIds = new Set<string>();
	for (const [index, contextRef] of value.entries()) {
		try {
			const parsed = parseSynaipseContextProjection(
				contextRef,
				`contextRefs[${index}]`,
			);
			if (seenContextIds.has(parsed.contextId)) {
				errors.push({
					path: `contextRefs[${index}].contextId`,
					message: "must not duplicate an earlier context ID",
				});
			} else {
				seenContextIds.add(parsed.contextId);
			}
		} catch (error) {
			if (error instanceof SynaipseContextContractError)
				errors.push({ path: error.path, message: error.detail });
			else throw error;
		}
	}
	return errors;
}

/** Validate optional unknown context projections without resolving providers. */
export function validateSynaipseContextUnknowns(
	value: unknown,
): ReadonlyArray<{ path: string; message: string }> {
	if (value === undefined) return [];
	if (!Array.isArray(value))
		return [{ path: "contextUnknowns", message: "must be an array" }];
	const errors: Array<{ path: string; message: string }> = [];
	const seenContextIds = new Set<string>();
	for (const [index, contextUnknown] of value.entries()) {
		try {
			const parsed = parseSynaipseContextUnknown(
				contextUnknown,
				`contextUnknowns[${index}]`,
			);
			if (seenContextIds.has(parsed.contextId)) {
				errors.push({
					path: `contextUnknowns[${index}].contextId`,
					message: "must not duplicate an earlier context ID",
				});
			} else {
				seenContextIds.add(parsed.contextId);
			}
		} catch (error) {
			if (error instanceof SynaipseContextContractError)
				errors.push({ path: error.path, message: error.detail });
			else throw error;
		}
	}
	return errors;
}

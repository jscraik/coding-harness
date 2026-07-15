import {
	SynaipseContextContractError,
	contractEnum,
	contractObject,
	digest,
	harnessId,
	rejectUnknown,
} from "./context-contract.js";

/** Provider observation status emitted by a read-only context resolver. */
export type SynaipseContextObservation = {
	contextId: string;
	status:
		| "available"
		| "unavailable"
		| "provider_unavailable"
		| "unresolved_host_path";
	digest: string | null;
};

/** Parse provider observations and reject conflicting duplicates. */
export function parseSynaipseContextObservations(
	value: unknown,
): SynaipseContextObservation[] {
	if (!Array.isArray(value))
		throw new SynaipseContextContractError(
			"resolution.observations",
			"must be an array",
		);
	const observations = value.map((item, index) => {
		const path = `resolution.observations[${index}]`;
		const observation = contractObject(item, path);
		rejectUnknown(observation, ["contextId", "status", "digest"], path);
		const status = contractEnum(
			observation.status,
			[
				"available",
				"unavailable",
				"provider_unavailable",
				"unresolved_host_path",
			] as const,
			`${path}.status`,
		);
		if (status !== "available" && observation.digest !== undefined)
			throw new SynaipseContextContractError(
				`${path}.digest`,
				"must be absent unless status is available",
			);
		return {
			contextId: harnessId(
				observation.contextId,
				"ch_context",
				`${path}.contextId`,
			),
			status,
			digest:
				status === "available"
					? digest(observation.digest, `${path}.digest`)
					: null,
		};
	});
	const observedIds = new Set<string>();
	for (const [index, observation] of observations.entries()) {
		if (observedIds.has(observation.contextId))
			throw new SynaipseContextContractError(
				`resolution.observations[${index}].contextId`,
				"must not duplicate an earlier observation",
			);
		observedIds.add(observation.contextId);
	}
	return observations;
}

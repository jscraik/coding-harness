import {
	AUTHORITIES,
	CONSUMERS,
	CONTEXT_KINDS,
	DESTINATIONS,
	LIFECYCLE,
	PRIVACY,
	REQUIREMENTS,
	STAGES,
	SynaipseContextContractError,
	contractEnum,
	contractObject,
	contractUniqueArray,
	dateTime,
	digest,
	harnessId,
	rejectUnknown,
	repositorySlug,
} from "./context-contract.js";
import { parseSynaipseContextProvider } from "./context-provider.js";
import { synaipsePrivacyBlocks } from "./context-privacy.js";
import {
	parseSynaipseContextProjection,
	type SynaipseContextProjection,
} from "./context-projection.js";
import { parseSynaipseContextObservations } from "./context-observations.js";
import { parseSynaipseTaskContext } from "./context-task.js";

export { SynaipseContextContractError } from "./context-contract.js";
export {
	createSynaipseTaskContext,
	type SynaipseTaskContext,
} from "./context-task.js";
export {
	parseSynaipseContextProjection,
	type SynaipseContextProjection,
	validateSynaipseContextProjections,
} from "./context-projection.js";

/** Parse privacy classification plus explicit consumers and destinations. */
function parsePrivacy(value: unknown, path: string) {
	const privacy = contractObject(value, path);
	rejectUnknown(
		privacy,
		["classification", "allowedConsumers", "prohibitedDestinations"],
		path,
	);
	if (!Array.isArray(privacy.prohibitedDestinations))
		throw new SynaipseContextContractError(
			`${path}.prohibitedDestinations`,
			"must be an array",
		);
	return {
		classification: contractEnum(
			privacy.classification,
			PRIVACY,
			`${path}.classification`,
		),
		allowedConsumers: contractUniqueArray(
			privacy.allowedConsumers,
			`${path}.allowedConsumers`,
			(item, itemPath) => contractEnum(item, CONSUMERS, itemPath),
		),
		prohibitedDestinations: contractUniqueArray(
			privacy.prohibitedDestinations,
			`${path}.prohibitedDestinations`,
			(item, itemPath) => contractEnum(item, DESTINATIONS, itemPath),
		),
	};
}

/** Parse lifecycle metadata and bind superseded refs to their replacement. */
function parseLifecycle(value: unknown, path: string) {
	const lifecycle = contractObject(value, path);
	rejectUnknown(lifecycle, ["status", "supersededBy"], path);
	const status = contractEnum(lifecycle.status, LIFECYCLE, `${path}.status`);
	const supersededBy =
		lifecycle.supersededBy === null
			? null
			: harnessId(lifecycle.supersededBy, "ch_context", `${path}.supersededBy`);
	if (status === "superseded" && supersededBy === null)
		throw new SynaipseContextContractError(
			`${path}.supersededBy`,
			"must identify the replacement for superseded context",
		);
	if (status !== "superseded" && supersededBy !== null)
		throw new SynaipseContextContractError(
			`${path}.supersededBy`,
			"must be null unless context is superseded",
		);
	return { status, supersededBy };
}

/** Parse one versioned context reference before selection. */
function parseContextRef(value: unknown, path: string) {
	const ref = contractObject(value, path);
	rejectUnknown(
		ref,
		[
			"schemaVersion",
			"contextId",
			"kind",
			"authority",
			"privacy",
			"lifecycle",
			"stages",
			"requirement",
			"provider",
			"digest",
			"freshness",
		],
		path,
	);
	if (ref.schemaVersion !== "synaipse-context-ref/v1")
		throw new SynaipseContextContractError(
			`${path}.schemaVersion`,
			"must be synaipse-context-ref/v1",
		);
	const freshness = contractObject(ref.freshness, `${path}.freshness`);
	rejectUnknown(freshness, ["observedAt", "expiresAt"], `${path}.freshness`);
	return {
		schemaVersion: "synaipse-context-ref/v1" as const,
		contextId: harnessId(ref.contextId, "ch_context", `${path}.contextId`),
		kind: contractEnum(ref.kind, CONTEXT_KINDS, `${path}.kind`),
		authority: contractEnum(ref.authority, AUTHORITIES, `${path}.authority`),
		privacy: parsePrivacy(ref.privacy, `${path}.privacy`),
		lifecycle: parseLifecycle(ref.lifecycle, `${path}.lifecycle`),
		stages: contractUniqueArray(
			ref.stages,
			`${path}.stages`,
			(item, itemPath) => contractEnum(item, STAGES, itemPath),
		),
		requirement: contractEnum(
			ref.requirement,
			REQUIREMENTS,
			`${path}.requirement`,
		),
		provider: parseSynaipseContextProvider(ref.provider, `${path}.provider`),
		digest: digest(ref.digest, `${path}.digest`),
		freshness: {
			observedAt: dateTime(
				freshness.observedAt,
				`${path}.freshness.observedAt`,
			),
			expiresAt:
				freshness.expiresAt === null
					? null
					: dateTime(freshness.expiresAt, `${path}.freshness.expiresAt`),
		},
	};
}

type ContextRef = ReturnType<typeof parseContextRef>;

/** Parse catalog metadata while keeping document bodies outside the contract. */
function parseCatalog(value: unknown) {
	const catalog = contractObject(value, "catalog");
	rejectUnknown(
		catalog,
		["schemaVersion", "catalogId", "projectId", "repository", "refs"],
		"catalog",
	);
	if (catalog.schemaVersion !== "synaipse-context-catalog/v1")
		throw new SynaipseContextContractError(
			"catalog.schemaVersion",
			"must be synaipse-context-catalog/v1",
		);
	return {
		schemaVersion: "synaipse-context-catalog/v1" as const,
		catalogId: harnessId(catalog.catalogId, "ch_catalog", "catalog.catalogId"),
		projectId: harnessId(catalog.projectId, "ch_project", "catalog.projectId"),
		repository: repositorySlug(catalog.repository, "catalog.repository"),
		refs: contractUniqueArray(
			catalog.refs,
			"catalog.refs",
			parseContextRef,
			(ref) => ref.contextId,
		),
	};
}

/** Parse one read-only resolution request and provider observation set. */
function parseResolutionInput(value: unknown) {
	const input = contractObject(value, "resolution");
	rejectUnknown(
		input,
		[
			"catalog",
			"taskContext",
			"acceptedAuthorities",
			"stage",
			"consumer",
			"destination",
			"observedAt",
			"observations",
		],
		"resolution",
	);
	const catalog = parseCatalog(input.catalog);
	const taskContext = parseSynaipseTaskContext(input.taskContext);
	if (taskContext.projectId !== catalog.projectId)
		throw new SynaipseContextContractError(
			"resolution.taskContext.projectId",
			"must match catalog.projectId",
		);
	const observedAt = dateTime(input.observedAt, "resolution.observedAt");
	if (Date.parse(taskContext.admittedAt) > Date.parse(observedAt))
		throw new SynaipseContextContractError(
			"resolution.taskContext.admittedAt",
			"must not be later than resolution.observedAt",
		);
	return {
		catalog,
		taskContext,
		acceptedAuthorities: contractUniqueArray(
			input.acceptedAuthorities,
			"resolution.acceptedAuthorities",
			(item, path) => contractEnum(item, AUTHORITIES, path),
		),
		stage: contractEnum(input.stage, STAGES, "resolution.stage"),
		consumer: contractEnum(input.consumer, CONSUMERS, "resolution.consumer"),
		destination: contractEnum(
			input.destination,
			DESTINATIONS,
			"resolution.destination",
		),
		observedAt,
		observations: parseSynaipseContextObservations(input.observations),
	};
}

const PURE_READ_EFFECTS = Object.freeze({
	writesFiles: false,
	mutatesGit: false,
	mutatesExternal: false,
});
type ContextBlockerCode =
	| "access_denied"
	| "historical_context"
	| "missing_context"
	| "provider_unavailable"
	| "stale_digest"
	| "superseded_context"
	| "unresolved_host_path";
type ContextUnknownReason =
	| "missing_context"
	| "provider_unavailable"
	| "unresolved_host_path";

/** Build one deterministic context-selection blocker and recovery. */
function contextBlocker(code: ContextBlockerCode, contextId: string) {
	return {
		code,
		contextId,
		recovery: {
			access_denied: "request_authorized_projection",
			historical_context: "select_current_context",
			missing_context: "refresh_context_provider",
			provider_unavailable: "restore_context_provider",
			stale_digest: "refresh_context_digest",
			superseded_context: "select_replacement_context",
			unresolved_host_path: "resolve_context_host_path",
		}[code],
	};
}

/** Return the first policy blocker for an applicable context ref. */
function policyBlocker(
	ref: ContextRef,
	input: ReturnType<typeof parseResolutionInput>,
): ContextBlockerCode | null {
	if (ref.lifecycle.status === "superseded") return "superseded_context";
	if (ref.lifecycle.status === "historical") return "historical_context";
	if (!input.acceptedAuthorities.includes(ref.authority))
		return "access_denied";
	if (
		synaipsePrivacyBlocks(
			ref.kind,
			ref.privacy.classification,
			ref.privacy.allowedConsumers,
			ref.privacy.prohibitedDestinations,
			input.taskContext.privacy,
			input.consumer,
			input.destination,
		)
	)
		return "access_denied";
	if (Date.parse(ref.freshness.observedAt) > Date.parse(input.observedAt))
		return "stale_digest";
	if (
		ref.freshness.expiresAt !== null &&
		Date.parse(ref.freshness.expiresAt) <= Date.parse(input.observedAt)
	)
		return "stale_digest";
	return null;
}

type RefResolution =
	| { kind: "skip" | "selected" }
	| { kind: "unknown"; reason: ContextUnknownReason }
	| { kind: "blocked"; code: ContextBlockerCode };

/** Resolve provider evidence after stage, task, authority, and privacy checks pass. */
function resolveObservation(
	ref: ContextRef,
	admittedDigest: string,
	input: ReturnType<typeof parseResolutionInput>,
): RefResolution {
	const observation = input.observations.find(
		(candidate) => candidate.contextId === ref.contextId,
	);
	if (!observation || observation.status === "unavailable")
		return ref.requirement === "required"
			? { kind: "blocked", code: "missing_context" }
			: { kind: "unknown", reason: "missing_context" };
	if (observation.status === "provider_unavailable")
		return ref.requirement === "required"
			? { kind: "blocked", code: "provider_unavailable" }
			: { kind: "unknown", reason: "provider_unavailable" };
	if (observation.status === "unresolved_host_path")
		return ref.requirement === "required"
			? { kind: "blocked", code: "unresolved_host_path" }
			: { kind: "unknown", reason: "unresolved_host_path" };
	if (admittedDigest !== ref.digest || observation.digest !== ref.digest)
		return { kind: "blocked", code: "stale_digest" };
	return { kind: "selected" };
}

/** Resolve one stage-applicable catalog ref against task admission and evidence. */
function resolveRef(
	ref: ContextRef,
	input: ReturnType<typeof parseResolutionInput>,
): RefResolution {
	if (!ref.stages.includes(input.stage)) return { kind: "skip" };
	const admitted = input.taskContext.selectedRefs.find(
		(candidate) => candidate.contextId === ref.contextId,
	);
	if (!admitted) return { kind: "skip" };
	const policy = policyBlocker(ref, input);
	if (policy) return { kind: "blocked", code: policy };
	return resolveObservation(ref, admitted.digest, input);
}

/** Resolve admitted context through metadata and supplied provider observations only. */
export function resolveSynaipseContext(value: unknown) {
	const input = parseResolutionInput(value);
	const selectedContextIds: string[] = [];
	const selectedRefs: SynaipseContextProjection[] = [];
	const unknownContextIds: string[] = [];
	const unknowns: Array<{ contextId: string; reason: ContextUnknownReason }> =
		[];
	const blockers: Array<ReturnType<typeof contextBlocker>> = [];
	for (const ref of input.catalog.refs) {
		const resolution = resolveRef(ref, input);
		if (resolution.kind === "skip") continue;
		if (resolution.kind === "blocked")
			blockers.push(contextBlocker(resolution.code, ref.contextId));
		else if (resolution.kind === "unknown") {
			unknownContextIds.push(ref.contextId);
			unknowns.push({ contextId: ref.contextId, reason: resolution.reason });
		} else {
			selectedContextIds.push(ref.contextId);
			selectedRefs.push(
				parseSynaipseContextProjection({
					contextId: ref.contextId,
					digest: ref.digest,
				}),
			);
		}
	}
	for (const admitted of input.taskContext.selectedRefs) {
		if (!input.catalog.refs.some((ref) => ref.contextId === admitted.contextId))
			blockers.push(contextBlocker("missing_context", admitted.contextId));
	}
	return {
		status:
			blockers.length === 0 ? ("resolved" as const) : ("blocked" as const),
		selectedContextIds,
		selectedRefs,
		unknownContextIds,
		unknowns,
		catalogRepository: input.catalog.repository,
		blockers,
		effects: PURE_READ_EFFECTS,
	};
}

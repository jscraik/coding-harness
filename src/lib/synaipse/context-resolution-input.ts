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
import { parseSynaipseContextObservations } from "./context-observations.js";
import { parseSynaipseTaskContext } from "./context-task.js";

/** Parse privacy metadata and enforce its explicit consumer boundary. */
function parsePrivacy(value: unknown, path: string) {
	const privacy = contractObject(value, path);
	rejectUnknown(
		privacy,
		["classification", "allowedConsumers", "prohibitedDestinations"],
		path,
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

/** Parse lifecycle metadata and bind superseded refs to replacements. */
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

/** The normalized reference shape consumed by context resolution. */
export type ContextRef = ReturnType<typeof parseContextRef>;

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
export function parseResolutionInput(value: unknown) {
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

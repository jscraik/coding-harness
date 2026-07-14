import { isRecord } from "../decision/validators.js";
import { isRfc3339DateTime } from "./date-time.js";

/** Version tag for the immutable Admit-time task-context contract. */
export const SYNAIPSE_TASK_CONTEXT_SCHEMA_VERSION =
	"synaipse-task-context/v1" as const;

/** Allowed semantic kinds for catalogued context references. */
export const CONTEXT_KINDS = [
	"operator_intent",
	"project_direction",
	"taste_example",
	"accepted_decision",
	"specification",
	"implementation_plan",
	"task_snapshot",
	"research_index",
	"source_evidence",
	"review_learning",
	"delivery_receipt",
	"historical_provenance",
	"public_safe_proof",
	"private_context",
] as const;
/** Authorities that may attest or admit a context reference. */
export const AUTHORITIES = [
	"operator_intent",
	"repository_authority",
	"accepted_task_contract",
	"work_ownership",
	"architecture_decision",
	"supporting_evidence",
	"runtime_evidence",
	"historical_provenance",
	"generated_projection",
] as const;
/** Privacy classifications used to constrain context consumers and destinations. */
export const PRIVACY = [
	"public",
	"internal",
	"confidential",
	"restricted",
] as const;
/** Lifecycle stages at which a context reference may be selected. */
export const STAGES = [
	"shape",
	"admit",
	"build",
	"prove",
	"review",
	"integrate",
	"improve",
] as const;
/** Consumers permitted to resolve a context reference. */
export const CONSUMERS = ["local_agent", "remote_agent", "hosted_ci"] as const;
/** Destinations that receive resolved logical context metadata. */
export const DESTINATIONS = [
	"local_task",
	"private_artifact",
	"public_pr",
	"hosted_ci",
] as const;
/** Whether a context reference must resolve or may remain unknown. */
export const REQUIREMENTS = ["required", "optional"] as const;
/** Lifecycle status values for context references. */
export const LIFECYCLE = ["current", "superseded", "historical"] as const;
/** Provider kinds that may hold context bodies outside the contract boundary. */
export const PROVIDERS = [
	"repository",
	"filesystem",
	"connector",
	"plugin",
	"app",
] as const;
/** Events that invalidate a task-context snapshot and require refresh. */
export const REFRESH_TRIGGERS = [
	"context_digest_changed",
	"base_sha_changed",
	"authority_changed",
	"privacy_changed",
	"lifecycle_changed",
] as const;

/** Reasons emitted when optional context cannot be resolved. */
export const CONTEXT_UNKNOWN_REASONS = [
	"missing_context",
	"provider_unavailable",
	"unresolved_host_path",
] as const;

/** Contract error raised before untrusted context metadata reaches domain logic. */
export class SynaipseContextContractError extends Error {
	constructor(
		readonly path: string,
		readonly detail: string,
	) {
		super(`${path}: ${detail}`);
		this.name = "SynaipseContextContractError";
	}
}

/** Require one object at the declared SynAIpse context-contract boundary. */
export function contractObject(
	value: unknown,
	path: string,
): Record<string, unknown> {
	if (!isRecord(value))
		throw new SynaipseContextContractError(path, "must be an object");
	return value;
}

/** Reject fields not declared by the versioned context contract. */
export function rejectUnknown(
	value: Record<string, unknown>,
	allowed: readonly string[],
	path: string,
): void {
	for (const key of Object.keys(value))
		if (!allowed.includes(key))
			throw new SynaipseContextContractError(
				`${path}.${key}`,
				"must not contain unknown properties",
			);
}

/** Parse a required non-blank contract string. */
export function contractString(value: unknown, path: string): string {
	if (typeof value !== "string" || value.trim() === "")
		throw new SynaipseContextContractError(path, "must be a non-empty string");
	return value;
}

/** Parse one canonical owner/repository slug without accepting URL syntax. */
export function repositorySlug(value: unknown, path: string): string {
	const candidate = contractString(value, path);
	const segments = candidate.split("/");
	const alphabet =
		"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._";
	if (
		segments.length !== 2 ||
		segments.some(
			(segment) =>
				segment.length === 0 ||
				![...segment].every((character) => alphabet.includes(character)),
		)
	)
		throw new SynaipseContextContractError(
			path,
			"must use the canonical owner/repository slug",
		);
	return candidate;
}

/** Parse a required finite-vocabulary string. */
export function contractEnum<const T extends readonly string[]>(
	value: unknown,
	allowed: T,
	path: string,
): T[number] {
	const candidate = contractString(value, path);
	if (!allowed.includes(candidate))
		throw new SynaipseContextContractError(
			path,
			`must be one of ${allowed.join(", ")}`,
		);
	return candidate as T[number];
}

/** Parse a required non-empty list through a field-specific item parser. */
export function contractArray<T>(
	value: unknown,
	path: string,
	parseItem: (item: unknown, path: string) => T,
): T[] {
	if (!Array.isArray(value) || value.length === 0)
		throw new SynaipseContextContractError(path, "must be a non-empty array");
	return value.map((item, index) => parseItem(item, `${path}[${index}]`));
}

/** Parse a required non-empty list and reject duplicate normalized values. */
export function contractUniqueArray<T>(
	value: unknown,
	path: string,
	parseItem: (item: unknown, path: string) => T,
	identity: (item: T) => string = String,
): T[] {
	const parsed = contractArray(value, path, parseItem);
	const seen = new Set<string>();
	for (const [index, item] of parsed.entries()) {
		const key = identity(item);
		if (seen.has(key))
			throw new SynaipseContextContractError(
				`${path}[${index}]`,
				"must not duplicate an earlier item",
			);
		seen.add(key);
	}
	return parsed;
}

/** Parse a type-prefixed, operator-visible harness identifier. */
export function harnessId(
	value: unknown,
	prefix: string,
	path: string,
): string {
	const candidate = contractString(value, path);
	const boundary = `${prefix}_`;
	const alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
	const opaque = candidate.startsWith(boundary)
		? candidate.slice(boundary.length)
		: "";
	if (
		opaque.length !== 12 ||
		![...opaque].every((character) => alphabet.includes(character))
	)
		throw new SynaipseContextContractError(
			path,
			`must use ${boundary}<12-character human-safe token>`,
		);
	return candidate;
}

/** Parse one SHA-256 digest without delegating domain validity to a regex. */
export function digest(value: unknown, path: string): string {
	const candidate = contractString(value, path);
	const payload = candidate.startsWith("sha256:") ? candidate.slice(7) : "";
	const hex = "0123456789abcdef";
	if (
		payload.length !== 64 ||
		![...payload].every((character) => hex.includes(character))
	)
		throw new SynaipseContextContractError(
			path,
			"must be a lowercase sha256 digest",
		);
	return candidate;
}

/** Parse one full Git object ID without accepting descriptive placeholders. */
export function gitSha(value: unknown, path: string): string {
	const candidate = contractString(value, path);
	const hex = "0123456789abcdef";
	if (
		candidate.length !== 40 ||
		![...candidate].every((character) => hex.includes(character))
	)
		throw new SynaipseContextContractError(
			path,
			"must be a 40-character lowercase Git SHA",
		);
	return candidate;
}

/** Parse one RFC3339 timestamp with strict calendar validation. */
export function dateTime(value: unknown, path: string): string {
	if (!isRfc3339DateTime(value))
		throw new SynaipseContextContractError(
			path,
			"must be an RFC3339 date-time",
		);
	return value;
}

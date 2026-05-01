import {
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";

import {
	NORTH_STAR_ARTIFACT_SCHEMA_VERSIONS,
	NORTH_STAR_OVERRIDE_ROOT,
	createNorthStarGuardrailId,
	getNorthStarDurableGuardrailPath,
	getNorthStarOverrideAcknowledgementPath,
} from "./north-star-artifacts.js";
import type { OverrideReviewerRegistry } from "./types.js";

/**
 * Canonical durable guardrail artifact shape.
 *
 * @see docs/specs/2026-04-20-feat-north-star-contract-product-surface-realignment-spec.md
 */
export interface DurableGuardrail {
	schemaVersion: typeof NORTH_STAR_ARTIFACT_SCHEMA_VERSIONS.durableGuardrail;
	guardrailId: string;
	failureClass: string;
	triggeredByFindingIds: string[];
	recurrenceCount: number;
	createdAtUtc: string;
	owner: string;
	implementationTarget: string;
	status: "proposed" | "implemented";
}

/**
 * Canonical override acknowledgement artifact shape.
 */
export interface OverrideAcknowledgement {
	schemaVersion: typeof NORTH_STAR_ARTIFACT_SCHEMA_VERSIONS.overrideAcknowledgement;
	overrideId: string;
	timestampUtc: string;
	actor: string;
	reason: string;
	linkedFindingIds: string[];
	approvedUntilUtc: string;
	compensatingControls: string[];
	signatureRef: string;
}

/** Result of resolving a guardrail recurrence. */
export interface GuardrailRecurrenceResult {
	/** Whether a guardrail already exists for this failure class + surface set */
	exists: boolean;
	/** Current recurrence count (0 if no guardrail exists) */
	recurrenceCount: number;
	/** The deterministic guardrailId for this recurrence */
	guardrailId: string;
}

/** Result of validating an override acknowledgement. */
export interface OverrideValidationResult {
	valid: boolean;
	/** Human-readable reason when validation fails */
	reason?: string;
}

/**
 * Reads and parses a JSON file at the given filesystem path and returns its parsed contents when available.
 *
 * @param path - Path to the JSON file to read
 * @returns The parsed JSON value from the file, or `undefined` if the file does not exist or cannot be read/parsed
 */
function safeReadJson<T>(path: string): T | undefined {
	if (!existsSync(path)) {
		return undefined;
	}
	try {
		return JSON.parse(readFileSync(path, "utf-8")) as T;
	} catch {
		return undefined;
	}
}

function readJsonWithParseError<T>(
	path: string,
): { value: T } | { error: "missing" | "invalid_json" } {
	if (!existsSync(path)) {
		return { error: "missing" };
	}
	try {
		return { value: JSON.parse(readFileSync(path, "utf-8")) as T };
	} catch {
		return { error: "invalid_json" };
	}
}

function readJsonForValidation<T>(
	path: string,
): { value: T } | { error: string } {
	if (!existsSync(path)) {
		return { error: "missing" };
	}
	try {
		return { value: JSON.parse(readFileSync(path, "utf-8")) as T };
	} catch {
		return { error: "invalid_json" };
	}
}

/**
 * Determine whether a durable guardrail artifact exists for the given failure class and surface IDs and return its recurrence state.
 *
 * @param repoRoot - Repository root used to resolve artifact paths
 * @param failureClass - Spec-aligned failure class
 * @param surfaceIds - Governed surface IDs that identify the recurrence scope
 * @returns An object with `exists` (`true` if a durable guardrail artifact was found, `false` otherwise), `recurrenceCount` (the recorded recurrence count or `0` when not found), and `guardrailId` (the deterministic identifier for the guardrail)
 */
export function resolveGuardrailRecurrence(
	repoRoot: string,
	failureClass: string,
	surfaceIds: readonly string[],
): GuardrailRecurrenceResult {
	const guardrailId = createNorthStarGuardrailId({ failureClass, surfaceIds });
	const artifactPath = getNorthStarDurableGuardrailPath(
		failureClass,
		guardrailId,
	);
	const resolvedPath = join(repoRoot, artifactPath);
	const existingGuardrail =
		readJsonWithParseError<DurableGuardrail>(resolvedPath);
	if ("error" in existingGuardrail) {
		if (existingGuardrail.error === "invalid_json") {
			throw new Error(
				`Durable guardrail artifact is invalid JSON: ${artifactPath}`,
			);
		}
	} else {
		return {
			exists: true,
			recurrenceCount: existingGuardrail.value.recurrenceCount,
			guardrailId,
		};
	}
	return { exists: false, recurrenceCount: 0, guardrailId };
}

/**
 * Write a durable guardrail artifact to the canonical north-star guardrail path.
 *
 * @param repoRoot - Repository root used to resolve the artifact path
 * @param guardrail - Guardrail data to persist
 * @returns The relative artifact path written
 */
export function writeNorthStarDurableGuardrail(
	repoRoot: string,
	guardrail: DurableGuardrail,
): string {
	const artifactPath = getNorthStarDurableGuardrailPath(
		guardrail.failureClass,
		guardrail.guardrailId,
	);
	const resolvedPath = join(repoRoot, artifactPath);
	mkdirSync(dirname(resolvedPath), { recursive: true });
	writeFileSync(
		resolvedPath,
		`${JSON.stringify(guardrail, null, 2)}\n`,
		"utf-8",
	);
	return artifactPath;
}

/**
 * Read a durable guardrail artifact from the canonical path.
 *
 * @param repoRoot - Repository root used to resolve the artifact path
 * @param failureClass - Failure class used in the path
 * @param guardrailId - Guardrail identifier
 * @returns The guardrail data, or undefined if not found or unreadable
 */
export function readNorthStarDurableGuardrail(
	repoRoot: string,
	failureClass: string,
	guardrailId: string,
): DurableGuardrail | undefined {
	const artifactPath = getNorthStarDurableGuardrailPath(
		failureClass,
		guardrailId,
	);
	return safeReadJson<DurableGuardrail>(join(repoRoot, artifactPath));
}

/**
 * List all durable guardrail artifacts under the canonical north-star guardrail root.
 *
 * @param repoRoot - Repository root used to resolve paths
 * @yields Each guardrail with its relative path
 */
export function* listNorthStarDurableGuardrails(
	repoRoot: string,
): Generator<{ guardrail: DurableGuardrail; path: string }> {
	const guardrailRoot = join(repoRoot, ".harness/guardrails/north-star");
	if (!existsSync(guardrailRoot)) return;
	for (const failureClass of readdirSync(guardrailRoot)) {
		const classDir = join(guardrailRoot, failureClass);
		if (!existsSync(classDir)) continue;
		for (const file of readdirSync(classDir)) {
			if (!file.endsWith(".json")) continue;
			const path = join(classDir, file);
			const guardrail = safeReadJson<DurableGuardrail>(path);
			if (guardrail) {
				yield { guardrail, path: relative(repoRoot, path) };
			}
		}
	}
}

/**
 * Write an override acknowledgement artifact to the canonical path.
 *
 * @param repoRoot - Repository root used to resolve the artifact path
 * @param date - Date partition in `YYYY-MM-DD` format
 * @param overrideId - Stable override identifier
 * @param acknowledgement - Override data to persist
 * @returns The relative artifact path written
 */
export function writeNorthStarOverrideAcknowledgement(
	repoRoot: string,
	date: string,
	overrideId: string,
	acknowledgement: OverrideAcknowledgement,
): string {
	if (
		date.includes("..") ||
		overrideId.includes("..") ||
		date.startsWith("/") ||
		overrideId.startsWith("/")
	) {
		throw new Error("Invalid override path segment");
	}
	const artifactPath = getNorthStarOverrideAcknowledgementPath(
		date,
		overrideId,
	);
	const resolvedPath = join(repoRoot, artifactPath);
	mkdirSync(dirname(resolvedPath), { recursive: true });
	writeFileSync(
		resolvedPath,
		`${JSON.stringify(acknowledgement, null, 2)}\n`,
		"utf-8",
	);
	return artifactPath;
}

/**
 * Read an override acknowledgement artifact from the canonical path.
 *
 * @param repoRoot - Repository root used to resolve the artifact path
 * @param date - Date partition in `YYYY-MM-DD` format
 * @param overrideId - Stable override identifier
 * @returns The acknowledgement data, or undefined if not found or unreadable
 */
export function readNorthStarOverrideAcknowledgement(
	repoRoot: string,
	date: string,
	overrideId: string,
): OverrideAcknowledgement | undefined {
	const artifactPath = getNorthStarOverrideAcknowledgementPath(
		date,
		overrideId,
	);
	return safeReadJson<OverrideAcknowledgement>(join(repoRoot, artifactPath));
}

/**
 * Validate an override acknowledgement against the trusted reviewer registry.
 *
 * Fail-closed: missing artifact, expired approval, empty/inactive linkedFindingIds,
 * unknown/revoked signatureRef, or ambiguous reviewer match all return `valid: false`.
 *
 * @param repoRoot - Repository root used to resolve the artifact path
 * @param date - Date partition in `YYYY-MM-DD` format
 * @param overrideId - Stable override identifier
 * @param options - Validation options including trusted reviewer registry and current time
 * @returns Validation result; `valid: false` with a reason when any check fails
 */
export function validateOverrideAcknowledgement(
	repoRoot: string,
	date: string,
	overrideId: string,
	options: {
		registry: OverrideReviewerRegistry;
		referenceDate?: Date;
		activeFindingIds?: string[];
	},
): OverrideValidationResult {
	const artifactPath = getNorthStarOverrideAcknowledgementPath(
		date,
		overrideId,
	);
	const resolvedPath = join(repoRoot, artifactPath);
	const parsedAcknowledgement =
		readJsonForValidation<OverrideAcknowledgement>(resolvedPath);
	if ("error" in parsedAcknowledgement) {
		if (parsedAcknowledgement.error === "missing") {
			return {
				valid: false,
				reason: "Override acknowledgement artifact not found",
			};
		}
		return {
			valid: false,
			reason: "Override acknowledgement artifact is not valid JSON",
		};
	}
	const acknowledgement = parsedAcknowledgement.value;
	if (
		acknowledgement.schemaVersion !==
		NORTH_STAR_ARTIFACT_SCHEMA_VERSIONS.overrideAcknowledgement
	) {
		return {
			valid: false,
			reason:
				"Override acknowledgement schemaVersion does not match canonical override schema",
		};
	}
	if (
		typeof acknowledgement.actor !== "string" ||
		acknowledgement.actor.trim().length === 0
	) {
		return {
			valid: false,
			reason: "Override acknowledgement actor is required",
		};
	}
	if (
		typeof acknowledgement.signatureRef !== "string" ||
		acknowledgement.signatureRef.trim().length === 0
	) {
		return {
			valid: false,
			reason: "Override acknowledgement signatureRef is required",
		};
	}
	if (
		!Array.isArray(acknowledgement.linkedFindingIds) ||
		acknowledgement.linkedFindingIds.length === 0 ||
		!acknowledgement.linkedFindingIds.every(
			(id) => typeof id === "string" && id.trim().length > 0,
		)
	) {
		return {
			valid: false,
			reason: "Override acknowledgement has no linked finding IDs",
		};
	}
	const referenceDate = options.referenceDate ?? new Date();
	const approvedUntil = Date.parse(acknowledgement.approvedUntilUtc);
	if (Number.isNaN(approvedUntil) || approvedUntil <= referenceDate.getTime()) {
		return { valid: false, reason: "Override approval has expired" };
	}
	if (options.activeFindingIds) {
		const activeFindingIds = options.activeFindingIds;
		const allLinkedActive = acknowledgement.linkedFindingIds.every((id) =>
			activeFindingIds.includes(id),
		);
		if (!allLinkedActive) {
			return {
				valid: false,
				reason: "One or more linked findings are no longer active",
			};
		}
	}
	const matchingReviewers = options.registry.trustedReviewers.filter(
		(r) => r.signatureRef === acknowledgement.signatureRef,
	);
	if (matchingReviewers.length === 0) {
		return {
			valid: false,
			reason:
				"Override signatureRef does not resolve to an active trusted reviewer",
		};
	}
	if (matchingReviewers.length > 1) {
		return {
			valid: false,
			reason: "Override signatureRef resolves to multiple trusted reviewers",
		};
	}
	if (matchingReviewers[0]?.status !== "active") {
		return {
			valid: false,
			reason:
				"Override signatureRef does not resolve to an active trusted reviewer",
		};
	}
	if (matchingReviewers[0]?.reviewerId !== acknowledgement.actor) {
		return {
			valid: false,
			reason:
				"Override actor must match the trusted reviewer referenced by signatureRef",
		};
	}
	return { valid: true };
}

/**
 * Scan the canonical override directory and return every (date, overrideId) pair
 * found on disk.
 *
 * @param repoRoot - Repository root used to resolve the override directory
 * @returns Array of { date, overrideId } entries
 */
export function listNorthStarOverrideAcknowledgements(repoRoot: string): {
	date: string;
	overrideId: string;
}[] {
	const root = join(repoRoot, NORTH_STAR_OVERRIDE_ROOT);
	if (!existsSync(root)) return [];

	const entries: { date: string; overrideId: string }[] = [];
	for (const date of readdirSync(root, { withFileTypes: true })) {
		if (!date.isDirectory()) continue;
		const dateDir = join(root, date.name);
		for (const overrideId of readdirSync(dateDir, { withFileTypes: true })) {
			if (!overrideId.isDirectory()) continue;
			entries.push({ date: date.name, overrideId: overrideId.name });
		}
	}
	return entries;
}

/**
 * Resolve all active override acknowledgements and return the union of their
 * linked finding IDs.
 *
 * Scans the override directory, validates each acknowledgement against the
 * trusted reviewer registry, and collects `linkedFindingIds` from every valid
 * override.
 *
 * @param repoRoot - Repository root used to resolve override paths
 * @param registry - Trusted reviewer registry for signature validation
 * @param options - Optional reference date and active finding IDs for validation
 * @returns Set of finding IDs that have active, valid overrides
 */
export function resolveActiveOverrides(
	repoRoot: string,
	registry: OverrideReviewerRegistry,
	options?: {
		referenceDate?: Date;
		activeFindingIds?: string[];
	},
): Set<string> {
	const activeFindingIds = new Set<string>();
	for (const { date, overrideId } of listNorthStarOverrideAcknowledgements(
		repoRoot,
	)) {
		const validation = validateOverrideAcknowledgement(
			repoRoot,
			date,
			overrideId,
			{
				registry,
				...(options?.referenceDate !== undefined
					? { referenceDate: options.referenceDate }
					: {}),
				...(options?.activeFindingIds !== undefined
					? { activeFindingIds: options.activeFindingIds }
					: {}),
			},
		);
		if (validation.valid) {
			const acknowledgement = readNorthStarOverrideAcknowledgement(
				repoRoot,
				date,
				overrideId,
			);
			if (acknowledgement) {
				for (const id of acknowledgement.linkedFindingIds) {
					activeFindingIds.add(id);
				}
			}
		}
	}
	return activeFindingIds;
}

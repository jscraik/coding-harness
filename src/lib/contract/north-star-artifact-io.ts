import {
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

import {
	type NORTH_STAR_ARTIFACT_SCHEMA_VERSIONS,
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

/**
 * Resolve the recurrence state for a given failure class and surface set.
 *
 * Computes the deterministic guardrailId, checks whether a guardrail artifact
 * already exists on disk, and returns the current recurrence count.
 *
 * @param repoRoot - Repository root used to resolve artifact paths
 * @param failureClass - Spec-aligned failure class
 * @param surfaceIds - Governed surface IDs that identify the recurrence scope
 * @returns Recurrence resolution result
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
	const existing = safeReadJson<DurableGuardrail>(resolvedPath);
	if (existing) {
		return {
			exists: true,
			recurrenceCount: existing.recurrenceCount,
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
				yield { guardrail, path: path.slice(repoRoot.length + 1) };
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
	const acknowledgement = readNorthStarOverrideAcknowledgement(
		repoRoot,
		date,
		overrideId,
	);
	if (!acknowledgement) {
		return {
			valid: false,
			reason: "Override acknowledgement artifact not found",
		};
	}

	const referenceDate = options.referenceDate ?? new Date();
	const approvedUntil = Date.parse(acknowledgement.approvedUntilUtc);
	if (Number.isNaN(approvedUntil) || approvedUntil <= referenceDate.getTime()) {
		return { valid: false, reason: "Override approval has expired" };
	}

	if (acknowledgement.linkedFindingIds.length === 0) {
		return {
			valid: false,
			reason: "Override acknowledgement has no linked finding IDs",
		};
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

	const matchingReviewer = options.registry.trustedReviewers.filter(
		(r) =>
			r.signatureRef === acknowledgement.signatureRef && r.status === "active",
	);
	if (matchingReviewer.length === 0) {
		return {
			valid: false,
			reason:
				"Override signatureRef does not resolve to an active trusted reviewer",
		};
	}
	if (matchingReviewer.length > 1) {
		return {
			valid: false,
			reason: "Override signatureRef resolves to multiple trusted reviewers",
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

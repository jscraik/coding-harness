import { createHash, randomUUID } from "node:crypto";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import type { LearningItem, LearningPromotionStatus } from "./types.js";

/** Schema version for the local learning enforcement-status ledger. */
export const LEARNING_ENFORCEMENT_STATUS_SCHEMA_VERSION =
	"learning-enforcement-status/v1";

/** Default local path for the learning enforcement-status ledger. */
export const DEFAULT_LEARNING_ENFORCEMENT_STATUS_LEDGER =
	".harness/learnings/enforcement-status.json";

/** One enforcement-status decision recorded for a learning. */
export interface LearningEnforcementStatusEntry {
	/** Stable learning identifier. */
	learningId: string;
	/** Local promotion lifecycle decision for the learning. */
	promotionStatus: LearningPromotionStatus;
	/** Concrete source, test, or config paths enforcing the learning. */
	enforcedBy?: string[];
	/** Human-readable decision rationale. */
	reason?: string;
}

/** Versioned learning enforcement-status ledger. */
export interface LearningEnforcementStatusLedger {
	/** Ledger schema version. */
	schemaVersion: typeof LEARNING_ENFORCEMENT_STATUS_SCHEMA_VERSION;
	/** Deterministically ordered enforcement-status entries. */
	items: LearningEnforcementStatusEntry[];
}

/** Loaded ledger result. */
export type LoadLearningEnforcementStatusResult =
	| {
			ok: true;
			path: string;
			ledger: LearningEnforcementStatusLedger;
			fingerprint: string;
	  }
	| { ok: false; code: string; message: string; fix?: string };

/** Write ledger result. */
export type WriteLearningEnforcementStatusResult =
	| { ok: true; path: string; fingerprint: string }
	| { ok: false; code: string; message: string; fix?: string };

const PROMOTION_STATUSES = new Set<LearningPromotionStatus>([
	"unreviewed",
	"candidate",
	"accepted",
	"enforced",
	"rejected",
	"deferred",
	"non_goal",
]);

/** Load and validate the local enforcement-status ledger. */
export function loadLearningEnforcementStatusLedger(
	ledgerPath = DEFAULT_LEARNING_ENFORCEMENT_STATUS_LEDGER,
	repoRoot = process.cwd(),
): LoadLearningEnforcementStatusResult {
	const resolvedPath = resolve(repoRoot, ledgerPath);
	if (!existsSync(resolvedPath)) {
		return {
			ok: true,
			path: resolvedPath,
			ledger: emptyLearningEnforcementStatusLedger(),
			fingerprint: "",
		};
	}
	const raw = readFileSync(resolvedPath, "utf-8");
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch (error) {
		return {
			ok: false,
			code: "learnings.enforcement_status.invalid_json",
			message: `Failed to parse learning enforcement-status ledger: ${error instanceof Error ? error.message : String(error)}`,
			fix: "Fix the JSON syntax or regenerate the ledger with harness learnings promote --write-enforcement-status.",
		};
	}
	const validation = parseLearningEnforcementStatusLedger(parsed);
	if (!validation.ok) return validation;
	return {
		ok: true,
		path: resolvedPath,
		ledger: validation.ledger,
		fingerprint: fingerprint(raw),
	};
}

/** Write the local enforcement-status ledger atomically. */
export function writeLearningEnforcementStatusLedger(options: {
	ledger: LearningEnforcementStatusLedger;
	ledgerPath?: string;
	repoRoot?: string;
	expectedFingerprint?: string;
}): WriteLearningEnforcementStatusResult {
	const repoRoot = resolve(options.repoRoot ?? process.cwd());
	const ledgerPath = resolve(
		repoRoot,
		options.ledgerPath ?? DEFAULT_LEARNING_ENFORCEMENT_STATUS_LEDGER,
	);
	const validation = parseLearningEnforcementStatusLedger(options.ledger);
	if (!validation.ok) return validation;
	if (options.expectedFingerprint !== undefined && existsSync(ledgerPath)) {
		const currentRaw = readFileSync(ledgerPath, "utf-8");
		const currentFingerprint = fingerprint(currentRaw);
		if (currentFingerprint !== options.expectedFingerprint) {
			return {
				ok: false,
				code: "learnings.enforcement_status.stale_write",
				message:
					"Learning enforcement-status ledger changed since it was loaded; refusing to overwrite existing decisions.",
				fix: "Reload the ledger, reapply the intended decision, then write again.",
			};
		}
	}
	const sortedLedger = sortLearningEnforcementStatusLedger(validation.ledger);
	const content = `${JSON.stringify(sortedLedger, null, 2)}\n`;
	const tempPath = `${ledgerPath}.${process.pid}.${randomUUID()}.tmp`;
	try {
		mkdirSync(dirname(ledgerPath), { recursive: true });
		writeFileSync(tempPath, content, "utf-8");
		renameSync(tempPath, ledgerPath);
		return {
			ok: true,
			path: ledgerPath,
			fingerprint: fingerprint(content),
		};
	} catch (error) {
		try {
			rmSync(tempPath, { force: true });
		} catch {
			// Best-effort cleanup only.
		}
		return {
			ok: false,
			code: "learnings.enforcement_status.write_failed",
			message: `Failed to write learning enforcement-status ledger: ${error instanceof Error ? error.message : String(error)}`,
		};
	}
}

/** Merge imported learning items with local enforcement-status decisions. */
export function applyLearningEnforcementStatus(
	items: LearningItem[],
	ledger: LearningEnforcementStatusLedger,
): LearningItem[] {
	const decisions = new Map(
		ledger.items.map((item) => [item.learningId, item] as const),
	);
	return items.map((item) => {
		const decision = decisions.get(item.id);
		if (!decision) return item;
		return {
			...item,
			promotionStatus: decision.promotionStatus,
			...(decision.enforcedBy ? { enforcedBy: [...decision.enforcedBy] } : {}),
		};
	});
}

/** Build an empty valid enforcement-status ledger. */
export function emptyLearningEnforcementStatusLedger(): LearningEnforcementStatusLedger {
	return {
		schemaVersion: LEARNING_ENFORCEMENT_STATUS_SCHEMA_VERSION,
		items: [],
	};
}

function parseLearningEnforcementStatusLedger(value: unknown):
	| { ok: true; ledger: LearningEnforcementStatusLedger }
	| {
			ok: false;
			code: string;
			message: string;
			fix?: string;
	  } {
	if (!isRecord(value)) {
		return invalidLedger("Ledger must be a JSON object.");
	}
	const allowedTopLevel = new Set(["schemaVersion", "items"]);
	const unknownTopLevel = Object.keys(value).filter(
		(key) => !allowedTopLevel.has(key),
	);
	if (unknownTopLevel.length > 0) {
		return invalidLedger(
			`Unknown enforcement-status ledger field: ${unknownTopLevel[0]}.`,
		);
	}
	if (value.schemaVersion !== LEARNING_ENFORCEMENT_STATUS_SCHEMA_VERSION) {
		return invalidLedger(
			`Unsupported enforcement-status ledger schemaVersion: ${String(value.schemaVersion)}.`,
		);
	}
	if (!Array.isArray(value.items)) {
		return invalidLedger("Ledger field `items` must be an array.");
	}
	const items: LearningEnforcementStatusEntry[] = [];
	const seen = new Set<string>();
	for (const [index, item] of value.items.entries()) {
		const parsedItem = parseEntry(item, index);
		if (!parsedItem.ok) return parsedItem;
		if (seen.has(parsedItem.entry.learningId)) {
			return invalidLedger(
				`Duplicate enforcement-status entry for learningId ${parsedItem.entry.learningId}.`,
			);
		}
		seen.add(parsedItem.entry.learningId);
		items.push(parsedItem.entry);
	}
	return {
		ok: true,
		ledger: sortLearningEnforcementStatusLedger({
			schemaVersion: LEARNING_ENFORCEMENT_STATUS_SCHEMA_VERSION,
			items,
		}),
	};
}

function parseEntry(
	value: unknown,
	index: number,
):
	| { ok: true; entry: LearningEnforcementStatusEntry }
	| {
			ok: false;
			code: string;
			message: string;
			fix?: string;
	  } {
	if (!isRecord(value)) {
		return invalidLedger(`Ledger item ${index} must be an object.`);
	}
	const allowedFields = new Set([
		"learningId",
		"promotionStatus",
		"enforcedBy",
		"reason",
	]);
	const unknownFields = Object.keys(value).filter(
		(key) => !allowedFields.has(key),
	);
	if (unknownFields.length > 0) {
		return invalidLedger(
			`Unknown enforcement-status item field: ${unknownFields[0]}.`,
		);
	}
	if (typeof value.learningId !== "string" || value.learningId.trim() === "") {
		return invalidLedger(`Ledger item ${index} requires learningId.`);
	}
	if (
		typeof value.promotionStatus !== "string" ||
		!PROMOTION_STATUSES.has(value.promotionStatus as LearningPromotionStatus)
	) {
		return invalidLedger(
			`Ledger item ${index} has unsupported promotionStatus ${String(value.promotionStatus)}.`,
		);
	}
	const entry: LearningEnforcementStatusEntry = {
		learningId: value.learningId,
		promotionStatus: value.promotionStatus as LearningPromotionStatus,
	};
	if (entry.promotionStatus === "enforced") {
		if (
			!Array.isArray(value.enforcedBy) ||
			value.enforcedBy.length === 0 ||
			value.enforcedBy.some(
				(path) => typeof path !== "string" || path.trim() === "",
			)
		) {
			return invalidLedger(
				`Ledger item ${index} with promotionStatus enforced requires enforcedBy as a non-empty array of strings.`,
			);
		}
	}
	if (
		["rejected", "deferred", "non_goal"].includes(entry.promotionStatus) &&
		(typeof value.reason !== "string" || value.reason.trim() === "")
	) {
		return invalidLedger(
			`Ledger item ${index} with promotionStatus ${entry.promotionStatus} requires a non-empty reason.`,
		);
	}
	if (value.enforcedBy !== undefined) {
		if (
			!Array.isArray(value.enforcedBy) ||
			value.enforcedBy.some(
				(path) => typeof path !== "string" || path.trim() === "",
			)
		) {
			return invalidLedger(
				`Ledger item ${index} field enforcedBy must be an array of non-empty strings.`,
			);
		}
		entry.enforcedBy = [...new Set(value.enforcedBy)].sort();
	}
	if (value.reason !== undefined) {
		if (typeof value.reason !== "string" || value.reason.trim() === "") {
			return invalidLedger(
				`Ledger item ${index} field reason must be a non-empty string.`,
			);
		}
		entry.reason = value.reason;
	}
	return { ok: true, entry };
}

function sortLearningEnforcementStatusLedger(
	ledger: LearningEnforcementStatusLedger,
): LearningEnforcementStatusLedger {
	return {
		schemaVersion: ledger.schemaVersion,
		items: [...ledger.items].sort((a, b) =>
			a.learningId.localeCompare(b.learningId),
		),
	};
}

function invalidLedger(message: string): {
	ok: false;
	code: string;
	message: string;
	fix: string;
} {
	return {
		ok: false,
		code: "learnings.enforcement_status.invalid",
		message,
		fix: "Regenerate the ledger with harness learnings promote --write-enforcement-status or fix it to match learning-enforcement-status/v1.",
	};
}

function fingerprint(value: string): string {
	return createHash("sha256").update(value).digest("hex");
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

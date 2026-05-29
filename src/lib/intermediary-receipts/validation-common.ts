import {
	BLOCKER_KEYS,
	INTERMEDIARY_BLOCKER_ACTIONS,
	INTERMEDIARY_BLOCKER_CLASSES,
	INTERMEDIARY_NEXT_ACTION_CLASSES,
} from "./constants.js";
import type {
	IntermediaryBlockerClass,
	IntermediaryCoverageStatus,
	IntermediaryReceiptCoverageValidationError,
} from "./types.js";
import {
	addError,
	isRecord,
	requireAllowedKeys,
	requireEnum,
	requireText,
} from "./validation-helpers.js";

const STATUS_RANK: Record<IntermediaryCoverageStatus, number> = {
	pass: 0,
	warn: 1,
	fail: 2,
	blocked: 3,
};

/** Validates blocker shape and deterministic blocker-to-next-action mapping. */
export function validateBlockers(
	value: unknown,
	path: string,
	errors: IntermediaryReceiptCoverageValidationError[],
): void {
	if (!Array.isArray(value)) {
		addError(errors, "invalid_blockers", path, "must be an array");
		return;
	}
	value.forEach((blocker, index) => {
		const blockerPath = `${path}[${index}]`;
		if (!isRecord(blocker)) {
			addError(errors, "invalid_blocker", blockerPath, "must be an object");
			return;
		}
		requireAllowedKeys(blocker, BLOCKER_KEYS, blockerPath, errors);
		requireEnum(
			blocker.blockerClass,
			INTERMEDIARY_BLOCKER_CLASSES,
			`${blockerPath}.blockerClass`,
			errors,
		);
		requireText(blocker.reason, `${blockerPath}.reason`, 256, errors);
		requireEnum(
			blocker.nextActionClass,
			INTERMEDIARY_NEXT_ACTION_CLASSES,
			`${blockerPath}.nextActionClass`,
			errors,
		);
		if (
			typeof blocker.blockerClass === "string" &&
			Object.hasOwn(INTERMEDIARY_BLOCKER_ACTIONS, blocker.blockerClass) &&
			blocker.nextActionClass !==
				INTERMEDIARY_BLOCKER_ACTIONS[
					blocker.blockerClass as IntermediaryBlockerClass
				]
		) {
			addError(
				errors,
				"invalid_next_action_class",
				`${blockerPath}.nextActionClass`,
				"blocker nextActionClass must match the deterministic repair map",
			);
		}
	});
}

/** Aggregates source status with the most restrictive status winning. */
export function aggregateStatus(
	sources: readonly Record<string, unknown>[],
): IntermediaryCoverageStatus {
	let mostRestrictive: IntermediaryCoverageStatus = "pass";
	for (const source of sources) {
		const sourceStatus =
			typeof source.status === "string" && source.status in STATUS_RANK
				? (source.status as IntermediaryCoverageStatus)
				: "blocked";
		const sourceBlocked =
			Array.isArray(source.blockers) && source.blockers.length > 0;
		const nextStatus =
			sourceBlocked && sourceStatus !== "fail" ? "blocked" : sourceStatus;
		if (STATUS_RANK[nextStatus] > STATUS_RANK[mostRestrictive]) {
			mostRestrictive = nextStatus;
		}
		if (
			source.freshness &&
			source.freshness !== "current" &&
			mostRestrictive === "pass"
		) {
			mostRestrictive = "warn";
		}
	}
	return mostRestrictive;
}

import { isRecord } from "../decision/validators.js";
import type { SynaipseTransitionValidationResult } from "./transition-contract.js";

type Errors = SynaipseTransitionValidationResult["errors"];

/** Retain only string evidence references from an untrusted value. */
function stringRefs(value: unknown): string[] {
	return Array.isArray(value)
		? value.filter((ref): ref is string => typeof ref === "string")
		: [];
}

/** Require an authority recovery receipt to demonstrate the repaired state. */
export function validateAuthorityRecovery(
	value: Record<string, unknown>,
	recovery: Record<string, unknown>,
	errors: Errors,
): void {
	const authority = isRecord(value.authority) ? value.authority : null;
	if (
		recovery.fromBlocker === "authority_capability_missing" &&
		!stringRefs(authority?.capabilities).includes(
			`transition:${String(value.fromStage)}->${String(value.toStage)}`,
		)
	)
		errors.push({
			path: "authority.capabilities",
			message: "must include the recovered transition capability",
		});
	if (
		recovery.fromBlocker === "standing_authority_required" &&
		authority?.standing !== true
	)
		errors.push({
			path: "authority.standing",
			message: "must be true after standing-authority recovery",
		});
}

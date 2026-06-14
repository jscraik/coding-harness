import { isPlainObject } from "./validator-helpers.js";

const VALID_AUTHORITIES = new Set([
	"user_or_explicit_request",
	"pull_request_policy",
	"release_policy",
	"explicit_credentialed_request",
]);

const VALID_ACTION_KEYS = new Set([
	"name",
	"authority",
	"writesGitState",
	"writesExternalState",
]);

function isValidSharedStateAction(value: unknown): boolean {
	if (!isPlainObject(value)) return false;
	const action = value as Record<string, unknown>;
	if (Object.keys(action).some((key) => !VALID_ACTION_KEYS.has(key))) {
		return false;
	}
	return (
		typeof action.name === "string" &&
		action.name.trim().length > 0 &&
		typeof action.authority === "string" &&
		VALID_AUTHORITIES.has(action.authority) &&
		(action.writesGitState === undefined ||
			typeof action.writesGitState === "boolean") &&
		(action.writesExternalState === undefined ||
			typeof action.writesExternalState === "boolean")
	);
}

/** Validate optional toolingPolicy.sharedStateActions entries. */
export function isValidSharedStateActions(value: unknown): boolean {
	return (
		value === undefined ||
		(Array.isArray(value) && value.every(isValidSharedStateAction))
	);
}

import { createHash } from "node:crypto";

/** Normalize queued steering instruction text before hashing. */
export function canonicalizeSteeringInstructionText(text: string): string {
	return text.replace(/\r\n?/gu, "\n");
}

/** Hash canonical steering instruction text without storing raw instruction content. */
export function hashSteeringInstructionText(text: string): string {
	const canonical = canonicalizeSteeringInstructionText(text);
	return `sha256:${createHash("sha256").update(canonical, "utf8").digest("hex")}`;
}

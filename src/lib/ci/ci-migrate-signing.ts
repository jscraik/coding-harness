import { createHash, createHmac } from "node:crypto";
import { env } from "node:process";

/**
 * Signature algorithm used for ci-migrate snapshot and state attestations.
 */
export const SNAPSHOT_SIGNATURE_ALGORITHM = "hmac-sha256";

/**
 * Environment variable that stores the ci-migrate signing key.
 */
export const SNAPSHOT_SIGNING_KEY_ENV = "HARNESS_CI_MIGRATE_SIGNING_KEY";

/**
 * Minimum key length (bytes) required for signing operations.
 */
export const MIN_SNAPSHOT_SIGNING_KEY_BYTES = 16;

/**
 * Compute a deterministic SHA-256 hex digest for text content.
 */
export function hashContent(content: string): string {
	return createHash("sha256").update(content, "utf-8").digest("hex");
}

/**
 * Compute an HMAC SHA-256 hex signature for text content.
 */
export function signContent(content: string, signingKey: string): string {
	return createHmac("sha256", signingKey)
		.update(content, "utf-8")
		.digest("hex");
}

/**
 * Resolve and validate the snapshot signing key from process environment.
 */
export function resolveSnapshotSigningKey(
	environment: NodeJS.ProcessEnv = env,
): { ok: true; key: string; keyId: string } | { ok: false; error: string } {
	const rawKey = environment[SNAPSHOT_SIGNING_KEY_ENV];
	if (!rawKey || rawKey.trim().length === 0) {
		return {
			ok: false,
			error: `${SNAPSHOT_SIGNING_KEY_ENV} is required for signed ci-migrate snapshots.`,
		};
	}
	const key = rawKey.trim();
	if (Buffer.byteLength(key, "utf-8") < MIN_SNAPSHOT_SIGNING_KEY_BYTES) {
		return {
			ok: false,
			error: `${SNAPSHOT_SIGNING_KEY_ENV} must be at least ${MIN_SNAPSHOT_SIGNING_KEY_BYTES} bytes.`,
		};
	}
	return { ok: true, key, keyId: hashContent(key).slice(0, 16) };
}

/**
 * CI migration integrity identifier validation helpers.
 *
 * This module keeps digest, commit, and signing-key token shape checks behind
 * the ci-migrate owner module so command orchestration does not own raw
 * integrity identifier policy.
 *
 * @module lib/ci-migrate/integrity-identifiers
 */

const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;
const COMMIT_SHA_PATTERN = /^[a-f0-9]{40}$/;
const HEX_TOKEN_PATTERN = /^[a-f0-9]+$/;

/**
 * Return whether a value is a lowercase SHA-256 hex digest.
 *
 * @param value - Candidate digest text.
 * @returns true when the value is a 64-character lowercase hex digest.
 */
export function isHexDigest(value: string): boolean {
	return SHA256_HEX_PATTERN.test(value);
}

/**
 * Return whether a value is a lowercase Git commit SHA.
 *
 * @param value - Candidate commit text.
 * @returns true when the value is a 40-character lowercase hex commit SHA.
 */
export function isCommitSha(value: string): boolean {
	return COMMIT_SHA_PATTERN.test(value);
}

/**
 * Return whether a value is a lowercase hex token with the requested length.
 *
 * @param value - Candidate token text.
 * @param minLength - Minimum accepted token length.
 * @returns true when the value is lowercase hex and meets the minimum length.
 */
export function isHexToken(value: string, minLength = 1): boolean {
	return value.length >= minLength && HEX_TOKEN_PATTERN.test(value);
}

const SHA_PATTERN = /^[0-9a-f]{40}$/;

export class ShaValidationError extends Error {
	constructor(sha: string) {
		super(
			`Invalid SHA format: ${sha}. Must be 40 lowercase hexadecimal characters.`,
		);
		this.name = "ShaValidationError";
	}
}

export function validateSha(sha: string): void {
	if (!SHA_PATTERN.test(sha)) {
		throw new ShaValidationError(sha);
	}
}

export function isValidSha(sha: unknown): sha is string {
	return typeof sha === "string" && SHA_PATTERN.test(sha);
}

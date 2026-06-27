export const CLI_ERROR_SCHEMA_VERSION = "harness-cli-error/v1";

export const CLI_ERROR_SCHEMA_PATH = "contracts/harness-cli-error.schema.json";

/** Machine-readable error envelope emitted by harness CLI commands. */
export interface HarnessCliErrorEnvelope {
	schemaVersion: typeof CLI_ERROR_SCHEMA_VERSION;
	status: "error";
	error: {
		code: string;
		message: string;
	};
}

/** Create a schema-backed CLI error envelope. */
export function createCliErrorEnvelope(options: {
	code: string;
	message: string;
}): HarnessCliErrorEnvelope {
	return {
		schemaVersion: CLI_ERROR_SCHEMA_VERSION,
		status: "error",
		error: {
			code: options.code,
			message: options.message,
		},
	};
}

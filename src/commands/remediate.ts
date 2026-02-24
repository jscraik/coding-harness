import { sanitizeError } from "../lib/input/sanitize.js";

export const EXIT_CODES = {
	SUCCESS: 0,
	USAGE: 2,
	POLICY: 3,
	PARTIAL: 4,
	INTERNAL: 10,
} as const;

export type RemediateMode = "run" | "apply";
export type RemediateProvider = "codeql" | "codex";

export interface RemediateOptions {
	mode: RemediateMode;
	owner: string;
	repo: string;
	prNumber: number;
	headSha: string;
	provider: RemediateProvider;
	dryRun?: boolean;
	maxAutoTier?: "low" | "medium" | "high";
	json?: boolean;
	noInput?: boolean;
	force?: boolean;
}

export interface RemediateOutput {
	mode: RemediateMode;
	owner: string;
	repo: string;
	prNumber: number;
	headSha: string;
	provider: RemediateProvider;
	planOnly: boolean;
	canRerun: boolean;
	findings: number;
}

export interface RemediateError {
	code:
		| "E_USAGE"
		| "E_VALIDATION"
		| "E_AUTH"
		| "E_POLICY"
		| "E_PARTIAL"
		| "E_INTERNAL";
	message: string;
	details?: Record<string, unknown>;
}

export type RemediateResult =
	| { ok: true; output: RemediateOutput }
	| { ok: false; error: RemediateError };

export function runRemediate(options: RemediateOptions): RemediateResult {
	try {
		if (!options.owner.trim()) {
			return {
				ok: false,
				error: {
					code: "E_USAGE",
					message: "Missing required option: --owner",
				},
			};
		}
		if (!options.repo.trim()) {
			return {
				ok: false,
				error: {
					code: "E_USAGE",
					message: "Missing required option: --repo",
				},
			};
		}
		if (
			typeof options.prNumber !== "number" ||
			Number.isNaN(options.prNumber) ||
			options.prNumber < 1
		) {
			return {
				ok: false,
				error: {
					code: "E_USAGE",
					message: "Invalid required option: --pr must be a positive integer",
				},
			};
		}
		if (!/^[0-9a-f]{7,40}$/.test(options.headSha)) {
			return {
				ok: false,
				error: {
					code: "E_USAGE",
					message: "Invalid required option: --sha must be a valid SHA",
				},
			};
		}
		if (options.provider !== "codeql" && options.provider !== "codex") {
			return {
				ok: false,
				error: {
					code: "E_VALIDATION",
					message: "Invalid required option: --provider must be codeql or codex",
				},
			};
		}
		if (options.mode === "apply" && options.dryRun) {
			return {
				ok: false,
				error: {
					code: "E_USAGE",
					message: "dry-run is not supported for remediate apply",
				},
			};
		}

		if (options.mode === "apply" && options.noInput && !options.force) {
			return {
				ok: false,
				error: {
					code: "E_POLICY",
					message:
						"remediate apply requires --force when running in non-interactive mode",
				},
			};
		}

		// V1 is deterministic and policy-first: this command currently performs a
		// no-op plan by design and returns structured results that callers can
		// use for CI/loop wiring.
		return {
			ok: true,
			output: {
				mode: options.mode,
				owner: options.owner,
				repo: options.repo,
				prNumber: options.prNumber,
				headSha: options.headSha,
				provider: options.provider,
				planOnly: options.mode === "run",
				canRerun: true,
				findings: 0,
			},
		};
	} catch (error) {
		return {
			ok: false,
			error: {
				code: "E_INTERNAL",
				message: sanitizeError(error),
			},
		};
	}
}

export function runRemediateCLI(options: RemediateOptions): number {
	const result = runRemediate(options);

	if (!result.ok) {
		console.error(result.error.message);
		if (options.json) {
			console.error(JSON.stringify({ error: result.error }));
		}
		switch (result.error.code) {
			case "E_USAGE":
			case "E_VALIDATION":
				return EXIT_CODES.USAGE;
			case "E_POLICY":
				return EXIT_CODES.POLICY;
			case "E_PARTIAL":
				return EXIT_CODES.PARTIAL;
			default:
				return EXIT_CODES.INTERNAL;
		}
	}

	if (options.json) {
		console.info(
			JSON.stringify({
				schema: "harness.remediate.v1",
				meta: {
					tool: "harness-remediate",
					timestamp: new Date().toISOString(),
				},
				status: "success",
				summary: `Remediation ${result.output.mode} completed (no-op stub)`,
				data: result.output,
				errors: [],
			}),
		);
		return EXIT_CODES.SUCCESS;
	}

	console.info(
		`Remediation ${result.output.mode} prepared for ${
			result.output.owner
		}/${result.output.repo}#${result.output.prNumber}`,
	);
	console.info(`planOnly: ${result.output.planOnly ? "true" : "false"}`);
	console.info(`findings: ${result.output.findings}`);
	return EXIT_CODES.SUCCESS;
}

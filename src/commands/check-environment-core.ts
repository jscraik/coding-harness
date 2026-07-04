import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
/**
 * check-environment command for governance envelope preflight validation.
 * Validates sandbox mode, environment filters, and approval posture.
 */
import { existsSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import semver from "semver";
import { loadContract } from "../lib/contract/loader.js";
import {
	DEFAULT_CONTRACT,
	type HarnessContract,
} from "../lib/contract/types.js";
import {
	PREFLIGHT_PYTHON_VERSION_PIN,
	PREFLIGHT_UV_VERSION_PIN,
} from "../lib/deps/environment-runtime.js";
import { probeCommandVersion } from "../lib/runtime/command-version-probe.js";
import { sanitizeError } from "../lib/input/sanitize.js";
import { PathTraversalError, validatePath } from "../lib/input/validator.js";
import {
	type CliErrorCode,
	createJsonErrorOutput,
	createJsonOutput,
} from "../lib/result/types.js";

// Exit codes for programmatic consumption
/** Public API export. */
export const EXIT_CODES = {
	SUCCESS: 0,
	POLICY_VIOLATION: 1,
	VALIDATION_ERROR: 2,
	CONTRACT_ERROR: 3,
} as const;

/** Public API export. */
export interface CheckEnvironmentOptions {
	/** Path to contract file */
	contractPath?: string;
	/** Check for secrets in environment */
	checkSecrets?: boolean;
	/** Allowed sandbox modes */
	allowedSandboxModes?: string[];
	/** Output as JSON */
	json?: boolean;
	/** Path to write attestation artifact */
	attestationPath?: string;
}

/** Public API export. */
export interface EnvironmentViolation {
	/** Violation type */
	type:
		| "sandbox_mode_not_allowed"
		| "secret_in_environment"
		| "approval_posture_invalid"
		| "artifact_path_traversal"
		| "artifact_write_failed"
		| "runtime_dependency_missing"
		| "runtime_dependency_version_mismatch";
	/** Human-readable message */
	message: string;
	/** The value that caused the violation */
	value?: string;
	/** Expected policy value */
	expected?: string;
}

/** Public API export. */
export interface EnvironmentPosture {
	/** Current sandbox mode (if detectable) */
	sandboxMode?: string;
	/** Whether environment has secrets filter */
	hasSecretsFilter: boolean;
	/** Whether approval posture is set for mutative operations */
	hasApprovalPosture: boolean;
	/** Policy fingerprint (hash of applied policy) */
	policyFingerprint: string;
	/** Timestamp of check */
	timestamp: string;
	/** Runtime posture for mandatory dependencies */
	runtime?: {
		pythonVersion?: string;
		uvVersion?: string;
	};
}

/** Public API export. */
export interface CheckEnvironmentOutput {
	/** Whether all checks passed */
	passed: boolean;
	/** Any policy violations found */
	violations: EnvironmentViolation[];
	/** Environment posture detected */
	posture: EnvironmentPosture;
	/** Path to attestation artifact (if written) */
	attestationPath?: string;
	/** Machine-readable checkpoint evidence reference for promotion workflows */
	evidenceReference?: {
		claimId: string;
		timestamp: string;
		headSha?: string;
		command: "check-environment";
		exitCode: number;
		evidencePostureRef: "preflight_only" | "signed_verifier";
		attestationVerificationStatus:
			| "not_requested"
			| "preflight_only"
			| "verified";
		artifactPath?: string;
		artifactChecksum?: string;
	};
}

/** Public API export. */
export type CheckEnvironmentResult =
	| { ok: true; output: CheckEnvironmentOutput }
	| { ok: false; error: { code: string; message: string } };

/**
 * Known secret environment variable patterns.
 */
const SECRET_PATTERNS = [
	/TOKEN$/i,
	/SECRET$/i,
	/KEY$/i,
	/PASSWORD$/i,
	/CREDENTIAL$/i,
	/API_KEY$/i,
	/ACCESS_KEY$/i,
	/AUTH/i,
	/^AWS_/,
	/^GITHUB_/,
	/^GITLAB_/,
	/^BITBUCKET_/,
];

/**
 * Check if an environment variable name looks like a secret.
 */
function isSecretVariable(name: string): boolean {
	return SECRET_PATTERNS.some((pattern) => pattern.test(name));
}

/**
 * Detect current sandbox mode from environment.
 */
function detectSandboxMode(): string | undefined {
	// Check common sandbox indicators
	if (process.env.CLAUDE_SANDBOX_MODE) {
		return process.env.CLAUDE_SANDBOX_MODE;
	}
	if (process.env.CODEX_SANDBOX_MODE) {
		return process.env.CODEX_SANDBOX_MODE;
	}
	// Default assumption for this tool is sandboxed
	return "sandboxed";
}

/**
 * Check if environment has secrets filtering configured.
 */
function hasSecretsFilterConfigured(): boolean {
	// Check for common secrets filter configurations
	const filterEnv =
		process.env.CLAUDE_SECRET_FILTER ?? process.env.CODEX_SECRET_FILTER;
	if (filterEnv) {
		return true;
	}
	// Check if a .env.example exists (best practice indicator)
	const envExamplePath = resolve(process.cwd(), ".env.example");
	if (existsSync(envExamplePath)) {
		return true;
	}
	return false;
}

/**
 * Check if approval posture is configured for mutative operations.
 */
function hasApprovalPostureConfigured(): boolean {
	// Check for approval configuration
	const approvalEnv =
		process.env.CLAUDE_APPROVAL_POSTURE ?? process.env.CODEX_APPROVAL_POSTURE;
	if (approvalEnv === "require") {
		return true;
	}
	// Default to true if running in interactive mode
	if (process.stdin.isTTY) {
		return true;
	}
	return false;
}

function parseSemverLoose(version: string): string | null {
	return semver.coerce(version)?.version ?? null;
}

/**
 * Compute a fingerprint for the policy.
 */
function computePolicyFingerprint(contract: HarnessContract): string {
	const policyData = JSON.stringify({
		pilotAuthzPolicy: contract.pilotAuthzPolicy,
		pilotRollbackPolicy: contract.pilotRollbackPolicy,
		pilotGapCasePolicy: contract.pilotGapCasePolicy,
	});
	return createHash("sha256").update(policyData).digest("hex").slice(0, 16);
}

function detectHeadSha(): string | undefined {
	const probe = spawnSync("git", ["rev-parse", "HEAD"], {
		encoding: "utf-8",
		stdio: ["ignore", "pipe", "ignore"],
	});
	if (probe.status !== 0) {
		return undefined;
	}
	const candidate = probe.stdout.trim();
	return /^[a-f0-9]{40}$/i.test(candidate) ? candidate : undefined;
}

/**
 * Return the consumer contract's required mise tool version, falling back to the
 * harness default only when the consumer contract omits that tool.
 */
function requiredMiseToolVersion(
	contract: HarnessContract,
	toolName: string,
	fallbackVersion: string,
): string {
	const contractVersion = contract.toolingPolicy?.requiredMiseTools.find(
		(tool) => tool.tool === toolName,
	)?.version;
	return contractVersion ?? fallbackVersion;
}

/**
 * Run environment preflight check.
 * This function is usable as a library (does not output to console).
 */
export async function runCheckEnvironment(
	options: CheckEnvironmentOptions,
): Promise<CheckEnvironmentResult> {
	// Load contract
	let contract: HarnessContract;
	try {
		const contractPath = options.contractPath ?? "harness.contract.json";
		const resolvedContractPath = resolve(contractPath);
		if (existsSync(resolvedContractPath)) {
			contract = loadContract(contractPath);
		} else {
			contract = DEFAULT_CONTRACT;
		}
	} catch (e) {
		return {
			ok: false,
			error: {
				code: "CONTRACT_ERROR",
				message: `Failed to load contract: ${sanitizeError(e)}`,
			},
		};
	}

	const violations: EnvironmentViolation[] = [];
	const headSha = detectHeadSha();

	// Default allowed sandbox modes
	const allowedModes = options.allowedSandboxModes ?? [
		"sandboxed",
		"restricted",
		"isolated",
	];

	// Detect sandbox mode
	const sandboxMode = detectSandboxMode();
	const posture: EnvironmentPosture = {
		hasSecretsFilter: hasSecretsFilterConfigured(),
		hasApprovalPosture: hasApprovalPostureConfigured(),
		policyFingerprint: computePolicyFingerprint(contract),
		timestamp: new Date().toISOString(),
	};

	// Only add sandboxMode if it has a value
	if (sandboxMode !== undefined) {
		posture.sandboxMode = sandboxMode;
	}

	// Check sandbox mode is allowed
	if (sandboxMode && !allowedModes.includes(sandboxMode)) {
		violations.push({
			type: "sandbox_mode_not_allowed",
			message: `Sandbox mode '${sandboxMode}' is not in the allowed list`,
			value: sandboxMode,
			expected: `One of: ${allowedModes.join(", ")}`,
		});
	}

	// Check for secrets in environment if requested
	if (options.checkSecrets) {
		const secretVars = Object.keys(process.env).filter(isSecretVariable);
		if (secretVars.length > 0 && !posture.hasSecretsFilter) {
			violations.push({
				type: "secret_in_environment",
				message: `Potential secrets detected in environment without filter: ${secretVars.slice(0, 5).join(", ")}${secretVars.length > 5 ? "..." : ""}`,
				value: `${secretVars.length} variables`,
				expected: "Configure CLAUDE_SECRET_FILTER or use .env.example",
			});
		}
	}

	// Check approval posture
	if (!posture.hasApprovalPosture) {
		violations.push({
			type: "approval_posture_invalid",
			message: "No approval posture configured for mutative operations",
			expected:
				"Set CLAUDE_APPROVAL_POSTURE=require or run in interactive mode",
		});
	}

	// Runtime dependency checks for local preflight execution.
	const requiredUvVersion = requiredMiseToolVersion(
		contract,
		"uv",
		PREFLIGHT_UV_VERSION_PIN,
	);
	const pythonProbe = probeCommandVersion(
		"python3",
		["--version"],
		(output) => output.match(/(\d+\.\d+\.\d+)/)?.[1],
	);
	if (!pythonProbe.available || !pythonProbe.version) {
		violations.push({
			type: "runtime_dependency_missing",
			message: "python3 is required but was not found",
			expected: `Install Python ${PREFLIGHT_PYTHON_VERSION_PIN}.x`,
		});
	} else {
		posture.runtime = {
			...(posture.runtime ?? {}),
			pythonVersion: pythonProbe.version,
		};
		const current = parseSemverLoose(pythonProbe.version);
		const required = parseSemverLoose(PREFLIGHT_PYTHON_VERSION_PIN);
		if (current && required && !semver.gte(current, required)) {
			violations.push({
				type: "runtime_dependency_version_mismatch",
				message: `python3 version ${pythonProbe.version} is lower than required`,
				value: pythonProbe.version,
				expected: `>= ${PREFLIGHT_PYTHON_VERSION_PIN}`,
			});
		}
	}

	const uvProbe = probeCommandVersion(
		"uv",
		["--version"],
		(output) => output.match(/(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)/)?.[1],
	);
	if (!uvProbe.available || !uvProbe.version) {
		violations.push({
			type: "runtime_dependency_missing",
			message: "uv is required but was not found",
			expected: `Install uv ${requiredUvVersion}`,
		});
	} else {
		posture.runtime = {
			...(posture.runtime ?? {}),
			uvVersion: uvProbe.version,
		};
		const current = parseSemverLoose(uvProbe.version);
		const required = parseSemverLoose(requiredUvVersion);
		if (current && required && !semver.eq(current, required)) {
			violations.push({
				type: "runtime_dependency_version_mismatch",
				message: `uv version ${uvProbe.version} does not match the pinned runtime`,
				value: uvProbe.version,
				expected: requiredUvVersion,
			});
		}
	}

	// Build output
	const output: CheckEnvironmentOutput = {
		passed: violations.length === 0,
		violations,
		posture,
	};

	// Write attestation artifact if path provided
	if (options.attestationPath) {
		try {
			// Validate path against cwd to prevent symlink-based overwrite.
			// validatePath checks all existing ancestors for symlinks and
			// ensures the resolved path stays within the base directory.
			const safeAttestation = validatePath(
				process.cwd(),
				options.attestationPath,
			);
			const attestation = {
				timestamp: posture.timestamp,
				policyFingerprint: posture.policyFingerprint,
				sandboxMode: posture.sandboxMode,
				hasSecretsFilter: posture.hasSecretsFilter,
				hasApprovalPosture: posture.hasApprovalPosture,
				passed: output.passed,
				violations: output.violations,
			};
			const resolvedDir = dirname(safeAttestation);
			const { mkdirSync } = await import("node:fs");
			mkdirSync(resolvedDir, { recursive: true });
			writeFileSync(
				safeAttestation,
				JSON.stringify(attestation, null, 2),
				"utf-8",
			);
			output.attestationPath = safeAttestation;
			output.evidenceReference = {
				claimId: createHash("sha256")
					.update(
						[
							"check-environment",
							posture.timestamp,
							posture.policyFingerprint,
							safeAttestation,
						].join("|"),
					)
					.digest("hex"),
				timestamp: posture.timestamp,
				...(headSha ? { headSha } : {}),
				command: "check-environment",
				exitCode: output.passed
					? EXIT_CODES.SUCCESS
					: EXIT_CODES.POLICY_VIOLATION,
				evidencePostureRef: "preflight_only",
				attestationVerificationStatus: "preflight_only",
				artifactPath: safeAttestation,
				artifactChecksum: createHash("sha256")
					.update(JSON.stringify(attestation, null, 2))
					.digest("hex"),
			};
		} catch (e) {
			if (e instanceof PathTraversalError) {
				violations.push({
					type: "artifact_path_traversal",
					message:
						"Attestation path cannot include symbolic links in existing path segments",
					value: options.attestationPath,
				});
				output.passed = false;
				output.violations = violations;
			} else {
				violations.push({
					type: "artifact_write_failed",
					message: `Failed to write attestation artifact: ${sanitizeError(e)}`,
					value: options.attestationPath,
				});
				output.passed = false;
				output.violations = violations;
			}
		}
	}

	if (!output.evidenceReference) {
		output.evidenceReference = {
			claimId: createHash("sha256")
				.update(
					[
						"check-environment",
						posture.timestamp,
						posture.policyFingerprint,
					].join("|"),
				)
				.digest("hex"),
			timestamp: posture.timestamp,
			...(headSha ? { headSha } : {}),
			command: "check-environment",
			exitCode: output.passed
				? EXIT_CODES.SUCCESS
				: EXIT_CODES.POLICY_VIOLATION,
			evidencePostureRef: "preflight_only",
			attestationVerificationStatus: "not_requested",
		};
	}

	return { ok: true, output };
}

/**
 * Get recovery hint for common error codes.
 */
function getRecoveryHint(code: string): string | undefined {
	switch (code) {
		case "CONTRACT_ERROR":
			return "Ensure harness.contract.json exists and is valid JSON with the correct schema";
		case "VALIDATION_ERROR":
			return "Fix the validation errors in the contract or environment configuration";
		default:
			return undefined;
	}
}

/**
 * CLI entry point with output formatting and exit codes.
 */
export async function runCheckEnvironmentCLI(
	options: CheckEnvironmentOptions,
): Promise<number> {
	const result = await runCheckEnvironment(options);

	if (!result.ok) {
		const errorCode = result.error.code as CliErrorCode;
		const exitCode = EXIT_CODES.CONTRACT_ERROR;
		const recoveryHint = getRecoveryHint(result.error.code);

		if (options.json) {
			const jsonOutput = createJsonErrorOutput(
				"check-environment",
				{
					code: errorCode,
					message: result.error.message,
					...(recoveryHint ? { recovery: recoveryHint } : {}),
				},
				exitCode,
			);
			console.error(JSON.stringify(jsonOutput, null, 2));
		} else {
			console.error(`Error: ${result.error.message}`);
			if (recoveryHint) {
				console.error(`Recovery: ${recoveryHint}`);
			}
		}
		return exitCode;
	}

	const { output } = result;
	const exitCode = output.passed
		? EXIT_CODES.SUCCESS
		: EXIT_CODES.POLICY_VIOLATION;

	if (options.json) {
		const jsonOutput = createJsonOutput("check-environment", output, exitCode);
		console.info(JSON.stringify(jsonOutput, null, 2));
	} else {
		if (output.passed) {
			console.info("✓ Environment check passed");
			console.info(`  Policy fingerprint: ${output.posture.policyFingerprint}`);
			if (output.posture.sandboxMode) {
				console.info(`  Sandbox mode: ${output.posture.sandboxMode}`);
			}
			console.info(
				`  Secrets filter: ${output.posture.hasSecretsFilter ? "configured" : "not configured"}`,
			);
			console.info(
				`  Approval posture: ${output.posture.hasApprovalPosture ? "configured" : "not configured"}`,
			);
			if (output.posture.runtime) {
				if (output.posture.runtime.pythonVersion) {
					console.info(`  Python: ${output.posture.runtime.pythonVersion}`);
				}
				if (output.posture.runtime.uvVersion) {
					console.info(`  uv: ${output.posture.runtime.uvVersion}`);
				}
			}
			if (output.attestationPath) {
				console.info(`  Attestation: ${output.attestationPath}`);
			}
		} else {
			console.error("✗ Environment check failed");
			console.error("");
			for (const violation of output.violations) {
				console.error(`  ${violation.type}: ${violation.message}`);
				if (violation.expected) {
					console.error(`    Expected: ${violation.expected}`);
				}
			}
		}
	}

	return exitCode;
}

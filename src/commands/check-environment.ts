import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
/**
 * check-environment command for governance envelope preflight validation.
 * Validates sandbox mode, environment filters, and approval posture.
 */
import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import semver from "semver";
import { loadContract } from "../lib/contract/loader.js";
import {
	DEFAULT_CONTRACT,
	type HarnessContract,
} from "../lib/contract/types.js";
import {
	RALPH_PYTHON_VERSION_PIN,
	RALPH_UV_VERSION_PIN,
	RALPH_VERSION_PIN,
	extractVersionFromRalphVersionOutput,
	getRalphPackageSpec,
} from "../lib/deps/ralph-runtime.js";
import { sanitizeError } from "../lib/input/sanitize.js";

// Exit codes for programmatic consumption
export const EXIT_CODES = {
	SUCCESS: 0,
	POLICY_VIOLATION: 1,
	VALIDATION_ERROR: 2,
	CONTRACT_ERROR: 3,
} as const;

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

export interface EnvironmentViolation {
	/** Violation type */
	type:
		| "sandbox_mode_not_allowed"
		| "secret_in_environment"
		| "approval_posture_invalid"
		| "artifact_path_traversal"
		| "runtime_dependency_missing"
		| "runtime_dependency_version_mismatch";
	/** Human-readable message */
	message: string;
	/** The value that caused the violation */
	value?: string;
	/** Expected policy value */
	expected?: string;
}

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
		ralphVersion?: string;
	};
}

export interface CheckEnvironmentOutput {
	/** Whether all checks passed */
	passed: boolean;
	/** Any policy violations found */
	violations: EnvironmentViolation[];
	/** Environment posture detected */
	posture: EnvironmentPosture;
	/** Path to attestation artifact (if written) */
	attestationPath?: string;
}

interface CommandProbe {
	available: boolean;
	version?: string;
	rawOutput?: string;
}

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

function probeCommandVersion(
	command: string,
	args: string[],
	extractVersion: (output: string) => string | undefined,
): CommandProbe {
	const result = spawnSync(command, args, {
		encoding: "utf-8",
		stdio: ["ignore", "pipe", "pipe"],
	});

	if (result.error || result.status !== 0) {
		return { available: false };
	}

	const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
	const version = extractVersion(output);
	return {
		available: true,
		rawOutput: output,
		...(version ? { version } : {}),
	};
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

	// Runtime dependency checks (mandatory for loop-stage execution)
	const pythonProbe = probeCommandVersion(
		"python3",
		["--version"],
		(output) => output.match(/(\d+\.\d+\.\d+)/)?.[1],
	);
	if (!pythonProbe.available || !pythonProbe.version) {
		violations.push({
			type: "runtime_dependency_missing",
			message: "python3 is required but was not found",
			expected: `Install Python ${RALPH_PYTHON_VERSION_PIN}.x`,
		});
	} else {
		posture.runtime = {
			...(posture.runtime ?? {}),
			pythonVersion: pythonProbe.version,
		};
		const current = parseSemverLoose(pythonProbe.version);
		const required = parseSemverLoose(RALPH_PYTHON_VERSION_PIN);
		if (current && required && !semver.gte(current, required)) {
			violations.push({
				type: "runtime_dependency_version_mismatch",
				message: `python3 version ${pythonProbe.version} is lower than required`,
				value: pythonProbe.version,
				expected: `>= ${RALPH_PYTHON_VERSION_PIN}`,
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
			expected: `Install uv ${RALPH_UV_VERSION_PIN}`,
		});
	} else {
		posture.runtime = {
			...(posture.runtime ?? {}),
			uvVersion: uvProbe.version,
		};
		const current = parseSemverLoose(uvProbe.version);
		const required = parseSemverLoose(RALPH_UV_VERSION_PIN);
		if (current && required && !semver.eq(current, required)) {
			violations.push({
				type: "runtime_dependency_version_mismatch",
				message: `uv version ${uvProbe.version} does not match the pinned runtime`,
				value: uvProbe.version,
				expected: RALPH_UV_VERSION_PIN,
			});
		}
	}

	const ralphProbe = probeCommandVersion(
		"ralph",
		["--version"],
		extractVersionFromRalphVersionOutput,
	);
	if (!ralphProbe.available || !ralphProbe.version) {
		violations.push({
			type: "runtime_dependency_missing",
			message: "ralph CLI is required but was not found",
			expected: `Install ${getRalphPackageSpec()}`,
		});
	} else {
		posture.runtime = {
			...(posture.runtime ?? {}),
			ralphVersion: ralphProbe.version,
		};
		const current = parseSemverLoose(ralphProbe.version);
		const required = parseSemverLoose(RALPH_VERSION_PIN);
		if (current && required && !semver.eq(current, required)) {
			violations.push({
				type: "runtime_dependency_version_mismatch",
				message: `ralph version ${ralphProbe.version} does not match pinned runtime`,
				value: ralphProbe.version,
				expected: RALPH_VERSION_PIN,
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
			const attestation = {
				timestamp: posture.timestamp,
				policyFingerprint: posture.policyFingerprint,
				sandboxMode: posture.sandboxMode,
				hasSecretsFilter: posture.hasSecretsFilter,
				hasApprovalPosture: posture.hasApprovalPosture,
				passed: output.passed,
				violations: output.violations,
			};
			writeFileSync(
				options.attestationPath,
				JSON.stringify(attestation, null, 2),
				"utf-8",
			);
			output.attestationPath = options.attestationPath;
		} catch {
			// Ignore write errors for attestation
		}
	}

	return { ok: true, output };
}

/**
 * CLI entry point with output formatting and exit codes.
 */
export async function runCheckEnvironmentCLI(
	options: CheckEnvironmentOptions,
): Promise<number> {
	const result = await runCheckEnvironment(options);

	if (!result.ok) {
		if (options.json) {
			console.error(JSON.stringify({ error: result.error }, null, 2));
		} else {
			console.error(`Error: ${result.error.message}`);
		}
		return EXIT_CODES.CONTRACT_ERROR;
	}

	const { output } = result;

	if (options.json) {
		console.info(JSON.stringify(output, null, 2));
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
				if (output.posture.runtime.ralphVersion) {
					console.info(`  Ralph: ${output.posture.runtime.ralphVersion}`);
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

	return output.passed ? EXIT_CODES.SUCCESS : EXIT_CODES.POLICY_VIOLATION;
}

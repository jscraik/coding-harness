import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

type ProbeOutput = {
	ok: boolean;
	output?: string;
	errorMessage?: string;
};

interface LocalRunnerProbe {
	description: string;
	originPath: string;
	remediationCommand: string;
}

/** Status reported by the harness version-coherence check. */
export type HarnessVersionCoherenceStatus = "ok" | "drift" | "skip" | "error";

/** Result payload for comparing repo-local and global harness runners. */
export interface HarnessVersionCoherenceResult {
	status: HarnessVersionCoherenceStatus;
	message: string;
	remediation?: string;
	repoLocalVersion?: string;
	repoLocalOriginPath?: string;
	globalVersion?: string;
	globalBinaryPath?: string;
}

/**
 * Extracts the first semantic version-like string from given text.
 *
 * @param output - Text to search (for example, a command's version output)
 * @returns The matched `major.minor.patch` version (prerelease/build suffixes allowed) without a leading `v` (e.g. `1.2.3` or `1.2.3-alpha.1+meta`), or `undefined` if no version is found
 */
function parseHarnessVersion(output: string): string | undefined {
	const match = output.match(/\bv?(\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?)\b/);
	return match?.[1];
}

/**
 * Executes a program with the given arguments and captures its stdout and stderr.
 *
 * Runs the specified command and returns a ProbeOutput describing whether the
 * invocation succeeded. On success `ok` is `true` and `output` contains the
 * combined stdout and stderr (trimmed). On failure `ok` is `false` and
 * `errorMessage` contains the spawn error message or the numeric exit status.
 *
 * @param command - The executable name or path to run
 * @param args - Arguments to pass to the command
 * @returns A ProbeOutput indicating success with `output`, or failure with `errorMessage`
 */
function probeCommand(command: string, args: string[]): ProbeOutput {
	const result = spawnSync(command, args, {
		encoding: "utf-8",
		stdio: ["ignore", "pipe", "pipe"],
	});
	if (result.error || result.status !== 0) {
		return {
			ok: false,
			errorMessage:
				result.error?.message ?? `exit status ${result.status ?? 1}`,
		};
	}
	return {
		ok: true,
		output: `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim(),
	};
}

/**
 * Locate an executable on PATH and return its first discovered filesystem path.
 *
 * @param command - The command name to locate (e.g., "node" or "harness")
 * @returns The first filesystem path to `command` as reported by the platform locator, or `undefined` if the command cannot be found or probing fails
 */
function resolveCommandPath(command: string): string | undefined {
	const locator = process.platform === "win32" ? "where" : "which";
	// First check if the locator command itself exists
	const locatorTest = spawnSync(locator, ["--version"], {
		encoding: "utf-8",
		stdio: ["ignore", "pipe", "pipe"],
	});
	if (locatorTest.error) {
		// Locator command doesn't exist, search PATH manually
		const pathDirs = (process.env.PATH ?? "").split(
			process.platform === "win32" ? ";" : ":",
		);
		for (const dir of pathDirs) {
			if (!dir) continue;
			const candidatePath = resolve(dir, command);
			if (existsSync(candidatePath)) {
				return candidatePath;
			}
		}
		return undefined;
	}

	const probe = probeCommand(locator, [command]);
	if (!probe.ok || !probe.output) {
		return undefined;
	}
	const firstLine = probe.output.split(/\r?\n/)[0]?.trim();
	return firstLine && firstLine.length > 0 ? firstLine : undefined;
}

/**
 * Detects a repository-local harness runner and returns metadata only (no execution).
 *
 * Checks common repo-local runner locations (in order: src/cli.ts, dist/cli.js,
 * and scripts/harness-cli.sh) and returns a LocalRunnerProbe describing the
 * discovered runner and a suggested remediation command.
 *
 * @param cwd - Filesystem directory to inspect for a repo-local runner
 * @returns A LocalRunnerProbe for the first discovered repo-local runner, or `undefined` if no candidate is found
 */
function detectRepoLocalRunner(cwd: string): LocalRunnerProbe | undefined {
	const sourceCliPath = resolve(cwd, "src/cli.ts");
	if (existsSync(sourceCliPath)) {
		return {
			description: "repo source CLI",
			originPath: sourceCliPath,
			remediationCommand: "node --import tsx src/cli.ts <command>",
		};
	}

	const distCliPath = resolve(cwd, "dist/cli.js");
	if (existsSync(distCliPath)) {
		return {
			description: "repo dist CLI",
			originPath: distCliPath,
			remediationCommand: "node dist/cli.js <command>",
		};
	}

	const wrapperPath = resolve(cwd, "scripts/harness-cli.sh");
	if (existsSync(wrapperPath)) {
		return {
			description: "repo wrapper",
			originPath: wrapperPath,
			remediationCommand: "bash scripts/harness-cli.sh <command>",
		};
	}

	return undefined;
}

/**
 * Reads the repository-local harness version from package.json without
 * executing any repository-controlled scripts.
 *
 * @param cwd - Filesystem directory to inspect
 * @returns The parsed version string, or `undefined` when missing/unparseable
 */
function readRepoPackageVersion(cwd: string): string | undefined {
	const packageJsonPath = resolve(cwd, "package.json");
	if (!existsSync(packageJsonPath)) {
		return undefined;
	}

	try {
		const packageData = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as {
			version?: unknown;
		};
		return typeof packageData.version === "string"
			? parseHarnessVersion(packageData.version)
			: undefined;
	} catch {
		return undefined;
	}
}

/**
 * Detects whether a repository-local "harness" runner is present and, if so, compares its version to a global `harness` binary on PATH.
 *
 * Detects repo-local runner artifacts (e.g., source, dist, or wrapper script),
 * reads and parses the repository package version from `package.json`, optionally
 * locates and probes a global `harness` executable, and returns a structured
 * result describing coherence or problems. Possible `status` values:
 * - `"skip"`: no repo-local runner was found in `cwd`.
 * - `"ok"`: either repo-local and global versions match, or a repo-local version exists and no global binary was found.
 * - `"drift"`: repo-local and global versions were both determined but differ.
 * - `"error"`: a probe or version parse failed and the module could not determine a required version.
 *
 * @param cwd - Filesystem directory to inspect for a repo-local harness runner. Defaults to the current working directory.
 * @returns A `HarnessVersionCoherenceResult` describing the outcome, including human-readable `message`, optional `remediation`, and available version/path fields (`repoLocalVersion`, `repoLocalOriginPath`, `globalVersion`, `globalBinaryPath`).
 */
export function detectHarnessVersionCoherence(
	cwd = process.cwd(),
): HarnessVersionCoherenceResult {
	const localRunner = detectRepoLocalRunner(cwd);
	if (!localRunner) {
		return {
			status: "skip",
			message: "Skipped: no repo-local harness runner found in this directory",
		};
	}

	const repoLocalVersion = readRepoPackageVersion(cwd);
	if (!repoLocalVersion) {
		return {
			status: "error",
			message: `Could not determine repo-local harness version for ${localRunner.description} (${localRunner.originPath}); expected a parseable package.json version`,
			remediation: `Use repo-local runner explicitly: ${localRunner.remediationCommand}`,
			repoLocalOriginPath: localRunner.originPath,
		};
	}

	const globalBinaryPath = resolveCommandPath("harness");
	if (!globalBinaryPath) {
		return {
			status: "ok",
			message: `Repo-local harness v${repoLocalVersion} detected at ${localRunner.originPath}; no global harness binary found on PATH`,
			repoLocalVersion,
			repoLocalOriginPath: localRunner.originPath,
		};
	}

	const globalProbe = probeCommand(globalBinaryPath, ["--version"]);
	const globalVersion =
		globalProbe.ok && globalProbe.output
			? parseHarnessVersion(globalProbe.output)
			: undefined;

	if (!globalVersion) {
		return {
			status: "error",
			message: `Found global harness binary at ${globalBinaryPath} but could not determine its version`,
			remediation: `Use repo-local runner explicitly: ${localRunner.remediationCommand}`,
			repoLocalVersion,
			repoLocalOriginPath: localRunner.originPath,
			globalBinaryPath,
		};
	}

	if (globalVersion !== repoLocalVersion) {
		return {
			status: "drift",
			message: `Version drift detected: repo-local harness v${repoLocalVersion} (${localRunner.originPath}) differs from global harness v${globalVersion} (${globalBinaryPath})`,
			remediation: `Use repo-local runner explicitly: ${localRunner.remediationCommand}`,
			repoLocalVersion,
			repoLocalOriginPath: localRunner.originPath,
			globalVersion,
			globalBinaryPath,
		};
	}

	return {
		status: "ok",
		message: `Harness version coherence verified: repo-local and global are both v${repoLocalVersion}`,
		repoLocalVersion,
		repoLocalOriginPath: localRunner.originPath,
		globalVersion,
		globalBinaryPath,
	};
}

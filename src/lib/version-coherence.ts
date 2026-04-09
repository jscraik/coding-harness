import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
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
	command: string;
	args: string[];
}

export type HarnessVersionCoherenceStatus = "ok" | "drift" | "skip" | "error";

export interface HarnessVersionCoherenceResult {
	status: HarnessVersionCoherenceStatus;
	message: string;
	remediation?: string;
	repoLocalVersion?: string;
	repoLocalOriginPath?: string;
	globalVersion?: string;
	globalBinaryPath?: string;
}

function parseHarnessVersion(output: string): string | undefined {
	const match = output.match(/\bv?(\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?)\b/);
	return match?.[1];
}

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

function commandExists(command: string): boolean {
	const probe = probeCommand(process.platform === "win32" ? "where" : "which", [
		command,
	]);
	return probe.ok;
}

function resolveCommandPath(command: string): string | undefined {
	const probe = probeCommand(process.platform === "win32" ? "where" : "which", [
		command,
	]);
	if (!probe.ok || !probe.output) {
		return undefined;
	}
	const firstLine = probe.output.split(/\r?\n/)[0]?.trim();
	return firstLine && firstLine.length > 0 ? firstLine : undefined;
}

function detectRepoLocalRunner(cwd: string): LocalRunnerProbe | undefined {
	const sourceCliPath = resolve(cwd, "src/cli.ts");
	if (existsSync(sourceCliPath) && commandExists("pnpm")) {
		return {
			description: "repo source CLI",
			originPath: sourceCliPath,
			remediationCommand: "pnpm exec tsx src/cli.ts <command>",
			command: "pnpm",
			args: ["exec", "tsx", sourceCliPath, "--version"],
		};
	}

	const distCliPath = resolve(cwd, "dist/cli.js");
	if (existsSync(distCliPath) && commandExists("node")) {
		return {
			description: "repo dist CLI",
			originPath: distCliPath,
			remediationCommand: "node dist/cli.js <command>",
			command: "node",
			args: [distCliPath, "--version"],
		};
	}

	const wrapperPath = resolve(cwd, "scripts/harness-cli.sh");
	if (existsSync(wrapperPath)) {
		return {
			description: "repo wrapper",
			originPath: wrapperPath,
			remediationCommand: "bash scripts/harness-cli.sh <command>",
			command: "bash",
			args: [wrapperPath, "--version"],
		};
	}

	return undefined;
}

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

	const localProbe = probeCommand(localRunner.command, localRunner.args);
	if (!localProbe.ok || !localProbe.output) {
		return {
			status: "error",
			message: `Could not read repo-local harness version from ${localRunner.description} (${localRunner.originPath}): ${localProbe.errorMessage ?? "unknown error"}`,
			remediation: `Use repo-local runner explicitly: ${localRunner.remediationCommand}`,
			repoLocalOriginPath: localRunner.originPath,
		};
	}

	const repoLocalVersion = parseHarnessVersion(localProbe.output);
	if (!repoLocalVersion) {
		return {
			status: "error",
			message: `Could not parse repo-local harness version output from ${localRunner.description} (${localRunner.originPath})`,
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

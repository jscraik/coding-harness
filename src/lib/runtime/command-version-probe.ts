import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Result of probing a command for an installed runtime version. */
export interface CommandProbe {
	/** Whether the command executed successfully. */
	available: boolean;
	/** Parsed semantic version, when the probe output included one. */
	version?: string;
	/** Combined stdout and stderr from the probe command. */
	rawOutput?: string;
}

function getMiseToolName(command: string): string {
	return command === "python3" ? "python" : command;
}

function hasMiseTool(command: string, misePath: string): boolean {
	const toolName = getMiseToolName(command);
	const contents = readFileSync(misePath, "utf-8");
	return contents.split(/\r?\n/).some((line) => {
		const match = line.match(/^\s*["']?([^"'=\s]+)["']?\s*=/);
		return match?.[1] === toolName;
	});
}

function resolveMiseCommand(command: string): string | undefined {
	const misePath = resolve(process.cwd(), ".mise.toml");
	if (!existsSync(misePath)) {
		return command;
	}
	if (!hasMiseTool(command, misePath)) {
		return command;
	}
	const miseProbe = spawnSync("mise", ["--version"], {
		encoding: "utf-8",
		stdio: ["ignore", "pipe", "pipe"],
	});
	if (miseProbe.error || miseProbe.status !== 0) {
		return undefined;
	}

	const result = spawnSync("mise", ["--cd", process.cwd(), "which", command], {
		encoding: "utf-8",
		stdio: ["ignore", "pipe", "pipe"],
	});
	if (result.status !== 0) {
		return undefined;
	}

	const resolved = result.stdout.trim();
	return resolved === "" ? undefined : resolved;
}

/**
 * Probe a command version, preferring the repo-pinned mise tool when available.
 *
 * @param command - Command name to resolve and execute.
 * @param args - Arguments passed to the command.
 * @param extractVersion - Parser for the command output.
 * @returns Availability, raw output, and parsed version when present.
 */
export function probeCommandVersion(
	command: string,
	args: string[],
	extractVersion: (output: string) => string | undefined,
): CommandProbe {
	const resolvedCommand = resolveMiseCommand(command);
	if (resolvedCommand === undefined) {
		return { available: false };
	}
	const result = spawnSync(resolvedCommand, args, {
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

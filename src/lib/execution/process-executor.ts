import { spawn } from "node:child_process";
import type { ExecutionRequest } from "./execution-result.js";

/** Terminal process outcome collected without exposing raw logs to stdout. */
export interface ProcessOutcome {
	exitCode: number | null;
	signal: string | null;
	stdout: string;
	stderr: string;
}

/** Injectable process handle used by the coordinator and deterministic tests. */
export interface ProcessHandle {
	result: Promise<ProcessOutcome>;
	cancel(): void;
	pid?: number;
}

/** Process-launch adapter used to keep coordinator behavior injectable in tests. */
export interface ProcessExecutor {
	start(request: ExecutionRequest): ProcessHandle;
}

/** Terminate the child process group without throwing during cleanup. */
function killProcessGroup(pid: number | undefined): void {
	if (pid === undefined) return;
	try {
		if (process.platform !== "win32") process.kill(-pid, "SIGTERM");
		else process.kill(pid, "SIGTERM");
	} catch {
		try {
			process.kill(pid, "SIGTERM");
		} catch {
			// The process already exited; no further cleanup is required.
		}
	}
}

/** Spawn one command without a shell and retain process-group cancellation. */
export const spawnProcessExecutor: ProcessExecutor = {
	/** Launch one command with shell execution disabled. */
	start(request) {
		const executable = request.command[0];
		if (!executable) throw new Error("Execution command must not be empty.");
		const child = spawn(executable, request.command.slice(1), {
			cwd: request.cwd,
			shell: false,
			detached: process.platform !== "win32",
			stdio: ["ignore", "pipe", "pipe"],
		});
		let stdout = "";
		let stderr = "";
		child.stdout?.setEncoding("utf8");
		child.stderr?.setEncoding("utf8");
		child.stdout?.on("data", (chunk: string) => {
			stdout += chunk;
		});
		child.stderr?.on("data", (chunk: string) => {
			stderr += chunk;
		});
		const result = new Promise<ProcessOutcome>((resolve, reject) => {
			child.once("error", reject);
			child.once("close", (exitCode, signal) => {
				resolve({ exitCode, signal, stdout, stderr });
			});
		});
		const handle: ProcessHandle = {
			result,
			cancel: () => killProcessGroup(child.pid),
		};
		if (child.pid !== undefined) handle.pid = child.pid;
		return handle;
	},
};

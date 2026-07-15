import { existsSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import {
	parseExecutionRunOptions,
	type ExecutionRunOptions,
} from "../lib/execution/execution-run-options.js";
import { LocalJobConductor } from "../lib/execution/job-conductor.js";
import {
	createExecutionJobResponse,
	type ExecutionJob,
	type ExecutionJobResponse,
} from "../lib/execution/execution-job.js";

/** Return the value immediately following a command option. */
function valueAfter(args: readonly string[], flag: string): string | undefined {
	const index = args.indexOf(flag);
	const value = args[index + 1];
	return index === -1 || value === undefined || value.startsWith("-")
		? undefined
		: value;
}

/** Keep operator-selected artifact paths inside the checkout. */
function withinRoot(root: string, candidate: string): boolean {
	const rel = relative(root, candidate);
	return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

/** Parse and constrain the durable ticket artifact root. */
function artifactsRoot(
	args: readonly string[],
): { ok: true; path: string } | { ok: false; message: string } {
	const repoRoot = resolve(process.cwd());
	const path = resolve(
		valueAfter(args, "--artifacts-dir") ?? "artifacts/agent-runs",
	);
	if (!withinRoot(repoRoot, path)) {
		return {
			ok: false,
			message: "--artifacts-dir must remain inside the repository root.",
		};
	}
	return { ok: true, path };
}

/** Parse the bounded wait timeout. */
function timeoutSeconds(
	args: readonly string[],
): { ok: true; value: number } | { ok: false; message: string } {
	const raw = valueAfter(args, "--timeout-seconds");
	const value = raw === undefined ? 300 : Number(raw);
	if (!Number.isInteger(value) || value < 1 || value > 86_400) {
		return {
			ok: false,
			message: "--timeout-seconds must be an integer from 1 to 86400.",
		};
	}
	return { ok: true, value };
}

/** Render one ticket or ticket list for humans or machines. */
function printJob(
	job: ExecutionJob | ExecutionJob[],
	json: boolean,
	response: ExecutionJobResponse,
): void {
	if (json) {
		console.info(JSON.stringify(response));
		return;
	}
	if (Array.isArray(job)) {
		for (const entry of job) {
			const record = entry as { ticket?: string; status?: string };
			console.info(
				`${record.status ?? "unknown"}: ${record.ticket ?? "unknown"}`,
			);
		}
		return;
	}
	const record = job as {
		ticket?: string;
		status?: string;
		nextAction?: string;
	};
	console.info(`${record.status ?? "unknown"}: ${record.ticket ?? "unknown"}`);
	if (record.nextAction) console.info(record.nextAction);
}

/** Convert shared CLI options into a durable execution request. */
function executionRequest(options: ExecutionRunOptions) {
	return {
		command: options.command,
		cwd: options.cwd,
		...(options.requestKey ? { requestKey: options.requestKey } : {}),
		resourceLanes: options.resourceLanes,
		parallelSafe: options.parallelSafe,
		timeoutSeconds: options.timeoutSeconds,
		artifactsDir: options.artifactsDir,
	};
}

/** Submit one durable execution ticket. */
async function submitJob(
	args: readonly string[],
	json: boolean,
): Promise<number> {
	const parsed = parseExecutionRunOptions(args.slice(1));
	if (!parsed.ok) {
		console.error(`Execution Job Error: ${parsed.message}`);
		return 2;
	}
	const conductor = new LocalJobConductor({
		storeRoot: parsed.options.artifactsDir,
	});
	const result = await conductor.submit(executionRequest(parsed.options));
	const response = createExecutionJobResponse("submit", result.status, {
		job: result.job,
	});
	if (json) printJob(result.job, true, response);
	else {
		console.info(`${result.status}: ${result.job.ticket}`);
		console.info(`Artifacts: ${result.job.artifactsDir}/${result.job.ticket}`);
	}
	return result.status === "request_key_conflict" ? 1 : 0;
}

/** Build a Conductor for read/control operations after path validation. */
function controlConductor(
	args: readonly string[],
): { ok: true; conductor: LocalJobConductor } | { ok: false } {
	const root = artifactsRoot(args);
	if (!root.ok) {
		console.error(`Execution Job Error: ${root.message}`);
		return { ok: false };
	}
	if (existsSync(root.path) && !statSync(root.path).isDirectory()) {
		console.error("Execution Job Error: artifact root is not a directory.");
		return { ok: false };
	}
	return {
		ok: true,
		conductor: new LocalJobConductor({ storeRoot: root.path }),
	};
}

/** Read the required ticket argument and report usage errors. */
function requiredTicket(args: readonly string[]): string | undefined {
	const ticket = valueAfter(args, "--ticket");
	if (!ticket) console.error("Execution Job Error: --ticket is required.");
	return ticket;
}

/** List durable tickets. */
async function listJobs(
	args: readonly string[],
	json: boolean,
): Promise<number> {
	const controlled = controlConductor(args);
	if (!controlled.ok) return 2;
	const jobs = await controlled.conductor.list();
	printJob(jobs, json, createExecutionJobResponse("list", "listed", { jobs }));
	return 0;
}

/** Read one durable ticket. */
async function statusJob(
	args: readonly string[],
	json: boolean,
): Promise<number> {
	const controlled = controlConductor(args);
	const ticket = requiredTicket(args);
	if (!controlled.ok || !ticket) return 2;
	const job = await controlled.conductor.status(ticket);
	if (!job) {
		if (json) {
			printJob([], true, createExecutionJobResponse("status", "not_found"));
		}
		return 1;
	}
	printJob(
		job,
		json,
		createExecutionJobResponse("status", job.status, { job }),
	);
	return job.status === "pass" ||
		job.status === "queued" ||
		job.status === "running"
		? 0
		: 1;
}

/** Wait for one ticket to reach terminal state. */
async function waitJob(
	args: readonly string[],
	json: boolean,
): Promise<number> {
	const controlled = controlConductor(args);
	const ticket = requiredTicket(args);
	const parsedTimeout = timeoutSeconds(args);
	if (!parsedTimeout.ok) {
		console.error(`Execution Job Error: ${parsedTimeout.message}`);
		return 2;
	}
	if (!controlled.ok || !ticket) return 2;
	const waited = await controlled.conductor.waitForOutcome(
		ticket,
		parsedTimeout.value,
	);
	if (!waited.job) {
		if (json) {
			printJob([], true, createExecutionJobResponse("wait", "not_found"));
		}
		return 1;
	}
	printJob(
		waited.job,
		json,
		createExecutionJobResponse(
			"wait",
			waited.timedOut ? "wait_timeout" : waited.job.status,
			{ job: waited.job, timedOut: waited.timedOut },
		),
	);
	return waited.job.status === "pass" ? 0 : 1;
}

/** Request cancellation for one ticket. */
async function cancelJob(
	args: readonly string[],
	json: boolean,
): Promise<number> {
	const controlled = controlConductor(args);
	const ticket = requiredTicket(args);
	if (!controlled.ok || !ticket) return 2;
	const job = await controlled.conductor.cancel(ticket);
	if (!job) {
		if (json) {
			printJob([], true, createExecutionJobResponse("cancel", "not_found"));
		}
		return 1;
	}
	printJob(
		job,
		json,
		createExecutionJobResponse("cancel", job.status, { job }),
	);
	return 0;
}

/** Run the hidden detached worker entrypoint. */
async function workerJob(args: readonly string[]): Promise<number> {
	const controlled = controlConductor(args);
	const ticket = requiredTicket(args);
	if (!controlled.ok || !ticket) return 2;
	return controlled.conductor.runWorker(ticket);
}

type JobHandler = (args: readonly string[], json: boolean) => Promise<number>;

const JOB_HANDLERS: Record<string, JobHandler> = {
	submit: submitJob,
	list: listJobs,
	status: statusJob,
	wait: waitJob,
	cancel: cancelJob,
	worker: (args) => workerJob(args),
};

/** Execute the durable local Conductor command family. */
export async function runExecutionJobCLI(
	args: readonly string[],
): Promise<number> {
	const subcommand = args[0];
	const json = args.includes("--json");
	if (!subcommand || subcommand === "--help" || subcommand === "-h") {
		console.info(
			"Usage: harness job <submit|list|status|wait|cancel> [options]",
		);
		return subcommand ? 0 : 2;
	}
	const handler = JOB_HANDLERS[subcommand];
	if (!handler) {
		console.error(`Execution Job Error: unknown subcommand: ${subcommand}`);
		return 2;
	}
	return handler(args, json);
}

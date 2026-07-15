import type { CommandInvocationEffect } from "./command-invocation-effects.js";

const JOB_TARGETS = [
	"artifacts/agent-runs/<ticket>/job.json",
	"artifacts/agent-runs/<ticket>/execution-result.json",
];
const JOB_AUTHORITY =
	"Local process and repository artifact-write authority are required.";
const JOB_ROLLBACK =
	"Remove the local ticket directory and its execution artifacts.";
const JOB_EVIDENCE = [
	"harness-execution-job/v1",
	"harness-execution-result/v1",
];

/** Characterization for the durable local execution Conductor commands. */
export const JOB_EFFECTS: readonly CommandInvocationEffect[] = [
	{
		invocation: "job submit",
		effectClasses: ["writes_artifact"],
		targets: JOB_TARGETS,
		providerClass: "local_job_conductor",
		authority: JOB_AUTHORITY,
		retryPolicy: "conditional",
		rollback: JOB_ROLLBACK,
		expectedEvidence: JOB_EVIDENCE,
	},
	{
		invocation: "job list|status|wait",
		effectClasses: ["writes_artifact"],
		targets: JOB_TARGETS,
		providerClass: "local_job_conductor",
		authority: JOB_AUTHORITY,
		retryPolicy: "conditional",
		rollback: JOB_ROLLBACK,
		expectedEvidence: JOB_EVIDENCE,
	},
	{
		invocation: "job cancel",
		effectClasses: ["writes_artifact"],
		targets: JOB_TARGETS,
		providerClass: "local_job_conductor",
		authority: JOB_AUTHORITY,
		retryPolicy: "conditional",
		rollback: JOB_ROLLBACK,
		expectedEvidence: JOB_EVIDENCE,
	},
	{
		invocation: "job worker",
		effectClasses: ["writes_artifact"],
		targets: JOB_TARGETS,
		providerClass: "local_job_conductor",
		authority: JOB_AUTHORITY,
		retryPolicy: "conditional",
		rollback: JOB_ROLLBACK,
		expectedEvidence: JOB_EVIDENCE,
	},
];

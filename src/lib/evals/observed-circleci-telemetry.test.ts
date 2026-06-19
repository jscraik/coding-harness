import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildObservedCircleCiTelemetry } from "./observed-circleci-telemetry.js";

const roots: string[] = [];

afterEach(() => {
	for (const root of roots.splice(0)) {
		rmSync(root, { recursive: true, force: true });
	}
});

describe("buildObservedCircleCiTelemetry", () => {
	it("normalizes failed CircleCI jobs into redacted eval seed evidence", () => {
		const root = makeRoot();
		writeFileSync(
			join(root, "jobs.json"),
			JSON.stringify({
				jobs: [
					{
						job_name: "typecheck",
						workflow_name: "pr-pipeline",
						pipeline_id: "pipe-1",
						workflow_id: "workflow-1",
						build_num: 123,
						vcs_revision: "abc123",
						vcs_branch: "feature/test",
						pull_request: "436",
						status: "failed",
						message:
							"TS2345 failed with GITHUB_TOKEN=super-secret and Circle-Token: circle-secret",
					},
				],
			}),
		);

		const outputPath = "artifacts/evals/observed-circleci-feed.json";
		const artifact = buildObservedCircleCiTelemetry({
			repoRoot: root,
			circleciTelemetryRoot: root,
			generatedAt: "2026-06-19T00:00:00.000Z",
			outputPath,
		});

		expect(artifact.summary).toMatchObject({
			jobsObserved: 1,
			failedJobs: 1,
			blockedJobs: 0,
			candidateEvalSeeds: 1,
		});
		expect(artifact.summary.failureClasses).toEqual({ typescript_error: 1 });
		expect(artifact.jobs[0]).toMatchObject({
			checkName: "ci/circleci: typecheck",
			workflowName: "pr-pipeline",
			jobNumber: "123",
			failureClass: "typescript_error",
			candidateEvalSeed: "circleci-typescript-error",
		});
		expect(artifact.jobs[0]?.excerpt).toContain("GITHUB_TOKEN=<redacted>");
		expect(artifact.jobs[0]?.excerpt).toContain("Circle-Token: <redacted>");
		expect(artifact.jobs[0]?.excerpt).not.toContain("super-secret");
		expect(artifact.jobs[0]?.evidenceRefs).toContain("circleci://build/123");
		expect(JSON.parse(readFileSync(join(root, outputPath), "utf8"))).toEqual(
			artifact,
		);
	});

	it("reads JSONL telemetry and classifies auth blockers", () => {
		const root = makeRoot();
		writeFileSync(
			join(root, "jobs.jsonl"),
			[
				JSON.stringify({
					name: "security/snyk",
					status: "unauthorized",
					message: "Forbidden token permission failure",
				}),
				"",
			].join("\n"),
		);

		const artifact = buildObservedCircleCiTelemetry({
			circleciTelemetryRoot: root,
			generatedAt: "2026-06-19T00:00:00.000Z",
		});

		expect(artifact.summary).toMatchObject({
			jobsObserved: 1,
			blockedJobs: 1,
			candidateEvalSeeds: 1,
		});
		expect(artifact.jobs[0]).toMatchObject({
			status: "blocked",
			failureClass: "circleci_auth_blocked",
			candidateEvalSeed: "circleci-circleci-auth-blocked",
		});
	});

	it("emits unavailable source artifact when telemetry is absent", () => {
		const root = makeRoot();
		const artifact = buildObservedCircleCiTelemetry({
			repoRoot: root,
			circleciTelemetryRoot: join(root, "missing"),
			generatedAt: "2026-06-19T00:00:00.000Z",
			outputPath: "artifact.json",
		});

		expect(artifact.source).toMatchObject({
			status: "unavailable",
			reason: "CircleCI telemetry root does not exist.",
		});
		expect(artifact.summary.jobsObserved).toBe(0);
		expect(
			JSON.parse(readFileSync(join(root, "artifact.json"), "utf8")),
		).toEqual(artifact);
	});
});

function makeRoot(): string {
	const root = mkdtempSync(join(tmpdir(), "observed-circleci-"));
	roots.push(root);
	return root;
}

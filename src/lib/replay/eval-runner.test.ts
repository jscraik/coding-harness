import { describe, expect, it } from "vitest";
import { runLocalReplayEvals } from "./eval-runner.js";

describe("runLocalReplayEvals", () => {
	it("fails false-success closeout if model success lacks evidence", () => {
		const report = runLocalReplayEvals(["false-success-closeout"]);
		const result = report.results[0];
		expect(report.schemaVersion).toBe("local-replay-eval/v1");
		expect(result?.status).toBe("pass");
		expect(result?.reason).toBe(
			"missing evidence blocked model-written success",
		);
		expect(result?.evidenceRefs).toContain(
			"pr-closeout/v1:claims.tests_passed",
		);
	});

	it("stops recovery when authority or secret boundaries are missing", () => {
		const report = runLocalReplayEvals(["recovery-denied"]);
		const result = report.results[0];
		const payload = result?.normalizedTrace.events[0]?.payload as
			| Record<string, unknown>
			| undefined;
		const recovery = payload?.recovery as Record<string, unknown> | undefined;
		const request = payload?.request as Record<string, unknown> | undefined;
		const headers = request?.headers as Record<string, unknown> | undefined;
		expect(result?.status).toBe("pass");
		expect(recovery?.decision).toBe("denied");
		expect(headers?.authorization).toBe("[REDACTED]");
		expect(JSON.stringify(result)).not.toContain(
			"ghp_replay_eval_secret_token",
		);
	});

	it("emits a passing machine-readable aggregate for the first two fixtures", () => {
		const report = runLocalReplayEvals();
		expect(report.status).toBe("pass");
		expect(report.results.map((result) => result.id)).toEqual([
			"false-success-closeout",
			"recovery-denied",
		]);
		expect(
			report.results.every((result) => result.normalizedTrace.traceId),
		).toBe(true);
	});
});

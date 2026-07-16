import { afterEach, describe, expect, it, vi } from "vitest";
import { createAgentNativePacketCommandSpecs } from "./agent-native-packet-command-specs.js";

afterEach(() => {
	vi.restoreAllMocks();
});

describe("agent-native packet command specs", () => {
	it.each([
		["agent-native-ratchets", "agent-native-ratchets/v1"],
		["session-distill", "session-distill/v1"],
		["agent-rework", "agent-rework/v1"],
		["governance-decision-surface", "governance-decision-surface/v1"],
	] as const)("routes the routine %s producer through canonical validation before compatibility output", (commandName, expectedSchemaVersion) => {
		const stdout = vi.spyOn(process.stdout, "write").mockReturnValue(true);
		const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
		const spec = createAgentNativePacketCommandSpecs().find(
			(candidate) => candidate.name === commandName,
		);

		expect(spec).toBeDefined();
		expect(spec?.execute([commandName])).toBe(0);
		const emitted = stdout.mock.calls.map(([chunk]) => String(chunk)).join("");
		expect(JSON.parse(emitted)).toMatchObject({
			schemaVersion: expectedSchemaVersion,
		});
		expect(stderr).not.toHaveBeenCalled();
	});

	it("preserves reviewer compatibility output and exit after canonical projection", () => {
		const stdout = vi.spyOn(process.stdout, "write").mockReturnValue(true);
		const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
		const spec = createAgentNativePacketCommandSpecs().find(
			(candidate) => candidate.name === "reviewer-decision",
		);

		expect(spec?.execute(["reviewer-decision"])).toBe(0);
		expect(
			JSON.parse(stdout.mock.calls.map(([chunk]) => String(chunk)).join("")),
		).toMatchObject({
			schemaVersion: "reviewer-decision/v1",
			status: "needs_evidence",
			decision: "needs_evidence",
		});
		expect(stderr).not.toHaveBeenCalled();
	});
});

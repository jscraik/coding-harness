import { spawnSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { canonicalizeLegacyPacket } from "../../synaipse/packet-canonicalization.js";
import { createAgentNativePacketCommandSpecs } from "./agent-native-packet-command-specs.js";

vi.mock("node:child_process", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:child_process")>();
	return { ...actual, spawnSync: vi.fn(actual.spawnSync) };
});

vi.mock("../../synaipse/packet-canonicalization.js", async (importOriginal) => {
	const actual =
		await importOriginal<
			typeof import("../../synaipse/packet-canonicalization.js")
		>();
	return {
		...actual,
		canonicalizeLegacyPacket: vi.fn(actual.canonicalizeLegacyPacket),
	};
});

beforeEach(() => {
	vi.mocked(canonicalizeLegacyPacket).mockImplementation((schemaVersion) => ({
		status: "complete",
		valid: true,
		errors: [],
		sourceSchemaVersion: schemaVersion,
		targetSchemaVersion:
			schemaVersion === "agent-native-ratchets/v1" ||
			schemaVersion === "session-distill/v1"
				? "synaipse-state/v1"
				: "synaipse-transition/v1",
		record: {} as never,
	}));
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("agent-native packet command specs", () => {
	it("allocates a bounded producer buffer above Node's one-megabyte default", () => {
		const stdout = vi.spyOn(process.stdout, "write").mockReturnValue(true);
		const spec = createAgentNativePacketCommandSpecs().find(
			(candidate) => candidate.name === "session-distill",
		);

		expect(spec?.execute(["session-distill"])).toBe(0);
		const options = vi.mocked(spawnSync).mock.calls.at(-1)?.[2];
		expect(options).toEqual(
			expect.objectContaining({ maxBuffer: 64 * 1024 * 1024 }),
		);
		expect(stdout).toHaveBeenCalled();
	});

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

	it("preserves legacy JSON and exit when canonical projection is invalid", () => {
		vi.mocked(canonicalizeLegacyPacket).mockReturnValueOnce({
			status: "invalid",
			valid: false,
			errors: ["coverageReceipt.evidenceRefs must not be empty"],
			sourceSchemaVersion: "reviewer-decision/v1",
			targetSchemaVersion: "synaipse-transition/v1",
			record: null,
		});
		const stdout = vi.spyOn(process.stdout, "write").mockReturnValue(true);
		const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
		const spec = createAgentNativePacketCommandSpecs().find(
			(candidate) => candidate.name === "reviewer-decision",
		);

		expect(spec?.execute(["reviewer-decision"])).toBe(0);
		expect(
			JSON.parse(stdout.mock.calls.map(([chunk]) => String(chunk)).join("")),
		).toMatchObject({ schemaVersion: "reviewer-decision/v1" });
		expect(
			JSON.parse(stderr.mock.calls.map(([chunk]) => String(chunk)).join("")),
		).toEqual({
			diagnostic: "canonical_projection_invalid",
			sourceSchemaVersion: "reviewer-decision/v1",
			targetSchemaVersion: "synaipse-transition/v1",
			reasons: ["coverageReceipt.evidenceRefs must not be empty"],
		});
	});
});

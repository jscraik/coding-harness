import { describe, expect, it } from "vitest";
import { getRegistryCommandCatalogDocument } from "../cli/command-registry.js";
import { measureRetainedPacketCommands } from "./packet-consolidation-measurement.js";

describe("packet consolidation measurement", () => {
	it("reports a compatibility command missing from the live registry", () => {
		const catalog = getRegistryCommandCatalogDocument();
		const commands = catalog.commands.filter(
			(command) => command.name !== "reviewer-decision",
		);

		expect(
			measureRetainedPacketCommands({
				...catalog,
				commandCount: commands.length,
				commands,
			}),
		).toMatchObject({
			retained: expect.not.arrayContaining([
				"harness reviewer-decision --json",
			]),
			missing: ["harness reviewer-decision --json"],
		});
	});
});

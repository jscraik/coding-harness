import { describe, expect, it } from "vitest";

import { PACKET_FAMILY_REGISTRY } from "../lib/synaipse/packet-consolidation.js";
import { agentNativeRatchetMeta } from "./next-agent-native-ratchets.js";

describe("agentNativeRatchetMeta", () => {
	it("uses the canonical packet family registry for emitted packet versions", () => {
		const meta = agentNativeRatchetMeta();
		const ratchets = meta.agentNativeRatchets as { packets?: unknown };

		expect(ratchets.packets).toEqual(
			PACKET_FAMILY_REGISTRY.map((family) => family.schemaVersion),
		);
	});
});

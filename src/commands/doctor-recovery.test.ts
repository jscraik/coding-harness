import { describe, expect, it } from "vitest";
import {
	buildRecoveryGuidance,
	renderRecoveryGuidance,
} from "./doctor-recovery.js";
import type { DoctorCheck } from "./doctor.js";

function makeCheck(
	id: string,
	status: DoctorCheck["status"],
	message: string,
): DoctorCheck {
	return {
		id,
		category: "config",
		label: "test",
		status,
		message,
	};
}

describe("buildRecoveryGuidance", () => {
	it("returns empty when all checks pass", () => {
		const checks: DoctorCheck[] = [
			makeCheck(
				"config:north-star-contract",
				"ok",
				"canonical north-star runtime surfaces are present",
			),
		];
		expect(buildRecoveryGuidance(checks)).toEqual([]);
	});

	it("returns empty for unrecognized failing checks", () => {
		const checks: DoctorCheck[] = [
			makeCheck("tool:node", "fail", "node is not installed"),
		];
		expect(buildRecoveryGuidance(checks)).toEqual([]);
	});

	it("maps missing northStar block to admission_incomplete / A2", () => {
		const checks: DoctorCheck[] = [
			makeCheck(
				"config:north-star-contract",
				"fail",
				"northStar block missing — runtime north-star contract is not load-bearing",
			),
		];
		const result = buildRecoveryGuidance(checks);
		expect(result).toHaveLength(1);
		expect(result[0]!.failureClass).toBe("admission_incomplete");
		expect(result[0]!.resumeState).toBe("A2");
		expect(result[0]!.afterFixGate).toBe("harness preflight-gate --json");
	});

	it("maps missing productSurface to surface_registration_gap / A2", () => {
		const checks: DoctorCheck[] = [
			makeCheck(
				"config:north-star-contract",
				"fail",
				"productSurface registry missing or empty — governed north-star surfaces are not explicit",
			),
		];
		const result = buildRecoveryGuidance(checks);
		expect(result).toHaveLength(1);
		expect(result[0]!.failureClass).toBe("surface_registration_gap");
		expect(result[0]!.resumeState).toBe("A2");
		expect(result[0]!.afterFixGate).toBe("harness drift-gate --json");
	});

	it("maps missing overrideReviewerRegistry to admission_unjustified / A2", () => {
		const checks: DoctorCheck[] = [
			makeCheck(
				"config:north-star-contract",
				"fail",
				"overrideReviewerRegistry is missing or empty — north-star override trust cannot be verified",
			),
		];
		const result = buildRecoveryGuidance(checks);
		expect(result).toHaveLength(1);
		expect(result[0]!.failureClass).toBe("admission_unjustified");
		expect(result[0]!.resumeState).toBe("A2");
		expect(result[0]!.afterFixGate).toBe("harness review-gate --json");
	});

	it("maps invalid contract to contract_invalid with no resume state", () => {
		const checks: DoctorCheck[] = [
			makeCheck(
				"config:north-star-contract",
				"fail",
				"harness.contract.json is invalid, so north-star runtime readiness cannot be verified",
			),
		];
		const result = buildRecoveryGuidance(checks);
		expect(result).toHaveLength(1);
		expect(result[0]!.failureClass).toBe("contract_invalid");
		expect(result[0]!.resumeState).toBe("—");
		expect(result[0]!.afterFixGate).toBe("harness doctor --json");
	});

	it("maps missing north-star doc to drift_blocking / A4", () => {
		const checks: DoctorCheck[] = [
			{
				id: "file:north-star-doc",
				category: "file",
				label: "docs/roadmap/north-star.md",
				status: "fail",
				message:
					"missing — drift-gate health mode cannot verify canonical north-star parity without this file",
			},
		];
		const result = buildRecoveryGuidance(checks);
		expect(result).toHaveLength(1);
		expect(result[0]!.failureClass).toBe("drift_blocking");
		expect(result[0]!.resumeState).toBe("A4");
		expect(result[0]!.afterFixGate).toBe("harness drift-gate --json");
	});

	it("orders multiple guidance entries", () => {
		const checks: DoctorCheck[] = [
			makeCheck(
				"config:north-star-contract",
				"fail",
				"northStar block missing",
			),
			{
				id: "file:north-star-doc",
				category: "file",
				label: "docs/roadmap/north-star.md",
				status: "fail",
				message: "missing",
			},
		];
		const result = buildRecoveryGuidance(checks);
		expect(result).toHaveLength(2);
		expect(result[0]!.failureClass).toBe("admission_incomplete");
		expect(result[1]!.failureClass).toBe("drift_blocking");
	});
});

describe("renderRecoveryGuidance", () => {
	it("returns empty array for empty guidance", () => {
		expect(renderRecoveryGuidance([])).toEqual([]);
	});

	it("renders a single guidance entry with resume state", () => {
		const lines = renderRecoveryGuidance([
			{
				failureClass: "admission_incomplete",
				resumeState: "A2",
				headline: "North-star admission declaration is incomplete",
				nextStep: "Add the canonical northStar block",
				afterFixGate: "harness preflight-gate --json",
			},
		]);
		const text = lines.join("\n");
		expect(text).toContain("Recovery Guidance");
		expect(text).toContain("[admission_incomplete]");
		expect(text).toContain("Resume from A2");
		expect(text).toContain("North-star admission declaration is incomplete");
		expect(text).toContain("harness preflight-gate --json");
	});

	it("renders contract_invalid with no-auto-resume label", () => {
		const lines = renderRecoveryGuidance([
			{
				failureClass: "contract_invalid",
				resumeState: "—",
				headline: "Contract is structurally invalid",
				nextStep: "Repair harness.contract.json",
				afterFixGate: "harness doctor --json",
			},
		]);
		const text = lines.join("\n");
		expect(text).toContain("[contract_invalid]");
		expect(text).toContain("No auto-resume");
	});
});

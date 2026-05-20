/**
 * Memory policy gate command
 *
 * Validates local-memory workflow compliance:
 * - Schema validation for memory.json
 * - Read-first preamble enforcement (bootstrap + search)
 * - Write-discipline checks (no raw dumps, no speculation)
 * - Closeout validation (FORJAMIE.md updated)
 */

import {
	runMemoryGate,
	runMemoryGateCLI,
	type MemoryGateOptions,
} from "../lib/memory-gate.js";

export { runMemoryGate, runMemoryGateCLI };
export type { MemoryGateOptions };

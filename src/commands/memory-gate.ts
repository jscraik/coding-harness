/**
 * Memory policy gate command
 *
 * Validates local-memory workflow compliance:
 * - Schema validation for memory.json
 * - Read-first preamble enforcement (bootstrap + search)
 * - Write-discipline checks (no raw dumps, no speculation)
 * - Closeout validation (FORJAMIE.md updated)
 */

import type { MemoryGateOptions } from "../lib/memory/types.js";
import { runMemoryGate, runMemoryGateCLI } from "../lib/memory/validator.js";

export { runMemoryGate, runMemoryGateCLI };
export type { MemoryGateOptions };

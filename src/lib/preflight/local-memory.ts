import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { runSmokeCycle } from "./local-memory-smoke.js";

/**
 * Optional overrides for local-memory preflight execution paths.
 */
export interface LocalMemoryPreflightOptions {
	configPath?: string;
	daemonLogPath?: string;
}

/**
 * Result payload for local-memory preflight checks.
 */
export interface LocalMemoryPreflightOutput {
	passed: boolean;
	messages: string[];
	healthUrl?: string;
	version?: string;
}

interface ParsedLocalMemoryConfig {
	hostPolicyOk: boolean;
	autoPortPolicyOk: boolean;
	restHost: string;
	restPort: number;
}

const DEFAULT_CONFIG_PATH = `${process.env.HOME}/.local-memory/config.yaml`;
const DEFAULT_DAEMON_LOG_PATH = `${process.env.HOME}/.local-memory/daemon.log`;

/**
 * Pause execution for a specified duration.
 *
 * @param ms - Duration to wait in milliseconds
 * @returns Resolves with no value after the specified duration
 */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extracts the last line that begins with `{` from a newline-delimited string.
 *
 * @param raw - The raw multi-line text to scan (for example, combined stdout/stderr).
 * @returns The last line starting with `{`, or an empty string if no such line exists.
 */
function extractLastJsonLine(raw: string): string {
	let lastJsonLine = "";
	for (const line of raw.split(/\r?\n/)) {
		if (line.startsWith("{")) {
			lastJsonLine = line;
		}
	}
	return lastJsonLine;
}

/**
 * Parses a JSON string into a typed value.
 *
 * @param raw - The JSON text to parse.
 * @returns The parsed value if `raw` is valid JSON, `undefined` otherwise.
 */
function parseJson<T>(raw: string): T | undefined {
	try {
		return JSON.parse(raw) as T;
	} catch {
		return undefined;
	}
}

/**
 * Executes a system command synchronously and returns its combined stdout/stderr and success status.
 *
 * @param command - The executable or command to run
 * @param args - Array of command-line arguments to pass to the command
 * @returns An object with `ok` set to `true` when the process exited with status `0` and no spawn error, and `output` containing the concatenated stdout and stderr (trimmed)
 */
function commandOutput(
	command: string,
	args: string[],
): {
	ok: boolean;
	output: string;
} {
	const result = spawnSync(command, args, {
		encoding: "utf-8",
		stdio: ["ignore", "pipe", "pipe"],
	});
	return {
		ok: !result.error && result.status === 0,
		output: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim(),
	};
}

/**
 * Detects whether daemon output contains the PID-file sandbox permission failure pattern.
 *
 * @param output - Combined stdout/stderr text from a `local-memory` command
 * @returns `true` if `output` contains both `"failed to write PID file"` and `"operation not permitted"`, `false` otherwise
 */
function isLocalMemoryPidfileSandboxBlock(output: string): boolean {
	return (
		output.includes("failed to write PID file") &&
		output.includes("operation not permitted")
	);
}

/**
 * Reads a local-memory YAML config file and extracts REST API settings and policy checks.
 *
 * Parses only the indented `rest_api:` block from the given file (by scanning lines), extracts
 * `host`, `port`, and the presence of `auto_port: false`, and returns the resolved REST host/port
 * along with two policy booleans:
 * - `hostPolicyOk` is `true` when `rest_api.host` equals `127.0.0.1`.
 * - `autoPortPolicyOk` is `true` when `rest_api.auto_port` is explicitly set to `false`.
 *
 * If `host` or `port` are not found, defaults are used: `restHost = "127.0.0.1"` and `restPort = 3002`.
 *
 * @param configPath - Path to the YAML config file to read and parse.
 * @returns An object with `hostPolicyOk`, `autoPortPolicyOk`, `restHost`, and `restPort`.
 */
function parseConfig(configPath: string): ParsedLocalMemoryConfig {
	const raw = readFileSync(configPath, "utf-8");
	const lines = raw.split(/\r?\n/);
	let inRestApiBlock = false;
	let hostPolicyOk = false;
	let autoPortPolicyOk = false;
	let restHost = "127.0.0.1";
	let restPort = 3002;

	for (const line of lines) {
		if (/^[\t ]*rest_api:[\t ]*$/.test(line)) {
			inRestApiBlock = true;
			continue;
		}
		if (inRestApiBlock && /^[^ \t]/.test(line) && line.trim().length > 0) {
			inRestApiBlock = false;
		}
		if (!inRestApiBlock) {
			continue;
		}

		const hostMatch = line.match(/^[\t ]*host:[\t ]*"?([^"#]+)"?/);
		if (hostMatch) {
			restHost = hostMatch[1]?.trim() || restHost;
			hostPolicyOk = restHost === "127.0.0.1";
			continue;
		}

		if (/^[\t ]*auto_port:[\t ]*false([\t ]*#.*)?$/.test(line)) {
			autoPortPolicyOk = true;
			continue;
		}

		const portMatch = line.match(/^[\t ]*port:[\t ]*([0-9]+)/);
		if (portMatch?.[1]) {
			restPort = Number.parseInt(portMatch[1], 10);
		}
	}

	return {
		hostPolicyOk,
		autoPortPolicyOk,
		restHost,
		restPort,
	};
}

/**
 * Fetches a URL and returns the response status and body text, enforcing a 5-second timeout.
 *
 * The provided `init` options are passed to `fetch` but the `signal` is overridden to abort after 5000 ms.
 *
 * @param url - The request URL
 * @param init - Optional `fetch` init options to apply to the request; `signal` will be replaced with a 5s timeout signal
 * @returns An object with `ok` indicating HTTP success, the numeric `status`, and the response `text`
 */
async function fetchText(
	url: string,
	init?: RequestInit,
): Promise<{ ok: boolean; status: number; text: string }> {
	const response = await fetch(url, {
		...init,
		signal: AbortSignal.timeout(5_000),
	});
	return {
		ok: response.ok,
		status: response.status,
		text: await response.text(),
	};
}

/**
 * Fetches the given URL and parses the response body as JSON.
 *
 * @param url - The request URL
 * @param init - Optional fetch init options (method, headers, body, etc.)
 * @returns An object with the HTTP `status`, an `ok` flag, and `json` which is the parsed response body or `undefined` if parsing failed
 */
async function fetchJson(
	url: string,
	init?: RequestInit,
): Promise<{ ok: boolean; status: number; json?: unknown }> {
	const response = await fetchText(url, init);
	return {
		ok: response.ok,
		status: response.status,
		json: parseJson(response.text),
	};
}

/**
 * Determine the count of search hits represented by common response payload shapes.
 *
 * Accepts multiple possible payload shapes returned by the local-memory API or search endpoints and infers a hit count.
 *
 * @param payload - The response payload to inspect. Supported shapes:
 *   - An array (returns its length)
 *   - An object with `search_info.total_results` (numeric)
 *   - An object with a `results` array
 *   - An object with a `data.results` array
 *   - An object where `data` is an array
 * @returns The inferred hit count, or `0` if no recognizable count is found.
 */
function getSearchHitCount(payload: unknown): number {
	if (Array.isArray(payload)) {
		return payload.length;
	}
	if (!payload || typeof payload !== "object") {
		return 0;
	}

	const record = payload as Record<string, unknown>;
	if (typeof record.search_info === "object" && record.search_info) {
		const searchInfo = record.search_info as Record<string, unknown>;
		if (typeof searchInfo.total_results === "number") {
			return searchInfo.total_results;
		}
	}
	if (Array.isArray(record.results)) {
		return record.results.length;
	}
	if (typeof record.data === "object" && record.data) {
		const data = record.data as Record<string, unknown>;
		if (Array.isArray(data.results)) {
			return data.results.length;
		}
		if (Array.isArray(record.data)) {
			return record.data.length;
		}
	}
	return 0;
}

/**
 * Extracts a memory identifier from a JSON-like payload.
 *
 * Checks the top-level `id` and `memory_id` fields, then looks for `id` or `memory_id`
 * inside a nested `data` object.
 *
 * @param payload - The value to search for a memory identifier; typically an object parsed from JSON.
 * @returns The memory ID string if found, `undefined` otherwise.
 */
function extractMemoryId(payload: unknown): string | undefined {
	if (!payload || typeof payload !== "object") {
		return undefined;
	}
	const record = payload as Record<string, unknown>;
	if (typeof record.id === "string") {
		return record.id;
	}
	if (typeof record.memory_id === "string") {
		return record.memory_id;
	}
	if (typeof record.data === "object" && record.data) {
		const data = record.data as Record<string, unknown>;
		if (typeof data.id === "string") {
			return data.id;
		}
		if (typeof data.memory_id === "string") {
			return data.memory_id;
		}
	}
	return undefined;
}

/**
 * Extracts a relationship identifier from common payload shapes.
 *
 * @param payload - An object that may contain `id` or `relationship_id` at the top level or inside a `data` object.
 * @returns The extracted relationship id as a string if present, `undefined` otherwise.
 */
function extractRelationshipId(payload: unknown): string | undefined {
	if (!payload || typeof payload !== "object") {
		return undefined;
	}
	const record = payload as Record<string, unknown>;
	if (typeof record.id === "string") {
		return record.id;
	}
	if (typeof record.relationship_id === "string") {
		return record.relationship_id;
	}
	if (typeof record.data === "object" && record.data) {
		const data = record.data as Record<string, unknown>;
		if (typeof data.id === "string") {
			return data.id;
		}
		if (typeof data.relationship_id === "string") {
			return data.relationship_id;
		}
	}
	return undefined;
}

/**
 * Determines whether a health payload explicitly reports success.
 *
 * Health checks are fail-closed: only `success === true` counts as healthy.
 */
function isHealthSuccessPayload(payload: unknown): boolean {
	if (!payload || typeof payload !== "object") {
		return false;
	}
	return (payload as Record<string, unknown>).success === true;
}

/**
 * Determines whether a parsed API/service payload should be considered successful.
 *
 * If the payload is an object and contains a boolean `success` property, that value is used;
 * otherwise any object payload is treated as successful. Non-object or falsy payloads are treated as failures.
 *
 * @param payload - The value to inspect for an explicit `success` boolean or implicit success.
 * @returns `true` if the payload represents success, `false` otherwise.
 */
function isSuccessPayload(payload: unknown): boolean {
	if (!payload || typeof payload !== "object") {
		return false;
	}
	const record = payload as Record<string, unknown>;
	if (typeof record.success === "boolean") {
		return record.success;
	}
	return true;
}

/**
 * Polls the local-memory health endpoint until it reports success or the attempt limit is reached.
 *
 * Repeatedly requests `healthUrl`, ignoring transient errors, and waits 1 second between attempts.
 *
 * @param healthUrl - The full URL of the local-memory health endpoint to poll (e.g. `http://127.0.0.1:3002/api/v1/health`).
 * @param maxAttempts - Maximum number of attempts before giving up.
 * @returns The parsed health JSON when the endpoint indicates success, `undefined` if health was not achieved within `maxAttempts`.
 */
async function waitForLocalMemoryHealth(
	healthUrl: string,
	maxAttempts: number,
): Promise<unknown | undefined> {
	for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
		try {
			const response = await fetchJson(healthUrl);
			if (response.ok && isHealthSuccessPayload(response.json)) {
				return response.json;
			}
		} catch {
			// Ignore transient startup races and retry until the timeout budget is spent.
		}
		await sleep(1_000);
	}
	return undefined;
}

/** Builds a preflight failure result. */
function failOutput(
	messages: string[],
	message: string,
	extra: { healthUrl?: string; version?: string } = {},
): { ok: false; output: LocalMemoryPreflightOutput } {
	messages.push(`❌ ${message}`);
	return {
		ok: false,
		output: {
			passed: false,
			messages,
			...(extra.healthUrl ? { healthUrl: extra.healthUrl } : {}),
			...(extra.version ? { version: extra.version } : {}),
		},
	};
}

/** Probes the local-memory binary and config. */
async function probeBinaryAndConfig(
	options: LocalMemoryPreflightOptions,
	messages: string[],
): Promise<
	| { ok: false; output: LocalMemoryPreflightOutput }
	| { ok: true; version: string; parsedConfig: ParsedLocalMemoryConfig }
> {
	const configPath = options.configPath ?? DEFAULT_CONFIG_PATH;
	const versionProbe = commandOutput("local-memory", ["--version"]);
	if (!versionProbe.ok) {
		return failOutput(messages, "missing binary: local-memory");
	}
	const version = versionProbe.output.replace(/\r/g, "");
	messages.push(`local-memory version: ${version}`);

	if (!existsSync(configPath)) {
		messages.push(`❌ local-memory config missing: ${configPath}`);
		messages.push(
			"   Set LOCAL_MEMORY_CONFIG_PATH if your config lives elsewhere.",
		);
		return { ok: false, output: { passed: false, messages, version } };
	}

	const parsedConfig = parseConfig(configPath);
	if (!parsedConfig.hostPolicyOk) {
		messages.push(`   file: ${configPath}`);
		return failOutput(
			messages,
			"local-memory config host policy failed: expected host: 127.0.0.1",
			{ version },
		);
	}
	if (!parsedConfig.autoPortPolicyOk) {
		messages.push(`   file: ${configPath}`);
		return failOutput(
			messages,
			"local-memory config auto_port policy failed: expected auto_port: false",
			{ version },
		);
	}
	messages.push(`✅ config host/auto_port policy ok: ${configPath}`);

	if (!Number.isInteger(parsedConfig.restPort)) {
		return failOutput(
			messages,
			`invalid rest_api_port from config: ${parsedConfig.restPort}`,
			{ version },
		);
	}

	return { ok: true, version, parsedConfig };
}

/** Ensures the daemon is running and healthy. */
async function ensureDaemonHealth(
	parsedConfig: ParsedLocalMemoryConfig,
	messages: string[],
	version: string,
): Promise<
	| { ok: false; output: LocalMemoryPreflightOutput }
	| { ok: true; healthUrl: string; healthJson: unknown }
> {
	const healthUrl = `http://${parsedConfig.restHost}:${parsedConfig.restPort}/api/v1/health`;
	const statusProbe = commandOutput("local-memory", ["status", "--json"]);
	if (!statusProbe.ok) {
		return failOutput(messages, "local-memory status failed", {
			healthUrl,
			version,
		});
	}

	const statusJsonLine = extractLastJsonLine(statusProbe.output);
	if (!statusJsonLine) {
		return failOutput(
			messages,
			"local-memory status returned no JSON payload",
			{ healthUrl, version },
		);
	}
	const statusJson = parseJson<Record<string, unknown>>(statusJsonLine);
	if (!statusJson) {
		return failOutput(
			messages,
			"local-memory status returned invalid JSON payload",
			{ healthUrl, version },
		);
	}
	const running =
		statusJson.data &&
		typeof statusJson.data === "object" &&
		"running" in statusJson.data
			? Boolean((statusJson.data as Record<string, unknown>).running)
			: Boolean(statusJson.running);

	let healthJson: unknown;
	if (!running) {
		try {
			const healthResponse = await fetchJson(healthUrl);
			if (healthResponse.ok && isHealthSuccessPayload(healthResponse.json)) {
				messages.push(
					`ℹ️ local-memory status drift detected; using REST health at ${healthUrl} as source of truth`,
				);
				healthJson = healthResponse.json;
			}
		} catch {
			// Ignore the initial probe failure and fall through to the explicit start path.
		}
	}

	if (!running && !healthJson) {
		messages.push(
			"⚠️ local-memory status reported stopped; attempting daemon start",
		);
		const startProbe = commandOutput("local-memory", ["start"]);
		if (!startProbe.ok) {
			if (isLocalMemoryPidfileSandboxBlock(startProbe.output)) {
				messages.push(
					"⚠️ local-memory start reported sandbox pidfile limits; continuing with REST health probe",
				);
			} else {
				if (startProbe.output) {
					messages.push(startProbe.output);
				}
				return failOutput(messages, "local-memory start failed", {
					healthUrl,
					version,
				});
			}
		} else {
			messages.push("✅ local-memory start command succeeded");
		}

		healthJson = await waitForLocalMemoryHealth(healthUrl, 12);
		if (!healthJson) {
			return failOutput(
				messages,
				`local-memory daemon failed to become healthy at ${healthUrl} after start attempt`,
				{ healthUrl, version },
			);
		}
	}

	if (!healthJson) {
		try {
			const healthResponse = await fetchJson(healthUrl);
			healthJson = healthResponse.json;
			if (!healthResponse.ok) {
				return failOutput(
					messages,
					`REST health endpoint unreachable at ${healthUrl}`,
					{ healthUrl, version },
				);
			}
		} catch {
			return failOutput(
				messages,
				`REST health endpoint unreachable at ${healthUrl}`,
				{ healthUrl, version },
			);
		}
	}

	if (!isHealthSuccessPayload(healthJson)) {
		return failOutput(messages, "REST health endpoint returned success=false", {
			healthUrl,
			version,
		});
	}
	messages.push(`✅ REST health ok: ${healthUrl}`);

	return { ok: true, healthUrl, healthJson };
}

/** Runs the smoke cycle using extracted helper dependencies. */
async function runSmokeCycleWithHelpers(
	baseUrl: string,
	healthUrl: string,
	version: string,
	messages: string[],
): Promise<
	| { ok: false; output: LocalMemoryPreflightOutput }
	| { ok: true; probe: string }
> {
	return runSmokeCycle(baseUrl, healthUrl, version, messages, {
		sleep,
		fetchJson,
		extractMemoryId,
		extractRelationshipId,
		getSearchHitCount,
		isSuccessPayload,
		failOutput,
	});
}

/** Scans the daemon log tail for migration markers. */
function scanDaemonLog(daemonLogPath: string, messages: string[]): void {
	if (!existsSync(daemonLogPath)) {
		messages.push(`ℹ️ daemon log not found at ${daemonLogPath}`);
		return;
	}

	const daemonLogTail = readFileSync(daemonLogPath, "utf-8")
		.split(/\r?\n/)
		.slice(-300)
		.join("\n");
	if (
		/"pending_migrations"|"target_version"|"current_version"/.test(
			daemonLogTail,
		)
	) {
		messages.push("ℹ️ migration status signal found in daemon log");
	} else {
		messages.push(
			"ℹ️ no migration status signal found in recent daemon log tail",
		);
	}
}

/**
 * Verifies a local "local-memory" installation and runs a full smoke test.
 *
 * Performs these high-level checks and actions: confirms the `local-memory` binary and reports its version; validates REST-related config policy (`rest_api.host` must be `127.0.0.1` and `auto_port: false`); probes daemon status (may attempt to start the daemon and wait for health); ensures the REST `/api/v1/health` endpoint reports success; exercises a smoke cycle (POST two observations, create a relationship, and verify search returns the probe); validates rejection of a malformed observe payload and records duplicate-observe behavior; and optionally scans the daemon log tail for migration/version markers. On any fatal check the function returns early with a failing result and an ordered list of human-readable messages.
 *
 * @param options - Optional overrides: `configPath` to use a non-default local-memory YAML config, and `daemonLogPath` to inspect a non-default daemon log file.
 * @returns A result object containing `passed` (true only if all checks and the smoke cycle succeeded), an ordered `messages` array describing each step and any errors, and optionally `healthUrl` and `version` when available.
 */
export async function runLocalMemoryPreflight(
	options: LocalMemoryPreflightOptions = {},
): Promise<LocalMemoryPreflightOutput> {
	const messages: string[] = [];
	const daemonLogPath = options.daemonLogPath ?? DEFAULT_DAEMON_LOG_PATH;

	messages.push("== Local Memory Preflight ==");

	const probeResult = await probeBinaryAndConfig(options, messages);
	if (!probeResult.ok) {
		return probeResult.output;
	}
	const { version, parsedConfig } = probeResult;

	const healthResult = await ensureDaemonHealth(
		parsedConfig,
		messages,
		version,
	);
	if (!healthResult.ok) {
		return healthResult.output;
	}
	const { healthUrl } = healthResult;

	const baseUrl = `http://${parsedConfig.restHost}:${parsedConfig.restPort}/api/v1`;

	const smokeResult = await runSmokeCycleWithHelpers(
		baseUrl,
		healthUrl,
		version,
		messages,
	);
	if (!smokeResult.ok) {
		return smokeResult.output;
	}

	scanDaemonLog(daemonLogPath, messages);

	messages.push("✅ local-memory preflight passed");
	return {
		passed: true,
		messages,
		healthUrl,
		version,
	};
}

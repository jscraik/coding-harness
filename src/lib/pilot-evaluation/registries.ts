import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export const DEFAULT_METRIC_REGISTRY_PATH =
	"contracts/agent-metric-registry.json";
export const DEFAULT_ADAPTER_REGISTRY_PATH =
	"contracts/agent-adapter-registry.json";

export interface PilotMetricRegistryEntry {
	name: string;
	numerator: string;
	denominator: string;
	source: string;
	windowRule: string;
	blockingPolicy: "blocking" | "non_blocking" | "advisory_only";
	owner: string;
	lastUpdatedCheckpoint: string;
	threshold?: {
		operator: "min" | "max";
		value: number;
	};
	minimumDenominator?: number;
}

export interface PilotMetricRegistry {
	schemaVersion: "agent-metric-registry/v1";
	metrics: PilotMetricRegistryEntry[];
}

export interface PilotAdapterRegistryEntry {
	adapterVersion: string;
	owner: string;
	introducedAt: string;
	sunsetBy: string;
	blockAfter: string | null;
	parityWindow?: {
		minimumCanonicalCoverage: number;
		minimumConsecutivePassingWindows: number;
		maxCriticalDrifts: number;
	};
}

export interface PilotAdapterRegistry {
	schemaVersion: "agent-adapter-registry/v1";
	adapters: PilotAdapterRegistryEntry[];
}

function loadJsonFile<T>(pathLike: string, label: string): T {
	const absolutePath = resolve(process.cwd(), pathLike);
	if (!existsSync(absolutePath)) {
		throw new Error(`${label} not found at ${absolutePath}`);
	}

	try {
		return JSON.parse(readFileSync(absolutePath, "utf-8")) as T;
	} catch (error) {
		throw new Error(
			`Failed to parse ${label} at ${absolutePath}: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
	}
}

export function loadMetricRegistry(
	registryPath = DEFAULT_METRIC_REGISTRY_PATH,
): PilotMetricRegistry {
	const registry = loadJsonFile<PilotMetricRegistry>(
		registryPath,
		"metric registry",
	);
	if (registry.schemaVersion !== "agent-metric-registry/v1") {
		throw new Error(
			`Unsupported metric registry schema: ${registry.schemaVersion}`,
		);
	}
	return registry;
}

export function loadAdapterRegistry(
	registryPath = DEFAULT_ADAPTER_REGISTRY_PATH,
): PilotAdapterRegistry {
	const registry = loadJsonFile<PilotAdapterRegistry>(
		registryPath,
		"adapter registry",
	);
	if (registry.schemaVersion !== "agent-adapter-registry/v1") {
		throw new Error(
			`Unsupported adapter registry schema: ${registry.schemaVersion}`,
		);
	}
	return registry;
}

export function getMetricRegistryEntry(
	registry: PilotMetricRegistry,
	name: string,
): PilotMetricRegistryEntry | undefined {
	return registry.metrics.find((metric) => metric.name === name);
}

export function getAdapterRegistryEntry(
	registry: PilotAdapterRegistry,
	adapterVersion: string,
): PilotAdapterRegistryEntry | undefined {
	return registry.adapters.find(
		(adapter) => adapter.adapterVersion === adapterVersion,
	);
}

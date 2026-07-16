export interface BulkAdvisory {
	name: string;
	severity: "info" | "low" | "moderate" | "high" | "critical";
	title: string;
	url: string;
}

export interface AuditPackageManifest {
	algorithm: "sha256";
	package_count: number;
	digest: `sha256:${string}`;
	registry_origin: string;
}

export function packageIdentity(
	lockfileKey: string,
): { name: string; version: string } | null;

export function buildBulkPayload(
	lockfileText: string,
	options?: {
		allowedScopes?: string[];
		packageManifest: unknown;
		registry?: string;
	},
): Record<string, string[]>;

export function validateResponse(
	value: unknown,
	expectedPackages?: string[] | null,
): BulkAdvisory[];

export function fetchBulkAdvisories(
	payload: Record<string, string[]>,
	options?: {
		fetchImplementation?: typeof fetch;
		registry?: string;
	},
): Promise<BulkAdvisory[]>;

export function blockingAdvisories(
	advisories: BulkAdvisory[],
	auditLevel: BulkAdvisory["severity"],
): BulkAdvisory[];

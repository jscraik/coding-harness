export interface BulkAdvisory {
	name: string;
	severity: "info" | "low" | "moderate" | "high" | "critical";
	title: string;
	url: string;
}

export function buildBulkPayload(
	lockfileText: string,
	options?: {
		allowedScopes?: string[];
		packageManifest: {
			algorithm: "sha256";
			package_count: number;
			digest: `sha256:${string}`;
		};
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

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { sanitizeError } from "../lib/input/sanitize.js";
import { PathTraversalError, validatePath } from "../lib/input/validator.js";

export const EXIT_CODES = {
	SUCCESS: 0,
	USAGE: 2,
	POLICY: 3,
	PARTIAL: 4,
	INTERNAL: 10,
} as const;

export type GapCaseStatus = "open" | "resolved";
export type GapSeverity = "low" | "medium" | "high";

export interface GapCaseRecord {
	id: string;
	incidentId: string;
	owner: string;
	severity: GapSeverity;
	linkedPr: string;
	findingSummary?: string;
	createdAt: string;
	dueAt: string;
	status: GapCaseStatus;
	resolvedBy?: string;
	closedAt?: string;
	closeReason?: string;
	evidence?: string[];
}

export interface GapCaseStore {
	version: number;
	cases: GapCaseRecord[];
}

export interface CreateGapCaseOptions {
	action: "create";
	incidentId: string;
	owner: string;
	severity: GapSeverity;
	linkedPr: string;
	findingSummary?: string;
	dueDays?: number;
	caseStore?: string;
	caseIdPrefix?: string;
	caseId?: string;
	evidence?: string[];
	json?: boolean;
}

export interface ListGapCaseOptions {
	action: "list";
	caseStore?: string;
	open?: boolean;
	overdue?: boolean;
	json?: boolean;
}

export interface ResolveGapCaseOptions {
	action: "resolve";
	caseStore?: string;
	caseId: string;
	incidentId: string;
	resolvedBy: string;
	linkedPr: string;
	evidence?: string[];
	closeReason?: string;
	force?: boolean;
	json?: boolean;
}

type GapCaseResultOutput =
	| { action: "create"; caseRecord: GapCaseRecord }
	| { action: "list"; cases: GapCaseRecord[] }
	| { action: "resolve"; caseRecord: GapCaseRecord };

export interface GapCaseError {
	code: "E_USAGE" | "E_VALIDATION" | "E_POLICY" | "E_NOT_FOUND" | "E_INTERNAL";
	message: string;
	details?: Record<string, unknown>;
}

export type GapCaseResult =
	| { ok: true; output: GapCaseResultOutput }
	| { ok: false; error: GapCaseError };

const DEFAULT_CASE_STORE = ".harness/gap-cases.json";
const DEFAULT_CASE_ID_PREFIX = "gap-";
const DEFAULT_DUE_DAYS = 7;

function nowIso(): string {
	return new Date().toISOString();
}

function normalizeCaseStore(caseStore?: string): string {
	return validatePath(process.cwd(), resolve(caseStore || DEFAULT_CASE_STORE));
}

function readCaseStore(filePath: string): GapCaseStore {
	if (!existsSync(filePath)) {
		return { version: 1, cases: [] };
	}

	const raw = readFileSync(filePath, "utf-8");
	const parsed = JSON.parse(raw) as unknown;
	if (
		typeof parsed !== "object" ||
		parsed === null ||
		!Array.isArray((parsed as { cases?: unknown }).cases)
	) {
		return { version: 1, cases: [] };
	}
	const cases = (parsed as { cases: unknown[] }).cases.filter(
		(entry): entry is GapCaseRecord =>
			typeof entry === "object" &&
			entry !== null &&
			typeof (entry as { id?: unknown }).id === "string",
	);
	return { version: 1, cases };
}

function writeCaseStore(filePath: string, store: GapCaseStore): void {
	mkdirSync(dirname(filePath), { recursive: true });
	writeFileSync(filePath, JSON.stringify(store, null, 2), "utf-8");
}

function nextCaseId(cases: GapCaseRecord[], prefix: string): string {
	const matches = cases
		.map((entry) => {
			if (!entry.id.startsWith(prefix)) {
				return 0;
			}
			const suffix = entry.id.slice(prefix.length);
			const n = Number.parseInt(suffix, 10);
			return Number.isNaN(n) ? 0 : n;
		})
		.filter((value) => value > 0);
	const next = Math.max(0, ...matches, 0) + 1;
	return `${prefix}${next.toString().padStart(3, "0")}`;
}

function computeDueDate(days: number): string {
	const timestamp = Date.now() + days * 24 * 60 * 60 * 1000;
	return new Date(timestamp).toISOString();
}

function isOverdue(caseRecord: GapCaseRecord): boolean {
	return new Date(caseRecord.dueAt).getTime() < Date.now();
}

export function runGapCase(
	options: CreateGapCaseOptions | ListGapCaseOptions | ResolveGapCaseOptions,
): GapCaseResult {
	try {
		const caseStore = normalizeCaseStore(
			"caseStore" in options ? options.caseStore : undefined,
		);
		const store = readCaseStore(caseStore);

		if (options.action === "create") {
			if (!options.incidentId.trim()) {
				return {
					ok: false,
					error: {
						code: "E_USAGE",
						message: "Missing required option: --incident-id",
					},
				};
			}
			if (!options.owner.trim()) {
				return {
					ok: false,
					error: {
						code: "E_USAGE",
						message: "Missing required option: --owner",
					},
				};
			}
			if (
				options.severity !== "low" &&
				options.severity !== "medium" &&
				options.severity !== "high"
			) {
				return {
					ok: false,
					error: {
						code: "E_USAGE",
						message:
							"Invalid required option: --severity must be low|medium|high",
					},
				};
			}
			if (!options.linkedPr.trim()) {
				return {
					ok: false,
					error: {
						code: "E_USAGE",
						message: "Missing required option: --linked-pr",
					},
				};
			}

			const prefix = options.caseIdPrefix ?? DEFAULT_CASE_ID_PREFIX;
			const id = options.caseId ?? nextCaseId(store.cases, prefix);
			const dueDays = options.dueDays ?? DEFAULT_DUE_DAYS;
			if (dueDays <= 0) {
				return {
					ok: false,
					error: {
						code: "E_VALIDATION",
						message: "Invalid --due-days; must be a positive integer",
					},
				};
			}

			const existing = store.cases.find((entry) => entry.id === id);
			if (existing) {
				return {
					ok: false,
					error: {
						code: "E_VALIDATION",
						message: `Gap case ${id} already exists`,
					},
				};
			}

			const caseRecord: GapCaseRecord = {
				id,
				incidentId: options.incidentId,
				owner: options.owner,
				severity: options.severity,
				linkedPr: options.linkedPr,
				createdAt: nowIso(),
				dueAt: computeDueDate(dueDays),
				status: "open",
				...(options.findingSummary
					? { findingSummary: options.findingSummary }
					: {}),
				...(options.evidence ? { evidence: options.evidence } : {}),
			};

			store.cases.push(caseRecord);
			writeCaseStore(caseStore, store);
			return { ok: true, output: { action: "create", caseRecord } };
		}

		if (options.action === "list") {
			let cases = [...store.cases];
			if (options.open) {
				cases = cases.filter((entry) => entry.status === "open");
			}
			if (options.overdue) {
				cases = cases.filter(isOverdue);
			}
			return { ok: true, output: { action: "list", cases } };
		}

		if (options.action === "resolve") {
			const target = store.cases.find((entry) => entry.id === options.caseId);
			if (!target) {
				return {
					ok: false,
					error: {
						code: "E_NOT_FOUND",
						message: `Gap case ${options.caseId} not found`,
					},
				};
			}
			if (target.status === "resolved") {
				return {
					ok: false,
					error: {
						code: "E_POLICY",
						message: `Gap case ${options.caseId} is already resolved`,
					},
				};
			}
			if (
				!options.incidentId.trim() ||
				options.incidentId !== target.incidentId
			) {
				return {
					ok: false,
					error: {
						code: "E_VALIDATION",
						message: "Incident ID does not match existing gap case",
					},
				};
			}
			if (!options.resolvedBy.trim() || !options.linkedPr.trim()) {
				return {
					ok: false,
					error: {
						code: "E_USAGE",
						message: "Missing required option: --resolved-by and --linked-pr",
					},
				};
			}
			target.status = "resolved";
			target.closedAt = nowIso();
			target.resolvedBy = options.resolvedBy;
			target.closeReason = options.closeReason ?? "fix";
			// Apply evidence and linkedPr from resolve options
			if (options.evidence && options.evidence.length > 0) {
				target.evidence = [...(target.evidence ?? []), ...options.evidence];
			}
			if (options.linkedPr?.trim()) {
				target.linkedPr = options.linkedPr;
			}

			writeCaseStore(caseStore, store);
			return { ok: true, output: { action: "resolve", caseRecord: target } };
		}

		return {
			ok: false,
			error: {
				code: "E_INTERNAL",
				message: "Unknown gap-case action",
			},
		};
	} catch (error) {
		if (error instanceof PathTraversalError) {
			return {
				ok: false,
				error: {
					code: "E_VALIDATION",
					message: "Invalid --case-store path (path traversal detected)",
				},
			};
		}
		if (error instanceof SyntaxError) {
			return {
				ok: false,
				error: {
					code: "E_VALIDATION",
					message: `Could not parse gap-case store: ${sanitizeError(error)}`,
				},
			};
		}
		return {
			ok: false,
			error: {
				code: "E_INTERNAL",
				message: `Could not update gap-case state: ${sanitizeError(error)}`,
			},
		};
	}
}

export function runGapCaseCLI(
	options: CreateGapCaseOptions | ListGapCaseOptions | ResolveGapCaseOptions,
): number {
	const result = runGapCase(options);
	if (!result.ok) {
		// Output only JSON or only plain text, not both
		if (options.json) {
			console.error(JSON.stringify({ error: result.error }));
		} else {
			console.error(result.error.message);
		}
		switch (result.error.code) {
			case "E_USAGE":
			case "E_VALIDATION":
				return EXIT_CODES.USAGE;
			case "E_POLICY":
			case "E_NOT_FOUND":
				return EXIT_CODES.POLICY;
			default:
				return EXIT_CODES.INTERNAL;
		}
	}

	if (options.json) {
		console.info(
			JSON.stringify({
				schema: "harness.gap-case.v1",
				meta: {
					tool: "harness-gap-case",
					timestamp: new Date().toISOString(),
				},
				status: "success",
				summary: `Gap-case ${result.output.action} complete`,
				data: result.output,
				errors: [],
			}),
		);
		return EXIT_CODES.SUCCESS;
	}

	switch (result.output.action) {
		case "create":
			console.info(`Created gap case ${result.output.caseRecord.id}`);
			console.info(`incident: ${result.output.caseRecord.incidentId}`);
			console.info(`dueAt: ${result.output.caseRecord.dueAt}`);
			break;
		case "list":
			console.info(
				`Gap cases: ${result.output.cases.length} record(s) in ${normalizeCaseStore(
					options.caseStore,
				)}`,
			);
			for (const entry of result.output.cases) {
				console.info(
					`${entry.id}\t${entry.status}\t${entry.incidentId}\t${entry.owner}`,
				);
			}
			break;
		case "resolve":
			console.info(`Resolved gap case ${result.output.caseRecord.id}`);
			console.info(`closedAt: ${result.output.caseRecord.closedAt}`);
			break;
	}
	return EXIT_CODES.SUCCESS;
}

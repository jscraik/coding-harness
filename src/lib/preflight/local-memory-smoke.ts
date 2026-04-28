import type { LocalMemoryPreflightOutput } from "./local-memory.js";

/**
 * Explicit dependencies used by local-memory smoke execution helpers.
 */
export interface SmokeDependencies {
	failOutput: (
		messages: string[],
		message: string,
		context?: { healthUrl?: string; version?: string },
	) => { ok: false; output: LocalMemoryPreflightOutput };
	fetchJson: (
		url: string,
		init?: RequestInit,
	) => Promise<{ ok: boolean; status: number; json?: unknown }>;
	extractMemoryId: (payload: unknown) => string | undefined;
	extractRelationshipId: (payload: unknown) => string | undefined;
	isSuccessPayload: (payload: unknown) => boolean;
	getSearchHitCount: (payload: unknown) => number;
	sleep: (ms: number) => Promise<void>;
}

async function runCoreSmoke(
	deps: SmokeDependencies,
	baseUrl: string,
	probe: string,
	healthUrl: string,
	version: string,
	messages: string[],
): Promise<
	| { ok: false; output: LocalMemoryPreflightOutput }
	| { ok: true; relationshipId: string | undefined }
> {
	const contentA = `Preflight anchor ${probe}`;
	const contentB = `Preflight evidence ${probe}`;

	const observeResult = await observePair(
		deps,
		baseUrl,
		contentA,
		contentB,
		healthUrl,
		version,
		messages,
	);
	if (!observeResult.ok) {
		return observeResult;
	}
	const { idA, idB } = observeResult;

	const relatePayload = {
		source_memory_id: idA,
		target_memory_id: idB,
		relationship_type: "references",
		strength: 0.8,
		context: "codex preflight smoke cycle",
	};
	let relationshipResponse = await deps.fetchJson(`${baseUrl}/relationships`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(relatePayload),
	});
	if (!relationshipResponse.ok) {
		relationshipResponse = await deps.fetchJson(`${baseUrl}/relate`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(relatePayload),
		});
	}
	if (!relationshipResponse.ok) {
		return deps.failOutput(
			messages,
			`relationship create returned HTTP ${relationshipResponse.status}`,
			{ healthUrl, version },
		);
	}
	if (!deps.isSuccessPayload(relationshipResponse.json)) {
		return deps.failOutput(messages, "relate reported failure", {
			healthUrl,
			version,
		});
	}

	const relationshipId = deps.extractRelationshipId(relationshipResponse.json);
	const searchPayload = {
		query: probe,
		limit: 10,
		response_format: "ids_only",
	};

	let searchHits = 0;
	for (let attempt = 1; attempt <= 5; attempt += 1) {
		const searchResponse = await deps.fetchJson(`${baseUrl}/memories/search`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(searchPayload),
		});
		if (!searchResponse.ok) {
			return deps.failOutput(
				messages,
				`search returned HTTP ${searchResponse.status}`,
				{ healthUrl, version },
			);
		}
		searchHits = deps.getSearchHitCount(searchResponse.json);
		if (searchHits >= 1) {
			break;
		}
		await deps.sleep(200);
	}
	if (searchHits < 1) {
		return deps.failOutput(
			messages,
			`search returned no results for probe ${probe}`,
			{ healthUrl, version },
		);
	}

	messages.push(
		`✅ smoke cycle ok: ids ${idA}, ${idB}; relationship ${relationshipId ?? "unknown"}`,
	);
	return { ok: true, relationshipId };
}

async function observePair(
	deps: SmokeDependencies,
	baseUrl: string,
	contentA: string,
	contentB: string,
	healthUrl: string,
	version: string,
	messages: string[],
): Promise<
	| { ok: false; output: LocalMemoryPreflightOutput }
	| { ok: true; idA: string; idB: string }
> {
	const observePayload = (content: string) => ({
		content,
		domain: "coding-harness",
		source: "codex_preflight",
		tags: ["preflight", "local-memory"],
	});
	const observeA = await deps.fetchJson(`${baseUrl}/observe`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(observePayload(contentA)),
	});
	if (!observeA.ok) {
		return deps.failOutput(
			messages,
			`observe A returned HTTP ${observeA.status}`,
			{
				healthUrl,
				version,
			},
		);
	}
	const observeB = await deps.fetchJson(`${baseUrl}/observe`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(observePayload(contentB)),
	});
	if (!observeB.ok) {
		return deps.failOutput(
			messages,
			`observe B returned HTTP ${observeB.status}`,
			{
				healthUrl,
				version,
			},
		);
	}
	const idA = deps.extractMemoryId(observeA.json);
	const idB = deps.extractMemoryId(observeB.json);
	if (!idA || !idB) {
		return deps.failOutput(messages, "observe returned no memory IDs", {
			healthUrl,
			version,
		});
	}
	return { ok: true, idA, idB };
}

/**
 * Run extended local-memory smoke checks (observe/relate/search + guards).
 */
export async function runSmokeCycle(
	baseUrl: string,
	healthUrl: string,
	version: string,
	messages: string[],
	deps: SmokeDependencies,
): Promise<
	| { ok: false; output: LocalMemoryPreflightOutput }
	| { ok: true; probe: string }
> {
	const probe = `LM-PREFLIGHT-${new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-")}-${process.pid}`;
	const coreResult = await runCoreSmoke(
		deps,
		baseUrl,
		probe,
		healthUrl,
		version,
		messages,
	);
	if (!coreResult.ok) {
		return coreResult;
	}

	const malformedResponse = await deps.fetchJson(`${baseUrl}/observe`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ level: "observation" }),
	});
	if (malformedResponse.status < 400) {
		return deps.failOutput(
			messages,
			`malformed payload did not return an error (HTTP ${malformedResponse.status})`,
			{ healthUrl, version },
		);
	}
	messages.push(
		`✅ malformed payload rejected: HTTP ${malformedResponse.status}`,
	);

	const duplicatePayload = {
		content: `Preflight anchor ${probe}`,
		domain: "coding-harness",
		source: "codex_preflight",
		tags: ["preflight", "duplicate-check"],
	};
	const duplicateOne = await deps.fetchJson(`${baseUrl}/observe`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(duplicatePayload),
	});
	const duplicateTwo = await deps.fetchJson(`${baseUrl}/observe`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(duplicatePayload),
	});
	messages.push(
		`ℹ️ duplicate behavior snapshot: first=${duplicateOne.status}, second=${duplicateTwo.status}`,
	);
	return { ok: true, probe };
}

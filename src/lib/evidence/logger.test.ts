import { afterEach, describe, expect, it, vi } from "vitest";
import { StructuredLogger } from "./logger.js";

afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
});

function getFetchHeaders(fetchMock: ReturnType<typeof vi.fn>): Headers {
	const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
	expect(init).toBeDefined();
	return new Headers(init?.headers);
}

describe("StructuredLogger OTLP export", () => {
	it("sends the collector token header from the environment", async () => {
		vi.stubEnv("OTEL_COLLECTOR_EXTERNAL_INGEST_TOKEN", "secret-token");
		const fetchMock = vi.fn(async () => ({ ok: true }));
		vi.stubGlobal("fetch", fetchMock);

		const logger = new StructuredLogger({
			otelEndpoint: "https://otel.example.test/v1/logs",
			output: { write: () => undefined },
		});
		logger.info("hello");

		await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		const headers = getFetchHeaders(fetchMock);
		expect(headers.get("content-type")).toBe("application/json");
		expect(headers.get("x-otel-collector-token")).toBe("secret-token");
	});

	it("supports standard OTEL_EXPORTER_OTLP_HEADERS", async () => {
		vi.stubEnv(
			"OTEL_EXPORTER_OTLP_HEADERS",
			"authorization=Bearer%20abc,x-custom=value",
		);
		const fetchMock = vi.fn(async () => ({ ok: true }));
		vi.stubGlobal("fetch", fetchMock);

		const logger = new StructuredLogger({
			otelEndpoint: "https://otel.example.test/v1/logs",
			output: { write: () => undefined },
		});
		logger.warn("hello");

		await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		const headers = getFetchHeaders(fetchMock);
		expect(headers.get("authorization")).toBe("Bearer abc");
		expect(headers.get("x-custom")).toBe("value");
	});

	it("supports otelHeaders in LoggerOptions", async () => {
		const fetchMock = vi.fn(async () => ({ ok: true }));
		vi.stubGlobal("fetch", fetchMock);

		const logger = new StructuredLogger({
			otelEndpoint: "https://otel.example.test/v1/logs",
			otelHeaders: {
				"x-api-key": "test-key-123",
				"x-trace-id": "abc-def-ghi",
			},
			output: { write: () => undefined },
		});
		logger.info("test message");

		await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		const headers = getFetchHeaders(fetchMock);
		expect(headers.get("content-type")).toBe("application/json");
		expect(headers.get("x-api-key")).toBe("test-key-123");
		expect(headers.get("x-trace-id")).toBe("abc-def-ghi");
	});

	it("supports custom collector token header via environment variables", async () => {
		vi.stubEnv("OTEL_COLLECTOR_EXTERNAL_INGEST_TOKEN_HEADER", "x-custom-auth");
		vi.stubEnv("OTEL_COLLECTOR_EXTERNAL_INGEST_TOKEN", "custom-token-value");
		const fetchMock = vi.fn(async () => ({ ok: true }));
		vi.stubGlobal("fetch", fetchMock);

		const logger = new StructuredLogger({
			otelEndpoint: "https://otel.example.test/v1/logs",
			output: { write: () => undefined },
		});
		logger.error("error message");

		await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		const headers = getFetchHeaders(fetchMock);
		expect(headers.get("content-type")).toBe("application/json");
		expect(headers.get("x-custom-auth")).toBe("custom-token-value");
	});
});

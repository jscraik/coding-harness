import { afterEach, describe, expect, it, vi } from "vitest";
import { StructuredLogger } from "./logger.js";

afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
});

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
		expect(fetchMock).toHaveBeenCalledWith(
			"https://otel.example.test/v1/logs",
			expect.objectContaining({
				headers: expect.objectContaining({
					"Content-Type": "application/json",
					"x-otel-collector-token": "secret-token",
				}),
			}),
		);
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
		expect(fetchMock).toHaveBeenCalledWith(
			"https://otel.example.test/v1/logs",
			expect.objectContaining({
				headers: expect.objectContaining({
					authorization: "Bearer abc",
					"x-custom": "value",
				}),
			}),
		);
	});
});

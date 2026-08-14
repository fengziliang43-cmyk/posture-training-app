import { describe, expect, it } from "vitest";
import {
  ApiRequestError,
  DEFAULT_NATIVE_API_BASE_URL,
  isRetryableApiError,
  normalizeApiBaseUrl,
  resolveApiBaseUrl
} from "../../src/web/api";

describe("normalizeApiBaseUrl", () => {
  it("keeps an explicit http server URL", () => {
    expect(normalizeApiBaseUrl("http://10.187.35.229:8787/")).toBe(
      "http://10.187.35.229:8787"
    );
  });

  it("adds http when the user only enters host and port", () => {
    expect(normalizeApiBaseUrl("10.187.35.229:8787")).toBe("http://10.187.35.229:8787");
  });

  it("normalizes full-width phone keyboard characters", () => {
    expect(normalizeApiBaseUrl("　ｈｔｔｐ：／／１０．１８７．３５．２２９：８７８７　")).toBe(
      "http://10.187.35.229:8787"
    );
  });
});

describe("resolveApiBaseUrl", () => {
  it("uses the production HTTPS API for a fresh native install", () => {
    expect(resolveApiBaseUrl(null, true)).toBe(DEFAULT_NATIVE_API_BASE_URL);
  });

  it("keeps websites on same-origin requests and ignores stale native overrides", () => {
    expect(resolveApiBaseUrl(null, false)).toBe("");
    expect(resolveApiBaseUrl("https://test.example/", true)).toBe(DEFAULT_NATIVE_API_BASE_URL);
    expect(resolveApiBaseUrl("http://10.0.0.8:8787", true)).toBe(DEFAULT_NATIVE_API_BASE_URL);
  });
});

describe("API retry classification", () => {
  it("only queues network and server failures for retry", () => {
    expect(isRetryableApiError(new ApiRequestError("offline", { retryable: true }))).toBe(true);
    expect(isRetryableApiError(new ApiRequestError("bad request", { status: 400, retryable: false }))).toBe(false);
    expect(isRetryableApiError(new Error("ordinary error"))).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { normalizeApiBaseUrl } from "../../src/web/api";

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

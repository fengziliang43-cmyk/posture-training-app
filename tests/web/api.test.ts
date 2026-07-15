import { describe, expect, it } from "vitest";
import { normalizeApiBaseUrl } from "../../src/web/api";

describe("normalizeApiBaseUrl", () => {
  it("keeps an explicit http server URL", () => {
    expect(normalizeApiBaseUrl("http://192.0.2.1:8787/")).toBe(
      "http://192.0.2.1:8787"
    );
  });

  it("adds http when the user only enters host and port", () => {
    expect(normalizeApiBaseUrl("192.0.2.1:8787")).toBe("http://192.0.2.1:8787");
  });

  it("normalizes full-width phone keyboard characters", () => {
    expect(normalizeApiBaseUrl("　ｈｔｔｐ：／／１９２．０．２．１：８７８７　")).toBe(
      "http://192.0.2.1:8787"
    );
  });
});

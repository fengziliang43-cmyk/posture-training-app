import { describe, expect, it } from "vitest";
import { isAdminConsolePath, isGuidePath } from "../../src/web/App";

describe("page paths", () => {
  it("serves the public guide on /guide with or without a trailing slash", () => {
    expect(isGuidePath("/guide")).toBe(true);
    expect(isGuidePath("/guide/")).toBe(true);
    expect(isGuidePath("/")).toBe(false);
    expect(isGuidePath("/guides")).toBe(false);
    expect(isGuidePath("/guide/extra")).toBe(false);
  });

  it("keeps the admin console on its own path", () => {
    expect(isAdminConsolePath("/admin")).toBe(true);
    expect(isGuidePath("/admin")).toBe(false);
  });
});

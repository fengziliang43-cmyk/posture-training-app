import { describe, expect, it } from "vitest";
import { buildApp } from "../../src/server/app";

describe("server app", () => {
  it("responds to health check", async () => {
    const app = await buildApp({ databaseFile: ":memory:", uploadDir: "uploads-test" });
    const response = await app.inject({ method: "GET", url: "/api/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });

    await app.close();
  });
});

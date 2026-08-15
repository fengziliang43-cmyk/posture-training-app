import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/server/app";
import { CURRENT_APP_VERSION } from "../../src/release";

let app: FastifyInstance | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe("release manifest", () => {
  it("is public, current and never cached", async () => {
    app = await buildApp({ databaseFile: ":memory:", uploadDir: "uploads" });
    const response = await app.inject({ method: "GET", url: "/api/releases/latest" });

    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.json().platforms.web.version).toBe(CURRENT_APP_VERSION);
    expect(response.json().platforms.android.version).toBe("1.0.2");
  });
});

import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/server/app";

let app: FastifyInstance | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe("admin analytics", () => {
  it("returns aggregate data to admins and hides the route from ordinary users", async () => {
    app = await buildApp({ databaseFile: ":memory:", uploadDir: "uploads" });

    const adminSetup = await app.inject({
      method: "POST",
      url: "/api/auth/setup",
      payload: { username: "owner", password: "strong-password-123" }
    });
    const adminCookie = sessionCookie(adminSetup.headers["set-cookie"]);

    const registration = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        username: "member",
        password: "another-strong-password",
        adultConfirmed: true,
        termsAccepted: true
      }
    });
    const memberCookie = sessionCookie(registration.headers["set-cookie"]);

    const memberResponse = await app.inject({
      method: "GET",
      url: "/api/admin/stats",
      headers: { cookie: memberCookie }
    });
    expect(memberResponse.statusCode).toBe(404);

    const adminResponse = await app.inject({
      method: "GET",
      url: "/api/admin/stats",
      headers: { cookie: adminCookie }
    });
    expect(adminResponse.statusCode).toBe(200);
    expect(adminResponse.headers["cache-control"]).toBe("no-store");

    const stats = adminResponse.json();
    expect(stats.users).toMatchObject({
      total: 2,
      new7d: 2,
      new30d: 2,
      onboarded: 1,
      active7d: 2,
      active30d: 2
    });
    expect(stats.traffic).toEqual({ available: false, provider: "goaccess", dashboardUrl: null });
    expect(JSON.stringify(stats)).not.toMatch(/owner|member|password|photo|pain|weight/i);

    const memberAccess = await app.inject({
      method: "GET",
      url: "/api/admin/access",
      headers: { cookie: memberCookie }
    });
    expect(memberAccess.statusCode).toBe(403);

    const adminAccess = await app.inject({
      method: "GET",
      url: "/api/admin/access",
      headers: { cookie: adminCookie }
    });
    expect(adminAccess.statusCode).toBe(204);
  });

  it("requires authentication", async () => {
    app = await buildApp({ databaseFile: ":memory:", uploadDir: "uploads" });
    const response = await app.inject({ method: "GET", url: "/api/admin/stats" });
    expect(response.statusCode).toBe(401);
  });

  it("publishes the same-origin GoAccess dashboard only when configured", async () => {
    app = await buildApp({
      databaseFile: ":memory:",
      uploadDir: "uploads",
      trafficDashboardUrl: "/ops/traffic/"
    });
    const setup = await app.inject({
      method: "POST",
      url: "/api/auth/setup",
      payload: { username: "owner", password: "strong-password-123" }
    });
    const response = await app.inject({
      method: "GET",
      url: "/api/admin/stats",
      headers: { cookie: sessionCookie(setup.headers["set-cookie"]) }
    });
    expect(response.json().traffic).toEqual({
      available: true,
      provider: "goaccess",
      dashboardUrl: "/ops/traffic/"
    });
  });
});

function sessionCookie(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) throw new Error("missing session cookie");
  return raw.split(";", 1)[0];
}

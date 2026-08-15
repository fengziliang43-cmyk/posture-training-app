import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/server/app";

let app: FastifyInstance | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe("account password changes", () => {
  it("checks the current password, replaces the hash, and revokes every session", async () => {
    app = await buildApp({ databaseFile: ":memory:", uploadDir: "uploads-test" });
    const registration = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        username: "password-user",
        password: "current-password-123",
        adultConfirmed: true,
        termsAccepted: true
      }
    });
    const firstCookie = sessionCookie(registration.headers["set-cookie"]);

    const secondLogin = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "password-user", password: "current-password-123" }
    });
    const secondCookie = sessionCookie(secondLogin.headers["set-cookie"]);

    const rejected = await app.inject({
      method: "PUT",
      url: "/api/account/password",
      headers: { cookie: firstCookie },
      payload: { currentPassword: "wrong-password", newPassword: "new-password-456" }
    });
    expect(rejected.statusCode).toBe(403);
    expect(rejected.json()).toEqual({ error: "current password incorrect" });

    const changed = await app.inject({
      method: "PUT",
      url: "/api/account/password",
      headers: { cookie: firstCookie },
      payload: { currentPassword: "current-password-123", newPassword: "new-password-456" }
    });
    expect(changed.statusCode).toBe(200);
    expect(changed.json()).toEqual({ ok: true, reauthenticationRequired: true });
    expect(changed.headers["set-cookie"]).toContain("zixu_session=");

    for (const cookie of [firstCookie, secondCookie]) {
      const me = await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie } });
      expect(me.statusCode).toBe(401);
    }

    const oldPasswordLogin = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "password-user", password: "current-password-123" }
    });
    expect(oldPasswordLogin.statusCode).toBe(401);

    const newPasswordLogin = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "password-user", password: "new-password-456" }
    });
    expect(newPasswordLogin.statusCode).toBe(200);

    const row = await (app as any).db.get(
      "SELECT password_hash, updated_at FROM users WHERE username_normalized = ?",
      "password-user"
    );
    expect(row.password_hash).not.toContain("current-password-123");
    expect(row.password_hash).not.toContain("new-password-456");
    expect(row.updated_at).toBeTypeOf("string");
  });
});

function sessionCookie(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) throw new Error("missing session cookie");
  return raw.split(";", 1)[0];
}

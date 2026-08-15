import { describe, expect, it } from "vitest";
import { buildApp } from "../../src/server/app";

describe("auth", () => {
  it("creates a local user and logs in without storing plaintext password", async () => {
    const app = await buildApp({ databaseFile: ":memory:", uploadDir: "uploads-test" });

    const setup = await app.inject({
      method: "POST",
      url: "/api/auth/setup",
      payload: { username: "legacy-user", password: "test-password-123" }
    });
    expect(setup.statusCode).toBe(200);
    expect(setup.json().user.role).toBe("admin");

    const row = await (app as any).db.get(
      "SELECT username, password_hash FROM users WHERE username = ?",
      "legacy-user"
    );
    expect(row.username).toBe("legacy-user");
    expect(row.password_hash).not.toBe("test-password-123");
    expect(row.password_hash).not.toContain("test-password-123");

    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "legacy-user", password: "test-password-123" }
    });
    expect(login.statusCode).toBe(200);
    expect(login.json().user.role).toBe("admin");
    expect(login.headers["set-cookie"]).toBeTruthy();
    expect(login.headers["set-cookie"]).toContain("HttpOnly");
    expect(login.headers["set-cookie"]).toContain("SameSite=Strict");
    expect(login.json().sessionToken).toBeUndefined();

    await app.close();
  });

  it("accepts bearer token authentication for APK requests", async () => {
    const app = await buildApp({ databaseFile: ":memory:", uploadDir: "uploads-test" });

    const setup = await app.inject({
      method: "POST",
      url: "/api/auth/setup",
      headers: { "x-zixu-client": "native" },
      payload: { username: "native-user", password: "test-password-123" }
    });
    const token = setup.json().sessionToken;
    expect(token).toBeTruthy();

    const me = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { authorization: `Bearer ${token}` }
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().user.username).toBe("native-user");

    await app.close();
  });

  it("rejects a tampered signed browser cookie", async () => {
    const app = await buildApp({ databaseFile: ":memory:", uploadDir: "uploads-test" });
    const setup = await app.inject({
      method: "POST",
      url: "/api/auth/setup",
      payload: { username: "cookie-user", password: "test-password-123" }
    });
    const setCookie = setup.headers["set-cookie"];
    const raw = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    if (!raw) throw new Error("Expected a cookie.");
    const cookie = raw.split(";")[0];
    const tampered = `${cookie.slice(0, -1)}${cookie.endsWith("a") ? "b" : "a"}`;

    const me = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { cookie: tampered }
    });
    expect(me.statusCode).toBe(401);
    await app.close();
  });

  it("accepts a six-character local password", async () => {
    const app = await buildApp({ databaseFile: ":memory:", uploadDir: "uploads-test" });

    const setup = await app.inject({
      method: "POST",
      url: "/api/auth/setup",
      payload: { username: "legacy-user", password: "123456" }
    });
    expect(setup.statusCode).toBe(200);

    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "legacy-user", password: "123456" }
    });
    expect(login.statusCode).toBe(200);

    await app.close();
  });

  it("uses secure strict cookies with the configured session lifetime", async () => {
    const app = await buildApp({
      databaseFile: ":memory:",
      uploadDir: "uploads-test",
      secureCookies: true,
      sessionTtlHours: 1
    });

    const setup = await app.inject({
      method: "POST",
      url: "/api/auth/setup",
      payload: { username: "secure-user", password: "test-password-123" }
    });
    const setCookie = setup.headers["set-cookie"];
    const cookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Max-Age=3600");

    await app.close();
  });
});

import { describe, expect, it } from "vitest";
import { buildApp } from "../../src/server/app";

describe("auth", () => {
  it("creates a local user and logs in without storing plaintext password", async () => {
    const app = await buildApp({ databaseFile: ":memory:", uploadDir: "uploads-test" });

    const setup = await app.inject({
      method: "POST",
      url: "/api/auth/setup",
      payload: { username: "liang", password: "test-password-123" }
    });
    expect(setup.statusCode).toBe(200);

    const row = await (app as any).db.get(
      "SELECT username, password_hash FROM users WHERE username = ?",
      "liang"
    );
    expect(row.username).toBe("liang");
    expect(row.password_hash).not.toBe("test-password-123");
    expect(row.password_hash).not.toContain("test-password-123");

    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "liang", password: "test-password-123" }
    });
    expect(login.statusCode).toBe(200);
    expect(login.headers["set-cookie"]).toBeTruthy();
    expect(login.json().sessionToken).toBeTruthy();

    await app.close();
  });

  it("accepts bearer token authentication for APK requests", async () => {
    const app = await buildApp({ databaseFile: ":memory:", uploadDir: "uploads-test" });

    const setup = await app.inject({
      method: "POST",
      url: "/api/auth/setup",
      payload: { username: "liang", password: "test-password-123" }
    });
    const token = setup.json().sessionToken;
    expect(token).toBeTruthy();

    const me = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { authorization: `Bearer ${token}` }
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().user.username).toBe("liang");

    await app.close();
  });

  it("accepts a six-character local password", async () => {
    const app = await buildApp({ databaseFile: ":memory:", uploadDir: "uploads-test" });

    const setup = await app.inject({
      method: "POST",
      url: "/api/auth/setup",
      payload: { username: "liang", password: "123456" }
    });
    expect(setup.statusCode).toBe(200);

    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "liang", password: "123456" }
    });
    expect(login.statusCode).toBe(200);

    await app.close();
  });
});

import { describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertServerConfig, type ServerConfig } from "../../src/server/config";
import { buildApp } from "../../src/server/app";

const productionConfig: ServerConfig = {
  port: 8787,
  host: "127.0.0.1",
  databaseFile: "/srv/zixu/data/app.sqlite",
  uploadDir: "/srv/zixu/uploads",
  cookieSecret: "a-production-cookie-secret-with-32-characters",
  allowedOrigins: ["https://zixu.example.com", "capacitor://localhost"],
  photoMaxBytes: 10 * 1024 * 1024,
  secureCookies: true,
  sessionTtlHours: 24 * 30,
  isProduction: true,
  deepseekUserKeysEnabled: false,
  registrationEnabled: false,
  trafficDashboardUrl: null
};

describe("production configuration", () => {
  it("accepts a loopback-only HTTPS reverse-proxy configuration", () => {
    expect(() => assertServerConfig(productionConfig)).not.toThrow();
  });

  it("fails closed for a weak cookie secret or insecure cookies", () => {
    expect(() => assertServerConfig({ ...productionConfig, cookieSecret: "weak" }))
      .toThrow(/COOKIE_SECRET/);
    expect(() => assertServerConfig({ ...productionConfig, secureCookies: false }))
      .toThrow(/SECURE_COOKIES/);
  });

  it("refuses user API keys in the public deployment", () => {
    expect(() => assertServerConfig({ ...productionConfig, deepseekUserKeysEnabled: true }))
      .toThrow(/secrets vault/);
  });

  it("disables the legacy first-user setup endpoint in production", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "zixu-production-config-"));
    const app = await buildApp({
      ...productionConfig,
      databaseFile: join(tempDir, "app.sqlite"),
      uploadDir: join(tempDir, "uploads")
    });
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/setup",
      payload: { username: "admin", password: "strong-password-123" }
    });
    expect(response.statusCode).toBe(404);

    const capabilities = await app.inject({
      method: "GET",
      url: "/api/auth/capabilities"
    });
    expect(capabilities.statusCode).toBe(200);
    expect(capabilities.json()).toEqual({ registrationEnabled: false });

    const registration = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        username: "new-user",
        password: "strong-password-123",
        adultConfirmed: true,
        termsAccepted: true
      }
    });
    expect(registration.statusCode).toBe(404);
    await app.close();
    await rm(tempDir, { recursive: true, force: true });
  });
});

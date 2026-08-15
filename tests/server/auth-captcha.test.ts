import { describe, expect, it } from "vitest";
import { buildApp } from "../../src/server/app";
import { AuthCaptchaService } from "../../src/server/captcha";

describe("authentication captcha", () => {
  it("requires a fresh one-time captcha for registration and login", async () => {
    const app = await buildApp(
      {
        databaseFile: ":memory:",
        uploadDir: "uploads-test",
        registrationEnabled: true,
        authCaptchaEnabled: true
      },
      { captchaCodeFactory: () => "2468" }
    );

    const missing = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: registrationPayload("captcha-user")
    });
    expect(missing.statusCode).toBe(422);

    const first = await issueCaptcha(app);
    const svg = Buffer.from(first.imageDataUrl.split(",", 2)[1], "base64").toString("utf8");
    expect(svg).not.toContain("<text");
    expect(svg).not.toContain("2468");

    const wrong = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { ...registrationPayload("captcha-user"), captchaId: first.id, captchaAnswer: "0000" }
    });
    expect(wrong.statusCode).toBe(422);

    const reused = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { ...registrationPayload("captcha-user"), captchaId: first.id, captchaAnswer: "2468" }
    });
    expect(reused.statusCode).toBe(422);

    const registrationCaptcha = await issueCaptcha(app);
    const registration = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        ...registrationPayload("captcha-user"),
        captchaId: registrationCaptcha.id,
        captchaAnswer: "2468"
      }
    });
    expect(registration.statusCode).toBe(200);

    const loginWithoutCaptcha = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "captcha-user", password: "123456" }
    });
    expect(loginWithoutCaptcha.statusCode).toBe(422);

    const loginCaptcha = await issueCaptcha(app);
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        username: "captcha-user",
        password: "123456",
        captchaId: loginCaptcha.id,
        captchaAnswer: "2468"
      }
    });
    expect(login.statusCode).toBe(200);

    await app.close();
  });

  it("expires challenges and consumes a correct answer only once", () => {
    let now = 1_000;
    const captcha = new AuthCaptchaService({
      now: () => now,
      ttlMs: 1_000,
      codeFactory: () => "1357"
    });
    const first = captcha.issue();
    expect(captcha.verify(first.id, "1357")).toBe(true);
    expect(captcha.verify(first.id, "1357")).toBe(false);

    const expired = captcha.issue();
    now += 1_001;
    expect(captcha.verify(expired.id, "1357")).toBe(false);
  });
});

function registrationPayload(username: string) {
  return {
    username,
    password: "123456",
    adultConfirmed: true,
    termsAccepted: true
  };
}

async function issueCaptcha(app: Awaited<ReturnType<typeof buildApp>>) {
  const response = await app.inject({ method: "POST", url: "/api/auth/captcha" });
  expect(response.statusCode).toBe(200);
  return response.json().captcha as { id: string; imageDataUrl: string; expiresAt: string };
}

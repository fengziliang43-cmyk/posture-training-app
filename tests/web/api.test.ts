import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ApiRequestError,
  DEFAULT_NATIVE_API_BASE_URL,
  describeLoginError,
  describePasswordChangeError,
  describeRegistrationError,
  getAuthCaptcha,
  isRetryableApiError,
  normalizeApiBaseUrl,
  resolveApiBaseUrl
} from "../../src/web/api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("normalizeApiBaseUrl", () => {
  it("keeps an explicit http server URL", () => {
    expect(normalizeApiBaseUrl("http://10.187.35.229:8787/")).toBe(
      "http://10.187.35.229:8787"
    );
  });

  it("adds http when the user only enters host and port", () => {
    expect(normalizeApiBaseUrl("10.187.35.229:8787")).toBe("http://10.187.35.229:8787");
  });

  it("normalizes full-width phone keyboard characters", () => {
    expect(normalizeApiBaseUrl("　ｈｔｔｐ：／／１０．１８７．３５．２２９：８７８７　")).toBe(
      "http://10.187.35.229:8787"
    );
  });
});

describe("resolveApiBaseUrl", () => {
  it("uses the production HTTPS API for a fresh native install", () => {
    expect(resolveApiBaseUrl(null, true)).toBe(DEFAULT_NATIVE_API_BASE_URL);
  });

  it("keeps websites on same-origin requests and ignores stale native overrides", () => {
    expect(resolveApiBaseUrl(null, false)).toBe("");
    expect(resolveApiBaseUrl("https://test.example/", true)).toBe(DEFAULT_NATIVE_API_BASE_URL);
    expect(resolveApiBaseUrl("http://10.0.0.8:8787", true)).toBe(DEFAULT_NATIVE_API_BASE_URL);
  });
});

describe("API retry classification", () => {
  it("only queues network and server failures for retry", () => {
    expect(isRetryableApiError(new ApiRequestError("offline", { retryable: true }))).toBe(true);
    expect(isRetryableApiError(new ApiRequestError("bad request", { status: 400, retryable: false }))).toBe(false);
    expect(isRetryableApiError(new Error("ordinary error"))).toBe(false);
  });
});

describe("authentication captcha client", () => {
  it("sends a JSON body so Fastify accepts the captcha POST", async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined
    });
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      captcha: {
        id: "captcha-id",
        imageDataUrl: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
        expiresAt: "2026-08-15T12:00:00.000Z"
      }
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await getAuthCaptcha();
    expect(response.captcha.id).toBe("captcha-id");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/captcha",
      expect.objectContaining({ method: "POST", body: "{}" })
    );
  });
});

describe("认证错误文案", () => {
  it("turns invalid login credentials into a safe Chinese prompt", () => {
    const error = new ApiRequestError(
      "API 401：invalid credentials；请求地址：https://example.test/api/auth/login",
      { status: 401, retryable: false }
    );

    const message = describeLoginError(error);
    expect(message).toBe("账号或密码不正确，请重新检查后再试。");
    expect(message).not.toMatch(/ApiRequestError|401|invalid credentials|\/api\/auth\/login/);
  });

  it("gives distinct login feedback for rate limits and network failures", () => {
    expect(
      describeLoginError(new ApiRequestError("rate limited", { status: 429, retryable: true }))
    ).toBe("尝试次数过多，请稍后再登录。");
    expect(
      describeLoginError(new ApiRequestError("offline", { retryable: true }))
    ).toBe("登录服务暂时不可用，请检查网络后再试。");
  });

  it("turns registration conflicts and invalid input into actionable prompts", () => {
    expect(
      describeRegistrationError(
        new ApiRequestError("username unavailable", { status: 409, retryable: false })
      )
    ).toBe("账号重复了，请直接登录或换一个账号/邮箱。");
    expect(
      describeRegistrationError(
        new ApiRequestError("invalid registration", { status: 400, retryable: false })
      )
    ).toBe("注册信息不符合要求，请检查账号、至少 6 位密码和确认选项。");
    expect(
      describeRegistrationError(
        new ApiRequestError("captcha invalid", { status: 422, retryable: false })
      )
    ).toBe("验证码不正确或已过期，请重新输入。");
    expect(
      describeLoginError(
        new ApiRequestError("captcha invalid", { status: 422, retryable: false })
      )
    ).toBe("验证码不正确或已过期，请重新输入。");
  });

  it("turns password change failures into safe prompts", () => {
    expect(
      describePasswordChangeError(
        new ApiRequestError("current password incorrect", { status: 403, retryable: false })
      )
    ).toBe("当前密码不正确，请重新输入。");
    expect(
      describePasswordChangeError(
        new ApiRequestError("invalid new password", { status: 400, retryable: false })
      )
    ).toBe("新密码至少 6 位，并且不能与当前密码相同。");
  });
});
